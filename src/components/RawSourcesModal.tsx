// ./src/components/RawSourcesModal.tsx
import { Save } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

interface RawSourcesModalProps {
  open: boolean;
  rawSources: string;
  setRawSources: Dispatch<SetStateAction<string>>;
  close: () => void;
  save: () => void;
}

export function RawSourcesModal({
  open,
  rawSources,
  setRawSources,
  close,
  save,
}: RawSourcesModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal wide elevated-card">
        <div className="panel-header">
          <div>
            <h2>Raw sources.json</h2>
            <small>Edit the full source list directly when you want total control over the portable catalog.</small>
          </div>
        </div>
        <textarea
          className="editor-area"
          value={rawSources}
          onChange={(event) => setRawSources(event.target.value)}
        />
        <div className="button-row compact-row end-row">
          <button className="btn-secondary" onClick={close}>
            Close
          </button>
          <button className="btn-primary" onClick={save}>
            <Save size={16} />
            Save JSON
          </button>
        </div>
      </div>
    </div>
  );
}
