// src/hooks/useUpdates.ts
import { useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { UpdateResult, InstallPlanResponse, PostInstallSummary, GroupedUpdateSection } from "../app-types";

export function useUpdates(
  addLog: (message: string, type?: "info" | "warn" | "error" | "success") => void,
  loadSources: () => Promise<void>,
  loadWorkspaceValidation: () => Promise<void>,
  loadHomebrew: () => Promise<void>,
) {
  const [updates, setUpdates] = useState<UpdateResult[]>([]);
  const [updateQuery, setUpdateQuery] = useState("");
  const [installPlanAll, setInstallPlanAll] = useState<InstallPlanResponse | null>(null);
  const [installPlanUpdates, setInstallPlanUpdates] = useState<InstallPlanResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSafeEjectReminder, setShowSafeEjectReminder] = useState(false);
  const [lastPostInstallSummary, setLastPostInstallSummary] = useState<PostInstallSummary | null>(null);

  const stats = useMemo(
    () => ({
      total: updates.length,
      installed: updates.filter((item) => item.installed).length,
      updateCount: updates.filter((item) => item.status === "update_available").length,
      notInstalled: updates.filter((item) => item.status === "not_installed").length,
    }),
    [updates],
  );

  const filteredUpdates = useMemo(
    () =>
      updates.filter((item) =>
        `${item.name} ${item.id} ${item.phase_label || ""}`
          .toLowerCase()
          .includes(updateQuery.toLowerCase()),
      ),
    [updates, updateQuery],
  );

  const groupedUpdates = useMemo<GroupedUpdateSection[]>(() => {
    const core = filteredUpdates.filter(
      (item) => item.install_phase === "core_cfw" || item.install_phase === "bootloader",
    );
    const rest = filteredUpdates.filter(
      (item) => item.install_phase !== "core_cfw" && item.install_phase !== "bootloader",
    );
    return [
      { key: "core", title: "Core first", subtitle: "Atmosphere and Hekate always lead the install order.", items: core },
      {
        key: "updates",
        title: "Updates available",
        subtitle: "Installed packages that have newer releases ready.",
        items: rest.filter((item) => item.status === "update_available"),
      },
      {
        key: "missing",
        title: "Ready to install",
        subtitle: "Packages available for a clean or expanded setup.",
        items: rest.filter((item) => item.status === "not_installed"),
      },
      {
        key: "current",
        title: "Installed / current",
        subtitle: "Already current on the active target.",
        items: rest.filter((item) => item.status === "up_to_date"),
      },
      {
        key: "attention",
        title: "Needs attention",
        subtitle: "Sources that could not be resolved cleanly during scan.",
        items: filteredUpdates.filter((item) => item.status === "error"),
      },
    ].filter((section) => section.items.length > 0);
  }, [filteredUpdates]);

  const loadInstallPlans = async () => {
    const [allPlan, updatesPlan] = await Promise.all([
      invoke<InstallPlanResponse>("cmd_get_install_plan", { mode: "all" }),
      invoke<InstallPlanResponse>("cmd_get_install_plan", { mode: "updates" }),
    ]);
    setInstallPlanAll(allPlan);
    setInstallPlanUpdates(updatesPlan);
  };

  const fetchUpdates = async () => {
    setIsSearching(true);
    try {
      setUpdates(await invoke<UpdateResult[]>("cmd_check_updates"));
      await loadInstallPlans();
      addLog("Scan complete.", "success");
    } catch (error) {
      addLog(`Scan failed: ${error}`, "error");
    } finally {
      setIsSearching(false);
    }
  };

  const runUpdate = async (ids: string[]) => {
    setIsUpdating(true);
    try {
      addLog(`Starting install queue for ${ids.length} source(s)...`);
      await invoke("cmd_run_update", { ids });
      addLog("Install queue complete.", "success");
      setShowSafeEjectReminder(true);
      await fetchUpdates();
      await loadSources();
      await loadHomebrew();
      await loadWorkspaceValidation();
    } catch (error) {
      addLog(`Update failed: ${error}`, "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const runRemoteUpdate = async (ids: string[], remoteRoot: string) => {
    setIsUpdating(true);
    try {
      addLog(`Starting remote transfer for ${ids.length} source(s)...`);
      await invoke("cmd_run_remote_update", { ids, remoteRoot });
      addLog("Remote transfer complete. Local workspace status remains unchanged.", "success");
    } catch (error) {
      addLog(`Remote transfer failed: ${error}`, "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const runPlannedUpdate = async (mode: "all" | "updates") => {
    try {
      const plan = await invoke<InstallPlanResponse>("cmd_get_install_plan", { mode });
      if (!plan.entries.length) {
        addLog(
          mode === "all"
            ? "Nothing to install right now."
            : "No update-ready packages found.",
          "warn",
        );
        return;
      }
      const orderPreview = plan.entries
        .slice(0, 4)
        .map((entry) => entry.name)
        .join(" → ");
      addLog(`Planned ${mode === "all" ? "install" : "update"} order: ${orderPreview}${plan.entries.length > 4 ? "..." : ""}`);
      await runUpdate(plan.entries.map((entry) => entry.id));
    } catch (error) {
      addLog(`Failed to build install plan: ${error}`, "error");
    }
  };

  const syncCustomStuff = async () => {
    const files = await invoke<string[]>("cmd_sync_custom_stuff");
    addLog(`Applied ${files.length} post-install file(s).`, "success");
    if (files.length) {
      setShowSafeEjectReminder(true);
    }
  };

  const applyPostInstallActions = async () => {
    try {
      const summary = await invoke<PostInstallSummary>("cmd_run_post_install_actions");
      setLastPostInstallSummary(summary);
      addLog(
        `Post-install actions complete: ${summary.defaults_enforced} config target(s) updated, ${summary.override_files_applied} override file(s) applied.`,
        "success",
      );
      if (summary.override_files_applied || summary.defaults_enforced) {
        setShowSafeEjectReminder(true);
      }
      await loadWorkspaceValidation();
    } catch (error) {
      addLog(`Post-install actions failed: ${error}`, "error");
    }
  };

  const resetManifest = async () => {
    await invoke("cmd_reset_manifest");
    await fetchUpdates();
    await loadSources();
    await loadWorkspaceValidation();
    addLog("Manifest reset.", "warn");
  };

  return {
    updates,
    setUpdates,
    updateQuery,
    setUpdateQuery,
    installPlanAll,
    setInstallPlanAll,
    installPlanUpdates,
    setInstallPlanUpdates,
    isSearching,
    setIsSearching,
    isUpdating,
    setIsUpdating,
    showSafeEjectReminder,
    setShowSafeEjectReminder,
    lastPostInstallSummary,
    stats,
    filteredUpdates,
    groupedUpdates,
    loadInstallPlans,
    fetchUpdates,
    runUpdate,
    runRemoteUpdate,
    runPlannedUpdate,
    syncCustomStuff,
    applyPostInstallActions,
    resetManifest,
  };
}
