// src-tauri/src/core/nro_scanner.rs
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NroMetadata {
    pub title: String,
    pub author: String,
    pub version: String,
    pub icon_path: Option<String>,
    pub mtime: u64,
}

pub struct NroScanner {
    sd_root: PathBuf,
    cache_file: PathBuf,
    icon_dir: PathBuf,
    cache: HashMap<String, NroMetadata>,
}

impl NroScanner {
    pub fn new(sd_root: PathBuf, cache_file: PathBuf, icon_dir: PathBuf) -> Self {
        let _ = fs::create_dir_all(&icon_dir);
        if let Some(parent) = cache_file.parent() { let _ = fs::create_dir_all(parent); }
        let mut cache = HashMap::new();
        if cache_file.exists() {
            if let Ok(content) = fs::read_to_string(&cache_file) {
                if let Ok(data) = serde_json::from_str(&content) {
                    cache = data;
                }
            }
        }
        Self { sd_root, cache_file, icon_dir, cache }
    }

    pub fn scan_all(&mut self) -> Result<usize> {
        let mut updated_count = 0;
        let mut current_paths = Vec::new();
        if !self.sd_root.exists() { return Ok(0); }

        for entry in walkdir::WalkDir::new(&self.sd_root).into_iter().filter_map(|e| e.ok()).filter(|e| e.file_type().is_file()) {
            let path = entry.path();
            let ext = path.extension().and_then(|s| s.to_str()).unwrap_or_default().to_lowercase();
            if ext != "nro" && ext != "ovl" { continue; }
            let rel_path = path.strip_prefix(&self.sd_root)?.to_string_lossy().to_string().replace("\\", "/");
            current_paths.push(rel_path.clone());
            let mtime = entry.metadata()?.modified()?.duration_since(std::time::UNIX_EPOCH)?.as_secs();
            if let Some(cached) = self.cache.get(&rel_path) { if cached.mtime == mtime { continue; } }
            if let Ok(meta) = self.parse_nro(path, &rel_path) {
                let mut meta_with_time = meta;
                meta_with_time.mtime = mtime;
                self.cache.insert(rel_path, meta_with_time);
                updated_count += 1;
            }
        }
        self.cache.retain(|k, _| current_paths.contains(k));
        if updated_count > 0 { self.save_cache()?; }
        Ok(updated_count)
    }

    pub fn get_all_metadata(&self) -> &HashMap<String, NroMetadata> { &self.cache }

    fn parse_nro(&self, file_path: &Path, rel_path: &str) -> Result<NroMetadata> {
        let mut f = File::open(file_path)?;
        let mut header = [0u8; 0x80];
        f.read_exact(&mut header)?;
        if &header[0x10..0x14] != b"NRO0" { return Err(anyhow!("Invalid NRO magic")); }
        let size = u32::from_le_bytes(header[0x18..0x1C].try_into()?) as u64;
        f.seek(SeekFrom::Start(size))?;
        let mut aset_header = [0u8; 0x38];
        if f.read_exact(&mut aset_header).is_err() { return Err(anyhow!("Truncated NRO (no ASET)")); }
        if &aset_header[0..4] != b"ASET" { return Err(anyhow!("Invalid ASET magic")); }
        let icon_off = u64::from_le_bytes(aset_header[0x08..0x10].try_into()?);
        let icon_sz = u64::from_le_bytes(aset_header[0x10..0x18].try_into()?);
        let nacp_off = u64::from_le_bytes(aset_header[0x18..0x20].try_into()?);
        let nacp_sz = u64::from_le_bytes(aset_header[0x20..0x28].try_into()?);
        let mut meta = NroMetadata { title: file_path.file_stem().unwrap_or_default().to_string_lossy().to_string(), author: "Unknown".to_string(), version: "1.0.0".to_string(), icon_path: None, mtime: 0 };
        if icon_sz > 0 {
            f.seek(SeekFrom::Start(size + icon_off))?;
            let mut icon_data = vec![0u8; icon_sz as usize];
            f.read_exact(&mut icon_data)?;
            let ext = if icon_data.starts_with(b"\x89PNG\r\n\x1a\n") { "png" } else { "jpg" };
            let safe_name = rel_path.replace("/", "_").replace(".", "_");
            let icon_file = format!("{}.{}", safe_name, ext);
            let dest = self.icon_dir.join(&icon_file);
            if fs::write(&dest, icon_data).is_ok() { meta.icon_path = Some(icon_file); }
        }
        if nacp_sz > 0 {
            f.seek(SeekFrom::Start(size + nacp_off))?;
            let mut nacp_data = vec![0u8; nacp_sz as usize];
            f.read_exact(&mut nacp_data)?;
            for i in 0..16 {
                let start = i * 0x300;
                if start + 0x300 > nacp_data.len() { break; }
                let entry = &nacp_data[start..start + 0x300];
                let name_bytes = entry[0..0x200].split(|&b| b == 0).next().unwrap_or(&[]);
                let author_bytes = entry[0x200..0x300].split(|&b| b == 0).next().unwrap_or(&[]);
                let name = String::from_utf8_lossy(name_bytes).trim().to_string();
                let author = String::from_utf8_lossy(author_bytes).trim().to_string();
                if !name.is_empty() { meta.title = name; meta.author = author; break; }
            }
            if nacp_data.len() >= 0x3070 {
                let ver_bytes = nacp_data[0x3060..0x3070].split(|&b| b == 0).next().unwrap_or(&[]);
                let ver = String::from_utf8_lossy(ver_bytes).trim().to_string();
                if !ver.is_empty() { meta.version = ver; }
            }
        }
        Ok(meta)
    }

    fn save_cache(&self) -> Result<()> {
        let content = serde_json::to_string_pretty(&self.cache)?;
        fs::write(&self.cache_file, content)?;
        Ok(())
    }
}
