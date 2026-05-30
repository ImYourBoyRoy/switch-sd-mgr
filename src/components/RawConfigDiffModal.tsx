// ./src/components/RawConfigDiffModal.tsx
import { Save } from "lucide-react";
import type { RawDiffLine } from "../app-types";

interface RawConfigDiffModalProps {
  open: boolean;
  diff: RawDiffLine[];
  close: () => void;
  save: () => void;
}

export function RawConfigDiffModal({ open, diff, close, save }: RawConfigDiffModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal wide elevated-card">
        <div className="panel-header">
          <div>
            <h2>Raw config diff</h2>
            <small>Preview line changes before writing the file back.</small>
          </div>
        </div>
        <div className="raw-diff-view">
          {diff.map((line, index) => (
            <div key={`${line.kind}-${index}`} className={`raw-diff-line ${line.kind}`}>
              <span className="raw-diff-number">{index + 1}</span>
              <code>
                {line.kind === "remove"
                  ? `- ${line.before ?? ""}`
                  : line.kind === "add"
                    ? `+ ${line.after ?? ""}`
                    : line.kind === "change"
                      ? `- ${line.before ?? ""}\n+ ${line.after ?? ""}`
                      : `  ${line.after ?? ""}`}
              </code>
            </div>
          ))}
        </div>
        <div className="button-row compact-row end-row">
          <button className="btn-secondary" onClick={close}>
            Close
          </button>
          <button className="btn-primary" onClick={save}>
            <Save size={16} />
            Save file
          </button>
        </div>
      </div>
    </div>
  );
}
