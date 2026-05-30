// src-tauri/src/core/archive.rs
use super::utils;
use anyhow::Result;
use std::fs::{self, File};
use std::io;
use std::path::{Path, PathBuf};
use tracing::warn;
use zip::ZipArchive;

pub struct ArchiveHandler {
    valid_tops: Vec<String>,
    global_blacklist: Vec<String>,
    allowed_root_exts: Vec<String>,
    skip_root_stems: Vec<String>,
}

impl ArchiveHandler {
    pub fn new(
        valid_tops: Vec<String>,
        global_blacklist: Vec<String>,
        allowed_root_exts: Vec<String>,
        skip_root_stems: Vec<String>,
    ) -> Self {
        Self {
            valid_tops,
            global_blacklist,
            allowed_root_exts,
            skip_root_stems,
        }
    }

    pub fn extract_zip(
        &self,
        zip_path: &Path,
        dest_dir: &Path,
        blacklist: &[String],
    ) -> Result<Vec<PathBuf>> {
        let file = File::open(zip_path)?;
        let mut archive = ZipArchive::new(file)?;
        let mut written_files = Vec::new();

        // 1. Detect Wrapper Folder
        let mut wrapper_folder: Option<String> = None;
        let mut all_in_wrapper = true;

        // Peek first entry to see if it's a candidate
        if archive.len() > 0 {
            let first = archive.by_index(0)?;
            let parts: Vec<&str> = first.name().split('/').collect();
            if parts.len() > 1 {
                let candidate = parts[0].to_string();
                if !self.valid_tops.contains(&candidate) {
                    wrapper_folder = Some(candidate);
                }
            }
        }

        if let Some(prefix) = &wrapper_folder {
            for i in 0..archive.len() {
                let entry = archive.by_index(i)?;
                if !entry.name().starts_with(&(prefix.to_owned() + "/")) {
                    all_in_wrapper = false;
                    break;
                }
            }
        } else {
            all_in_wrapper = false;
        }

        // 2. Extract
        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            if file.is_dir() {
                continue;
            }

            let name = file.name();
            let lower_name = name.to_lowercase();

            // Filter logic (MacOS crap + Source Blacklist + Global Blacklist)
            if name.starts_with("__MACOSX") {
                continue;
            }

            let is_blacklisted = blacklist
                .iter()
                .any(|b| wildmatch::WildMatch::new(&b.to_lowercase()).matches(&lower_name))
                || self
                    .global_blacklist
                    .iter()
                    .any(|b| wildmatch::WildMatch::new(&b.to_lowercase()).matches(&lower_name));

            if is_blacklisted {
                continue;
            }

            let rel_path = if all_in_wrapper {
                &name[wrapper_folder.as_ref().unwrap().len() + 1..]
            } else {
                name
            };

            if rel_path.is_empty() {
                continue;
            }

            // Parity Check: Root-level restrictions
            let rel_path_buf = PathBuf::from(rel_path);
            let is_root = rel_path_buf
                .parent()
                .map(|p| p.as_os_str().is_empty())
                .unwrap_or(true);

            if is_root {
                let stem = rel_path_buf
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                let ext = rel_path_buf
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| format!(".{}", e))
                    .unwrap_or_default()
                    .to_lowercase();

                // 1. Skip stems (e.g., readme, license)
                if self
                    .skip_root_stems
                    .iter()
                    .any(|s| s.to_lowercase() == stem)
                {
                    continue;
                }

                // 2. Enforce allowed extensions (if list is non-empty)
                if !self.allowed_root_exts.is_empty() {
                    if !self
                        .allowed_root_exts
                        .iter()
                        .any(|e| e.to_lowercase() == ext)
                    {
                        continue;
                    }
                }
            }

            let outpath = dest_dir.join(rel_path);

            // Zip Slip Protection
            if !outpath.starts_with(dest_dir) {
                warn!("   [BLOCKED] Zip Slip attempt: {}", name);
                continue;
            }

            if let Some(p) = outpath.parent() {
                fs::create_dir_all(p)?;
            }

            let mut outfile = File::create(&outpath)?;
            io::copy(&mut file, &mut outfile)?;
            written_files.push(outpath);
        }

        Ok(written_files)
    }

    pub fn install_single_file(
        &self,
        src: &Path,
        dest_dir: &Path,
        new_name: Option<&str>,
    ) -> Result<PathBuf> {
        fs::create_dir_all(dest_dir)?;
        let final_path =
            dest_dir.join(new_name.unwrap_or(src.file_name().unwrap().to_str().unwrap()));

        utils::retry_op(
            || fs::copy(src, &final_path),
            5,
            std::time::Duration::from_millis(1000),
        )?;

        Ok(final_path)
    }

    pub fn surgical_wipe(&self, files: Vec<PathBuf>) {
        for f in files {
            if f.exists() && f.is_file() {
                let _ = utils::safe_delete(&f);
                // Attempt to remove empty parents (optional)
                let mut p = f.parent();
                while let Some(parent) = p {
                    if parent.exists() && parent.is_dir() {
                        if let Ok(entries) = fs::read_dir(parent) {
                            if entries.count() == 0 {
                                let _ = fs::remove_dir(parent);
                                p = parent.parent();
                            } else {
                                break;
                            }
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
    }
}
