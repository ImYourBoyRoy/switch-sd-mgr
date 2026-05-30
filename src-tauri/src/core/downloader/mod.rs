// ./src-tauri/src/core/downloader/mod.rs
//! Core downloading, github scraping, and local file stream extract mechanisms.
//! Operational Notes: Integrates GitHub API queries, HTML selectors fallback scraping, and Codeberg API clients.
pub mod models;
pub use models::*;

use anyhow::{anyhow, Result};
use chrono::{DateTime, Duration, Utc};
use futures_util::StreamExt;
use reqwest::Client;
use scraper::{Html, Selector};
use std::env;
use std::path::Path;
use sha2::Digest;
use tokio::fs::{self as tfs, File};
use tokio::io::AsyncWriteExt;
use tracing::{info, warn};

pub struct Downloader {
    client: Client,
    _user_agent: String,
}

impl Downloader {
    pub fn new(user_agent: Option<&str>) -> Self {
        let ua = user_agent.unwrap_or("SD_Updater/7.0").to_string();
        let mut headers = reqwest::header::HeaderMap::new();

        if let Ok(token) = env::var("GITHUB_TOKEN")
            && let Ok(val) = reqwest::header::HeaderValue::from_str(&format!("Bearer {}", token))
        {
            headers.insert(reqwest::header::AUTHORIZATION, val);
        }

        Self {
            client: Client::builder()
                .user_agent(&ua)
                .default_headers(headers)
                .build()
                .unwrap(),
            _user_agent: ua,
        }
    }

    pub async fn get_release_metadata(
        &self,
        repo: &str,
        alt_repo: Option<&str>,
        s_type: &str,
        alt_type: Option<&str>,
        prerelease: bool,
    ) -> Result<ReleaseMetadata> {
        // 1. Fetch Primary
        let primary = self.fetch_source(repo, s_type, prerelease).await.ok();

        // 2. Fetch Alt
        let alt = if let Some(a) = alt_repo {
            let a_type = alt_type.unwrap_or("github_release");
            self.fetch_source(a, a_type, prerelease).await.ok()
        } else {
            None
        };

        // 3. Selection Logic (Parity with v6.0 Python)
        match (primary, alt) {
            (Some(p), Some(a)) => Ok(self.compare_metadata(p, a)),
            (Some(p), None) => Ok(p),
            (None, Some(a)) => {
                info!("   [INFO] Primary source failed. Switched to Alt.");
                Ok(a)
            }
            (None, None) => Err(anyhow!(
                "Both primary and alt metadata fetch failed for {}",
                repo
            )),
        }
    }

    async fn fetch_source(
        &self,
        repo: &str,
        s_type: &str,
        prerelease: bool,
    ) -> Result<ReleaseMetadata> {
        match s_type {
            "github_release" => match self.fetch_api(repo, prerelease).await {
                Ok(meta) => Ok(meta),
                Err(e) => {
                    warn!(
                        "   [API] GitHub Failed for {}: {}. Switching to Scraper...",
                        repo, e
                    );
                    self.scrape_github(repo, prerelease).await
                }
            },
            "codeberg_release" => self.fetch_codeberg_api(repo).await,
            "tinfoil_scrape" => self.fetch_tinfoil_metadata().await,
            _ => Err(anyhow!("Unsupported source type: {}", s_type)),
        }
    }

    pub async fn fetch_tinfoil_metadata(&self) -> Result<ReleaseMetadata> {
        use super::tinfoil::TinfoilConnector;
        let connector = TinfoilConnector::new(self.client.clone());
        connector.get_latest_metadata().await
    }

    fn compare_metadata(&self, primary: ReleaseMetadata, alt: ReleaseMetadata) -> ReleaseMetadata {
        let p_date = primary.published_at.unwrap_or(DateTime::<Utc>::MIN_UTC);
        let a_date = alt.published_at.unwrap_or(DateTime::<Utc>::MIN_UTC);

        // Case B/A: Version Comparison (Simplified string-based for now, same as Python reference)
        if alt.tag_name > primary.tag_name {
            info!(
                "   [ALT] Selected Alt Source: Fork Upgrade ({} > {})",
                alt.tag_name, primary.tag_name
            );
            alt
        } else if primary.tag_name > alt.tag_name {
            // Case D: Regression Fix Check
            // "alt_source.date > (source.date + 7 days)"
            if a_date > (p_date + Duration::days(7)) {
                info!("   [ALT] Selected Alt Source: Regression Fix (Alt is newer date)");
                return alt;
            }
            primary
        } else {
            // Case C: Hotfix Check (Versions match)
            // "Is alt_source.date > source.date by more than 24 hours?"
            if a_date > (p_date + Duration::hours(24)) {
                info!("   [ALT] Selected Alt Source: Hotfix (Versions match, Alt is newer > 24h)");
                return alt;
            }
            primary
        }
    }

