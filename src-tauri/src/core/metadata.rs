// src-tauri/src/core/metadata.rs
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NroMetadata {
    pub title: String,
    pub author: String,
    pub version: String,
    pub icon_path: Option<String>,
}

pub struct MetadataScanner;

impl MetadataScanner {
    pub fn parse_nro(path: &Path) -> Result<NroMetadata> {
        let mut file = File::open(path)?;
        let mut buffer = vec![0u8; 0x10000]; // Read a good chunk
        file.read_exact(&mut buffer)?;

        if buffer.len() < 0x80 {
            return Err(anyhow!("File too small"));
        }

        // NRO0 Magic at 0x10
        if &buffer[0x10..0x14] != b"NRO0" {
            return Err(anyhow!("Invalid NRO magic"));
        }

        // Get ASET offset from NRO header (at 0x14 size)
        let nro_size = u32::from_le_bytes(buffer[0x14..0x18].try_into()?) as u64;

        // Seek to ASET
        file.seek(SeekFrom::Start(nro_size))?;
        let mut aset_header = [0u8; 0x40];
        file.read_exact(&mut aset_header)?;

        if &aset_header[0..4] != b"ASET" {
            return Err(anyhow!("ASET header not found at offset 0x{:x}", nro_size));
        }

        // ASET format:
        // 0x0..0x4: ASET
        // 0x8..0x10: Icon Offset + Size
        // 0x18..0x20: NACP Offset + Size
        let nacp_off = u64::from_le_bytes(aset_header[0x18..0x20].try_into()?);
        let nacp_size = u64::from_le_bytes(aset_header[0x20..0x28].try_into()?);

        file.seek(SeekFrom::Start(nro_size + nacp_off))?;
        let mut nacp_data = vec![0u8; nacp_size as usize];
        file.read_exact(&mut nacp_data)?;

        // NACP contains many languages, we'll take English (index 1) or first valid
        let mut title = String::from("Unknown");
        let mut author = String::from("Unknown");
        let mut version = String::from("");

        for i in 0..16 {
            let offset = i * 0x300;
            if offset + 0x300 > nacp_data.len() {
                break;
            }

            let name_bytes = &nacp_data[offset..offset + 0x200];
            let author_bytes = &nacp_data[offset + 0x200..offset + 0x300];

            let name = String::from_utf8_lossy(name_bytes)
                .trim_matches('\0')
                .to_string();
            let publ = String::from_utf8_lossy(author_bytes)
                .trim_matches('\0')
                .to_string();

            if !name.is_empty() {
                title = name;
                author = publ;
                break;
            }
        }

        // Version is at 0x3060
        if nacp_data.len() >= 0x3070 {
            version = String::from_utf8_lossy(&nacp_data[0x3060..0x3070])
                .trim_matches('\0')
                .to_string();
        }

        Ok(NroMetadata {
            title,
            author,
            version,
            icon_path: None, // Icon extraction is more complex, implement later if needed
        })
    }
}
