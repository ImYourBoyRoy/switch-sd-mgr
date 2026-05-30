use super::downloader::{Asset, ReleaseMetadata};
use anyhow::{anyhow, Result};
use reqwest::Client;
use scraper::{Html, Selector};

pub struct TinfoilConnector {
    client: Client,
}

impl TinfoilConnector {
    pub fn new(client: Client) -> Self {
        Self { client }
    }

    pub async fn get_latest_metadata(&self) -> Result<ReleaseMetadata> {
        let base_url = "https://tinfoil.media";
        let download_page = "/Download";

        let res = self
            .client
            .get(format!("{}{}", base_url, download_page))
            .send()
            .await?;
        let text = res.text().await?;
        let mut download_url = String::new();
        {
            let document = Html::parse_document(&text);

            // Match Python: ul.downloads a[href*="Self%20Installer"][href$=".zip"]
            let selector =
                Selector::parse("ul.downloads a[href*='Self%20Installer'][href$='.zip']")
                    .map_err(|_| anyhow!("Invalid selector"))?;

            if let Some(link) = document.select(&selector).next() {
                if let Some(href) = link.value().attr("href") {
                    download_url = if href.starts_with("/") {
                        format!("{}{}", base_url, href)
                    } else if href.starts_with("//") {
                        format!("https:{}", href)
                    } else {
                        href.to_string()
                    };
                }
            }
        }

        if download_url.is_empty() {
            return Err(anyhow!("Tinfoil Self Installer link not found"));
        }

        // Get ETag/Last-Modified for versioning parity
        let head = self.client.head(&download_url).send().await?;
        let etag = head
            .headers()
            .get("ETag")
            .or_else(|| head.headers().get("Last-Modified"))
            .and_then(|v| v.to_str().ok())
            .unwrap_or("latest")
            .replace("\"", "");

        Ok(ReleaseMetadata {
            tag_name: etag,
            assets: vec![Asset {
                name: "tinfoil.zip".to_string(),
                browser_download_url: download_url,
            }],
            published_at: None,
        })
    }
}