    async fn fetch_api(&self, repo: &str, prerelease: bool) -> Result<ReleaseMetadata> {
        let url = if prerelease {
            format!("https://api.github.com/repos/{}/releases?per_page=1", repo)
        } else {
            format!("https://api.github.com/repos/{}/releases/latest", repo)
        };

        let res = self.client.get(&url).send().await?;
        if !res.status().is_success() {
            return Err(anyhow!("API Status: {}", res.status()));
        }

        if prerelease {
            let releases: Vec<serde_json::Value> = res.json().await?;
            let latest = releases.first().ok_or(anyhow!("No releases found"))?;
            self.parse_api_json(latest)
        } else {
            let release: serde_json::Value = res.json().await?;
            self.parse_api_json(&release)
        }
    }

    fn parse_api_json(&self, val: &serde_json::Value) -> Result<ReleaseMetadata> {
        let raw_tag = val["tag_name"]
            .as_str()
            .ok_or(anyhow!("Missing tag_name"))?;
        let tag_name = raw_tag
            .trim_matches('"')
            .strip_prefix('v')
            .unwrap_or(raw_tag)
            .to_string();
        let pub_at = val["published_at"]
            .as_str()
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .map(|d| d.with_timezone(&Utc));

        let mut assets = Vec::new();
        let mut seen_names = std::collections::HashSet::new();

        if let Some(arr) = val["assets"].as_array() {
            for a in arr {
                let name = a["name"].as_str().unwrap_or("unknown").to_string();
                let lower_name = name.to_lowercase();
                if seen_names.insert(lower_name) {
                    assets.push(Asset {
                        name,
                        browser_download_url: a["browser_download_url"]
                            .as_str()
                            .unwrap_or("")
                            .to_string(),
                    });
                }
            }
        }

        Ok(ReleaseMetadata {
            tag_name,
            assets,
            published_at: pub_at,
        })
    }

    pub async fn scrape_github(&self, repo: &str, prerelease: bool) -> Result<ReleaseMetadata> {
        let base_url = format!("https://github.com/{}", repo);
        let target_url = if prerelease {
            format!("{}/releases", base_url)
        } else {
            format!("{}/releases/latest", base_url)
        };

        let res_text = self.client.get(&target_url).send().await?.text().await?;

        let (tag_name, published_at, mut assets, mut seen_urls, fragments, _) = {
            let document = Html::parse_document(&res_text);

            let tag_selector = Selector::parse("h1.d-inline").unwrap();
            let date_selector = Selector::parse("relative-time").unwrap();
            let link_selector = Selector::parse("a[href*='/releases/download/']").unwrap();
            let fragment_selector = Selector::parse("include-fragment").unwrap();

            let mut tag_name = String::from("unknown");
            if let Some(el) = document.select(&tag_selector).next() {
                tag_name = el.text().collect::<String>().trim().to_string();
            }

            let published_at = document
                .select(&date_selector)
                .next()
                .and_then(|el| el.value().attr("datetime"))
                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                .map(|d| d.with_timezone(&Utc));

            let mut assets = Vec::new();
            let mut seen_urls = std::collections::HashSet::new();
            let mut pinned_tag: Option<String> = None;

            for el in document.select(&link_selector) {
                if let Some(href) = el.value().attr("href") {
                    // Extract Tag from /user/repo/releases/download/TAG/file
                    let parts: Vec<&str> = href.split('/').collect();
                    let current_tag = if let Some(idx) = parts.iter().position(|&p| p == "download")
                    {
                        parts.get(idx + 1).map(|&t| t.to_string())
                    } else {
                        None
                    };

                    // Deep Parity: Version Pinning
                    if pinned_tag.is_none() {
                        pinned_tag = current_tag.clone();
                    } else if current_tag != pinned_tag {
                        continue; // Skip assets from other releases on same page
                    }

                    let full_url = format!("https://github.com{}", href);
                    let name = href.split('/').next_back().unwrap_or("unknown").to_string();
                    if seen_urls.insert(full_url.clone()) {
                        assets.push(Asset {
                            name,
                            browser_download_url: full_url,
                        });
                    }
                }
            }

            let fragments: Vec<String> = document
                .select(&fragment_selector)
                .filter_map(|frag| frag.value().attr("src"))
                .filter(|src| src.contains("/releases/expanded_assets/"))
                .map(|src| format!("https://github.com{}", src))
                .collect();

            (
                tag_name,
                published_at,
                assets,
                seen_urls,
                fragments,
                pinned_tag,
            )
        };

        // 2. Fragment Logic (Expanded Assets)
        if assets.is_empty() {
            for frag_url in fragments {
                // Deep Parity: Retry Logic for Fragments
                let mut success = false;
                for attempt in 0..3 {
                    if let Ok(fr_res) = self.client.get(&frag_url).send().await {
                        if !fr_res.status().is_success() {
                            warn!(
                                "   [Scrape] Fragment attempt {} failed: {}",
                                attempt + 1,
                                fr_res.status()
                            );
                            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                            continue;
                        }

                        if let Ok(fr_text) = fr_res.text().await {
                            let frag_assets = {
                                let fdoc = Html::parse_document(&fr_text);
                                let link_selector =
                                    Selector::parse("a[href*='/releases/download/']").unwrap();
                                let mut extracted = Vec::new();
                                let mut first_frag_tag = None;

                                for el in fdoc.select(&link_selector) {
                                    if let Some(href) = el.value().attr("href") {
                                        let parts: Vec<&str> = href.split('/').collect();
                                        let current_tag = if let Some(idx) =
                                            parts.iter().position(|&p| p == "download")
                                        {
                                            parts.get(idx + 1).map(|&t| t.to_string())
                                        } else {
                                            None
                                        };

                                        if first_frag_tag.is_none() {
                                            first_frag_tag = current_tag.clone();
                                        } else if current_tag != first_frag_tag {
                                            continue;
                                        }

                                        let full_url = format!("https://github.com{}", href);
                                        let name =
                                            href.split('/').next_back().unwrap_or("unknown").to_string();
                                        extracted.push((full_url, name));
                                    }
                                }
                                extracted
                            };

                            for (full_url, name) in frag_assets {
                                if seen_urls.insert(full_url.clone()) {
                                    assets.push(Asset {
                                        name,
                                        browser_download_url: full_url,
                                    });
                                }
                            }
                            success = true;
                            break;
                        }
                    }
                }
                if success {
                    break;
                } // Parity: Stop after first successful fragment
            }
        }

        if assets.is_empty() {
            warn!(
                "   [Scrape] No assets found for {}. Root fragment might be needed.",
                repo
            );
        }

        let final_tag = if tag_name != "unknown" {
            tag_name
                .trim_matches('"')
                .strip_prefix('v')
                .unwrap_or(&tag_name)
                .to_string()
        } else {
            tag_name
        };

        Ok(ReleaseMetadata {
            tag_name: final_tag,
            assets,
            published_at,
        })
    }

