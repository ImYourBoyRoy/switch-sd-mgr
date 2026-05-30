// src-tauri/src/core/config.rs
use super::ini_parser::SwitchIni;
use super::utils;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tracing::info;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConfigSettingSchema {
    #[serde(rename = "type")]
    pub kind: String,
    pub default: Value,
    pub options: Option<Vec<Value>>,
    pub description: Option<String>,
    pub switch_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConfigSectionSchema {
    pub display_name: String,
    pub settings: HashMap<String, ConfigSettingSchema>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct AppConfig {
    pub paths: HashMap<String, String>,
    pub network: HashMap<String, Value>,
    pub archive_rules: ArchiveRules,
    pub smart_paths: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ArchiveRules {
    pub valid_tops: Vec<String>,
    pub global_blacklist: Vec<String>,
    pub allowed_root_exts: Vec<String>,
    pub skip_root_stems: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConfigSchema {
    pub display_name: String,
    pub description: Option<String>,
    pub requires_package: Option<String>,
    pub destination: String,
    pub template_path: Option<String>,
    pub section: Option<String>,
    pub settings: Option<HashMap<String, ConfigSettingSchema>>,
    pub multi_section: Option<bool>,
    pub sections: Option<HashMap<String, ConfigSectionSchema>>,
    pub editable_as_text: Option<bool>,
    pub file_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkspacePaths {
    pub workspace_root: PathBuf,
    pub data_root: PathBuf,
    pub sd_root: PathBuf,
    pub rcm_root: PathBuf,
    pub custom_stuff_root: PathBuf,
}

pub struct ConfigManager {
    pub workspace_root: PathBuf,
    pub data_root: PathBuf,
    pub sd_root: PathBuf,
    pub rcm_root: PathBuf,
    pub custom_dir: PathBuf,
    pub schema_path: PathBuf,
}

impl ConfigManager {
    pub fn new(workspace_root: PathBuf, data_root: Option<PathBuf>, sd_root: Option<PathBuf>, rcm_root: Option<PathBuf>, custom_dir: Option<PathBuf>) -> Self {
        let data_root = data_root.unwrap_or_else(|| workspace_root.join("configs"));
        let sd_root = sd_root.unwrap_or_else(|| workspace_root.join("SD"));
        let rcm_root = rcm_root.unwrap_or_else(|| workspace_root.join("RCMLoader"));
        let custom_dir = custom_dir.unwrap_or_else(|| workspace_root.join("Custom_stuff"));
        let schema_path = data_root.join("switch_configs.json");
        Self {
            workspace_root,
            data_root,
            sd_root,
            rcm_root,
            custom_dir,
            schema_path,
        }
    }

    pub fn workspace_paths(&self) -> WorkspacePaths {
        WorkspacePaths {
            workspace_root: self.workspace_root.clone(),
            data_root: self.data_root.clone(),
            sd_root: self.sd_root.clone(),
            rcm_root: self.rcm_root.clone(),
            custom_stuff_root: self.custom_dir.clone(),
        }
    }

    pub fn apply_workspace_paths(&mut self, paths: WorkspacePaths) {
        self.workspace_root = paths.workspace_root;
        self.data_root = paths.data_root;
        self.sd_root = paths.sd_root;
        self.rcm_root = paths.rcm_root;
        self.custom_dir = paths.custom_stuff_root;
        self.schema_path = self.data_root.join("switch_configs.json");
    }

    pub fn resolve_workspace_relative(&self, raw: &str) -> PathBuf {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return self.workspace_root.clone();
        }

        let path = PathBuf::from(trimmed);
        if path.is_absolute() {
            return path;
        }

        let normalized = trimmed.replace('\\', "/");
        let lower = normalized.to_lowercase();

        if lower == "sd" || lower.starts_with("sd/") {
            let rest = normalized.split_once('/').map(|(_, tail)| tail).unwrap_or("");
            return if rest.is_empty() { self.sd_root.clone() } else { self.sd_root.join(rest) };
        }

        if lower == "rcmloader" || lower.starts_with("rcmloader/") {
            let rest = normalized.split_once('/').map(|(_, tail)| tail).unwrap_or("");
            return if rest.is_empty() { self.rcm_root.clone() } else { self.rcm_root.join(rest) };
        }

        if lower == "data" || lower.starts_with("data/") || lower == "configs" || lower.starts_with("configs/") {
            let rest = normalized.split_once('/').map(|(_, tail)| tail).unwrap_or("");
            return if rest.is_empty() { self.data_root.clone() } else { self.data_root.join(rest) };
        }

        if lower == "custom_stuff" || lower.starts_with("custom_stuff/") {
            let rest = normalized.split_once('/').map(|(_, tail)| tail).unwrap_or("");
            return if rest.is_empty() { self.custom_dir.clone() } else { self.custom_dir.join(rest) };
        }

        self.workspace_root.join(path)
    }

    pub fn resolve_data_file(&self, configured: Option<&str>, default_name: &str) -> PathBuf {
        if let Some(raw) = configured {
            let resolved = self.resolve_workspace_relative(raw);
            if resolved.exists() || Path::new(raw).is_absolute() {
                return resolved;
            }
            let fallback = self.data_root.join(raw);
            if fallback.exists() {
                return fallback;
            }
        }
        self.data_root.join(default_name)
    }

    pub fn resolve_target_path(&self, raw: &str) -> PathBuf {
        self.resolve_workspace_relative(raw)
    }

    pub fn load_schema(&self) -> Result<HashMap<String, ConfigSchema>> {
        let content = fs::read_to_string(&self.schema_path)?;
        let mut full_schema: HashMap<String, Value> = serde_json::from_str(&content)?;

        full_schema.remove("_schema_version");
        full_schema.remove("_description");

        let mut result = HashMap::new();
        for (k, v) in full_schema {
            if let Ok(schema) = serde_json::from_value(v) {
                result.insert(k, schema);
            }
        }
        Ok(result)
    }

    pub fn load_app_config(&self) -> Result<AppConfig> {
        let path = self.data_root.join("config.json");
        let content = fs::read_to_string(path)?;
        Ok(serde_json::from_str(&content)?)
    }

    pub fn save_app_config(&self, config: &AppConfig) -> Result<()> {
        if let Some(parent) = self.data_root.join("config.json").parent() {
            fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(config)?;
        fs::write(self.data_root.join("config.json"), content)?;
        Ok(())
    }

    pub fn compute_hash<P: AsRef<Path>>(path: P) -> Result<String> {
        let mut file = fs::File::open(path)?;
        let mut hasher = Sha256::new();
        let mut buffer = [0u8; 8192];
        use std::io::Read;
        loop {
            let n = file.read(&mut buffer)?;
            if n == 0 {
                break;
            }
            hasher.update(&buffer[..n]);
        }
        Ok(hex::encode(hasher.finalize()))
    }

    pub fn apply_custom_stuff(&self) -> Result<Vec<String>> {
        if !self.custom_dir.exists() {
            return Ok(Vec::new());
        }

        let mut applied = Vec::new();

        for entry in WalkDir::new(&self.custom_dir)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            if entry.file_type().is_file() {
                let rel_path = entry.path().strip_prefix(&self.custom_dir)?;
                let dest_path = self.sd_root.join(rel_path);

                if let Some(parent) = dest_path.parent() {
                    fs::create_dir_all(parent)?;
                }

                utils::retry_op(
                    || fs::copy(entry.path(), &dest_path),
                    5,
                    std::time::Duration::from_millis(1000),
                )?;

                applied.push(rel_path.to_string_lossy().to_string());
            }
        }

        Ok(applied)
    }

    pub fn check_and_apply_after_update(
        &self,
        installed_files: &[PathBuf],
        package_id: &str,
    ) -> Result<Vec<String>> {
        let mut reapplied = Vec::new();

        if self.custom_dir.exists() {
            for installed in installed_files {
                if let Ok(rel_to_sd) = installed.strip_prefix(&self.sd_root) {
                    let custom_source = self.custom_dir.join(rel_to_sd);
                    if custom_source.exists() {
                        info!("   [SYNC] Re-applying custom override: {:?}", rel_to_sd);
                        utils::retry_op(
                            || fs::copy(&custom_source, installed),
                            5,
                            std::time::Duration::from_millis(1000),
                        )?;
                        reapplied.push(rel_to_sd.to_string_lossy().to_string());
                    }
                }
            }
        }

        if let Ok(schema_map) = self.load_schema() {
            for (cid, schema) in schema_map {
                if let Some(pkg) = &schema.requires_package
                    && (pkg == package_id || package_id.is_empty())
                {
                    let _ = self.enforce_config_defaults(&cid, &schema);
                }
            }
        }

        Ok(reapplied)
    }

    pub fn enforce_config_defaults_all(&self) -> Result<()> {
        let _ = self.enforce_config_defaults_all_with_count()?;
        Ok(())
    }

    pub fn enforce_config_defaults_all_with_count(&self) -> Result<usize> {
        let schemas = self.load_schema()?;
        let mut changed_count = 0usize;
        for (id, schema) in schemas {
            if self.enforce_config_defaults(&id, &schema)? {
                changed_count += 1;
            }
        }
        Ok(changed_count)
    }

    pub fn enforce_config_defaults(&self, id: &str, schema: &ConfigSchema) -> Result<bool> {
        let dest = self.resolve_target_path(&schema.destination);
        if !dest.exists()
            && let Some(template) = &schema.template_path
        {
            let t_path = self.resolve_target_path(template);
            if t_path.exists() {
                if let Some(parent) = dest.parent() {
                    fs::create_dir_all(parent)?;
                }
                let _ = fs::copy(t_path, &dest);
            }
        }

        if dest.exists() {
            let mut ini = SwitchIni::parse(&dest)?;
            let mut changed = false;

            if let Some(true) = schema.multi_section {
                if let Some(sections) = &schema.sections {
                    for (s_name, s_schema) in sections {
                        for (key, setting) in &s_schema.settings {
                            let val = setting.default.to_string().trim_matches('"').to_string();
                            let vtype = setting.switch_type.as_deref();
                            if ini.set_value(s_name, key, &val, vtype, true) {
                                changed = true;
                            }
                        }
                    }
                }
            } else {
                let s_name = schema.section.as_deref().unwrap_or("config");
                if let Some(settings) = &schema.settings {
                    for (key, setting) in settings {
                        let val = setting.default.to_string().trim_matches('"').to_string();
                        let vtype = setting.switch_type.as_deref();
                        if ini.set_value(s_name, key, &val, vtype, true) {
                            changed = true;
                        }
                    }
                }
            }

            if changed {
                info!("   [CONFIG] Enforced defaults for {}", id);
                ini.write()?;
            }
            return Ok(changed);
        }
        Ok(false)
    }


    pub fn validate_portable_workspace(&self, manifest_path: &Path) -> Result<WorkspaceValidation> {
        let mut issues = Vec::new();
        let manifest = super::manifest::ManifestManager::new(manifest_path.to_path_buf());
        let mut missing_tracked_files = 0usize;

        for entry in manifest.data.entries.values() {
            for file in &entry.files {
                if !PathBuf::from(file).exists() {
                    missing_tracked_files += 1;
                }
            }
        }

        if missing_tracked_files > 0 {
            issues.push(format!("Manifest tracks {} missing files.", missing_tracked_files));
        }

        if self.data_root.join("configs").exists() {
            issues.push("Nested configs/configs directory detected in portable workspace.".to_string());
        }
        if self.custom_dir.join("Custom_stuff").exists() {
            issues.push("Nested Custom_stuff/Custom_stuff directory detected in portable workspace.".to_string());
        }

        Ok(WorkspaceValidation {
            missing_tracked_files,
            issues,
        })
    }

    pub fn backup_file(&self, path: &Path, label: &str) -> Result<Option<PathBuf>> {
        if !path.exists() {
            return Ok(None);
        }

        let safe_label = label
            .chars()
            .map(|character| if character.is_ascii_alphanumeric() { character } else { '_' })
            .collect::<String>();
        let timestamp = chrono::Utc::now().format("%Y%m%d-%H%M%S").to_string();
        let backup_dir = self.data_root.join("backups").join(timestamp);
        fs::create_dir_all(&backup_dir)?;
        let target = backup_dir.join(format!("{}.bak", safe_label));
        fs::copy(path, &target)?;
        Ok(Some(target))
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct WorkspaceValidation {
    pub missing_tracked_files: usize,
    pub issues: Vec<String>,
}
