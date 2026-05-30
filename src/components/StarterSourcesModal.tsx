import { Download, FileUp, PlusCircle, Sparkles } from "lucide-react";

interface StarterSourcesModalProps {
  open: boolean;
  close: () => void;
  startFresh: () => void;
  importLocal: () => void;
  useBundledDefaults: () => void;
}

export function StarterSourcesModal({
  open,
  close,
  startFresh,
  importLocal,
  useBundledDefaults,
}: StarterSourcesModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal elevated-card starter-modal">
        <div className="panel-header">
          <div>
            <h2>Choose how to begin</h2>
            <small>Stay empty, import your own source file, or start from the bundled core starter set.</small>
          </div>
          <button className="btn-ghost" onClick={close}>
            Close
          </button>
        </div>

        <div className="starter-choice-grid">
          <button className="starter-choice-card elevated-subcard" onClick={useBundledDefaults}>
            <span className="starter-choice-icon">
              <Sparkles size={18} />
            </span>
            <strong>Use bundled starter sources</strong>
            <p>Load the packaged baseline so Atmosphere, Hekate, and your core setup can be scanned immediately.</p>
            <small>Best for first-time setup and fast recovery.</small>
          </button>

          <button className="starter-choice-card elevated-subcard" onClick={importLocal}>
            <span className="starter-choice-icon">
              <FileUp size={18} />
            </span>
            <strong>Import local JSON</strong>
            <p>Bring in an existing sources file from disk when you already maintain your own curated source set.</p>
            <small>Best for experienced users and backup restores.</small>
          </button>

          <button className="starter-choice-card elevated-subcard" onClick={startFresh}>
            <span className="starter-choice-icon">
              <PlusCircle size={18} />
            </span>
            <strong>Start fresh</strong>
            <p>Keep the list empty and add sources one by one with URL autofill and install-order controls.</p>
            <small>Best when you want a fully custom stack.</small>
          </button>
        </div>

        <div className="starter-modal-footer">
          <small>
            Starter sources stay external in your workspace data folder, so they can be replaced or versioned without
            embedding them into the app binary.
          </small>
          <button className="btn-secondary" onClick={useBundledDefaults}>
            <Download size={16} />
            Use starter sources
          </button>
        </div>
      </div>
    </div>
  );
}
