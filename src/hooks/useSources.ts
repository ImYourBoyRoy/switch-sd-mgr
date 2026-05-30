// src/hooks/useSources.ts
import { useState, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { SourceRecord } from "../app-types";
import { emptySource } from "../source-utils";

export function useSources(
  addLog: (message: string, type?: "info" | "warn" | "error" | "success") => void,
  loadInstallPlans: () => Promise<void>,
) {
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [filteredSourceQuery, setFilteredSourceQuery] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [sourceDraft, setSourceDraft] = useState<SourceRecord>(emptySource());
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [showSourceEditor, setShowSourceEditor] = useState(false);
  const [rawSources, setRawSources] = useState("");
  const [showRawEditor, setShowRawEditor] = useState(false);
  const [showStarterSourcesModal, setShowStarterSourcesModal] = useState(false);
  const starterChoicePrompted = useRef(false);

  const filteredSources = useMemo(
    () =>
      sources.filter((source) =>
        `${source.name} ${source.id}`.toLowerCase().includes(filteredSourceQuery.toLowerCase()),
      ),
    [sources, filteredSourceQuery],
  );

  const loadSources = async () => setSources(await invoke<SourceRecord[]>("cmd_list_sources"));

  const saveSource = async () => {
    const normalized: SourceRecord = {
      ...sourceDraft,
      blacklist: (sourceDraft.blacklist || []).filter(Boolean),
      source: { ...sourceDraft.source },
      alt_source: sourceDraft.alt_source?.repo ? sourceDraft.alt_source : undefined,
      payload_info:
        sourceDraft.payload_info?.folder && sourceDraft.payload_info?.pattern
          ? sourceDraft.payload_info
          : undefined,
    };
    if (!normalized.id || !normalized.name) {
      return addLog("Source id and name are required.", "warn");
    }
    if (editingSourceId) {
      await invoke("cmd_update_source", { id: editingSourceId, source: normalized });
    } else {
      await invoke("cmd_add_source", { source: normalized });
    }
    await loadSources();
    await loadInstallPlans();
    setShowSourceEditor(false);
    setEditingSourceId(null);
    setSourceDraft(emptySource());
    addLog("Source saved.", "success");
  };

  const parseSourceUrl = async (value: string) => {
    if (!value.startsWith("http")) {
      return;
    }
    try {
      const parsed = await invoke<{ id: string; name: string; repo: string; type: string }>(
        "cmd_parse_source_url",
        { url: value },
      );
      setSourceDraft((draft) => ({
        ...draft,
        id: draft.id || parsed.id,
        name: draft.name || parsed.name,
        source: { ...(draft.source || {}), type: parsed.type, repo: parsed.repo },
      }));
      addLog(`Autofilled source metadata for ${parsed.repo}.`, "success");
    } catch {
      addLog("Could not autofill that source URL.", "warn");
    }
  };

  const saveRawSources = async () => {
    await invoke("cmd_save_sources_raw", { content: rawSources });
    await loadSources();
    setShowRawEditor(false);
    addLog("Raw sources saved.", "success");
  };

  const openRawSources = async () => {
    setRawSources(await invoke<string>("cmd_get_sources_raw"));
    setShowRawEditor(true);
  };

  const bulkDeleteSources = async () => {
    await invoke("cmd_bulk_delete_sources", { ids: selectedSourceIds });
    setSelectedSourceIds([]);
    await loadSources();
    await loadInstallPlans();
    addLog("Selected sources deleted.", "success");
  };

  const restoreDefaultSources = async () => {
    try {
      const count = await invoke<number>("cmd_restore_default_sources");
      await loadSources();
      await loadInstallPlans();
      setShowStarterSourcesModal(false);
      addLog(`Restored ${count} starter source(s).`, "success");
    } catch (error) {
      addLog(`Failed to restore starter sources: ${error}`, "error");
    }
  };

  const importSourcesFromFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!selected) {
        return;
      }
      const count = await invoke<number>("cmd_import_sources_file", {
        path: selected as string,
      });
      await loadSources();
      await loadInstallPlans();
      setShowStarterSourcesModal(false);
      addLog(`Imported ${count} source(s) from file.`, "success");
    } catch (error) {
      addLog(`Failed to import sources file: ${error}`, "error");
    }
  };

  return {
    sources,
    setSources,
    filteredSourceQuery,
    setFilteredSourceQuery,
    selectedSourceIds,
    setSelectedSourceIds,
    sourceDraft,
    setSourceDraft,
    editingSourceId,
    setEditingSourceId,
    showSourceEditor,
    setShowSourceEditor,
    rawSources,
    setRawSources,
    showRawEditor,
    setShowRawEditor,
    showStarterSourcesModal,
    setShowStarterSourcesModal,
    starterChoicePrompted,
    filteredSources,
    loadSources,
    saveSource,
    parseSourceUrl,
    saveRawSources,
    openRawSources,
    bulkDeleteSources,
    restoreDefaultSources,
    importSourcesFromFile,
  };
}
