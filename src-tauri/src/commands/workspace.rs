// ./src-tauri/src/commands/workspace.rs
/// Domain-specific controller for Switch environment manager commands related to workspace.
/// Operational Notes: Included as a sub-module of the tauri command router.

use crate::*;

#[tauri::command]
pub async fn cmd_validate_workspace(state: tauri::State<'_, AppState>) -> Result<crate::core::config::WorkspaceValidation, String> {
    let config_mgr = state.config_mgr.lock().unwrap();
    let app_config = state.app_config.lock().unwrap();
    let manifest_path = config_mgr.resolve_data_file(app_config.paths.get("manifest_lock").map(|s| s.as_str()), "manifest.lock");
    config_mgr.validate_portable_workspace(&manifest_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_reset_manifest(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let config_mgr = state.config_mgr.lock().unwrap();
    let app_config = state.app_config.lock().unwrap();
    let manifest_path = config_mgr.resolve_data_file(app_config.paths.get("manifest_lock").map(|s| s.as_str()), "manifest.lock");
    let mut manifest = crate::core::manifest::ManifestManager::new(manifest_path);
    manifest.data.entries.clear();
    manifest.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_wipe_sd(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let config_mgr = state.config_mgr.lock().unwrap();
    let _ = crate::core::utils::safe_delete(&config_mgr.sd_root);
    let _ = std::fs::create_dir_all(&config_mgr.sd_root);
    let _ = crate::core::utils::safe_delete(&config_mgr.rcm_root);
    let _ = std::fs::create_dir_all(&config_mgr.rcm_root);
    Ok(())
}
