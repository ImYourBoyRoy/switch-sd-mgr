import { RefreshCcw, Settings2 } from "lucide-react";
import { EmptyStateCard, PageHeader } from "../components/ui";
import type { HomebrewMeta } from "../app-types";

interface AppsViewProps {
  homebrew: Record<string, HomebrewMeta>;
  rescan: () => void;
  openSettings: () => void;
  openUpdates: () => void;
}

export function AppsView({ homebrew, rescan, openSettings, openUpdates }: AppsViewProps) {
  const entries = Object.entries(homebrew);

  return (
    <section className="view fade-in">
      <PageHeader
        title="Detected homebrew"
        subtitle="Scan installed NRO and overlay content from the resolved active SD target so you can quickly confirm what is already on the card."
        actions={
          <button className="btn-secondary" onClick={rescan}>
            <RefreshCcw size={16} />
            Rescan
          </button>
        }
      />

      {entries.length ? (
        <div className="card-list">
          {entries.map(([path, meta]) => (
            <article key={path} className="list-card elevated-card two-line-card">
              <div className="card-title-stack">
                <strong>{meta.title}</strong>
                <small>{meta.author || "Unknown author"}</small>
              </div>
              <div className="status-stack">
                <span className="status-pill up_to_date">v{meta.version || "unknown"}</span>
                <small>{path}</small>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyStateCard
          title="No homebrew detected yet"
          description="That usually means the active SD target is still empty, pointed at the wrong folder, or waiting for your first install pass."
          actions={
            <div className="button-row compact-row">
              <button className="btn-primary" onClick={openUpdates}>
                Open updates
              </button>
              <button className="btn-secondary" onClick={openSettings}>
                <Settings2 size={16} />
                Review targets
              </button>
            </div>
          }
        />
      )}
    </section>
  );
}
