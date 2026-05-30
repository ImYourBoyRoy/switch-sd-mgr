import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { ArrowDown, ArrowUp, ExternalLink, FileCode, GripVertical, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { EmptyStateCard, PageHeader } from "../components/ui";
import type { SourceRecord } from "../app-types";
import { repoUrlForSource } from "../source-utils";

interface SourcesViewProps {
  allSources: SourceRecord[];
  filteredSources: SourceRecord[];
  filteredSourceQuery: string;
  setFilteredSourceQuery: (value: string) => void;
  selectedSourceIds: string[];
  setSelectedSourceIds: Dispatch<SetStateAction<string[]>>;
  bulkDeleteSources: () => void;
  openRawSources: () => void;
  openAddSource: () => void;
  openEditSource: (source: SourceRecord) => void;
  deleteSource: (id: string) => Promise<void>;
  moveSourcePriority: (source: SourceRecord, direction: "up" | "down") => void;
  reorderSources: (draggedId: string, targetId: string) => Promise<void>;
  openExternal: (url: string) => void;
  openStarterSources: () => void;
}

export function SourcesView({
  allSources,
  filteredSources,
  filteredSourceQuery,
  setFilteredSourceQuery,
  selectedSourceIds,
  setSelectedSourceIds,
  bulkDeleteSources,
  openRawSources,
  openAddSource,
  openEditSource,
  deleteSource,
  moveSourcePriority,
  reorderSources,
  openExternal,
  openStarterSources,
}: SourcesViewProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const noSources = filteredSources.length === 0 && !filteredSourceQuery.trim();
  const dragEnabled = !filteredSourceQuery.trim() && allSources.length > 1;

  return (
    <section className="view fade-in">
      <PageHeader
        title="Sources"
        subtitle="Manage portable source definitions with URL autofill, blacklist rules, install ordering, and starter-source recovery."
        actions={
          <div className="button-row compact-row">
            <button className="btn-secondary" onClick={openStarterSources}>
              <Sparkles size={16} />
              Choose source setup
            </button>
            <button className="btn-secondary" onClick={openRawSources}>
              <FileCode size={16} />
              Raw JSON
            </button>
            <button className="btn-primary" onClick={openAddSource}>
              <Plus size={16} />
              Add source
            </button>
          </div>
        }
      />
      <div className="toolbar elevated-card">
        <div className="search-box">
          <Search size={16} />
          <input
            value={filteredSourceQuery}
            onChange={(e) => setFilteredSourceQuery(e.target.value)}
            placeholder="Search sources"
          />
        </div>
        {filteredSourceQuery.trim() ? (
          <small className="inline-helper">Clear the search filter to drag and drop the full source order.</small>
        ) : dragEnabled ? (
          <small className="inline-helper">Drag the grip handle to reorder sources. Core install phases still stay pinned first.</small>
        ) : null}
        <button className="btn-danger" disabled={!selectedSourceIds.length} onClick={bulkDeleteSources}>
          <Trash2 size={16} />
          Delete selected
        </button>
      </div>

      {noSources ? (
        <EmptyStateCard
          title="No sources yet"
          description="Paste a GitHub or Codeberg URL to auto-fill a source, import an existing JSON file, or load the bundled starter list for a clean baseline."
          actions={
            <div className="button-row compact-row">
              <button className="btn-primary" onClick={openStarterSources}>
                Choose source setup
              </button>
              <button className="btn-secondary" onClick={openAddSource}>
                Add source manually
              </button>
            </div>
          }
        />
      ) : (
        <div className="card-list">
          {filteredSources.map((source) => {
            const repoUrl = repoUrlForSource(source);
            return (
              <label key={source.id} className="list-card selectable elevated-card source-card">
                <input
                  type="checkbox"
                  checked={selectedSourceIds.includes(source.id)}
                  onChange={(e) =>
                    setSelectedSourceIds((prev) =>
                      e.target.checked ? [...prev, source.id] : prev.filter((item) => item !== source.id),
                    )
                  }
                />
                <div
                  className={`source-card-main ${draggedId === source.id ? "dragging" : ""} ${dropTargetId === source.id ? "drop-target" : ""}`}
                  draggable={dragEnabled}
                  onDragStart={() => {
                    if (!dragEnabled) {
                      return;
                    }
                    setDraggedId(source.id);
                  }}
                  onDragEnd={() => {
                    setDraggedId(null);
                    setDropTargetId(null);
                  }}
                  onDragOver={(event) => {
                    if (!dragEnabled || draggedId === source.id) {
                      return;
                    }
                    event.preventDefault();
                    setDropTargetId(source.id);
                  }}
                  onDragLeave={() => {
                    if (dropTargetId === source.id) {
                      setDropTargetId(null);
                    }
                  }}
                  onDrop={async (event) => {
                    event.preventDefault();
                    if (!dragEnabled || !draggedId || draggedId === source.id) {
                      setDropTargetId(null);
                      return;
                    }
                    await reorderSources(draggedId, source.id);
                    setDraggedId(null);
                    setDropTargetId(null);
                  }}
                >
                  <div className="source-card-head">
                    <span
                      className={`source-handle ${dragEnabled ? "draggable" : "disabled"}`}
                      title={
                        dragEnabled
                          ? "Drag to reorder source priority"
                          : "Drag-and-drop is available when the full list is visible"
                      }
                    >
                      <GripVertical size={16} />
                    </span>
                    <div className="card-title-stack">
                      <strong>{source.name}</strong>
                      <small>{source.source?.repo || source.id}</small>
                    </div>
                    <div className="status-stack">
                      <span className={`status-pill ${source._installed ? "up_to_date" : "not_installed"}`}>
                        {source._installed ? `Installed ${source._installed_version || ""}` : "Not installed"}
                      </span>
                      <small>
                        {source.install_dir || "Default smart path"} · {source.install_phase || "standard"} · #
                        {source.install_priority ?? 1000}
                      </small>
                    </div>
                  </div>

                  <div className="source-card-preview elevated-subcard">
                    <div className="source-preview-copy">
                      <strong>{repoUrl || "Paste a repository URL to auto-fill this source."}</strong>
                      <small>
                        {(source.blacklist || []).length
                          ? `${source.blacklist?.length || 0} source blacklist pattern(s)`
                          : "No source-specific blacklist patterns yet."}
                      </small>
                    </div>
                    {repoUrl ? (
                      <button
                        className="btn-ghost"
                        onClick={(event) => {
                          event.preventDefault();
                          openExternal(repoUrl);
                        }}
                      >
                        <ExternalLink size={16} />
                        Open repo
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="button-row compact-row end-row source-card-actions">
                  <button
                    className="btn-ghost icon-only"
                    onClick={(event) => {
                      event.preventDefault();
                      moveSourcePriority(source, "up");
                    }}
                    title="Move earlier in the install order"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    className="btn-ghost icon-only"
                    onClick={(event) => {
                      event.preventDefault();
                      moveSourcePriority(source, "down");
                    }}
                    title="Move later in the install order"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={(event) => {
                      event.preventDefault();
                      openEditSource(source);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn-danger"
                    onClick={async (event) => {
                      event.preventDefault();
                      await deleteSource(source.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
}
