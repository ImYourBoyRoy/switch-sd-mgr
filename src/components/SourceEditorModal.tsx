import { ExternalLink, Save } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { SourceRecord } from "../app-types";
import { repoUrlForSource } from "../source-utils";

interface SourceEditorModalProps {
  open: boolean;
  editingSourceId: string | null;
  sourceDraft: SourceRecord;
  setSourceDraft: Dispatch<SetStateAction<SourceRecord>>;
  parseSourceUrl: (value: string) => void;
  openExternal: (url: string) => void;
  close: () => void;
  saveSource: () => void;
}

export function SourceEditorModal({
  open,
  editingSourceId,
  sourceDraft,
  setSourceDraft,
  parseSourceUrl,
  openExternal,
  close,
  saveSource,
}: SourceEditorModalProps) {
  if (!open) {
    return null;
  }

  const repoUrl = repoUrlForSource(sourceDraft);

  return (
    <div className="modal-overlay">
      <div className="modal wide elevated-card">
        <div className="panel-header">
          <div>
            <h2>{editingSourceId ? "Edit source" : "Add source"}</h2>
            <small>Start with the basics, then expand into ordering, payload handling, and blacklist rules only when needed.</small>
          </div>
        </div>

        <section className="elevated-subcard">
          <div className="panel-header">
            <div>
              <h3>Basic setup</h3>
              <small>Paste a supported repo URL to auto-fill the essentials, then fine-tune the source id and display name.</small>
            </div>
          </div>
          <div className="field-grid two-col">
            <input placeholder="Paste GitHub/Codeberg URL to autofill" onBlur={(e) => parseSourceUrl(e.target.value)} />
            <div />
            <input
              placeholder="Source id"
              value={sourceDraft.id}
              onChange={(e) => setSourceDraft((draft) => ({ ...draft, id: e.target.value }))}
            />
            <input
              placeholder="Display name"
              value={sourceDraft.name}
              onChange={(e) => setSourceDraft((draft) => ({ ...draft, name: e.target.value }))}
            />
            <input
              placeholder="Primary repo owner/name"
              value={sourceDraft.source?.repo || ""}
              onChange={(e) =>
                setSourceDraft((draft) => ({
                  ...draft,
                  source: { ...(draft.source || {}), repo: e.target.value },
                }))
              }
            />
            <select
              value={sourceDraft.source?.type || "github_release"}
              onChange={(e) =>
                setSourceDraft((draft) => ({
                  ...draft,
                  source: { ...(draft.source || {}), type: e.target.value },
                }))
              }
            >
              <option value="github_release">GitHub</option>
              <option value="codeberg_release">Codeberg</option>
              <option value="tinfoil_scrape">Tinfoil scrape</option>
            </select>
          </div>
          <div className="source-editor-preview elevated-subcard">
            <div className="source-preview-copy">
              <strong>{repoUrl || "Paste a repository URL to auto-fill source details."}</strong>
              <small>{repoUrl ? "Resolved repository preview" : "Repo preview will appear here after autofill or manual entry."}</small>
            </div>
            {repoUrl ? (
              <button className="btn-ghost" onClick={() => openExternal(repoUrl)}>
                <ExternalLink size={16} />
                Open repo
              </button>
            ) : null}
          </div>
        </section>

        <section className="elevated-subcard">
          <div className="panel-header">
            <div>
              <h3>Install behavior</h3>
              <small>Set where the package lands, its default ordering, and any optional payload mapping.</small>
            </div>
          </div>
          <div className="field-grid two-col">
            <input
              placeholder="Install dir (optional)"
              value={sourceDraft.install_dir || ""}
              onChange={(e) => setSourceDraft((draft) => ({ ...draft, install_dir: e.target.value }))}
            />
            <select
              value={sourceDraft.install_phase || "standard"}
              onChange={(e) =>
                setSourceDraft((draft) => ({
                  ...draft,
                  install_phase: e.target.value,
                }))
              }
            >
              <option value="core_cfw">Core CFW</option>
              <option value="bootloader">Bootloader</option>
              <option value="standard">Standard</option>
            </select>
            <input
              placeholder="Install priority (optional number)"
              value={sourceDraft.install_priority?.toString() || ""}
              onChange={(e) =>
                setSourceDraft((draft) => ({
                  ...draft,
                  install_priority: e.target.value.trim() ? Number.parseInt(e.target.value, 10) || 0 : undefined,
                }))
              }
            />
            <input
              placeholder="Alt repo owner/name"
              value={sourceDraft.alt_source?.repo || ""}
              onChange={(e) =>
                setSourceDraft((draft) => ({
                  ...draft,
                  alt_source: {
                    ...(draft.alt_source || {}),
                    repo: e.target.value,
                    type: draft.alt_source?.type || draft.source?.type || "github_release",
                  },
                }))
              }
            />
            <input
              placeholder="Payload folder (optional)"
              value={sourceDraft.payload_info?.folder || ""}
              onChange={(e) =>
                setSourceDraft((draft) => ({
                  ...draft,
                  payload_info: { ...(draft.payload_info || { folder: "", pattern: "" }), folder: e.target.value },
                }))
              }
            />
            <input
              placeholder="Payload pattern (optional)"
              value={sourceDraft.payload_info?.pattern || ""}
              onChange={(e) =>
                setSourceDraft((draft) => ({
                  ...draft,
                  payload_info: { ...(draft.payload_info || { folder: "", pattern: "" }), pattern: e.target.value },
                }))
              }
            />
          </div>
        </section>

        <section className="elevated-subcard">
          <div className="panel-header">
            <div>
              <h3>Asset filters</h3>
              <small>Use blacklist patterns to drop noisy files, screenshots, changelogs, or other junk from this source only.</small>
            </div>
          </div>
          <textarea
            className="editor-area compact"
            placeholder="Blacklist / disallow patterns, one per line"
            value={(sourceDraft.blacklist || []).join("\n")}
            onChange={(e) =>
              setSourceDraft((draft) => ({
                ...draft,
                blacklist: e.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean),
              }))
            }
          />
        </section>

        <div className="button-row compact-row end-row">
          <button className="btn-secondary" onClick={close}>
            Cancel
          </button>
          <button className="btn-primary" onClick={saveSource}>
            <Save size={16} />
            Save source
          </button>
        </div>
      </div>
    </div>
  );
}
