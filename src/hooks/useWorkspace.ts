// src/hooks/useWorkspace.ts
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { PathConfig, WorkspaceValidation, DetectedStorageTarget } from "../app-types";

export function useWorkspace(addLog: (message: string, type?: "info" | "warn" | "error" | "success") => void) {
  const [pathConfig, setPathConfig] = useState<PathConfig | null>(null);
  const [workspaceValidation, setWorkspaceValidation] = useState<WorkspaceValidation | null>(null);
  const [storageTargets, setStorageTargets] = useState<DetectedStorageTarget[]>([]);

  const loadPaths = async () => {
    const paths = await invoke<PathConfig>("cmd_get_paths");
    setPathConfig(paths);
  };

  const loadWorkspaceValidation = async () => {
    setWorkspaceValidation(await invoke<WorkspaceValidation>("cmd_validate_workspace"));
  };

  const loadStorageTargets = async () => {
    setStorageTargets(await invoke<DetectedStorageTarget[]>("cmd_detect_storage_targets"));
  };

  const savePaths = async (next: Partial<PathConfig>) => {
    await invoke("cmd_set_paths", {
      dataRoot: next.data_root ?? null,
      customRoot: next.custom_stuff_root ?? null,
      sdRoot: next.sd_root ?? null,
      rcmRoot: next.rcm_root ?? null,
    });
    await loadPaths();
    await loadWorkspaceValidation();
    addLog("Workspace paths updated.", "success");
  };

  const choosePath = async (key: keyof PathConfig) => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      await savePaths({ [key]: selected as string } as Partial<PathConfig>);
    }
  };

  const wipeTargets = async () => {
    await invoke("cmd_wipe_sd");
    await loadWorkspaceValidation();
    addLog("SD target and Boot Bin output wiped.", "warn");
  };

  return {
    pathConfig,
    setPathConfig,
    workspaceValidation,
    setWorkspaceValidation,
    storageTargets,
    setStorageTargets,
    loadPaths,
    loadWorkspaceValidation,
    loadStorageTargets,
    choosePath,
    savePaths,
    wipeTargets,
  };
}
