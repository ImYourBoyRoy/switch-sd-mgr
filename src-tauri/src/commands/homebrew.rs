// ./src-tauri/src/commands/homebrew.rs
/// Domain-specific controller for Switch environment manager commands related to homebrew.
/// Operational Notes: Included as a sub-module of the tauri command router.

use crate::*;

#[tauri::command]
pub async fn cmd_get_installed_homebrew(state: tauri::State<'_, AppState>) -> Result<HashMap<String, crate::core::nro_scanner::NroMetadata>, String> {
    use crate::core::nro_scanner::NroScanner;
    let paths = state.config_mgr.lock().unwrap().workspace_paths();
    let mut scanner = NroScanner::new(paths.sd_root.clone(), paths.data_root.join("cache/nro_cache.json"), paths.data_root.join("cache/icons"));
    let _ = scanner.scan_all();
    Ok(scanner.get_all_metadata().clone())
}

#[tauri::command]
pub async fn cmd_get_icon(state: tauri::State<'_, AppState>, name: String) -> Result<Vec<u8>, String> {
    let config_mgr = state.config_mgr.lock().unwrap();
    let path = config_mgr.data_root.join("cache/icons").join(name);
    if path.exists() { std::fs::read(path).map_err(|e| e.to_string()) } else { Err("Icon not found".to_string()) }
}

#[tauri::command]
pub async fn cmd_check_integrity(state: tauri::State<'_, AppState>) -> Result<String, String> {
    use crate::core::manifest::ManifestManager;
    let config_mgr = state.config_mgr.lock().unwrap();
    let app_config = state.app_config.lock().unwrap();
    let manifest_path = config_mgr.resolve_data_file(app_config.paths.get("manifest_lock").map(|s| s.as_str()), "manifest.lock");
    let manifest = ManifestManager::new(manifest_path);
    if manifest.data.entries.is_empty() && config_mgr.sd_root.exists() {
        if let Ok(entries) = std::fs::read_dir(&config_mgr.sd_root) {
            if entries.count() > 0 { return Ok("mismatch_detected".to_string()); }
        }
    }
    Ok("ok".to_string())
}
