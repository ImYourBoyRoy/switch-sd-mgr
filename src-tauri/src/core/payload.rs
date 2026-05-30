// src-tauri/src/core/payload.rs
use anyhow::Result;
use std::fs;
use std::path::{Path, PathBuf};
// use tracing::{info, warn}; removed unused
use super::utils;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PayloadInfo {
    pub folder: String,
    pub pattern: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PayloadOutputSettings {
    pub enabled: bool,
    pub naming_template: String,
}

impl Default for PayloadOutputSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            naming_template: "{folder}/payload.bin".to_string(),
        }
    }
}

pub struct PayloadManager {
    sd_root: PathBuf,
    output_root: PathBuf,
    settings: PayloadOutputSettings,
}

impl PayloadManager {
    pub fn new(sd_root: PathBuf, output_root: PathBuf, settings: PayloadOutputSettings) -> Self {
        Self {
            sd_root,
            output_root,
            settings,
        }
    }

    pub fn process_file(
        &self,
        file_path: &Path,
        payload_info: Option<&PayloadInfo>,
    ) -> Vec<PathBuf> {
        let mut created = Vec::new();

        let path_str = file_path.to_string_lossy().to_lowercase();
        let file_name = file_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let ext = file_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or_default()
            .to_lowercase();

        // 1. Global .bin Mirror (sd/bootloader/payloads)
        if ext == "bin" {
            // Fail-safe: Don't mirror if deep inside switch/ folder
            if path_str.contains("/switch/") && !path_str.contains("/payloads/") {
                return created;
            }

            let is_system =
                path_str.contains("bootloader/sys") || path_str.contains("bootloader/res");
            let is_updater = file_name.to_lowercase() == "update.bin";

            if !is_system && !is_updater {
                let dest = self.sd_root.join("bootloader/payloads").join(&file_name);
                if let Ok(p) = self.safe_copy(file_path, &dest) {
                    created.push(p);
                }
            }
        }

        // 2. Optional Boot Bin Mirror
        if self.settings.enabled
            && let Some(info) = payload_info
        {
            let destination = self.render_output_path(info, &file_name);

            // RCMLoader Case-Insensitive Pattern Matching (Parity with Python fnmatch)
            let mut matched = wildmatch::WildMatch::new(&info.pattern.to_lowercase())
                .matches(&file_name.to_lowercase());

            // Special case for Atmosphere (Legacy compatibility)
            if !matched
                && info.folder == "ATMOSPHERE"
                && file_name.to_lowercase() == "fusee.bin"
            {
                matched = true;
            }

            if matched
                && let Ok(path) = self.safe_copy(file_path, &destination)
            {
                created.push(path);
            }
        }

        created
    }

    fn render_output_path(&self, info: &PayloadInfo, file_name: &str) -> PathBuf {
        let file_stem = Path::new(file_name)
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or(file_name);
        let rendered = self
            .settings
            .naming_template
            .replace("{folder}", &info.folder)
            .replace("{file_name}", file_name)
            .replace("{file_stem}", file_stem)
            .replace('\\', "/");
        let relative = rendered.trim_start_matches('/');
        self.output_root.join(relative)
    }

    fn safe_copy(&self, src: &Path, dest: &Path) -> Result<PathBuf> {
        if src == dest {
            return Ok(dest.to_path_buf());
        }
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)?;
        }
        utils::retry_op(
            || fs::copy(src, dest),
            5,
            std::time::Duration::from_millis(1000),
        )?;
        Ok(dest.to_path_buf())
    }
}
