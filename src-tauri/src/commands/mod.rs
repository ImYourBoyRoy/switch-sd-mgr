// ./src-tauri/src/commands/mod.rs
/// Domain-specific command aggregators for Switch SD environment manager.
/// Operational Notes: Exposes and registers SSH, paths, UI, blacklist, updates, configs, sources, homebrew, workspace, and firmware commands.

pub mod ssh;
pub mod paths;
pub mod ui;
pub mod blacklist;
pub mod updates;
pub mod configs;
pub mod sources;
pub mod homebrew;
pub mod workspace;
pub mod firmware;
pub mod utilities;
