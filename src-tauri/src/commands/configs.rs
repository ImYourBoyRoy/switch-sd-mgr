// ./src-tauri/src/commands/configs.rs
//! Domain-specific controller for Switch environment manager commands related to configs.
//! Operational Notes: Included as a sub-module of the tauri command router.
use crate::*;
use serde_json::Value;

#[tauri::command]
pub async fn cmd_backup_config_file(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<String>, String> {
    let config_mgr = state.config_mgr.lock().unwrap();
    let schema_map = config_mgr.load_schema().map_err(|e| e.to_string())?;
    let schema = schema_map.get(&id).ok_or("Config scheme not found")?;
    let destination = config_mgr.resolve_target_path(&schema.destination);
    config_mgr
        .backup_file(&destination, &id)
        .map(|path| path.map(|value| value.to_string_lossy().to_string()))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_list_configs(state: tauri::State<'_, AppState>) -> Result<HashMap<String, crate::core::config::ConfigSchema>, String> {
    let config_mgr = state.config_mgr.lock().unwrap();
    config_mgr.load_schema().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_get_config(state: tauri::State<'_, AppState>, id: String) -> Result<Value, String> {
    use crate::core::ini_parser::SwitchIni;
    let config_mgr = state.config_mgr.lock().unwrap();
    let schema_map = config_mgr.load_schema().map_err(|e| e.to_string())?;
    let schema = schema_map.get(&id).ok_or("Config scheme not found")?;
    let dest = config_mgr.resolve_target_path(&schema.destination);
    if !dest.exists() {
        return Ok(serde_json::json!({
            "found": false,
            "path": dest.to_string_lossy(),
            "creation": config_creation_options(&config_mgr, &id, schema)
        }));
    }
    let parsed = SwitchIni::parse(dest).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "found": true,
        "data": parsed,
        "creation": config_creation_options(&config_mgr, &id, schema)
    }))
}

#[tauri::command]
pub async fn cmd_update_config(state: tauri::State<'_, AppState>, id: String, section: String, key: String, value: String, vtype: Option<String>, enabled: bool) -> Result<(), String> {
    use crate::core::ini_parser::SwitchIni;
    let config_mgr = state.config_mgr.lock().unwrap();
    let schema_map = config_mgr.load_schema().map_err(|e| e.to_string())?;
    let schema = schema_map.get(&id).ok_or("Config scheme not found")?;
    let dest = config_mgr.resolve_target_path(&schema.destination);
    let mut ini = SwitchIni::parse(&dest).map_err(|e| e.to_string())?;
    ini.set_value(&section, &key, &value, vtype.as_deref(), enabled);
    ini.write().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_get_raw_config(state: tauri::State<'_, AppState>, id: String) -> Result<String, String> {
    let config_mgr = state.config_mgr.lock().unwrap();
    let schema_map = config_mgr.load_schema().map_err(|e| e.to_string())?;
    let schema = schema_map.get(&id).ok_or("Config scheme not found")?;
    let dest = config_mgr.resolve_target_path(&schema.destination);
    if !dest.exists() {
        return Ok(String::new());
    }
    std::fs::read_to_string(dest).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_get_raw_config_payload(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<RawConfigPayload, String> {
    let config_mgr = state.config_mgr.lock().unwrap();
    let schema_map = config_mgr.load_schema().map_err(|e| e.to_string())?;
    let schema = schema_map.get(&id).ok_or("Config scheme not found")?;
    let dest = config_mgr.resolve_target_path(&schema.destination);
    let creation = config_creation_options(&config_mgr, &id, schema);
    if !dest.exists() {
        return Ok(RawConfigPayload {
            found: false,
            path: creation.path.clone(),
            content: String::new(),
            creation,
        });
    }
    Ok(RawConfigPayload {
        found: true,
        path: dest.to_string_lossy().to_string(),
        content: std::fs::read_to_string(dest).map_err(|e| e.to_string())?,
        creation,
    })
}

#[tauri::command]
pub async fn cmd_create_config_file(
    state: tauri::State<'_, AppState>,
    id: String,
    mode: String,
) -> Result<String, String> {
    let config_mgr = state.config_mgr.lock().unwrap();
    let schema_map = config_mgr.load_schema().map_err(|e| e.to_string())?;
    let schema = schema_map.get(&id).ok_or("Config scheme not found")?;
    let dest = config_mgr.resolve_target_path(&schema.destination);

    if dest.exists() {
        return Ok(dest.to_string_lossy().to_string());
    }

    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    match mode.as_str() {
        "template" => {
            let template = schema
                .template_path
                .as_ref()
                .ok_or("No packaged template is available for this config.")?;
            let template_path = config_mgr.resolve_target_path(template);
            if !template_path.exists() {
                return Err(format!(
                    "Template file not found at {}",
                    template_path.display()
                ));
            }
            std::fs::copy(&template_path, &dest).map_err(|e| e.to_string())?;
        }
        "managed" => {
            if schema.editable_as_text.unwrap_or(false) {
                let content = managed_text_content_for_config(&config_mgr, &id)
                    .ok_or("No managed starter content is available for this file.")?;
                std::fs::write(&dest, content).map_err(|e| e.to_string())?;
            } else {
                std::fs::write(&dest, "").map_err(|e| e.to_string())?;
                let _ = config_mgr
                    .enforce_config_defaults(&id, schema)
                    .map_err(|e| e.to_string())?;
            }
        }
        "empty" => {
            std::fs::write(&dest, "").map_err(|e| e.to_string())?;
        }
        _ => return Err("Unsupported config creation mode.".to_string()),
    }

    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn cmd_save_raw_config(state: tauri::State<'_, AppState>, id: String, content: String) -> Result<(), String> {
    let config_mgr = state.config_mgr.lock().unwrap();
    let schema_map = config_mgr.load_schema().map_err(|e| e.to_string())?;
    let schema = schema_map.get(&id).ok_or("Config scheme not found")?;
    let dest = config_mgr.resolve_target_path(&schema.destination);
    if let Some(parent) = dest.parent() { let _ = std::fs::create_dir_all(parent); }
    std::fs::write(dest, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_enforce_defaults(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let config_mgr = state.config_mgr.lock().unwrap();
    config_mgr.enforce_config_defaults_all().map_err(|e| e.to_string())
}
