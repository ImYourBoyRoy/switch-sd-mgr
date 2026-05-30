import type { Dispatch, SetStateAction } from "react";
import { FilePlus2, MousePointerClick, Save, Sparkles } from "lucide-react";
import { EmptyStateCard, PageHeader, PathValue } from "../components/ui";
import type {
  ConfigCreateMode,
  ConfigCreationOptions,
  ConfigSchema,
  StructuredConfigChange,
  SwitchIni,
} from "../app-types";

interface ConfigViewProps {
  manageableConfigs: Record<string, ConfigSchema>;
  selectedConfigId: string | null;
  selectConfig: (id: string) => void;
  isConfigLoading: boolean;
  missingConfig: ConfigCreationOptions | null;
  createMissingConfig: (mode: ConfigCreateMode) => void;
  currentConfig: SwitchIni | null;
  setCurrentConfig: Dispatch<SetStateAction<SwitchIni | null>>;
  structuredConfigChanges: StructuredConfigChange[];
  openStructuredPreview: () => void;
  rawConfigContent: string;
  setRawConfigContent: (value: string) => void;
  openRawPreview: () => void;
  saveRawConfig: () => void;
}

export function ConfigView({
  manageableConfigs,
  selectedConfigId,
  selectConfig,
  isConfigLoading,
  missingConfig,
  createMissingConfig,
  currentConfig,
  setCurrentConfig,
  structuredConfigChanges,
  openStructuredPreview,
  rawConfigContent,
  setRawConfigContent,
  openRawPreview,
  saveRawConfig,
}: ConfigViewProps) {
  const selectedSchema = selectedConfigId ? manageableConfigs[selectedConfigId] : null;
  const isTextEditor = Boolean(selectedSchema?.editable_as_text);

  const missingTitle = selectedSchema?.file_type === "hosts" ? "Hosts file not created yet" : "Config file not created yet";
  const missingDescription = selectedSchema?.file_type === "hosts"
    ? "Create it with the managed rules, start with a blank hosts file, or leave it untouched until Atmosphere is in place."
    : "Create it from the packaged template, use managed defaults, or start with a blank file if you want to author it manually.";

  return (
    <section className="view fade-in">
      <PageHeader
        title="Config Manager"
        subtitle="Edit structured config targets cleanly, create missing files with clear intent, and preview changes before saving."
      />
      <div className="config-layout">
        <aside className="config-nav elevated-card">
          {Object.entries(manageableConfigs).map(([id, schema]) => (
            <button
              key={id}
              className={`config-tab ${selectedConfigId === id ? "active" : ""}`}
              onClick={() => selectConfig(id)}
            >
              <strong>{schema.display_name}</strong>
              <small>{schema.description || ""}</small>
            </button>
          ))}
        </aside>

        <div className="panel elevated-card config-panel">
          {selectedConfigId == null && (
            <EmptyStateCard
              title="Choose a config target"
              description="Pick a managed file from the left to inspect it, create it if it is missing, and preview changes before writing anything."
            />
          )}

          {isConfigLoading && <div className="loading-copy">Loading selected config…</div>}

          {selectedConfigId && missingConfig && !isConfigLoading && (
            <div className="missing-config-state">
              <EmptyStateCard
                title={missingTitle}
                description={missingDescription}
                actions={
                  <div className="button-row compact-row">
                    <button
                      className="btn-primary"
                      onClick={() => createMissingConfig(missingConfig.recommended_mode as ConfigCreateMode)}
                    >
                      <Sparkles size={16} />
                      {missingConfig.recommended_label}
                    </button>
                    {missingConfig.template_available && missingConfig.recommended_mode !== "template" && (
                      <button className="btn-secondary" onClick={() => createMissingConfig("template")}>
                        Create from template
                      </button>
                    )}
                    {missingConfig.managed_content_available && missingConfig.recommended_mode !== "managed" && (
                      <button className="btn-secondary" onClick={() => createMissingConfig("managed")}>
                        Create with managed defaults
                      </button>
                    )}
                    <button className="btn-ghost" onClick={() => createMissingConfig("empty")}>
                      <FilePlus2 size={16} />
                      Create empty file
                    </button>
                  </div>
                }
              />

              <div className="missing-config-meta elevated-subcard">
                <div className="field-stack">
                  <span className="form-label">Destination path</span>
                  <PathValue path={missingConfig.path} />
                </div>
                <div className="field-stack">
                  <span className="form-label">Recommended approach</span>
                  <p className="inline-note">{missingConfig.helper_text}</p>
                </div>
                {missingConfig.managed_content_label ? (
                  <div className="field-stack">
                    <span className="form-label">Managed content</span>
                    <p className="inline-note">{missingConfig.managed_content_label}</p>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {currentConfig && !isConfigLoading && (
            <div className="settings-list">
              {currentConfig.sections_order.map((section) => (
                <div key={section} className="section-block elevated-subcard">
                  <h3>{section}</h3>
                  {Object.entries(currentConfig.sections[section] || {}).map(([key, entry]) => (
                    <div key={key} className="form-stack form-stack-inline">
                      <div className="field-copy">
                        <strong>{key}</strong>
                        <small>{entry.value_type || "value"}</small>
                      </div>
                      <input
                        value={entry.value}
                        onChange={(event) =>
                          setCurrentConfig((draft) => {
                            if (!draft) {
                              return draft;
                            }
                            const next = structuredClone(draft);
                            next.sections[section][key].value = event.target.value;
                            return next;
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              ))}
              <div className="button-row compact-row">
                <button
                  className="btn-secondary"
                  disabled={!structuredConfigChanges.length}
                  onClick={openStructuredPreview}
                >
                  <MousePointerClick size={16} />
                  Preview changes
                </button>
                <small className="inline-helper">
                  {structuredConfigChanges.length
                    ? `${structuredConfigChanges.length} staged change(s) ready`
                    : "No staged structured config changes yet."}
                </small>
              </div>
            </div>
          )}

          {selectedConfigId && isTextEditor && !missingConfig && !isConfigLoading && (
            <div className="editor-stack">
              <textarea
                className="editor-area"
                value={rawConfigContent}
                onChange={(event) => setRawConfigContent(event.target.value)}
              />
              <div className="button-row compact-row">
                <button className="btn-secondary" onClick={openRawPreview}>
                  <MousePointerClick size={16} />
                  Preview diff
                </button>
                <button className="btn-primary" onClick={saveRawConfig}>
                  <Save size={16} />
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
