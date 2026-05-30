// ./src-tauri/src/commands/utilities.rs
//! Domain-specific controller for Switch environment manager utility commands.
//! Operational Notes: Included as a sub-module of the tauri command router.
use crate::*;
use std::fs::File;
use std::io::{Read, Write};
use std::path::PathBuf;
use serde::Serialize;
use sha2::{Digest, Sha256};

#[derive(Serialize)]
pub struct DnsStatus {
    pub static_default_blocked: bool,
    pub static_emummc_blocked: bool,
    pub live_pc_blocked: bool,
    pub checked_domains: Vec<String>,
}

#[derive(Serialize)]
pub struct BenchmarkResult {
    pub write_speed_mbs: f64,
    pub read_speed_mbs: f64,
    pub integrity_passed: bool,
    pub test_file_path: String,
    pub error: Option<String>,
}

#[derive(Serialize)]
pub struct BiosStatus {
    pub name: String,
    pub console: String,
    pub found: bool,
    pub hash_valid: bool,
    pub expected_hash: String,
    pub actual_hash: String,
}

#[tauri::command]
pub async fn cmd_write_bootlogo(state: tauri::State<'_, AppState>, pixels_rgba: Vec<u8>) -> Result<String, String> {
    if pixels_rgba.len() != 720 * 1280 * 4 {
        return Err(format!("Incorrect pixel buffer length. Expected {}, got {}", 720 * 1280 * 4, pixels_rgba.len()));
    }

    let cm = state.config_mgr.lock().unwrap();
    let sd_root = &cm.sd_root;
    let bootloader_dir = sd_root.join("bootlogo").parent().unwrap_or(sd_root).join("bootloader");
    
    std::fs::create_dir_all(&bootloader_dir)
        .map_err(|e| format!("Failed to create bootloader folder: {}", e))?;
        
    let bmp_path = bootloader_dir.join("bootlogo.bmp");

    // 1. Build the 54-byte BMP Header for 720x1280 32-bit uncompressed BGRA
    let pixel_data_size = 720 * 1280 * 4;
    let file_size = 54 + pixel_data_size;
    let mut header = [0u8; 54];

    // File Header (14 bytes)
    header[0] = b'B';
    header[1] = b'M';
    header[2..6].copy_from_slice(&(file_size as u32).to_le_bytes());
    header[10..14].copy_from_slice(&54u32.to_le_bytes());

    // DIB Header (40 bytes - BITMAPINFOHEADER)
    header[14..18].copy_from_slice(&40u32.to_le_bytes());
    header[18..22].copy_from_slice(&720i32.to_le_bytes());
    header[22..26].copy_from_slice(&1280i32.to_le_bytes());
    header[26..28].copy_from_slice(&1u16.to_le_bytes());
    header[28..30].copy_from_slice(&32u16.to_le_bytes());
    header[30..34].copy_from_slice(&0u32.to_le_bytes()); // BI_RGB (uncompressed)
    header[34..38].copy_from_slice(&(pixel_data_size as u32).to_le_bytes());
    header[38..42].copy_from_slice(&2835i32.to_le_bytes()); // 72 DPI
    header[42..46].copy_from_slice(&2835i32.to_le_bytes()); // 72 DPI

    // 2. Convert RGBA to BGRA and flip bottom-to-top as required by standard BMP files
    let mut bmp_pixels = vec![0u8; pixel_data_size];
    for y in 0..1280 {
        let src_y = 1279 - y; // Flip vertical
        for x in 0..720 {
            let src_idx = (src_y * 720 + x) * 4;
            let dest_idx = (y * 720 + x) * 4;
            
            bmp_pixels[dest_idx] = pixels_rgba[src_idx + 2];     // B
            bmp_pixels[dest_idx + 1] = pixels_rgba[src_idx + 1]; // G
            bmp_pixels[dest_idx + 2] = pixels_rgba[src_idx];     // R
            bmp_pixels[dest_idx + 3] = pixels_rgba[src_idx + 3]; // A
        }
    }

    // 3. Write file
    let mut file = File::create(&bmp_path)
        .map_err(|e| format!("Failed to create BMP file: {}", e))?;
        
    file.write_all(&header)
        .map_err(|e| format!("Failed to write BMP header: {}", e))?;
    file.write_all(&bmp_pixels)
        .map_err(|e| format!("Failed to write BMP pixels: {}", e))?;

    Ok(format!("Successfully converted and saved custom bootlogo to {}", bmp_path.to_string_lossy()))
}

