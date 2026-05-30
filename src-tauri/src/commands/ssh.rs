// ./src-tauri/src/commands/ssh.rs
/// Domain-specific controller for Switch environment manager commands related to ssh.
/// Operational Notes: Included as a sub-module of the tauri command router.

use crate::*;
use crate::core::ssh::SshManager;

#[tauri::command]
pub async fn ssh_connect(state: tauri::State<'_, AppState>, host: String, user: String, password: Option<String>) -> Result<(), String> {
    let mgr = SshManager::connect(&host, &user, password.as_deref()).map_err(|e: anyhow::Error| e.to_string())?;
    let mut session = state.ssh_session.lock().unwrap();
    *session = Some(mgr);
    Ok(())
}

#[tauri::command]
pub async fn ssh_read_config(state: tauri::State<'_, AppState>, path: String) -> Result<String, String> {
    let session = state.ssh_session.lock().unwrap();
    let mgr = session.as_ref().ok_or("Not connected")?;
    mgr.read_file(&path).map_err(|e: anyhow::Error| e.to_string())
}

#[tauri::command]
pub async fn ssh_write_config(state: tauri::State<'_, AppState>, path: String, content: String) -> Result<(), String> {
    let session = state.ssh_session.lock().unwrap();
    let mgr = session.as_ref().ok_or("Not connected")?;
    mgr.write_file(&path, &content).map_err(|e: anyhow::Error| e.to_string())
}
