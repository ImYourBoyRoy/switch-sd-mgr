// ./src-tauri/src/commands/firmware.rs
/// Domain-specific controller for Switch environment manager commands related to firmware.
/// Operational Notes: Included as a sub-module of the tauri command router.

use crate::*;

#[tauri::command]
pub async fn cmd_get_atmosphere_version(state: tauri::State<'_, AppState>) -> Result<Option<String>, String> {
    let cm = state.config_mgr.lock().unwrap();
    let app_config = state.app_config.lock().unwrap();
    let (_, manifest_path) = source_paths(&cm, &app_config);
    let manifest = crate::core::manifest::ManifestManager::new(manifest_path);
    if let Some(entry) = manifest.data.entries.get("atmosphere") {
        Ok(Some(entry.version.clone()))
    } else {
        let sd_root = &cm.sd_root;
        let atmosphere_dir = sd_root.join("atmosphere");
        if atmosphere_dir.exists() {
            Ok(Some("detected".to_string()))
        } else {
            Ok(None)
        }
    }
}

#[tauri::command]
pub async fn cmd_download_firmware(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    version: String,
    url: String,
) -> Result<String, String> {
    use crate::core::downloader::Downloader;
    use std::fs::File;
    use zip::ZipArchive;

    emit_progress(Some(&app), "firmware", format!("Initializing Firmware v{} download...", version), None, Some(1), Some(3));

    let (sd_root, temp_dir, user_agent) = {
        let cm = state.config_mgr.lock().unwrap();
        let app_config = state.app_config.lock().unwrap();
        let temp_dir = cm.resolve_data_file(app_config.paths.get("temp_dir").map(|s| s.as_str()), "temp");
        let user_agent = app_config.network.get("user_agent").and_then(|v| v.as_str()).map(|s| s.to_string());
        (cm.sd_root.clone(), temp_dir, user_agent)
    };

    let firmware_dir = sd_root.join("firmware");

    // 1. Surgical wipe of existing /firmware directory to prevent mixed files!
    if firmware_dir.exists() {
        emit_progress(Some(&app), "firmware", "Clearing prior firmware directories...", None, Some(1), Some(3));
        std::fs::remove_dir_all(&firmware_dir).map_err(|e| format!("Failed to clear existing /firmware folder: {}", e))?;
    }
    std::fs::create_dir_all(&firmware_dir).map_err(|e| format!("Failed to create /firmware folder: {}", e))?;

    // 2. Download ZIP
    let tmp_zip = temp_dir.join(format!("firmware_{}.zip", version));
    let downloader = Downloader::new(user_agent.as_deref());

    emit_progress(Some(&app), "firmware", format!("Downloading Firmware v{} zip...", version), None, Some(2), Some(3));
    let _hash = downloader.download_file(&url, &tmp_zip).await.map_err(|e| e.to_string())?;

    // 3. Flat Unpack ZIP into /SD/firmware/
    emit_progress(Some(&app), "firmware", "Extracting firmware files...", None, Some(3), Some(3));

    let file = File::open(&tmp_zip).map_err(|e| format!("Failed to open downloaded firmware zip: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Failed to parse zip archive: {}", e))?;

    let mut extracted_count = 0;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| format!("Failed to read zip entry: {}", e))?;
        if file.is_dir() {
            continue;
        }
        let name = file.name().to_string();
        let file_path = std::path::Path::new(&name);
        if let Some(filename) = file_path.file_name() {
            let dest_path = firmware_dir.join(filename);
            let mut outfile = File::create(&dest_path).map_err(|e| format!("Failed to create destination file: {}", e))?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| format!("Failed to extract file {}: {}", name, e))?;
            extracted_count += 1;
        }
    }

    // 4. Cleanup temp ZIP
    let _ = std::fs::remove_file(tmp_zip);

    emit_progress(Some(&app), "firmware", format!("Successfully downloaded and extracted {} firmware files to /firmware!", extracted_count), None, Some(3), Some(3));

    Ok(format!("Successfully extracted {} files to SD/firmware", extracted_count))
}
