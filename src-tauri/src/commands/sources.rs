// ./src-tauri/src/commands/sources.rs
/// Domain-specific controller for Switch environment manager commands related to sources.
/// Operational Notes: Included as a sub-module of the tauri command router.

use crate::*;
use crate::core::downloader::Source;
use serde_json::Value;
use std::path::PathBuf;

#[tauri::command]
pub async fn cmd_restore_default_sources(state: tauri::State<'_, AppState>) -> Result<usize, String> {
    let (sources_path, default_path) = {
        let cm = state.config_mgr.lock().unwrap();
        let app_config = state.app_config.lock().unwrap();
        let (sources_path, _) = source_paths(&cm, &app_config);
        (sources_path, default_sources_path(&cm))
    };
    if !default_path.exists() {
        return Err(format!("Default sources file not found at {}", default_path.display()));
    }
    let sources = load_sources_file(&default_path)?;
    save_sources_file(&sources_path, &sources)?;
    Ok(sources.len())
}

#[tauri::command]
pub async fn cmd_import_sources_file(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<usize, String> {
    let import_path = PathBuf::from(path);
    if !import_path.exists() {
        return Err(format!("Import file not found at {}", import_path.display()));
    }
    let sources = load_sources_file(&import_path)?;
    let sources_path = {
        let cm = state.config_mgr.lock().unwrap();
        let app_config = state.app_config.lock().unwrap();
        let (sources_path, _) = source_paths(&cm, &app_config);
        sources_path
    };
    save_sources_file(&sources_path, &sources)?;
    Ok(sources.len())
}

#[tauri::command]
pub async fn cmd_list_sources(state: tauri::State<'_, AppState>) -> Result<Vec<Value>, String> {
    use crate::core::manifest::ManifestManager;
    let cm = state.config_mgr.lock().unwrap();
    let app_config = state.app_config.lock().unwrap();
    let (sources_path, manifest_path) = source_paths(&cm, &app_config);
    let sources = load_sources_file(&sources_path)?;
    let manifest = ManifestManager::new(manifest_path);
    Ok(sources.into_iter().map(|s| {
        let installed = manifest.data.entries.get(&s.id).map(|entry| entry.files.iter().any(|f| PathBuf::from(f).exists())).unwrap_or(false);
        let version = manifest.data.entries.get(&s.id).map(|e| e.version.clone()).unwrap_or_default();
        let phase = install_phase_for_source(&s);
        let repo_url = source_repo_url(&s);
        serde_json::json!({
            "id": s.id,
            "name": s.name,
            "source": s.source,
            "alt_source": s.alt_source,
            "install_dir": s.install_dir,
            "blacklist": s.blacklist,
            "payload_info": s.payload_info,
            "prerelease": s.prerelease,
            "install_phase": phase,
            "install_priority": install_priority_for_source(&s),
            "repo_url": repo_url,
            "_installed": installed,
            "_installed_version": version
        })
    }).collect())
}

#[tauri::command]
pub async fn cmd_get_sources_raw(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let cm = state.config_mgr.lock().unwrap();
    let app_config = state.app_config.lock().unwrap();
    let (sources_path, _) = source_paths(&cm, &app_config);
    std::fs::read_to_string(sources_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_save_sources_raw(state: tauri::State<'_, AppState>, content: String) -> Result<(), String> {
    let parsed: Vec<Source> = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    let cm = state.config_mgr.lock().unwrap();
    let app_config = state.app_config.lock().unwrap();
    let (sources_path, _) = source_paths(&cm, &app_config);
    save_sources_file(&sources_path, &parsed)
}

#[tauri::command]
pub async fn cmd_add_source(state: tauri::State<'_, AppState>, source: Source) -> Result<(), String> {
    let cm = state.config_mgr.lock().unwrap();
    let app_config = state.app_config.lock().unwrap();
    let (sources_path, _) = source_paths(&cm, &app_config);
    let mut sources = load_sources_file(&sources_path)?;
    if sources.iter().any(|s| s.id == source.id) { return Err(format!("Source {} already exists", source.id)); }
    sources.push(source);
    save_sources_file(&sources_path, &sources)
}

#[tauri::command]
pub async fn cmd_update_source(state: tauri::State<'_, AppState>, id: String, source: Source) -> Result<(), String> {
    let cm = state.config_mgr.lock().unwrap();
    let app_config = state.app_config.lock().unwrap();
    let (sources_path, _) = source_paths(&cm, &app_config);
    let mut sources = load_sources_file(&sources_path)?;
    let Some(existing) = sources.iter_mut().find(|s| s.id == id) else { return Err(format!("Source {} not found", id)); };
    *existing = source;
    save_sources_file(&sources_path, &sources)
}

#[tauri::command]
pub async fn cmd_delete_source(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    let cm = state.config_mgr.lock().unwrap();
    let app_config = state.app_config.lock().unwrap();
    let (sources_path, _) = source_paths(&cm, &app_config);
    let mut sources = load_sources_file(&sources_path)?;
    sources.retain(|s| s.id != id);
    save_sources_file(&sources_path, &sources)
}

#[tauri::command]
pub async fn cmd_bulk_delete_sources(state: tauri::State<'_, AppState>, ids: Vec<String>) -> Result<(), String> {
    let cm = state.config_mgr.lock().unwrap();
    let app_config = state.app_config.lock().unwrap();
    let (sources_path, _) = source_paths(&cm, &app_config);
    let mut sources = load_sources_file(&sources_path)?;
    sources.retain(|s| !ids.contains(&s.id));
    save_sources_file(&sources_path, &sources)
}

#[tauri::command]
pub async fn cmd_reorder_sources(
    state: tauri::State<'_, AppState>,
    ids: Vec<String>,
) -> Result<(), String> {
    let cm = state.config_mgr.lock().unwrap();
    let app_config = state.app_config.lock().unwrap();
    let (sources_path, _) = source_paths(&cm, &app_config);
    let existing_sources = load_sources_file(&sources_path)?;

    let existing_ids: Vec<String> = existing_sources.iter().map(|source| source.id.clone()).collect();
    if existing_ids.len() != ids.len() {
        return Err("Reorder request must include every source exactly once.".to_string());
    }
    for existing_id in &existing_ids {
        if !ids.contains(existing_id) {
            return Err(format!("Reorder request is missing source id {}", existing_id));
        }
    }

    let mut source_map: HashMap<String, Source> = existing_sources
        .into_iter()
        .map(|source| (source.id.clone(), source))
        .collect();

    let reordered = ids
        .into_iter()
        .enumerate()
        .map(|(index, id)| {
            let mut source = source_map
                .remove(&id)
                .ok_or_else(|| format!("Source {} not found during reorder", id))?;
            source.install_priority = Some((index as i32) * 10);
            Ok(source)
        })
        .collect::<Result<Vec<_>, String>>()?;

    save_sources_file(&sources_path, &reordered)
}

#[tauri::command]
pub async fn cmd_parse_source_url(url: String) -> Result<Value, String> {
    parse_source_url_impl(&url).ok_or_else(|| "Unrecognized source URL".to_string())
}
