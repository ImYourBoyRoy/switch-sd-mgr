// ./src-tauri/src/core/downloader/models.rs
/// Data models representing Switch SD packages, update sources, release assets, and metadata.
/// Operational Notes: Included as a sub-module of the core downloader engine.

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SourceDescriptor {
    #[serde(rename = "type")]
    pub kind: String,
    pub repo: Option<String>,
    pub prerelease: Option<bool>,
    pub blacklist: Option<Vec<String>>,
    pub use_if_newer_date: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Source {
    pub id: String,
    pub name: String,
    pub source: Option<SourceDescriptor>,
    pub alt_source: Option<SourceDescriptor>,
    // Legacy support or flat fields
    pub github_repo: Option<String>,
    pub alt_github_repo: Option<String>,
    pub category: Option<String>,
    pub description: Option<String>,
    pub tinfoil: Option<bool>,
    pub prerelease: Option<bool>,
    pub blacklist: Option<Vec<String>>,
    pub payload_info: Option<crate::core::payload::PayloadInfo>,
    pub install_dir: Option<String>,
    pub install_phase: Option<String>,
    pub install_priority: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Asset {
    pub name: String,
    pub browser_download_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReleaseMetadata {
    pub tag_name: String,
    pub assets: Vec<Asset>,
    pub published_at: Option<DateTime<Utc>>,
}
