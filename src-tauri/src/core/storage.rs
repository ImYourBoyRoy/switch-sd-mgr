// src-tauri/src/core/storage.rs
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

#[cfg(target_os = "windows")]
fn hide_windows_command(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedStorageTarget {
    pub path: String,
    pub label: String,
    pub kind: String,
    pub reason: String,
    pub can_eject: bool,
}

pub fn detect_storage_targets() -> Vec<DetectedStorageTarget> {
    #[cfg(target_os = "windows")]
    {
        detect_windows_targets()
    }
    #[cfg(target_os = "macos")]
    {
        detect_unix_mounts(Path::new("/Volumes"), true)
    }
    #[cfg(target_os = "linux")]
    {
        let mut found = detect_unix_mounts(Path::new("/media"), false);
        found.extend(detect_unix_mounts(Path::new("/run/media"), false));
        dedupe_targets(found)
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Vec::new()
    }
}

pub fn open_in_file_manager(path: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut cmd = Command::new("explorer");
        cmd.arg(path);
        hide_windows_command(&mut cmd);
        cmd
    };
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut cmd = Command::new("open");
        cmd.arg(path);
        cmd
    };
    #[cfg(target_os = "linux")]
    let mut command = {
        let mut cmd = Command::new("xdg-open");
        cmd.arg(path);
        cmd
    };

    command
        .spawn()
        .map_err(|e| format!("Failed to open file manager for {}: {}", path, e))?;
    Ok(())
}

pub fn eject_storage_target(path: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let drive = path.trim_end_matches('\\').trim_end_matches('/');
        let script = format!(
            "$shell = New-Object -ComObject Shell.Application; $drive = '{}'; $item = $shell.Namespace(17).ParseName($drive); if ($null -eq $item) {{ exit 1 }}; $item.InvokeVerb('Eject')",
            drive
        );
        let mut command = Command::new("powershell");
        command
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &script]);
        hide_windows_command(&mut command);
        command
            .status()
            .map_err(|e| format!("Failed to eject {}: {}", path, e))
            .and_then(|status| if status.success() { Ok(()) } else { Err(format!("Failed to eject {}", path)) })?;
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("diskutil")
            .args(["eject", path])
            .status()
            .map_err(|e| format!("Failed to eject {}: {}", path, e))
            .and_then(|status| if status.success() { Ok(()) } else { Err(format!("Failed to eject {}", path)) })?;
        Ok(())
    }
    #[cfg(target_os = "linux")]
    {
        let status = Command::new("gio")
            .args(["mount", "-u", path])
            .status();
        match status {
            Ok(ok) if ok.success() => Ok(()),
            Ok(_) | Err(_) => Err(format!("Eject is not available for {}", path)),
        }?;
        Ok(())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("Eject is not supported on this platform".to_string())
    }
}

#[cfg(target_os = "windows")]
fn detect_windows_targets() -> Vec<DetectedStorageTarget> {
    let script = "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,VolumeName,DriveType | ConvertTo-Json -Compress";
    let mut command = Command::new("powershell");
    command.args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", script]);
    hide_windows_command(&mut command);
    let output = command.output();
    let Ok(output) = output else {
        return Vec::new();
    };
    if !output.status.success() {
        return Vec::new();
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() {
        return Vec::new();
    }

    let parsed: serde_json::Value = match serde_json::from_str(&stdout) {
        Ok(value) => value,
        Err(_) => return Vec::new(),
    };
    let items = match parsed {
        serde_json::Value::Array(array) => array,
        other => vec![other],
    };

    let mut targets = Vec::new();
    for item in items {
        let Some(path) = item.get("DeviceID").and_then(|value| value.as_str()) else {
            continue;
        };
        let root = format!("{}\\", path.trim_end_matches('\\'));
        let drive_type = item
            .get("DriveType")
            .and_then(|value| value.as_i64())
            .unwrap_or_default();
        let volume_name = item
            .get("VolumeName")
            .and_then(|value| value.as_str())
            .unwrap_or("");

        let kind = match drive_type {
            2 => "removable",
            3 => "fixed",
            _ => "other",
        };

        let looks_like_switch = looks_like_switch_target(Path::new(&root));
        if drive_type != 2 && !looks_like_switch {
            continue;
        }

        targets.push(DetectedStorageTarget {
            path: root.clone(),
            label: if volume_name.is_empty() {
                path.to_string()
            } else {
                format!("{} ({})", volume_name, path)
            },
            kind: kind.to_string(),
            reason: if looks_like_switch {
                "Detected Switch-like folder layout".to_string()
            } else {
                "Detected removable volume".to_string()
            },
            can_eject: drive_type == 2,
        });
    }

    dedupe_targets(targets)
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn detect_unix_mounts(root: &Path, can_eject: bool) -> Vec<DetectedStorageTarget> {
    let mut targets = Vec::new();
    if !root.exists() {
        return targets;
    }

    let Ok(entries) = std::fs::read_dir(root) else {
        return targets;
    };

    for entry in entries.filter_map(|item| item.ok()) {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        if root.ends_with("media") || root.ends_with("run/media") {
            if let Ok(children) = std::fs::read_dir(&path) {
                for child in children.filter_map(|item| item.ok()) {
                    let child_path = child.path();
                    if child_path.is_dir() {
                        push_unix_target(&mut targets, &child_path, can_eject);
                    }
                }
            }
        } else {
            push_unix_target(&mut targets, &path, can_eject);
        }
    }

    targets
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn push_unix_target(targets: &mut Vec<DetectedStorageTarget>, path: &Path, can_eject: bool) {
    let label = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Mounted volume")
        .to_string();
    let looks_like_switch = looks_like_switch_target(path);
    targets.push(DetectedStorageTarget {
        path: path.to_string_lossy().to_string(),
        label,
        kind: if looks_like_switch { "switch_like" } else { "mounted" }.to_string(),
        reason: if looks_like_switch {
            "Detected Switch-like folder layout".to_string()
        } else {
            "Detected mounted volume".to_string()
        },
        can_eject,
    });
}

fn looks_like_switch_target(path: &Path) -> bool {
    ["Nintendo", "atmosphere", "bootloader", "switch"]
        .iter()
        .any(|name| path.join(name).exists())
}

#[allow(dead_code)]
fn dedupe_targets(targets: Vec<DetectedStorageTarget>) -> Vec<DetectedStorageTarget> {
    let mut seen = std::collections::HashSet::new();
    let mut deduped = Vec::new();
    for target in targets {
        if seen.insert(target.path.clone()) {
            deduped.push(target);
        }
    }
    deduped.sort_by(|a, b| a.path.cmp(&b.path));
    deduped
}
