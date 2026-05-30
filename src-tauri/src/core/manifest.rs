// src-tauri/src/core/manifest.rs
use anyhow::Result;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ManifestEntry {
    pub version: String,
    pub updated_at: String,
    pub hash: Option<String>,
    pub files: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Manifest {
    #[serde(flatten)]
    pub entries: HashMap<String, ManifestEntry>,
}

pub struct ManifestManager {
    path: PathBuf,
    pub data: Manifest,
}

impl ManifestManager {
    pub fn new(path: PathBuf) -> Self {
        let data = if path.exists() {
            let content = fs::read_to_string(&path).unwrap_or_else(|_| "{}".to_string());
            serde_json::from_str(&content).unwrap_or(Manifest {
                entries: HashMap::new(),
            })
        } else {
            Manifest {
                entries: HashMap::new(),
            }
        };

        Self { path, data }
    }

    pub fn save(&self) -> Result<()> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(&self.data)?;
        fs::write(&self.path, content)?;
        Ok(())
    }

    pub fn should_update(&self, id: &str, remote_version: &str, remote_hash: Option<&str>) -> bool {
        let entry = match self.data.entries.get(id) {
            Some(e) => e,
            None => return true,
        };

        if let Some(h) = remote_hash {
            if entry.hash.as_deref() != Some(h) {
                return true;
            }
        }

        let local_ver =
            urlencoding::decode(&entry.version).unwrap_or(entry.version.as_str().into());
        let remote_ver_decoded =
            urlencoding::decode(remote_version).unwrap_or(remote_version.into());

        local_ver != remote_ver_decoded
    }

    pub fn update_entry(
        &mut self,
        id: String,
        version: String,
        files: Vec<PathBuf>,
        hash: Option<String>,
    ) {
        let entry = ManifestEntry {
            version,
            updated_at: Utc::now().to_rfc3339(),
            hash,
            files: files
                .into_iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect(),
        };
        self.data.entries.insert(id, entry);
        let _ = self.save();
    }

    pub fn get_files(&self, id: &str) -> Vec<PathBuf> {
        self.data
            .entries
            .get(id)
            .map(|e| e.files.iter().map(PathBuf::from).collect())
            .unwrap_or_default()
    }
}
