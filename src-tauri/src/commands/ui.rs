// ./src-tauri/src/commands/ui.rs
//! Domain-specific controller for Switch environment manager commands related to ui.
//! Operational Notes: Included as a sub-module of the tauri command router.
use crate::*;

#[tauri::command]
pub async fn cmd_get_ui_settings(state: tauri::State<'_, AppState>) -> Result<UiSettings, String> {
    let settings = current_portable_settings(&state);
    Ok(UiSettings {
        theme: settings.theme.unwrap_or_else(|| "dark".to_string()),
        walkthrough_completed: settings
            .walkthrough_completed
            .unwrap_or_else(|| has_meaningful_setup(&state)),
        payload_output_enabled: settings.payload_output_enabled,
        payload_naming_template: settings.payload_naming_template,
        backup_before_config_apply: settings.backup_before_config_apply,
    })
}

#[tauri::command]
pub async fn cmd_set_ui_settings(state: tauri::State<'_, AppState>, update: UiSettingsUpdate) -> Result<UiSettings, String> {
    let mut settings = current_portable_settings(&state);
    if let Some(theme) = update.theme.as_ref() {
        let normalized = match theme.trim().to_lowercase().as_str() {
            "light" => "light".to_string(),
            _ => "dark".to_string(),
        };
        settings.theme = Some(normalized);
    } else if settings.theme.is_none() {
        settings.theme = Some("dark".to_string());
    }
    if let Some(completed) = update.walkthrough_completed {
        settings.walkthrough_completed = Some(completed);
    }
    if let Some(enabled) = update.payload_output_enabled {
        settings.payload_output_enabled = enabled;
    }
    if let Some(template) = update.payload_naming_template {
        settings.payload_naming_template = if template.trim().is_empty() {
            default_payload_naming_template()
        } else {
            template
        };
    }
    if let Some(backup) = update.backup_before_config_apply {
        settings.backup_before_config_apply = backup;
    }
    write_portable_settings(&state.portable_settings_path, &settings)?;
    Ok(UiSettings {
        theme: settings.theme.unwrap_or_else(|| "dark".to_string()),
        walkthrough_completed: settings
            .walkthrough_completed
            .unwrap_or_else(|| has_meaningful_setup(&state)),
        payload_output_enabled: settings.payload_output_enabled,
        payload_naming_template: settings.payload_naming_template,
        backup_before_config_apply: settings.backup_before_config_apply,
    })
}
