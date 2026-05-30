import { Download, Folder, RefreshCcw, Search, Settings, ShieldCheck, Sparkles, Wrench, Copy, FolderOpen } from "lucide-react";
import { EmptyStateCard, PathValue, StatCard } from "../components/ui";
import type {
  DetectedStorageTarget,
  InstallPlanResponse,
  PathConfig,
  PostInstallSummary,
  SummaryCardData,
  UiSettings,
  WorkspaceValidation,
} from "../app-types";

interface DashboardViewProps {
  storageTargets: DetectedStorageTarget[];
  loadStorageTargets: () => void;
  useDetectedTarget: (path: string) => void;
  openDetectedTarget: (path: string) => void;
  ejectDetectedTarget: (path: string) => void;
  showSafeEjectReminder: boolean;
  dismissSafeEjectReminder: () => void;
  pathConfig: PathConfig | null;
  uiSettings: UiSettings;
  stats: {
    total: number;
    installed: number;
    updateCount: number;
    notInstalled: number;
  };
  summaryCards: SummaryCardData[];
  isSearching: boolean;
  isUpdating: boolean;
  fetchUpdates: () => void;
  runPlannedUpdate: (mode: "all" | "updates") => void;
  syncCustomStuff: () => void;
  applyPostInstallActions: () => void;
  workspaceValidation: WorkspaceValidation | null;
  loadWorkspaceValidation: () => void;
  resetManifest: () => void;
  setActiveTab: (tab: "settings" | "logs" | "updates" | "sources") => void;
  openStarterSources: () => void;
  installPlanAll: InstallPlanResponse | null;
  installPlanUpdates: InstallPlanResponse | null;
  lastPostInstallSummary: PostInstallSummary | null;
  copyToClipboard: (value: string, label: string) => void;
  openPathInManager: (value: string) => void;
}

