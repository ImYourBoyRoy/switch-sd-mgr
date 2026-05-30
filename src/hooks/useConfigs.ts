// src/hooks/useConfigs.ts
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SwitchIni, ConfigSchema, ConfigCreationOptions, ConfigCreateMode, RawConfigPayload, ConfigPayload } from "../app-types";

export function useConfigs(
  addLog: (message: string, type?: "info" | "warn" | "error" | "success") => void,
  backupBeforeConfigApply: boolean,
) {
  const [manageableConfigs, setManageableConfigs] = useState<Record<string, ConfigSchema>>({});
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [currentConfig, setCurrentConfig] = useState<SwitchIni | null>(null);
  const [originalConfig, setOriginalConfig] = useState<SwitchIni | null>(null);
  const [rawConfigContent, setRawConfigContent] = useState("");
  const [originalRawConfig, setOriginalRawConfig] = useState("");
  const [missingConfig, setMissingConfig] = useState<ConfigCreationOptions | null>(null);
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [configPreviewMode, setConfigPreviewMode] = useState<"structured" | "raw" | null>(null);

  const loadConfigs = async () =>
    setManageableConfigs(await invoke<Record<string, ConfigSchema>>("cmd_list_configs"));

  const selectConfig = async (id: string) => {
    setSelectedConfigId(id);
    setIsConfigLoading(true);
    setCurrentConfig(null);
    setOriginalConfig(null);
    setRawConfigContent("");
    setOriginalRawConfig("");
    setMissingConfig(null);
    try {
      const schema = manageableConfigs[id];
      if (schema?.editable_as_text) {
        const payload = await invoke<RawConfigPayload>("cmd_get_raw_config_payload", { id });
        if (payload.found) {
          setRawConfigContent(payload.content);
          setOriginalRawConfig(payload.content);
        } else {
          setMissingConfig(payload.creation);
        }
      } else {
        const payload = await invoke<ConfigPayload>("cmd_get_config", { id });
        if (payload.found && payload.data) {
          setCurrentConfig(payload.data);
          setOriginalConfig(payload.data);
        } else {
          setMissingConfig(payload.creation || null);
        }
      }
    } catch (error) {
      addLog(`Failed to load ${id}: ${error}`, "error");
    } finally {
      setIsConfigLoading(false);
    }
  };

  const backupConfigIfEnabled = async (id: string) => {
    if (!backupBeforeConfigApply) {
      return;
    }
    const backupPath = await invoke<string | null>("cmd_backup_config_file", { id });
    if (backupPath) {
      addLog(`Backed up ${id} to ${backupPath}`, "info");
    }
  };

  const saveStructuredConfig = async (structuredConfigChanges: any[]) => {
    if (!selectedConfigId || !structuredConfigChanges.length) {
      addLog("No structured config changes to save.", "warn");
      return;
    }
    try {
      await backupConfigIfEnabled(selectedConfigId);
      for (const change of structuredConfigChanges) {
        await invoke("cmd_update_config", {
          id: selectedConfigId,
          section: change.section,
          key: change.key,
          value: change.next,
          vtype: change.valueType,
          enabled: true,
        });
      }
      addLog(`Saved ${structuredConfigChanges.length} config change(s).`, "success");
      setConfigPreviewMode(null);
      await selectConfig(selectedConfigId);
    } catch (error) {
      addLog(`Config save failed: ${error}`, "error");
    }
  };

  const saveRawConfig = async () => {
    if (!selectedConfigId) {
      return;
    }
    try {
      await backupConfigIfEnabled(selectedConfigId);
      await invoke("cmd_save_raw_config", {
        id: selectedConfigId,
        content: rawConfigContent,
      });
      setOriginalRawConfig(rawConfigContent);
      setConfigPreviewMode(null);
      addLog("Raw config saved.", "success");
    } catch (error) {
      addLog(`Raw config save failed: ${error}`, "error");
    }
  };

  const createMissingConfig = async (mode: ConfigCreateMode) => {
    if (!selectedConfigId) {
      return;
    }
    try {
      const createdPath = await invoke<string>("cmd_create_config_file", {
        id: selectedConfigId,
        mode,
      });
      addLog(`Created ${selectedConfigId} at ${createdPath}.`, "success");
      await selectConfig(selectedConfigId);
    } catch (error) {
      addLog(`Failed to create ${selectedConfigId}: ${error}`, "error");
    }
  };

  return {
    manageableConfigs,
    setManageableConfigs,
    selectedConfigId,
    setSelectedConfigId,
    currentConfig,
    setCurrentConfig,
    originalConfig,
    setOriginalConfig,
    rawConfigContent,
    setRawConfigContent,
    originalRawConfig,
    setOriginalRawConfig,
    missingConfig,
    setMissingConfig,
    isConfigLoading,
    setIsConfigLoading,
    configPreviewMode,
    setConfigPreviewMode,
    loadConfigs,
    selectConfig,
    saveStructuredConfig,
    saveRawConfig,
    createMissingConfig,
  };
}