#[tauri::command]
pub async fn cmd_test_telemetry_blocks(state: tauri::State<'_, AppState>) -> Result<DnsStatus, String> {
    let cm = state.config_mgr.lock().unwrap();
    let sd_root = &cm.sd_root;
    
    let default_hosts_path = sd_root.join("atmosphere/hosts/default.txt");
    let emummc_hosts_path = sd_root.join("atmosphere/hosts/emummc.txt");
    
    let domains_to_check = vec![
        "conntest.nintendowifi.net".to_string(),
        "receive-lp1.dg.srv.nintendo.net".to_string(),
        "receive-lp1.erpt.srv.nintendo.net".to_string(),
    ];

    // Static check default hosts
    let static_default_blocked = check_hosts_file_blocked(&default_hosts_path, &domains_to_check);
    
    // Static check emuMMC hosts
    let static_emummc_blocked = check_hosts_file_blocked(&emummc_hosts_path, &domains_to_check);

    // Live PC network DNS block test
    let live_pc_blocked = check_live_dns_blocked(&domains_to_check);

    Ok(DnsStatus {
        static_default_blocked,
        static_emummc_blocked,
        live_pc_blocked,
        checked_domains: domains_to_check,
    })
}

#[tauri::command]
pub async fn cmd_benchmark_storage(state: tauri::State<'_, AppState>) -> Result<BenchmarkResult, String> {
    let cm = state.config_mgr.lock().unwrap();
    let sd_root = cm.sd_root.clone();
    
    if !sd_root.exists() {
        return Err("SD Card directory is not connected or missing.".to_string());
    }

    let test_file_path = sd_root.join(".sd_speedtest.tmp");
    let test_size_bytes = 20 * 1024 * 1024; // 20 MB test is quick and diagnostic

    // Generate random mock data
    let mut write_data = vec![0u8; test_size_bytes];
    for (i, byte) in write_data.iter_mut().enumerate() {
        *byte = (i % 256) as u8;
    }
    
    // Hash original data for integrity check
    let original_hash = hash_bytes(&write_data);

    // 1. Benchmark Write
    let start_write = std::time::Instant::now();
    let mut file = match File::create(&test_file_path) {
        Ok(f) => f,
        Err(e) => return Ok(BenchmarkResult {
            write_speed_mbs: 0.0,
            read_speed_mbs: 0.0,
            integrity_passed: false,
            test_file_path: test_file_path.to_string_lossy().to_string(),
            error: Some(format!("Failed to create test file: {}", e)),
        }),
    };
    
    if let Err(e) = file.write_all(&write_data) {
        let _ = std::fs::remove_file(&test_file_path);
        return Ok(BenchmarkResult {
            write_speed_mbs: 0.0,
            read_speed_mbs: 0.0,
            integrity_passed: false,
            test_file_path: test_file_path.to_string_lossy().to_string(),
            error: Some(format!("Failed to write benchmark blocks: {}", e)),
        });
    }
    
    let write_duration = start_write.elapsed().as_secs_f64();
    let write_speed_mbs = (test_size_bytes as f64 / (1024.0 * 1024.0)) / write_duration;

    // Flush cache to force disk write read
    drop(file);

    // 2. Benchmark Read
    let mut read_data = vec![0u8; test_size_bytes];
    let start_read = std::time::Instant::now();
    
    let mut file = match File::open(&test_file_path) {
        Ok(f) => f,
        Err(e) => {
            let _ = std::fs::remove_file(&test_file_path);
            return Ok(BenchmarkResult {
                write_speed_mbs,
                read_speed_mbs: 0.0,
                integrity_passed: false,
                test_file_path: test_file_path.to_string_lossy().to_string(),
                error: Some(format!("Failed to open test file for reading: {}", e)),
            });
        }
    };

    if let Err(e) = file.read_exact(&mut read_data) {
        let _ = std::fs::remove_file(&test_file_path);
        return Ok(BenchmarkResult {
            write_speed_mbs,
            read_speed_mbs: 0.0,
            integrity_passed: false,
            test_file_path: test_file_path.to_string_lossy().to_string(),
            error: Some(format!("Failed to read benchmark blocks: {}", e)),
        });
    }

    let read_duration = start_read.elapsed().as_secs_f64();
    let read_speed_mbs = (test_size_bytes as f64 / (1024.0 * 1024.0)) / read_duration;

    // Cleanup file
    drop(file);
    let _ = std::fs::remove_file(&test_file_path);

    // 3. Verify integrity
    let read_hash = hash_bytes(&read_data);
    let integrity_passed = original_hash == read_hash;

    Ok(BenchmarkResult {
        write_speed_mbs,
        read_speed_mbs,
        integrity_passed,
        test_file_path: test_file_path.to_string_lossy().to_string(),
        error: None,
    })
}