export function DashboardView({
  storageTargets,
  loadStorageTargets,
  useDetectedTarget,
  openDetectedTarget,
  ejectDetectedTarget,
  showSafeEjectReminder,
  dismissSafeEjectReminder,
  pathConfig,
  uiSettings,
  stats,
  summaryCards,
  isSearching,
  isUpdating,
  fetchUpdates,
  runPlannedUpdate,
  syncCustomStuff,
  applyPostInstallActions,
  workspaceValidation,
  loadWorkspaceValidation,
  resetManifest,
  setActiveTab,
  openStarterSources,
  installPlanAll,
  installPlanUpdates,
  lastPostInstallSummary,
  copyToClipboard,
  openPathInManager,
}: DashboardViewProps) {
  const highlightMode = stats.installed === 0 && stats.total > 0 ? "all" : stats.updateCount > 0 ? "updates" : "scan";

  return (
    <section className="view fade-in">
      {!!storageTargets.length && (
        <section className="detected-targets-card elevated-card">
          <div className="panel-header">
            <div>
              <h3>Detected storage targets</h3>
              <small>Best-effort removable media detection. Pick one when you want to work directly on a mounted SD card.</small>
            </div>
            <button className="btn-secondary" onClick={loadStorageTargets} title="Refresh detected storage targets">
              <RefreshCcw size={16} />
              Refresh
            </button>
          </div>
          <div className="detected-target-list">
            {storageTargets.map((target) => (
              <article key={target.path} className="detected-target-item">
                <div>
                  <strong>{target.label}</strong>
                  <small>
                    {target.reason} · {target.path}
                  </small>
                </div>
                <div className="button-row compact-row">
                  <button className="btn-secondary" onClick={() => useDetectedTarget(target.path)}>
                    Use as SD target
                  </button>
                  <button className="btn-ghost" onClick={() => openDetectedTarget(target.path)}>
                    Open
                  </button>
                  {target.can_eject && (
                    <button className="btn-ghost" onClick={() => ejectDetectedTarget(target.path)}>
                      Eject
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {showSafeEjectReminder && (
        <div className="reminder-banner elevated-card">
          <ShieldCheck size={16} />
          <span>Remember to safely eject your SD card after installs or post-install actions.</span>
          <button className="btn-ghost" onClick={dismissSafeEjectReminder}>
            Dismiss
          </button>
        </div>
      )}

      <section className="hero-panel elevated-card compact-hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <Sparkles size={15} />
            Clean setup + maintenance
          </span>
          <h1>Switch environment manager</h1>
          <p className="subtitle">
            Build a clean SD from scratch, maintain an existing card, mirror payload bins only when you want them,
            and handle config changes locally or over SSH without visual clutter.
          </p>
          <div className="hero-meta">
            <div className="hero-meta-item">
              <span>Active mode</span>
              <strong>{pathConfig?.target_mode === "portable" ? "Local workspace" : "Mounted target"}</strong>
            </div>
            <div className="hero-meta-item">
              <span>Payload output</span>
              <strong>{uiSettings.payload_output_enabled ? "Enabled" : "Disabled"}</strong>
            </div>
            <div className="hero-meta-item">
              <span>Tracked sources</span>
              <strong>{stats.total}</strong>
            </div>
          </div>
        </div>
        <div className="hero-action-stack">
          <div className="hero-action-group elevated-subcard">
            <div className="hero-action-head">
              <strong>Setup + refresh</strong>
              <small>
                {stats.total === 0
                  ? "Start by adding or restoring source definitions, then run a scan."
                  : stats.installed === 0
                    ? "Fresh setup detected. Install all is the fastest clean-start path."
                    : stats.updateCount > 0
                      ? "Updates are ready. Install updates keeps the card current without reinstalling everything."
                      : "Scan again anytime to refresh package metadata and install status."}
              </small>
            </div>
            <div className="hero-actions hero-actions-primary">
              <button
                className={highlightMode === "scan" ? "btn-primary" : "btn-secondary"}
                disabled={isSearching}
                onClick={fetchUpdates}
                title="Resolve package metadata and refresh install status"
              >
                {isSearching ? <RefreshCcw size={16} className="spin" /> : <Search size={16} />}
                Check for updates
              </button>
              <button
                className={highlightMode === "all" ? "btn-primary" : "btn-secondary"}
                disabled={!installPlanAll?.total_count || isUpdating}
                onClick={() => runPlannedUpdate("all")}
                title="Install missing packages and update outdated ones in the smart core-first order"
              >
                <Download size={16} />
                Install all
              </button>
              <button
                className={highlightMode === "updates" ? "btn-primary" : "btn-secondary"}
                disabled={!installPlanUpdates?.total_count || isUpdating}
                onClick={() => runPlannedUpdate("updates")}
                title="Update only already-installed packages"
              >
                <Download size={16} />
                Install updates
              </button>
            </div>
            {installPlanAll?.phase_summary.some((phase) => phase.phase === "core_cfw" || phase.phase === "bootloader") && (
              <small className="inline-helper">Core packages still queue first: Atmosphere before Hekate, then everything else.</small>
            )}
          </div>
          <div className="hero-action-group elevated-subcard">
            <div className="hero-action-head">
              <strong>Finish + personalize</strong>
              <small>Run these after Atmosphere and Hekate are in place so defaults and custom files land last.</small>
            </div>
            <div className="hero-actions hero-actions-secondary">
              <button className="btn-secondary" onClick={syncCustomStuff} title="Apply advanced override files after installs">
                <Folder size={16} />
                Apply post-install files
              </button>
              <button className="btn-secondary" onClick={applyPostInstallActions} title="Apply defaults, then your post-install file overrides">
                <Wrench size={16} />
                Run post-install actions
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="stats-grid compact-stats-grid">
        <StatCard label="Sources" value={stats.total} hint="Tracked release definitions" />
        <StatCard label="Installed" value={stats.installed} hint="Confirmed on active target" />
        <StatCard label="Updates" value={stats.updateCount} hint="Ready to apply now" />
        <StatCard label="Not Installed" value={stats.notInstalled} hint="Available but not deployed" />
      </div>

      <div className="summary-grid compact-summary-grid">
        {summaryCards.map(({ label, value, description, icon: Icon, action, actionLabel, isPath }) => (
          <div key={label} className="summary-card elevated-card">
            <div className="summary-card-top">
              <div className="summary-card-label">
                <Icon size={16} />
                <span>{label}</span>
              </div>
              <div className="button-row compact-row end-row tighter-actions">
                {isPath && (
                  <>
                    <button className="btn-ghost icon-only" title={`Copy ${label}`} onClick={() => copyToClipboard(value, label)}>
                      <Copy size={15} />
                    </button>
                    <button className="btn-ghost icon-only" title={`Open ${label}`} onClick={() => openPathInManager(value)}>
                      <FolderOpen size={15} />
                    </button>
                  </>
                )}
                <button className="btn-ghost" onClick={action}>
                  {actionLabel}
                </button>
              </div>
            </div>
            <div className="summary-card-value">
              {isPath ? <PathValue path={value} /> : <p className="summary-copy">{value}</p>}
            </div>
            <small className="summary-card-note">{description}</small>
          </div>
        ))}
      </div>

      {stats.total === 0 ? (
        <EmptyStateCard
          title="No sources yet"
          description="Choose a starter path, import an existing JSON file, or add sources one by one before you run the first scan."
          actions={
            <div className="button-row compact-row">
              <button className="btn-primary" onClick={openStarterSources}>
                Choose source setup
              </button>
              <button className="btn-secondary" onClick={() => setActiveTab("sources")}>
                Open sources
              </button>
            </div>
          }
        />
      ) : (
        <div className="panel-grid dashboard-grid compact-dashboard-grid">
          <section className="panel elevated-card">
            <div className="panel-header">
              <div>
                <h3>Workspace health</h3>
                <small>Portable integrity, manifest hygiene, and tracked file checks.</small>
              </div>
            </div>
            <ul className="detail-list">
              {workspaceValidation?.issues.length ? (
                workspaceValidation.issues.map((issue) => <li key={issue}>{issue}</li>)
              ) : (
                <li>No portable workspace issues detected.</li>
              )}
            </ul>
            <div className="button-row compact-row">
              <button className="btn-secondary" onClick={loadWorkspaceValidation}>
                <RefreshCcw size={16} />
                Refresh
              </button>
              <button className="btn-danger" onClick={resetManifest}>
                Reset manifest
              </button>
            </div>
          </section>

          <section className="panel elevated-card">
            <div className="panel-header">
              <div>
                <h3>Next steps</h3>
                <small>Use this as a quick checklist instead of a long workflow description.</small>
              </div>
            </div>
            <ul className="detail-list compact-list">
              <li>Pick an SD target, then scan sources.</li>
              <li>Run Install all for a clean setup, or Install updates for maintenance.</li>
              <li>Finish with post-install actions after Atmosphere and Hekate land.</li>
            </ul>
            <div className="button-row compact-row">
              <button className="btn-secondary" onClick={() => setActiveTab("settings")}>
                <Settings size={16} />
                Open settings
              </button>
              <button className="btn-secondary" onClick={applyPostInstallActions}>
                <Wrench size={16} />
                Run post-install actions
              </button>
            </div>
          </section>

          <section className="panel elevated-card compact-plan-panel">
            <div className="panel-header">
              <div>
                <h3>Install plan</h3>
                <small>Install all runs Atmosphere first, Hekate next, then everything else.</small>
              </div>
            </div>
            <div className="phase-plan">
              {(installPlanAll?.phase_summary || []).map((phase) => (
                <div key={phase.phase} className="phase-chip">
                  <span>{phase.label}</span>
                  <strong>{phase.count}</strong>
                </div>
              ))}
              {!installPlanAll?.phase_summary.length && <p className="empty-inline">Everything is already installed and current.</p>}
            </div>
            <div className="plan-preview-list compact compact-plan-list">
              {(installPlanAll?.entries || []).slice(0, 5).map((entry, index) => (
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
            </div>
            {lastPostInstallSummary && (
              <div className="post-install-summary">
                <strong>Last post-install pass</strong>
                <small>
                  {lastPostInstallSummary.defaults_enforced} config target(s) updated ·{" "}
                  {lastPostInstallSummary.override_files_applied} override file(s) applied
                </small>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