    async fn fetch_codeberg_api(&self, repo: &str) -> Result<ReleaseMetadata> {
        let url = format!("https://codeberg.org/api/v1/repos/{}/releases", repo);
        let res = self.client.get(&url).send().await?;
        if !res.status().is_success() {
            return Err(anyhow!("Codeberg API Status: {}", res.status()));
        }

        let releases: Vec<serde_json::Value> = res.json().await?;
        let latest = releases
            .first()
            .ok_or(anyhow!("No releases found on Codeberg"))?;

        let raw_tag = latest["tag_name"]
            .as_str()
            .ok_or(anyhow!("Missing tag_name"))?;
        let tag_name = raw_tag
            .trim_matches('"')
            .strip_prefix('v')
            .unwrap_or(raw_tag)
            .to_string();
        let pub_at = latest["published_at"]
            .as_str()
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .map(|d| d.with_timezone(&Utc));

        let mut assets = Vec::new();
        let mut seen_names = std::collections::HashSet::new();

        if let Some(arr) = latest["assets"].as_array() {
            for a in arr {
                let name = a["name"].as_str().unwrap_or("unknown").to_string();
                let lower_name = name.to_lowercase();
                if seen_names.insert(lower_name) {
                    assets.push(Asset {
                        name,
                        browser_download_url: a["browser_download_url"]
                            .as_str()
                            .unwrap_or("")
                            .to_string(),
                    });
                }
            }
        }

        Ok(ReleaseMetadata {
            tag_name,
            assets,
            published_at: pub_at,
        })
    }

    pub async fn download_file(&self, url: &str, dest: &Path) -> Result<String> {
        let res = self.client.get(url).send().await?;
        if !res.status().is_success() {
            return Err(anyhow!("Download failed: {}", res.status()));
        }

        // Parity: Reject HTML content if expecting a binary/zip
        let content_type = res
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        if content_type.contains("text/html") {
            let ext = dest.extension().and_then(|e| e.to_str()).unwrap_or("");
            if matches!(ext, "zip" | "nro" | "bin" | "ovl") {
                return Err(anyhow!(
                    "Rejected HTML content for binary download: {}",
                    url
                ));
            }
        }

        if let Some(parent) = dest.parent() {
            tfs::create_dir_all(parent).await?;
        }

        let mut file = File::create(dest).await?;
        let mut hasher = sha2::Sha256::new();
        let mut stream = res.bytes_stream();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| anyhow!("Stream error: {}", e))?;
            file.write_all(&chunk)
                .await
                .map_err(|e| anyhow!("File write error: {}", e))?;
            sha2::Digest::update(&mut hasher, &chunk);
        }

        // Parity: Race-Condition Protection (Wait for AV and Flush)
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;

        Ok(hex::encode(sha2::Digest::finalize(hasher)))
    }
}