#[tauri::command]
pub async fn cmd_validate_retroarch_bios(state: tauri::State<'_, AppState>) -> Result<Vec<BiosStatus>, String> {
    let cm = state.config_mgr.lock().unwrap();
    let sd_root = &cm.sd_root;
    let retro_dir = sd_root.join("retroarch/cores/system");
    
    let bios_database = vec![
        ("gba_bios.bin", "Game Boy Advance", "a860e8c0b6d573d191e4e44440c7b1d5"),
        ("scph5501.bin", "PlayStation 1 (US)", "110cbb0d139b53ddcd4bdc15f6c1fd25"),
        ("dc_boot.bin", "Sega Dreamcast", "e10c53c2f8b90bab96ead2d368858623"),
        ("scph39001.bin", "PlayStation 2 (US)", "2fbfed5193910c2c10b77c6178c772c6"),
    ];

    let mut results = Vec::new();

    for (name, console, expected_md5) in bios_database {
        let bios_path = retro_dir.join(name);
        if !bios_path.exists() {
            results.push(BiosStatus {
                name: name.to_string(),
                console: console.to_string(),
                found: false,
                hash_valid: false,
                expected_hash: expected_md5.to_string(),
                actual_hash: String::new(),
            });
            continue;
        }

        // Calculate MD5 of the actual BIOS file
        let mut file = match File::open(&bios_path) {
            Ok(f) => f,
            Err(_) => {
                results.push(BiosStatus {
                    name: name.to_string(),
                    console: console.to_string(),
                    found: true,
                    hash_valid: false,
                    expected_hash: expected_md5.to_string(),
                    actual_hash: "Error reading file".to_string(),
                });
                continue;
            }
        };

        let mut buffer = Vec::new();
        if file.read_to_end(&mut buffer).is_err() {
            results.push(BiosStatus {
                name: name.to_string(),
                console: console.to_string(),
                found: true,
                hash_valid: false,
                expected_hash: expected_md5.to_string(),
                actual_hash: "Error reading file".to_string(),
            });
            continue;
        }

        let actual_md5 = format!("{:x}", md5::compute(&buffer));
        let hash_valid = actual_md5 == expected_md5;

        results.push(BiosStatus {
            name: name.to_string(),
            console: console.to_string(),
            found: true,
            hash_valid,
            expected_hash: expected_md5.to_string(),
            actual_hash: actual_md5,
        });
    }

    Ok(results)
}

// --- Helper Functions ---

fn hash_bytes(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hasher.finalize().iter().map(|b| format!("{:02x}", b)).collect()
}

fn check_hosts_file_blocked(path: &PathBuf, domains: &[String]) -> bool {
    if !path.exists() {
        return false;
    }
    
    let mut file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return false,
    };
    
    let mut content = String::new();
    if file.read_to_string(&mut content).is_err() {
        return false;
    }

    // Lowercase lines for search
    let content_lower = content.to_lowercase();
    
    // Check if every checked domain is mapped in this file to 127.0.0.1 or 0.0.0.0
    // e.g. "127.0.0.1 conntest.nintendowifi.net"
    let mut blocked_count = 0;
    for domain in domains {
        let domain_lower = domain.to_lowercase();
        if content_lower.contains(&format!("127.0.0.1 {}", domain_lower)) 
            || content_lower.contains(&format!("0.0.0.0 {}", domain_lower))
            || content_lower.contains(&format!("127.0.0.1\t{}", domain_lower))
            || content_lower.contains(&format!("0.0.0.0\t{}", domain_lower)) 
        {
            blocked_count += 1;
        }
    }

    blocked_count == domains.len()
}

fn check_live_dns_blocked(domains: &[String]) -> bool {
    // Attempt DNS lookup on checked domains using std::net::ToSocketAddrs
    // Since DNS-MITM / 90DNS blocks resolution, a blocked query will either fail to resolve,
    // or resolve directly to loopback IP addresses.
    // If it resolves successfully to a real external Nintendo IP, it is NOT blocked.
    use std::net::ToSocketAddrs;

    let mut blocked_count = 0;
    for domain in domains {
        // Query domain with default port 80
        let query = format!("{}:80", domain);
        match query.to_socket_addrs() {
            Ok(mut addrs) => {
                // If it resolves, check if it resolves to loopback IP
                if let Some(addr) = addrs.next() {
                    let ip = addr.ip();
                    if ip.is_loopback() || ip.is_unspecified() {
                        blocked_count += 1;
                    }
                }
            }
            Err(_) => {
                // Fails to resolve (DNS sinkhole) which is successfully blocked!
                blocked_count += 1;
            }
        }
    }

    blocked_count == domains.len()
}
