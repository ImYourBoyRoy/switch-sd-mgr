// ./src-tauri/src/commands/blacklist.rs
//! Domain-specific controller for Switch environment manager commands related to blacklist.
//! Operational Notes: Included as a sub-module of the tauri command router.
use crate::*;

#[tauri::command]
pub async fn cmd_get_global_blacklist(state: tauri::State<'_, AppState>) -> Result<Vec<String>, String> {
    let app_config = state.app_config.lock().unwrap();
    Ok(app_config.archive_rules.global_blacklist.clone())
}

#[tauri::command]
pub async fn cmd_set_global_blacklist(
    state: tauri::State<'_, AppState>,
    blacklist: Vec<String>,
) -> Result<(), String> {
    let cleaned = blacklist
        .into_iter()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();
    {
        let mut app_config = state.app_config.lock().unwrap();
        app_config.archive_rules.global_blacklist = cleaned;
        state
            .config_mgr
            .lock()
            .unwrap()
            .save_app_config(&app_config)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
