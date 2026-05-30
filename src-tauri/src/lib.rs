pub mod core;
pub mod commands;

use crate::core::downloader::Source;
use crate::core::ssh::SshManager;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::Emitter;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PortableSettings {
    pub workspace_root: PathBuf,
    pub data_root: PathBuf,
    pub sd_root: PathBuf,
    pub rcm_root: PathBuf,
    pub custom_stuff_root: PathBuf,
    #[serde(default)]
    pub theme: Option<String>,
    #[serde(default = "default_true")]
    pub payload_output_enabled: bool,
    #[serde(default = "default_payload_naming_template")]
    pub payload_naming_template: String,
    #[serde(default)]
    pub walkthrough_completed: Option<bool>,
    #[serde(default)]
    pub backup_before_config_apply: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct ProgressPayload {
    stage: String,
    message: String,
    source_id: Option<String>,
    current: Option<usize>,
    total: Option<usize>,
}

pub struct AppState {
    pub ssh_session: Mutex<Option<SshManager>>,
    pub downloader: Mutex<crate::core::downloader::Downloader>,
    pub config_mgr: Mutex<crate::core::config::ConfigManager>,
    pub app_config: Mutex<crate::core::config::AppConfig>,
    pub portable_settings_path: PathBuf,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UiSettings {
    pub theme: String,
    pub walkthrough_completed: bool,
    pub payload_output_enabled: bool,
    pub payload_naming_template: String,
    pub backup_before_config_apply: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct UiSettingsUpdate {
    pub theme: Option<String>,
    pub walkthrough_completed: Option<bool>,
    pub payload_output_enabled: Option<bool>,
    pub payload_naming_template: Option<String>,
    pub backup_before_config_apply: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct InstallPlanEntry {
    pub id: String,
    pub name: String,
    pub status: String,
    pub phase: String,
    pub phase_label: String,
    pub priority: i32,
    pub installed: bool,
    pub has_update: bool,
    pub local_version: String,
    pub remote_version: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct InstallPlanPhaseSummary {
    pub phase: String,
    pub label: String,
    pub count: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct InstallPlanResponse {
    pub mode: String,
    pub total_count: usize,
    pub entries: Vec<InstallPlanEntry>,
    pub phase_summary: Vec<InstallPlanPhaseSummary>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PostInstallSummary {
    pub defaults_enforced: usize,
    pub override_files_applied: usize,
    pub applied_files: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ConfigCreationOptions {
    pub path: String,
    pub template_available: bool,
    pub managed_content_available: bool,
    pub managed_content_label: Option<String>,
    pub recommended_mode: String,
    pub recommended_label: String,
    pub helper_text: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RawConfigPayload {
    pub found: bool,
    pub path: String,
    pub content: String,
    pub creation: ConfigCreationOptions,
}

fn default_true() -> bool {
    true
}

fn default_payload_naming_template() -> String {
    "{folder}/payload.bin".to_string()
}

fn active_target_mode(paths: &crate::core::config::WorkspacePaths) -> &'static str {
    if paths.sd_root.starts_with(&paths.workspace_root) && paths.rcm_root.starts_with(&paths.workspace_root) {
        "portable"
    } else {
        "mounted"
    }
}

fn install_phase_for_source(source: &Source) -> String {
    source.install_phase.clone().unwrap_or_else(|| match source.id.as_str() {
        "atmosphere" => "core_cfw".to_string(),
        "hekate" => "bootloader".to_string(),
        _ => "standard".to_string(),
    })
}

fn install_priority_for_source(source: &Source) -> i32 {
    source.install_priority.unwrap_or(match source.id.as_str() {
        "atmosphere" => 0,
        "hekate" => 10,
        _ => 1000,
    })
}

fn install_phase_rank(phase: &str) -> i32 {
    match phase {
        "core_cfw" => 0,
        "bootloader" => 1,
        "standard" => 2,
        _ => 3,
    }
}

fn install_phase_label(phase: &str) -> &'static str {
    match phase {
        "core_cfw" => "Core CFW",
        "bootloader" => "Bootloader",
        "standard" => "Standard",
        _ => "Custom",
    }
}

fn emit_progress(app: Option<&tauri::AppHandle>, stage: &str, message: impl Into<String>, source_id: Option<String>, current: Option<usize>, total: Option<usize>) {
    if let Some(handle) = app {
        let _ = handle.emit("sd-updater://progress", ProgressPayload { stage: stage.to_string(), message: message.into(), source_id, current, total });
    }
}

fn clean_source_id(name: &str) -> String {
    name.trim().trim_matches('/').split('/').next_back().unwrap_or(name).chars().map(|c| if c.is_ascii_alphanumeric() { c.to_ascii_lowercase() } else { '_' }).collect::<String>().trim_matches('_').to_string()
}

fn source_paths(cm: &crate::core::config::ConfigManager, app_config: &crate::core::config::AppConfig) -> (PathBuf, PathBuf) {
    let sources_path = cm.resolve_data_file(app_config.paths.get("sources_json").map(|s| s.as_str()), "sources.json");
    let manifest_path = cm.resolve_data_file(app_config.paths.get("manifest_lock").map(|s| s.as_str()), "manifest.lock");
    (sources_path, manifest_path)
}

fn default_sources_path(cm: &crate::core::config::ConfigManager) -> PathBuf {
    let packaged_defaults = cm.data_root.join("sources.defaults.json");
    if packaged_defaults.exists() {
        return packaged_defaults;
    }
    cm.workspace_root.join("build").join("data").join("sources.json")
}

fn hosts_defaults_path(cm: &crate::core::config::ConfigManager) -> PathBuf {
    let packaged_defaults = cm.data_root.join("hosts_config.json");
    if packaged_defaults.exists() {
        return packaged_defaults;
    }
    cm.workspace_root.join("build").join("data").join("hosts_config.json")
}

fn load_sources_file(path: &Path) -> Result<Vec<Source>, String> {
    let sources_json = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&sources_json).map_err(|e| e.to_string())
}

fn save_sources_file(path: &Path, sources: &[Source]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(sources).map_err(|e| e.to_string())?;
    std::fs::write(path, content).map_err(|e| e.to_string())
}

fn managed_text_content_for_config(
    cm: &crate::core::config::ConfigManager,
    id: &str,
) -> Option<String> {
    let defaults_path = hosts_defaults_path(cm);
    let content = std::fs::read_to_string(defaults_path).ok()?;
    let parsed: HashMap<String, Value> = serde_json::from_str(&content).ok()?;
    parsed
        .get(id)?
        .get("overrides")?
        .get("content")?
        .as_str()
        .map(|value| value.to_string())
}

fn config_creation_options(
    cm: &crate::core::config::ConfigManager,
    id: &str,
    schema: &crate::core::config::ConfigSchema,
) -> ConfigCreationOptions {
    let path = cm.resolve_target_path(&schema.destination).to_string_lossy().to_string();
    let template_available = schema
        .template_path
        .as_ref()
        .map(|template| cm.resolve_target_path(template).exists())
        .unwrap_or(false);
    let managed_text_content = managed_text_content_for_config(cm, id);
    let managed_content_available = managed_text_content.is_some()
        || schema.settings.as_ref().map(|settings| !settings.is_empty()).unwrap_or(false)
        || schema.sections.as_ref().map(|sections| !sections.is_empty()).unwrap_or(false);

    let (recommended_mode, recommended_label, helper_text, managed_content_label) =
        if template_available {
            (
                "template".to_string(),
                "Create from template".to_string(),
                "Use the packaged template, then fine-tune values in the editor.".to_string(),
                Some("Managed defaults remain available after the template is created.".to_string()),
            )
        } else if let Some(content) = managed_text_content {
            let line_count = content.lines().filter(|line| !line.trim().is_empty()).count();
            (
                "managed".to_string(),
                "Create with managed rules".to_string(),
                "Create the file with the built-in managed rules so you can review and tweak them immediately."
                    .to_string(),
                Some(format!("Managed starter content ready ({} populated line(s)).", line_count)),
            )
        } else if managed_content_available {
            (
                "managed".to_string(),
                "Create with managed defaults".to_string(),
                "Create the file and prefill it with the known defaults for this config target."
                    .to_string(),
                Some("Recommended for first-time setup and safe baseline values.".to_string()),
            )
        } else {
            (
                "empty".to_string(),
                "Create empty file".to_string(),
                "Start with a blank file if you want to author every entry manually.".to_string(),
                None,
            )
        };

    ConfigCreationOptions {
        path,
        template_available,
        managed_content_available,
        managed_content_label,
        recommended_mode,
        recommended_label,
        helper_text,
    }
}

fn parse_source_url_impl(url: &str) -> Option<Value> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return None;
    }
    let parsed = url::Url::parse(trimmed).ok()?;
    let host = parsed.host_str()?.to_lowercase();
    let parts: Vec<&str> = parsed.path().split('/').filter(|p| !p.is_empty()).collect();
    if parts.len() < 2 {
        return None;
    }
    let owner = parts[0];
    let repo = parts[1].trim_end_matches(".git");
    let source_type = match host.as_str() {
        "github.com" | "www.github.com" => "github_release",
        "codeberg.org" | "www.codeberg.org" => "codeberg_release",
        _ => return None,
    };
    Some(serde_json::json!({ "id": clean_source_id(repo), "name": repo, "repo": format!("{}/{}", owner, repo), "type": source_type }))
}

fn current_portable_settings(state: &AppState) -> PortableSettings {
    let paths = state.config_mgr.lock().unwrap().workspace_paths();
    let stored = std::fs::read_to_string(&state.portable_settings_path)
        .ok()
        .and_then(|content| serde_json::from_str::<PortableSettings>(&content).ok());
    PortableSettings {
        workspace_root: paths.workspace_root,
        data_root: paths.data_root,
        sd_root: paths.sd_root,
        rcm_root: paths.rcm_root,
        custom_stuff_root: paths.custom_stuff_root,
        theme: stored.as_ref().and_then(|settings| settings.theme.clone()),
        payload_output_enabled: stored
            .as_ref()
            .map(|settings| settings.payload_output_enabled)
            .unwrap_or_else(default_true),
        payload_naming_template: stored
            .as_ref()
            .map(|settings| settings.payload_naming_template.clone())
            .unwrap_or_else(default_payload_naming_template),
        walkthrough_completed: stored
            .as_ref()
            .and_then(|settings| settings.walkthrough_completed),
        backup_before_config_apply: stored
            .as_ref()
            .map(|settings| settings.backup_before_config_apply)
            .unwrap_or(false),
    }
}

fn write_portable_settings(path: &Path, settings: &PortableSettings) -> Result<(), String> {
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

fn has_meaningful_setup(state: &AppState) -> bool {
    let cm = state.config_mgr.lock().unwrap();
    if let Ok(entries) = std::fs::read_dir(&cm.sd_root)
        && entries.filter_map(|entry| entry.ok()).next().is_some() {
            return true;
    }
    if let Ok(entries) = std::fs::read_dir(&cm.custom_dir)
        && entries.filter_map(|entry| entry.ok()).next().is_some() {
            return true;
    }
    let app_config = state.app_config.lock().unwrap();
    let (_, manifest_path) = source_paths(&cm, &app_config);
    let manifest = crate::core::manifest::ManifestManager::new(manifest_path);
    !manifest.data.entries.is_empty()
}

fn source_repo_url(source: &Source) -> Option<String> {
    let descriptor = source.source.as_ref()?;
    let repo = descriptor.repo.as_ref()?;
    let base = match descriptor.kind.as_str() {
        "codeberg_release" => "https://codeberg.org",
        "github_release" => "https://github.com",
        _ => return None,
    };
    Some(format!("{}/{}", base, repo.trim_matches('/')))
}

#[cfg(target_os = "windows")]
fn hide_windows_command(command: &mut std::process::Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    command.creation_flags(CREATE_NO_WINDOW);
}

fn sort_sources_for_install(sources: &mut [Source]) {
    sources.sort_by(|a, b| {
        let phase_cmp = install_phase_rank(&install_phase_for_source(a))
            .cmp(&install_phase_rank(&install_phase_for_source(b)));
        if phase_cmp != std::cmp::Ordering::Equal {
            return phase_cmp;
        }
        let priority_cmp = install_priority_for_source(a).cmp(&install_priority_for_source(b));
        if priority_cmp != std::cmp::Ordering::Equal {
            return priority_cmp;
        }
        a.name.to_lowercase().cmp(&b.name.to_lowercase())
    });
}

async fn install_plan_for_mode(state: &AppState, mode: &str) -> Result<InstallPlanResponse, String> {
    let updates = check_updates_logic(state).await?;
    let (sources_path, _) = {
        let cm = state.config_mgr.lock().unwrap();
        let app_config = state.app_config.lock().unwrap();
        source_paths(&cm, &app_config)
    };
    let mut sources = load_sources_file(&sources_path)?;
    sort_sources_for_install(&mut sources);

    let status_map: HashMap<String, Value> = updates
        .into_iter()
        .filter_map(|value| {
            let id = value["id"].as_str()?.to_string();
            Some((id, value))
        })
        .collect();

    let entries: Vec<InstallPlanEntry> = sources
        .into_iter()
        .filter_map(|source| {
            let update = status_map.get(&source.id)?;
            let status = update["status"].as_str().unwrap_or("unknown").to_string();
            let include = match mode {
                "updates" => status == "update_available",
                "all" => status == "update_available" || status == "not_installed",
                _ => false,
            };
            if !include {
                return None;
            }
            let phase = install_phase_for_source(&source);
            let priority = install_priority_for_source(&source);
            Some(InstallPlanEntry {
                id: source.id.clone(),
                name: source.name.clone(),
                status,
                phase: phase.clone(),
                phase_label: install_phase_label(&phase).to_string(),
                priority,
                installed: update["installed"].as_bool().unwrap_or(false),
                has_update: update["has_update"].as_bool().unwrap_or(false),
                local_version: update["local_version"].as_str().unwrap_or("").to_string(),
                remote_version: update["remote_version"].as_str().unwrap_or("").to_string(),
            })
        })
        .collect();

    let phase_summary = ["core_cfw", "bootloader", "standard"]
        .into_iter()
        .filter_map(|phase| {
            let count = entries.iter().filter(|entry| entry.phase == phase).count();
            if count == 0 {
                None
            } else {
                Some(InstallPlanPhaseSummary {
                    phase: phase.to_string(),
                    label: install_phase_label(phase).to_string(),
                    count,
                })
            }
        })
        .collect::<Vec<_>>();

    Ok(InstallPlanResponse {
        mode: mode.to_string(),
        total_count: entries.len(),
        entries,
        phase_summary,
    })
}




pub fn open_external_url(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut cmd = std::process::Command::new("explorer");
        cmd.arg(url);
        hide_windows_command(&mut cmd);
        cmd
    };
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut cmd = std::process::Command::new("open");
        cmd.arg(url);
        cmd
    };
    #[cfg(target_os = "linux")]
    let mut command = {
        let mut cmd = std::process::Command::new("xdg-open");
        cmd.arg(url);
        cmd
    };

    command
        .spawn()
        .map_err(|e| format!("Failed to open {}: {}", url, e))?;
    Ok(())
}

pub async fn check_updates_logic(state: &AppState) -> Result<Vec<Value>, String> {
    check_updates_logic_with_progress(state, None).await
}

pub async fn check_updates_logic_with_progress(state: &AppState, app: Option<&tauri::AppHandle>) -> Result<Vec<Value>, String> {
    use crate::core::manifest::ManifestManager;
    use crate::core::utils::clean_version;

    let (sources_path, manifest_path, user_agent) = {
        let cm = state.config_mgr.lock().unwrap();
        let app_config = state.app_config.lock().unwrap();
        let (sources_path, manifest_path) = source_paths(&cm, &app_config);
        let user_agent = app_config
            .network
            .get("user_agent")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        (sources_path, manifest_path, user_agent)
    };
    let sources = load_sources_file(&sources_path)?;
    let manifest_mgr = ManifestManager::new(manifest_path);
    let total = sources.len();

    let mut results = Vec::new();
    for (index, source) in sources.iter().enumerate() {
        emit_progress(app, "scan", format!("Scanning source {}/{}: {}", index + 1, total, source.name), Some(source.id.clone()), Some(index + 1), Some(total));
        let downloader = crate::core::downloader::Downloader::new(user_agent.as_deref());
        let manifest_entry = manifest_mgr.data.entries.get(&source.id).cloned();
        let mut status = "up_to_date".to_string();
        let mut remote_ver = "unknown".to_string();
        let mut local_ver = manifest_entry.as_ref().map(|e| clean_version(&e.version)).unwrap_or_default();
        let tracked_exists = manifest_entry.as_ref().map(|entry| entry.files.iter().any(|f| PathBuf::from(f).exists())).unwrap_or(false);
        let installed = manifest_entry.is_some() && tracked_exists;
        let prerelease = source.prerelease.or(source.source.as_ref().and_then(|sd| sd.prerelease)).unwrap_or(false);
        let repo = source.github_repo.as_ref().or(source.source.as_ref().and_then(|sd| sd.repo.as_ref())).map(|s| s.as_str());
        if let Some(r) = repo {
            let alt = source.alt_github_repo.as_ref().or(source.alt_source.as_ref().and_then(|sd| sd.repo.as_ref())).map(|s| s.as_str());
            let s_type = source.source.as_ref().map(|sd| sd.kind.as_str()).unwrap_or("github_release");
            let a_type = source.alt_source.as_ref().map(|sd| sd.kind.as_str());
            if let Ok(meta) = downloader.get_release_metadata(r, alt, s_type, a_type, prerelease).await {
                remote_ver = clean_version(&meta.tag_name);
                emit_progress(app, "scan", format!("Resolved release metadata for {}", source.name), Some(source.id.clone()), Some(index + 1), Some(total));
            } else {
                status = "error".to_string();
            }
        } else if source.tinfoil.unwrap_or(false) || source.source.as_ref().map(|sd| sd.kind == "tinfoil_scrape").unwrap_or(false) {
            if let Ok(meta) = downloader.fetch_tinfoil_metadata().await {
                remote_ver = clean_version(&meta.tag_name);
            } else {
                status = "error".to_string();
            }
        }
        if !installed {
            local_ver.clear();
            if status != "error" {
                status = "not_installed".to_string();
            }
        } else if status != "error" && !remote_ver.is_empty() && remote_ver != "unknown" && remote_ver != local_ver {
            status = "update_available".to_string();
        }
        let phase = install_phase_for_source(source);
        results.push(serde_json::json!({
            "id": source.id,
            "name": source.name,
            "local_version": local_ver,
            "remote_version": remote_ver,
            "status": status,
            "has_update": status == "update_available",
            "installed": installed,
            "install_phase": phase,
            "install_priority": install_priority_for_source(source),
            "phase_label": install_phase_label(&install_phase_for_source(source)),
        }));
    }
    results.sort_by(|a, b| a["name"].as_str().unwrap_or("").cmp(b["name"].as_str().unwrap_or("")));
    Ok(results)
}


pub async fn run_update_logic(state: &AppState, ids: Vec<String>) -> Result<String, String> {
    run_update_logic_with_progress(state, ids, None).await
}

pub async fn run_update_logic_with_progress(state: &AppState, ids: Vec<String>, app: Option<&tauri::AppHandle>) -> Result<String, String> {
    use crate::core::archive::ArchiveHandler;
    use crate::core::manifest::ManifestManager;
    use crate::core::payload::PayloadManager;

    let portable_settings = current_portable_settings(state);
    let (sources_path, manifest_path, temp_dir, smart_paths, archive_rules, user_agent, sd_root, rcm_root, payload_settings) = {
        let cm = state.config_mgr.lock().unwrap();
        let app_config = state.app_config.lock().unwrap();
        let (sources_path, manifest_path) = source_paths(&cm, &app_config);
        let temp_dir = cm.resolve_data_file(app_config.paths.get("temp_dir").map(|s| s.as_str()), "temp");
        let smart_paths = app_config.smart_paths.clone();
        let archive_rules = app_config.archive_rules.clone();
        let user_agent = app_config.network.get("user_agent").and_then(|v| v.as_str()).map(|s| s.to_string());
        (
            sources_path,
            manifest_path,
            temp_dir,
            smart_paths,
            archive_rules,
            user_agent,
            cm.sd_root.clone(),
            cm.rcm_root.clone(),
            crate::core::payload::PayloadOutputSettings {
                enabled: portable_settings.payload_output_enabled,
                naming_template: portable_settings.payload_naming_template.clone(),
            },
        )
    };
    let sources = load_sources_file(&sources_path)?;
    let source_map: HashMap<String, Source> = sources.into_iter().map(|s| (s.id.clone(), s)).collect();
    let mut manifest_mgr = ManifestManager::new(manifest_path);
    let archive_handler = ArchiveHandler::new(archive_rules.valid_tops, archive_rules.global_blacklist, archive_rules.allowed_root_exts, archive_rules.skip_root_stems);
    let payload_mgr = PayloadManager::new(sd_root.clone(), rcm_root.clone(), payload_settings);
    let mut planned_sources = Vec::new();
    for id in ids {
        let source = source_map.get(&id).ok_or(format!("Source {} not found", id))?.clone();
        planned_sources.push(source);
    }
    sort_sources_for_install(&mut planned_sources);
    let total = planned_sources.len();

    for (index, source) in planned_sources.into_iter().enumerate() {
        let id = source.id.clone();
        let downloader = crate::core::downloader::Downloader::new(user_agent.as_deref());
        emit_progress(app, "update", format!("Resolving release for {}/{}: {}", index + 1, total, source.name), Some(id.clone()), Some(index + 1), Some(total));
        let prerelease = source.prerelease.or(source.source.as_ref().and_then(|sd| sd.prerelease)).unwrap_or(false);
        let blacklist = source.blacklist.clone().or_else(|| source.source.as_ref().and_then(|sd| sd.blacklist.clone())).unwrap_or_default();
        let meta = if source.tinfoil.unwrap_or(false) || source.source.as_ref().map(|sd| sd.kind == "tinfoil_scrape").unwrap_or(false) {
            downloader.fetch_tinfoil_metadata().await.map_err(|e: anyhow::Error| e.to_string())?
        } else {
            let repo = source.github_repo.as_ref().or(source.source.as_ref().and_then(|sd| sd.repo.as_ref())).ok_or_else(|| format!("No repo for {}", id))?;
            let alt = source.alt_github_repo.as_ref().or(source.alt_source.as_ref().and_then(|sd| sd.repo.as_ref())).map(|s| s.as_str());
            let s_type = source.source.as_ref().map(|sd| sd.kind.as_str()).unwrap_or("github_release");
            let a_type = source.alt_source.as_ref().map(|sd| sd.kind.as_str());
            downloader.get_release_metadata(repo, alt, s_type, a_type, prerelease).await.map_err(|e: anyhow::Error| e.to_string())?
        };

        let asset = meta.assets.iter().find(|a| {
            let name = a.name.to_lowercase();
            (name.ends_with(".zip") || name.ends_with(".nro") || name.ends_with(".ovl") || name.ends_with(".bin") || name.ends_with(".kip")) && !blacklist.iter().any(|b| wildmatch::WildMatch::new(&b.to_lowercase()).matches(&name))
        }).ok_or(format!("No valid asset found for {}", id))?;

        let tmp_path = temp_dir.join(&asset.name);
        emit_progress(app, "update", format!("Downloading {}", asset.name), Some(id.clone()), Some(index + 1), Some(total));
        let hash = downloader.download_file(&asset.browser_download_url, &tmp_path).await.map_err(|e| e.to_string())?;
        let old_files = manifest_mgr.get_files(&id);
        archive_handler.surgical_wipe(old_files);
        let mut tracked_files = Vec::new();
        let name_lower = asset.name.to_lowercase();

        if name_lower.ends_with(".zip") {
            emit_progress(app, "update", format!("Extracting {} to SD", asset.name), Some(id.clone()), Some(index + 1), Some(total));
            let ext_files = archive_handler.extract_zip(&tmp_path, &sd_root, &blacklist).map_err(|e| e.to_string())?;
            tracked_files.extend(ext_files);
        } else {
            let install_to = if let Some(dir) = &source.install_dir {
                state.config_mgr.lock().unwrap().resolve_target_path(dir)
            } else {
                let ext = format!(".{}", asset.name.split('.').next_back().unwrap_or(""));
                smart_paths.get(&ext).cloned().map(|p| state.config_mgr.lock().unwrap().resolve_target_path(&p)).unwrap_or_else(|| sd_root.clone())
            };
            emit_progress(app, "update", format!("Installing {} to {}", asset.name, install_to.display()), Some(id.clone()), Some(index + 1), Some(total));
            let p = archive_handler.install_single_file(&tmp_path, &install_to, Some(&asset.name)).map_err(|e| e.to_string())?;
            tracked_files.push(p);
        }

        let mut mirrored_files = Vec::new();
        for f in &tracked_files {
            let extra = payload_mgr.process_file(f, source.payload_info.as_ref());
            if !extra.is_empty() {
                emit_progress(app, "update", format!("Mirroring boot bins for {}", source.name), Some(id.clone()), Some(index + 1), Some(total));
            }
            mirrored_files.extend(extra);
        }
        tracked_files.extend(mirrored_files);
        state.config_mgr.lock().unwrap().check_and_apply_after_update(&tracked_files, &id).map_err(|e| e.to_string())?;
        manifest_mgr.update_entry(id.clone(), meta.tag_name.clone(), tracked_files, Some(hash));
        let _ = std::fs::remove_file(tmp_path);
    }
    let _ = state.config_mgr.lock().unwrap().apply_custom_stuff();
    Ok("Batch Update Complete".into())
}

pub async fn run_remote_update_logic_with_progress(
    state: &AppState,
    ids: Vec<String>,
    remote_root: String,
    app: Option<&tauri::AppHandle>,
) -> Result<String, String> {
    use crate::core::archive::ArchiveHandler;

    let (sources_path, temp_dir, smart_paths, archive_rules, user_agent, sd_root) = {
        let cm = state.config_mgr.lock().unwrap();
        let app_config = state.app_config.lock().unwrap();
        let (sources_path, _) = source_paths(&cm, &app_config);
        let temp_dir = cm.resolve_data_file(app_config.paths.get("temp_dir").map(|s| s.as_str()), "temp");
        let smart_paths = app_config.smart_paths.clone();
        let archive_rules = app_config.archive_rules.clone();
        let user_agent = app_config.network.get("user_agent").and_then(|v| v.as_str()).map(|s| s.to_string());
        (sources_path, temp_dir, smart_paths, archive_rules, user_agent, cm.sd_root.clone())
    };

    let sources = load_sources_file(&sources_path)?;
    let source_map: HashMap<String, Source> = sources.into_iter().map(|source| (source.id.clone(), source)).collect();
    let archive_handler = ArchiveHandler::new(
        archive_rules.valid_tops,
        archive_rules.global_blacklist,
        archive_rules.allowed_root_exts,
        archive_rules.skip_root_stems,
    );

    let mut planned_sources = Vec::new();
    for id in ids {
        planned_sources.push(
            source_map
                .get(&id)
                .ok_or_else(|| format!("Source {} not found", id))?
                .clone(),
        );
    }
    sort_sources_for_install(&mut planned_sources);
    let total = planned_sources.len();
    let remote_root = if remote_root.trim().is_empty() {
        "/".to_string()
    } else {
        let normalized = remote_root.replace('\\', "/");
        if normalized.starts_with('/') {
            normalized
        } else {
            format!("/{}", normalized.trim_start_matches('/'))
        }
    };

    for (index, source) in planned_sources.into_iter().enumerate() {
        let downloader = crate::core::downloader::Downloader::new(user_agent.as_deref());
        let source_id = source.id.clone();
        let prerelease = source
            .prerelease
            .or(source.source.as_ref().and_then(|descriptor| descriptor.prerelease))
            .unwrap_or(false);
        let blacklist = source
            .blacklist
            .clone()
            .or_else(|| source.source.as_ref().and_then(|descriptor| descriptor.blacklist.clone()))
            .unwrap_or_default();
        emit_progress(
            app,
            "ssh",
            format!("Preparing SSH transfer for {}/{}: {}", index + 1, total, source.name),
            Some(source_id.clone()),
            Some(index + 1),
            Some(total),
        );

        let metadata = if source.tinfoil.unwrap_or(false)
            || source
                .source
                .as_ref()
                .map(|descriptor| descriptor.kind == "tinfoil_scrape")
                .unwrap_or(false)
        {
            downloader
                .fetch_tinfoil_metadata()
                .await
                .map_err(|e: anyhow::Error| e.to_string())?
        } else {
            let repo = source
                .github_repo
                .as_ref()
                .or(source.source.as_ref().and_then(|descriptor| descriptor.repo.as_ref()))
                .ok_or_else(|| format!("No repo configured for {}", source_id))?;
            let alt_repo = source
                .alt_github_repo
                .as_ref()
                .or(source.alt_source.as_ref().and_then(|descriptor| descriptor.repo.as_ref()))
                .map(|value| value.as_str());
            let source_type = source
                .source
                .as_ref()
                .map(|descriptor| descriptor.kind.as_str())
                .unwrap_or("github_release");
            let alt_type = source.alt_source.as_ref().map(|descriptor| descriptor.kind.as_str());
            downloader
                .get_release_metadata(repo, alt_repo, source_type, alt_type, prerelease)
                .await
                .map_err(|e: anyhow::Error| e.to_string())?
        };

        let asset = metadata
            .assets
            .iter()
            .find(|asset| {
                let name = asset.name.to_lowercase();
                (name.ends_with(".zip")
                    || name.ends_with(".nro")
                    || name.ends_with(".ovl")
                    || name.ends_with(".bin")
                    || name.ends_with(".kip"))
                    && !blacklist.iter().any(|pattern| {
                        wildmatch::WildMatch::new(&pattern.to_lowercase()).matches(&name)
                    })
            })
            .ok_or_else(|| format!("No valid asset found for {}", source_id))?;

        let tmp_path = temp_dir.join("ssh_downloads").join(&asset.name);
        let stage_root = temp_dir.join("ssh_stage").join(&source_id);
        let _ = std::fs::remove_dir_all(&stage_root);
        std::fs::create_dir_all(&stage_root).map_err(|e| e.to_string())?;

        emit_progress(
            app,
            "ssh",
            format!("Downloading {} for remote transfer", asset.name),
            Some(source_id.clone()),
            Some(index + 1),
            Some(total),
        );
        downloader
            .download_file(&asset.browser_download_url, &tmp_path)
            .await
            .map_err(|e| e.to_string())?;

        if asset.name.to_lowercase().ends_with(".zip") {
            archive_handler
                .extract_zip(&tmp_path, &stage_root, &blacklist)
                .map_err(|e| e.to_string())?;
        } else {
            let install_to = if let Some(dir) = &source.install_dir {
                state.config_mgr.lock().unwrap().resolve_target_path(dir)
            } else {
                let extension = format!(".{}", asset.name.split('.').next_back().unwrap_or(""));
                smart_paths
                    .get(&extension)
                    .map(|path| state.config_mgr.lock().unwrap().resolve_target_path(path))
                    .unwrap_or_else(|| sd_root.clone())
            };
            let relative_dir = install_to
                .strip_prefix(&sd_root)
                .map_err(|_| format!("Install path for {} is outside the SD target", source.name))?;
            let destination_dir = stage_root.join(relative_dir);
            archive_handler
                .install_single_file(&tmp_path, &destination_dir, Some(&asset.name))
                .map_err(|e| e.to_string())?;
        }

        emit_progress(
            app,
            "ssh",
            format!("Uploading {} to {}", source.name, remote_root),
            Some(source_id.clone()),
            Some(index + 1),
            Some(total),
        );
        let uploaded_count = {
            let session = state.ssh_session.lock().unwrap();
            let manager = session.as_ref().ok_or("Not connected")?;
            manager
                .upload_tree(&stage_root, &remote_root)
                .map_err(|e: anyhow::Error| e.to_string())?
                .len()
        };
        emit_progress(
            app,
            "ssh",
            format!("Transferred {} file(s) for {}", uploaded_count, source.name),
            Some(source_id),
            Some(index + 1),
            Some(total),
        );

        let _ = std::fs::remove_file(&tmp_path);
        let _ = std::fs::remove_dir_all(&stage_root);
    }

    Ok("Remote transfer complete. Local manifest was not modified.".to_string())
}










































#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use crate::core::config::{AppConfig, ArchiveRules, ConfigManager};
    use crate::core::downloader::Downloader;
    use std::env;

    let current_exe = env::current_exe().expect("Failed to get current executable path");
    let exe_dir = current_exe.parent().expect("Failed to get exe directory").to_path_buf();
    let legacy_settings_path = exe_dir.join("portable_settings.json");
    let p_settings_path = exe_dir.join("switch-sd-updater_settings.json");
    let mut workspace_root = exe_dir.clone();
    let mut data_root = exe_dir.join("data");
    let mut sd_root = exe_dir.join("SD");
    let mut rcm_root = exe_dir.join("RCMLoader");
    let mut custom_stuff_root = exe_dir.join("Custom_stuff");

    let settings_to_read = if p_settings_path.exists() {
        Some(p_settings_path.clone())
    } else if legacy_settings_path.exists() {
        Some(legacy_settings_path.clone())
    } else {
        None
    };

    if let Some(settings_path) = settings_to_read
        && let Ok(content) = std::fs::read_to_string(&settings_path)
        && let Ok(settings) = serde_json::from_str::<PortableSettings>(&content) {
            workspace_root = settings.workspace_root;
            data_root = settings.data_root;
            sd_root = settings.sd_root;
            rcm_root = settings.rcm_root;
            custom_stuff_root = settings.custom_stuff_root;
            let _ = write_portable_settings(
                &p_settings_path,
                &PortableSettings {
                    workspace_root: workspace_root.clone(),
                    data_root: data_root.clone(),
                    sd_root: sd_root.clone(),
                    rcm_root: rcm_root.clone(),
                    custom_stuff_root: custom_stuff_root.clone(),
                    theme: settings.theme.clone(),
                    payload_output_enabled: settings.payload_output_enabled,
                    payload_naming_template: settings.payload_naming_template.clone(),
                    walkthrough_completed: settings.walkthrough_completed,
                    backup_before_config_apply: settings.backup_before_config_apply,
                },
            );
    }

    let config_mgr = ConfigManager::new(workspace_root, Some(data_root), Some(sd_root), Some(rcm_root), Some(custom_stuff_root));
    let app_config = config_mgr.load_app_config().unwrap_or_else(|_| AppConfig { paths: HashMap::new(), network: HashMap::new(), smart_paths: HashMap::new(), archive_rules: ArchiveRules { valid_tops: vec![], global_blacklist: vec![], allowed_root_exts: vec![], skip_root_stems: vec![] } });
    let downloader = Downloader::new(app_config.network.get("user_agent").and_then(|v| v.as_str()));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState { ssh_session: Mutex::new(None), downloader: Mutex::new(downloader), config_mgr: Mutex::new(config_mgr), app_config: Mutex::new(app_config), portable_settings_path: p_settings_path })
        .invoke_handler(tauri::generate_handler![
            commands::paths::cmd_get_paths,
            commands::paths::cmd_set_paths,
            commands::ui::cmd_get_ui_settings,
            commands::ui::cmd_set_ui_settings,
            commands::blacklist::cmd_get_global_blacklist,
            commands::blacklist::cmd_set_global_blacklist,
            commands::updates::cmd_check_updates,
            commands::updates::cmd_get_install_plan,
            commands::updates::cmd_run_update,
            commands::updates::cmd_run_remote_update,
            commands::updates::cmd_sync_custom_stuff,
            commands::updates::cmd_run_post_install_actions,
            commands::configs::cmd_backup_config_file,
            commands::configs::cmd_list_configs,
            commands::configs::cmd_get_config,
            commands::configs::cmd_update_config,
            commands::configs::cmd_get_raw_config,
            commands::configs::cmd_save_raw_config,
            commands::configs::cmd_enforce_defaults,
            commands::homebrew::cmd_get_installed_homebrew,
            commands::homebrew::cmd_get_icon,
            commands::homebrew::cmd_check_integrity,
            commands::workspace::cmd_validate_workspace,
            commands::workspace::cmd_reset_manifest,
            commands::workspace::cmd_wipe_sd,
            commands::sources::cmd_list_sources,
            commands::sources::cmd_get_sources_raw,
            commands::sources::cmd_save_sources_raw,
            commands::sources::cmd_add_source,
            commands::sources::cmd_update_source,
            commands::sources::cmd_delete_source,
            commands::sources::cmd_bulk_delete_sources,
            commands::sources::cmd_reorder_sources,
            commands::sources::cmd_parse_source_url,
            commands::paths::cmd_detect_storage_targets,
            commands::paths::cmd_open_path_in_file_manager,
            commands::paths::cmd_eject_storage_target,
            commands::paths::cmd_open_external,
            commands::sources::cmd_restore_default_sources,
            commands::sources::cmd_import_sources_file,
            commands::ssh::ssh_connect,
            commands::ssh::ssh_read_config,
            commands::ssh::ssh_write_config,
            commands::configs::cmd_get_raw_config_payload,
            commands::configs::cmd_create_config_file,
            commands::firmware::cmd_get_atmosphere_version,
            commands::firmware::cmd_download_firmware,
            commands::utilities::cmd_write_bootlogo,
            commands::utilities::cmd_test_telemetry_blocks,
            commands::utilities::cmd_benchmark_storage,
            commands::utilities::cmd_validate_retroarch_bios
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
