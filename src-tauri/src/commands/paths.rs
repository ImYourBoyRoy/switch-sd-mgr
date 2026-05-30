// ./src-tauri/src/commands/paths.rs
/// Domain-specific controller for Switch environment manager commands related to paths.
/// Operational Notes: Included as a sub-module of the tauri command router.

use crate::*;
use serde_json::Value;
use std::path::PathBuf;
use crate::core::storage::DetectedStorageTarget;

#[tauri::command]
pub async fn cmd_detect_storage_targets() -> Result<Vec<DetectedStorageTarget>, String> {
    Ok(crate::core::storage::detect_storage_targets())
}

#[tauri::command]
pub async fn cmd_open_path_in_file_manager(path: String) -> Result<(), String> {
    crate::core::storage::open_in_file_manager(&path)
}

#[tauri::command]
pub async fn cmd_eject_storage_target(path: String) -> Result<(), String> {
    crate::core::storage::eject_storage_target(&path)
}

#[tauri::command]
pub async fn cmd_open_external(url: String) -> Result<(), String> {
    open_external_url(&url)
}

#[tauri::command]
pub async fn cmd_get_paths(state: tauri::State<'_, AppState>) -> Result<Value, String> {
    let cm = state.config_mgr.lock().unwrap();
    let paths = cm.workspace_paths();
    Ok(serde_json::json!({
        "workspace_root": paths.workspace_root,
        "data_root": paths.data_root,
        "custom_stuff": paths.custom_stuff_root,
        "custom_stuff_root": paths.custom_stuff_root,
        "sd_root": paths.sd_root,
        "rcm_root": paths.rcm_root,
        "boot_bin_root": paths.rcm_root,
        "target_mode": active_target_mode(&paths),
    }))
}

#[tauri::command]
pub async fn cmd_set_paths(state: tauri::State<'_, AppState>, data_root: Option<String>, custom_root: Option<String>, sd_root: Option<String>, rcm_root: Option<String>) -> Result<(), String> {
    let current = state.config_mgr.lock().unwrap().workspace_paths();
    let updated = crate::core::config::WorkspacePaths {
        workspace_root: current.workspace_root.clone(),
        data_root: data_root.map(PathBuf::from).unwrap_or(current.data_root.clone()),
        sd_root: sd_root.map(PathBuf::from).unwrap_or(current.sd_root.clone()),
        rcm_root: rcm_root.map(PathBuf::from).unwrap_or(current.rcm_root.clone()),
        custom_stuff_root: custom_root.map(PathBuf::from).unwrap_or(current.custom_stuff_root.clone()),
    };
    {
        let mut cm = state.config_mgr.lock().unwrap();
        cm.apply_workspace_paths(updated.clone());
    }
    if let Ok(new_cfg) = state.config_mgr.lock().unwrap().load_app_config() {
        let mut cfg = state.app_config.lock().unwrap();
        *cfg = new_cfg.clone();
        let mut dl = state.downloader.lock().unwrap();
        *dl = crate::core::downloader::Downloader::new(new_cfg.network.get("user_agent").and_then(|v| v.as_str()));
    }
    let mut p_settings = current_portable_settings(&state);
    p_settings.workspace_root = updated.workspace_root;
    p_settings.data_root = updated.data_root;
    p_settings.sd_root = updated.sd_root;
    p_settings.rcm_root = updated.rcm_root;
    p_settings.custom_stuff_root = updated.custom_stuff_root;
    write_portable_settings(&state.portable_settings_path, &p_settings)?;
    Ok(())
}
