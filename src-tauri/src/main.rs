// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use clap::{Parser, Subcommand};
use std::collections::HashMap;
use switch_sd_mgr_lib as lib;

#[derive(Parser)]
#[command(name = "sd-updater")]
#[command(about = "Modern Switch SD Card Updater", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    Check { #[arg(short, long)] id: Option<String> },
    Update { ids: Vec<String>, #[arg(short, long)] all: bool },
    List,
    Sync,
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    let current_dir = std::env::current_dir().unwrap_or_default();
    let config_mgr = lib::core::config::ConfigManager::new(
        current_dir.clone(),
        Some(current_dir.join("configs")),
        Some(current_dir.join("SD")),
        Some(current_dir.join("RCMLoader")),
        Some(current_dir.join("Custom_stuff")),
    );
    let app_config = config_mgr.load_app_config().unwrap_or_else(|_| lib::core::config::AppConfig {
        paths: HashMap::new(),
        network: HashMap::new(),
        smart_paths: HashMap::new(),
        archive_rules: lib::core::config::ArchiveRules::default(),
    });

    let state = lib::AppState {
        ssh_session: std::sync::Mutex::new(None),
        downloader: std::sync::Mutex::new(lib::core::downloader::Downloader::new(app_config.network.get("user_agent").and_then(|v| v.as_str()))),
        config_mgr: std::sync::Mutex::new(config_mgr),
        app_config: std::sync::Mutex::new(app_config),
        portable_settings_path: current_dir.join("switch-sd-updater_settings.json"),
    };

    match cli.command {
        Some(Commands::Check { id: _ }) => {
            println!("[INFO] Checking for updates...");
            match lib::check_updates_logic(&state).await {
                Ok(results) => {
                    for res in results {
                        println!(
                            "[{}] {}: {} -> {}",
                            if res["has_update"].as_bool().unwrap_or(false) { "UPDATE" } else { res["status"].as_str().unwrap_or("OK") },
                            res["name"].as_str().unwrap_or("Unknown"),
                            res["local_version"].as_str().unwrap_or("None"),
                            res["remote_version"].as_str().unwrap_or("None")
                        );
                    }
                }
                Err(e) => eprintln!("[ERROR] Check failed: {}", e),
            }
        }
        Some(Commands::Update { ids, all }) => {
            let mut target_ids = ids;
            if all {
                if let Ok(results) = lib::check_updates_logic(&state).await {
                    target_ids = results.iter().filter(|r| r["has_update"].as_bool().unwrap_or(false)).map(|r| r["id"].as_str().unwrap_or("").to_string()).collect();
                }
            }
            if target_ids.is_empty() {
                println!("[INFO] No updates found/specified.");
                return;
            }
            match lib::run_update_logic(&state, target_ids).await {
                Ok(msg) => println!("[SUCCESS] {}", msg),
                Err(e) => eprintln!("[ERROR] Update failed: {}", e),
            }
        }
        Some(Commands::List) => {
            if let Ok(results) = lib::check_updates_logic(&state).await {
                for res in results {
                    if res["installed"].as_bool().unwrap_or(false) {
                        println!("- {} (v{})", res["name"].as_str().unwrap_or("Unknown"), res["local_version"].as_str().unwrap_or(""));
                    }
                }
            }
        }
        Some(Commands::Sync) => match state.config_mgr.lock().unwrap().apply_custom_stuff() {
            Ok(files) => println!("[SUCCESS] Mirrored {} files from Custom_stuff.", files.len()),
            Err(e) => eprintln!("[ERROR] Sync failed: {}", e),
        },
        None => lib::run(),
    }
}
