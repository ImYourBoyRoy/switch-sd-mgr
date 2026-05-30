import type { Dispatch, SetStateAction } from "react";
import { Copy, FolderOpen, LifeBuoy, Save, Wrench } from "lucide-react";
import { PageHeader, PathValue, ThemeToggle } from "../components/ui";
import type { PathConfig, UiSettings, WorkspaceValidation } from "../app-types";

interface SettingsViewProps {
  theme: "dark" | "light";
  saveTheme: (theme: "dark" | "light") => void;
  setShowWalkthrough: (value: boolean) => void;
  uiSettings: UiSettings;
  setUiSettings: Dispatch<SetStateAction<UiSettings>>;
  saveUiSettings: (partial: Partial<UiSettings>, successMessage?: string) => Promise<UiSettings>;
  workspaceValidation: WorkspaceValidation | null;
  pathConfig: PathConfig | null;
  choosePath: (key: keyof PathConfig) => void;
  loadWorkspaceValidation: () => void;
  wipeTargets: () => void;
  resetManifest: () => void;
  globalBlacklist: string;
  setGlobalBlacklist: (value: string) => void;
  saveGlobalBlacklist: () => void;
  copyToClipboard: (value: string, label: string) => void;
  openPathInManager: (value: string) => void;
}

export function SettingsView({
  theme,
  saveTheme,
  setShowWalkthrough,
  uiSettings,
  setUiSettings,
  saveUiSettings,
  workspaceValidation,
  pathConfig,
  choosePath,
  loadWorkspaceValidation,
  wipeTargets,
  resetManifest,
  globalBlacklist,
  setGlobalBlacklist,
  saveGlobalBlacklist,
  copyToClipboard,
  openPathInManager,
}: SettingsViewProps) {
  const pathCards = pathConfig
    ? [
        ["SD target", "sd_root", "Used by active install and update operations."],
        ["Boot Bin path", "rcm_root", "Used when optional payload mirroring is enabled."],
        ["Data root", "data_root", "Stores sources, manifests, backups, and caches."],
        ["Advanced override folder", "custom_stuff_root", "Used for optional post-install file overrides."],
      ]
    : [];

  return (
    <section className="view fade-in">
      <PageHeader
        title="Workspace Settings"
        subtitle="Targets, payload output, safety preferences, desktop appearance, and advanced workspace controls."
      />

      <div className="panel-grid settings-grid">
        <div className="panel elevated-card">
          <div className="panel-header">
            <div>
              <h3>Appearance</h3>
              <small>Dark mode is the default. Changes are written to portable settings immediately.</small>
            </div>
          </div>
          <ThemeToggle theme={theme} onChange={saveTheme} />
          <div className="button-row compact-row">
            <button className="btn-secondary" onClick={() => setShowWalkthrough(true)}>
              <LifeBuoy size={16} />
              Open walkthrough
            </button>
          </div>
        </div>

        <div className="panel elevated-card">
          <div className="panel-header">
            <div>
              <h3>Payload output</h3>
              <small>Optional payload mirroring for RCMLoader-style layouts or any other folder template you prefer.</small>
            </div>
          </div>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={uiSettings.payload_output_enabled}
              onChange={(e) =>
                void saveUiSettings(
                  { payload_output_enabled: e.target.checked },
                  e.target.checked ? "Boot Bin output enabled." : "Boot Bin output disabled.",
                )
              }
            />
            <span>Enable Boot Bin output</span>
          </label>
          <input
            value={uiSettings.payload_naming_template}
            onChange={(e) =>
              setUiSettings((draft) => ({ ...draft, payload_naming_template: e.target.value }))
            }
            onBlur={() =>
              void saveUiSettings(
                { payload_naming_template: uiSettings.payload_naming_template },
                "Boot Bin naming template saved.",
              )
            }
            placeholder="{folder}/payload.bin"
          />
          <small className="inline-helper">Template placeholders: {"{folder}"}, {"{file_name}"}, {"{file_stem}"}.</small>
        </div>

        <div className="panel elevated-card">
          <div className="panel-header">
            <div>
              <h3>Safety</h3>
              <small>Preview config changes first and optionally make quick backups before writes.</small>
            </div>
          </div>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={uiSettings.backup_before_config_apply}
              onChange={(e) =>
                void saveUiSettings(
                  { backup_before_config_apply: e.target.checked },
                  e.target.checked ? "Config backups enabled." : "Config backups disabled.",
                )
              }
            />
            <span>Backup managed config files before saving</span>
          </label>
          <small className="inline-helper">
            Backups land in the data/backups folder inside your workspace when the target file already exists.
          </small>
        </div>

        <div className="panel elevated-card">
          <div className="panel-header">
            <div>
              <h3>Advanced</h3>
              <small>Workspace validation, manifest reset, target cleanup, and direct folder access.</small>
            </div>
          </div>
          <ul className="detail-list">
            <li>Target mode: {pathConfig?.target_mode}</li>
            <li>Missing tracked files: {workspaceValidation?.missing_tracked_files ?? 0}</li>
          </ul>
          <div className="button-row compact-row">
            <button className="btn-secondary" onClick={loadWorkspaceValidation}>
              <Wrench size={16} />
              Revalidate
            </button>
            {pathConfig?.data_root && (
              <button className="btn-secondary" onClick={() => openPathInManager(pathConfig.data_root)}>
                <FolderOpen size={16} />
                Open data folder
              </button>
            )}
            <button className="btn-danger" onClick={wipeTargets}>
              Wipe targets
            </button>
            <button className="btn-danger" onClick={resetManifest}>
              Reset manifest
            </button>
          </div>
        </div>
      </div>

      <div className="settings-path-grid refined-settings-path-grid">
        {pathCards.map(([label, key, helper]) => (
          <article key={key} className="path-card elevated-card">
            <div className="path-card-header">
              <div>
                <h3>{label}</h3>
                <small>{helper}</small>
              </div>
              <div className="button-row compact-row end-row tighter-actions">
                <button className="btn-ghost icon-only" onClick={() => copyToClipboard(pathConfig?.[key as keyof PathConfig] as string, label)} title={`Copy ${label}`}>
                  <Copy size={15} />
                </button>
                <button className="btn-ghost icon-only" onClick={() => openPathInManager(pathConfig?.[key as keyof PathConfig] as string)} title={`Open ${label}`}>
                  <FolderOpen size={15} />
                </button>
                <button className="btn-secondary" onClick={() => choosePath(key as keyof PathConfig)}>
                  Browse
                </button>
              </div>
            </div>
            <PathValue path={pathConfig?.[key as keyof PathConfig] as string} />
          </article>
        ))}
      </div>

      <section className="panel elevated-card">
        <div className="panel-header">
          <div>
            <h3>Global blacklist</h3>
            <small>Patterns here are ignored for every source. Keep noisy readmes, assets, and junk out globally.</small>
          </div>
          <button className="btn-secondary" onClick={saveGlobalBlacklist}>
            <Save size={16} />
            Save blacklist
          </button>
        </div>
        <textarea
          className="editor-area compact"
          value={globalBlacklist}
          onChange={(e) => setGlobalBlacklist(e.target.value)}
          placeholder="One wildcard pattern per line"
        />
      </section>
    </section>
  );
}
