// src/hooks/useUiSettings.ts
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { UiSettings, ThemeMode } from "../app-types";

export function useUiSettings(addLog: (message: string, type?: "info" | "warn" | "error" | "success") => void) {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [uiSettings, setUiSettings] = useState<UiSettings>({
    theme: "dark",
    walkthrough_completed: true,
    payload_output_enabled: true,
    payload_naming_template: "{folder}/payload.bin",
    backup_before_config_apply: false,
  });
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);

  const loadUiSettings = async () => {
    const settings = await invoke<UiSettings>("cmd_get_ui_settings");
    setTheme(settings.theme || "dark");
    setUiSettings(settings);
    setShowWalkthrough(!settings.walkthrough_completed);
  };

  const saveUiSettings = async (partial: Partial<UiSettings>, message?: string) => {
    const saved = await invoke<UiSettings>("cmd_set_ui_settings", {
      update: {
        theme: partial.theme,
        walkthrough_completed: partial.walkthrough_completed,
        payload_output_enabled: partial.payload_output_enabled,
        payload_naming_template: partial.payload_naming_template,
        backup_before_config_apply: partial.backup_before_config_apply,
      },
    });
    setUiSettings(saved);
    setTheme(saved.theme);
    if (message) {
      addLog(message, "success");
    }
    return saved;
  };

  const saveTheme = async (nextTheme: ThemeMode) => {
    const saved = await saveUiSettings({ theme: nextTheme }, `Theme set to ${nextTheme}.`);
    setTheme(saved.theme);
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  return {
    theme,
    setTheme,
    uiSettings,
    setUiSettings,
    showWalkthrough,
    setShowWalkthrough,
    walkthroughStep,
    setWalkthroughStep,
    loadUiSettings,
    saveUiSettings,
    saveTheme,
  };
}
