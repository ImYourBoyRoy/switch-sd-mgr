import { Download, RefreshCcw, Search } from "lucide-react";
import { EmptyStateCard, PageHeader } from "../components/ui";
import type { GroupedUpdateSection, InstallPlanResponse } from "../app-types";

interface UpdatesViewProps {
  installPlanAll: InstallPlanResponse | null;
  installPlanUpdates: InstallPlanResponse | null;
  groupedUpdates: GroupedUpdateSection[];
  filteredUpdatesCount: number;
  updateQuery: string;
  setUpdateQuery: (value: string) => void;
  isUpdating: boolean;
  isSearching: boolean;
  runPlannedUpdate: (mode: "all" | "updates") => void;
  runUpdate: (ids: string[]) => void;
  fetchUpdates: () => void;
  openSources: () => void;
}

export function UpdatesView({
  installPlanAll,
  installPlanUpdates,
  groupedUpdates,
  filteredUpdatesCount,
  updateQuery,
  setUpdateQuery,
  isUpdating,
  isSearching,
  runPlannedUpdate,
  runUpdate,
  fetchUpdates,
  openSources,
}: UpdatesViewProps) {
  const hasAnyQueue = Boolean(installPlanAll?.entries.length);

  return (
    <section className="view fade-in">
      <PageHeader
        title="Updates"
        subtitle="A denser setup queue for clean installs, core-first refreshes, and ongoing package maintenance."
        actions={
          <div className="button-row compact-row">
            <button
              className="btn-secondary"
              disabled={!installPlanAll?.total_count || isUpdating}
              onClick={() => runPlannedUpdate("all")}
            >
              <Download size={16} />
              Install all
            </button>
            <button
              className="btn-secondary"
              disabled={!installPlanUpdates?.total_count || isUpdating}
              onClick={() => runPlannedUpdate("updates")}
            >
              <Download size={16} />
              Install updates
            </button>
            <button className="btn-secondary" onClick={fetchUpdates} disabled={isSearching}>
              <RefreshCcw size={16} className={isSearching ? "spin" : ""} />
              Refresh
            </button>
          </div>
        }
      />

      <div className="updates-shell">
        <div className="updates-toolbar elevated-card">
          <div className="search-box">
            <Search size={16} />
            <input
              value={updateQuery}
              onChange={(e) => setUpdateQuery(e.target.value)}
              placeholder="Search packages, ids, or phases"
            />
          </div>
          <div className="updates-toolbar-meta">
            <span>{filteredUpdatesCount} visible</span>
            <span>Install order: Atmosphere → Hekate → everything else</span>
          </div>
        </div>

        <div className="updates-plan-card elevated-card compact-plan-panel">
          <div className="panel-header">
            <div>
              <h3>Batch install preview</h3>
              <small>Install all follows the phased sequence below.</small>
            </div>
          </div>
          <div className="phase-plan">
            {(installPlanAll?.phase_summary || []).map((phase) => (
              <div key={phase.phase} className="phase-chip">
                <span>{phase.label}</span>
                <strong>{phase.count}</strong>
              </div>
            ))}
          </div>
          <div className="plan-preview-list compact compact-plan-list">
            {(installPlanAll?.entries || []).slice(0, 6).map((entry, index) => (
              <div key={entry.id} className="plan-preview-item">
                <span>{index + 1}</span>
                <div>
                  <strong>{entry.name}</strong>
                  <small>
                    {entry.phase_label} · {entry.status.replace(/_/g, " ")}
                  </small>
                </div>
              </div>
            ))}
            {!installPlanAll?.entries.length && <p className="empty-inline">Nothing queued right now.</p>}
          </div>
        </div>

        {!hasAnyQueue && (
          <EmptyStateCard
            title="Nothing queued yet"
            description="If this is a fresh workspace, add or restore sources first. Otherwise run a scan to refresh install status."
            actions={
              <div className="button-row compact-row">
                <button className="btn-primary" onClick={fetchUpdates} disabled={isSearching}>
                  Run scan
                </button>
                <button className="btn-secondary" onClick={openSources}>
                  Open sources
                </button>
              </div>
            }
          />
        )}

        {groupedUpdates.map((section) => (
          <section key={section.key} className="update-section">
            <div className="update-section-header">
              <div>
                <h3>{section.title}</h3>
                <small>{section.subtitle}</small>
              </div>
              <span className="count-badge">{section.items.length}</span>
            </div>
            <div className="update-section-grid">
              {section.items.map((item) => (
                <article key={item.id} className="update-card elevated-card">
                  <div className="update-card-top">
                    <div className="card-title-stack">
                      <strong>{item.name}</strong>
                      <small>{item.id}</small>
                    </div>
                    <div className="update-card-badges">
                      {item.phase_label && <span className="phase-badge">{item.phase_label}</span>}
                      <span className={`status-pill ${item.status}`}>{item.status.replace(/_/g, " ")}</span>
                    </div>
                  </div>
                  <div className="update-card-details">
                    <div>
                      <label>Version</label>
                      <p>
                        {item.installed
                          ? `${item.local_version || "?"} → ${item.remote_version || "?"}`
                          : `Latest: ${item.remote_version || "unknown"}`}
                      </p>
                    </div>
                    <div>
                      <label>Order</label>
                      <p>#{item.install_priority ?? 1000}</p>
                    </div>
                  </div>
                  <div className="update-card-actions">
                    <button className="btn-primary" disabled={isUpdating} onClick={() => runUpdate([item.id])}>
                      {item.installed ? (item.has_update ? "Update" : "Reinstall") : "Install"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        {!groupedUpdates.length && updateQuery.trim() && (
          <EmptyStateCard
            title="No packages match this filter"
            description="Try a shorter search term, clear the filter, or refresh the scan if source data may have changed."
          />
        )}
      </div>
    </section>
  );
}
