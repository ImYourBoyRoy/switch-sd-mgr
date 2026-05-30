import type { ComponentType } from "react";

export type ThemeMode = "dark" | "light";
export type LogType = "info" | "warn" | "error" | "success";
export type ActiveTab =
  | "dashboard"
  | "updates"
  | "sources"
  | "config"
  | "firmware"
  | "apps"
  | "remote"
  | "utilities"
  | "settings"
  | "logs"
  | "help";

export interface LogEntry {
  message: string;
  type: LogType;
  timestamp: string;
}

export interface UpdateResult {
  id: string;
  name: string;
  local_version: string;
  remote_version: string;
  status: string;
  has_update: boolean;
  installed: boolean;
  install_phase?: string;
  install_priority?: number;
  phase_label?: string;
}

export interface PathConfig {
  workspace_root: string;
  data_root: string;
  custom_stuff_root: string;
  sd_root: string;
  rcm_root: string;
  boot_bin_root?: string;
  target_mode: string;
}

export interface WorkspaceValidation {
  missing_tracked_files: number;
  issues: string[];
}

export interface ConfigSchema {
  display_name: string;
  description?: string;
  editable_as_text?: boolean;
  destination?: string;
  template_path?: string;
  file_type?: string;
  requires_package?: string;
}

export interface IniEntry {
  value: string;
  value_type: string | null;
  enabled: boolean;
}

export interface SwitchIni {
  path: string;
  sections: Record<string, Record<string, IniEntry>>;
  sections_order: string[];
}

export interface ConfigPayload {
  found: boolean;
  path?: string;
  data?: SwitchIni;
  creation?: ConfigCreationOptions;
}

export type ConfigCreateMode = "template" | "managed" | "empty";

export interface ConfigCreationOptions {
  path: string;
  template_available: boolean;
  managed_content_available: boolean;
  managed_content_label?: string;
  recommended_mode: ConfigCreateMode;
  recommended_label: string;
  helper_text: string;
}

export interface RawConfigPayload {
  found: boolean;
  path: string;
  content: string;
  creation: ConfigCreationOptions;
}

export interface SourceDescriptor {
  type?: string;
  kind?: string;
  repo?: string;
  prerelease?: boolean;
  blacklist?: string[];
}

export interface PayloadInfo {
  folder: string;
  pattern: string;
}

export interface SourceRecord {
  id: string;
  name: string;
  source?: SourceDescriptor;
  alt_source?: SourceDescriptor;
  install_dir?: string;
  install_phase?: string;
  install_priority?: number;
  blacklist?: string[];
  payload_info?: PayloadInfo;
  prerelease?: boolean;
  repo_url?: string;
  _installed?: boolean;
  _installed_version?: string;
}

export interface ProgressPayload {
  stage: string;
  message: string;
  source_id?: string;
  current?: number;
  total?: number;
}

export interface UiSettings {
  theme: ThemeMode;
  walkthrough_completed: boolean;
  payload_output_enabled: boolean;
  payload_naming_template: string;
  backup_before_config_apply: boolean;
}

export interface InstallPlanEntry {
  id: string;
  name: string;
  status: string;
  phase: string;
  phase_label: string;
  priority: number;
  installed: boolean;
  has_update: boolean;
  local_version: string;
  remote_version: string;
}

export interface InstallPlanPhaseSummary {
  phase: string;
  label: string;
  count: number;
}

export interface InstallPlanResponse {
  mode: string;
  total_count: number;
  entries: InstallPlanEntry[];
  phase_summary: InstallPlanPhaseSummary[];
}

export interface PostInstallSummary {
  defaults_enforced: number;
  override_files_applied: number;
  applied_files: string[];
}

export interface DetectedStorageTarget {
  path: string;
  label: string;
  kind: string;
  reason: string;
  can_eject: boolean;
}

export interface StructuredConfigChange {
  section: string;
  key: string;
  previous: string;
  next: string;
  valueType: string | null;
}

export interface RawDiffLine {
  kind: "same" | "add" | "remove" | "change";
  before?: string;
  after?: string;
}

export interface HomebrewMeta {
  title: string;
  author: string;
  version: string;
  icon_path: string | null;
}

export interface SummaryCardData {
  label: string;
  value: string;
  description: string;
  actionLabel: string;
  isPath: boolean;
  icon: ComponentType<{ size?: number }>;
  action: () => void;
}

export interface GroupedUpdateSection {
  key: string;
  title: string;
  subtitle: string;
  items: UpdateResult[];
}
