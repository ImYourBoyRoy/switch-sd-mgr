import { Save } from "lucide-react";
import type { StructuredConfigChange } from "../app-types";

interface StructuredConfigPreviewModalProps {
  open: boolean;
  changes: StructuredConfigChange[];
  close: () => void;
  save: () => void;
}

export function StructuredConfigPreviewModal({
  open,
  changes,
  close,
  save,
}: StructuredConfigPreviewModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal wide elevated-card">
        <div className="panel-header">
          <div>
            <h2>Structured config preview</h2>
            <small>Review staged key/value changes before saving.</small>
          </div>
        </div>
        <div className="diff-list">
          {changes.map((change) => (
            <article key={`${change.section}-${change.key}`} className="diff-item">
              <div>
                <strong>
                  [{change.section}] {change.key}
                </strong>
                <small>{change.valueType || "value"}</small>
              </div>
              <div className="diff-columns">
                <code>- {change.previous || "(empty)"}</code>
                <code>+ {change.next || "(empty)"}</code>
              </div>
            </article>
          ))}
        </div>
        <div className="button-row compact-row end-row">
          <button className="btn-secondary" onClick={close}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save}>
            <Save size={16} />
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
