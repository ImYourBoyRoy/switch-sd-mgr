import type { RefObject } from "react";
import { EmptyStateCard, PageHeader } from "../components/ui";
import type { LogEntry } from "../app-types";

interface LogsViewProps {
  logs: LogEntry[];
  logRef: RefObject<HTMLDivElement | null>;
  openUpdates: () => void;
  openSources: () => void;
}

export function LogsView({ logs, logRef, openUpdates, openSources }: LogsViewProps) {
  return (
    <section className="view full-height fade-in">
      <PageHeader
        title="Live Logs"
        subtitle="Progress events, installs, scans, and runtime diagnostics in a terminal-style console."
      />
      <section className="terminal-shell elevated-card">
        <div className="terminal-toolbar">
          <div className="terminal-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="terminal-title">switch-sd-manager://runtime-console</div>
          <div className="terminal-meta">{logs.length} line{logs.length === 1 ? "" : "s"}</div>
        </div>
        <div className="terminal-body" ref={logRef}>
          {logs.length ? (
            logs.map((entry, index) => (
              <div key={`${entry.timestamp}-${index}`} className={`terminal-line ${entry.type}`}>
                <span className="terminal-gutter">{String(index + 1).padStart(3, "0")}</span>
                <span className={`terminal-badge ${entry.type}`}>{entry.type}</span>
                <span className="terminal-time">{entry.timestamp}</span>
                <span className="terminal-message">{entry.message}</span>
              </div>
            ))
          ) : (
            <div className="terminal-empty-state">
              <EmptyStateCard
                title="Console idle"
                description="Scans, installs, SSH transfers, and file actions will stream here once you start working."
                actions={
                  <div className="button-row compact-row">
                    <button className="btn-primary" onClick={openUpdates}>
                      Open updates
                    </button>
                    <button className="btn-secondary" onClick={openSources}>
                      Open sources
                    </button>
                  </div>
                }
              />
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
