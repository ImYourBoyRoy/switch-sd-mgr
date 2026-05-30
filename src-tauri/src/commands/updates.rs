// ./src-tauri/src/commands/updates.rs
/// Domain-specific controller for Switch environment manager commands related to updates.
/// Operational Notes: Included as a sub-module of the tauri command router.

use crate::*;
use serde_json::Value;

#[tauri::command]
pub async fn cmd_check_updates(app: tauri::AppHandle, state: tauri::State<'_, AppState>) -> Result<Vec<Value>, String> {
    check_updates_logic_with_progress(&state, Some(&app)).await
}

#[tauri::command]
pub async fn cmd_run_update(app: tauri::AppHandle, state: tauri::State<'_, AppState>, ids: Vec<String>) -> Result<String, String> {
    run_update_logic_with_progress(&state, ids, Some(&app)).await
}

#[tauri::command]
pub async fn cmd_run_remote_update(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    ids: Vec<String>,
    remote_root: String,
) -> Result<String, String> {
    run_remote_update_logic_with_progress(&state, ids, remote_root, Some(&app)).await
}

#[tauri::command]
pub async fn cmd_get_install_plan(state: tauri::State<'_, AppState>, mode: String) -> Result<InstallPlanResponse, String> {
    install_plan_for_mode(&state, &mode).await
}

#[tauri::command]
pub async fn cmd_sync_custom_stuff(state: tauri::State<'_, AppState>) -> Result<Vec<String>, String> {
    let config_mgr = state.config_mgr.lock().unwrap();
    config_mgr.apply_custom_stuff().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_run_post_install_actions(state: tauri::State<'_, AppState>) -> Result<PostInstallSummary, String> {
    let config_mgr = state.config_mgr.lock().unwrap();
    let defaults_enforced = config_mgr
        .enforce_config_defaults_all_with_count()
        .map_err(|e| e.to_string())?;
    let applied_files = config_mgr.apply_custom_stuff().map_err(|e| e.to_string())?;
    Ok(PostInstallSummary {
        defaults_enforced,
        override_files_applied: applied_files.len(),
        applied_files,
    })
}
