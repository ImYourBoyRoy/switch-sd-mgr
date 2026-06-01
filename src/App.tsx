// src/App.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  CircleHelp,
  Coffee,
  Cpu,
  Database,
  Download,
  ExternalLink,
  FileCode,
  Folder,
  Gamepad2,
  HardDrive,
  LayoutDashboard,
  Palette,
  Settings,
  ShieldCheck,
  Terminal,
  Wifi,
} from "lucide-react";
import { ThemeToggle } from "./components/ui";
import { SourceEditorModal } from "./components/SourceEditorModal";
import { StarterSourcesModal } from "./components/StarterSourcesModal";
import { WalkthroughModal } from "./components/WalkthroughModal";
import { StructuredConfigPreviewModal } from "./components/StructuredConfigPreviewModal";
import { RawConfigDiffModal } from "./components/RawConfigDiffModal";
import { RawSourcesModal } from "./components/RawSourcesModal";
import type {
  ActiveTab,
  HomebrewMeta,
  LogEntry,
  LogType,
  ProgressPayload,
  SourceRecord,
  SummaryCardData,
} from "./app-types";
import { emptySource } from "./source-utils";
import { DashboardView } from "./views/DashboardView";
import { UpdatesView } from "./views/UpdatesView";
import { SourcesView } from "./views/SourcesView";
import { SettingsView } from "./views/SettingsView";
import { HelpView } from "./views/HelpView";
import { ConfigView } from "./views/ConfigView";
import { FirmwareView } from "./views/FirmwareView";
import { AppsView } from "./views/AppsView";
import { RemoteView } from "./views/RemoteView";
import { LogsView } from "./views/LogsView";
import { UtilitiesView } from "./views/UtilitiesView";

// Custom Hooks and Utilities
import { buildStructuredConfigChanges, buildTextDiff } from "./utils/diff";
import { useUiSettings } from "./hooks/useUiSettings";
import { useWorkspace } from "./hooks/useWorkspace";
import { useSources } from "./hooks/useSources";
import { useConfigs } from "./hooks/useConfigs";
import { useUpdates } from "./hooks/useUpdates";
import { useSsh } from "./hooks/useSsh";

import "./App.css";

const navItems = [
  { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { id: "updates", icon: Download, label: "Updates" },
  { id: "sources", icon: Database, label: "Sources" },
  { id: "config", icon: FileCode, label: "Config" },
  { id: "firmware", icon: Cpu, label: "Firmware" },
  { id: "apps", icon: Gamepad2, label: "Apps" },
  { id: "remote", icon: Wifi, label: "SSH" },
  { id: "utilities", icon: ShieldCheck, label: "Utilities" },
  { id: "settings", icon: Settings, label: "Settings" },
  { id: "logs", icon: Terminal, label: "Logs" },
  { id: "help", icon: CircleHelp, label: "Help" },
] as const;

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [globalBlacklist, setGlobalBlacklist] = useState("");
  const [initComplete, setInitComplete] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string, type: LogType = "info") => {
    setLogs((prev) =>
      [...prev, { message, type, timestamp: new Date().toLocaleTimeString() }].slice(-250),
    );
  };

  // 1. Core Domain Custom Hooks
  const uiSettingsHook = useUiSettings(addLog);
  const { theme, uiSettings, setUiSettings, saveUiSettings, saveTheme, showWalkthrough, setShowWalkthrough, walkthroughStep, setWalkthroughStep } = uiSettingsHook;

  const workspaceHook = useWorkspace(addLog);
  const { pathConfig, workspaceValidation, storageTargets, loadPaths, loadWorkspaceValidation, loadStorageTargets, choosePath, savePaths, wipeTargets } = workspaceHook;

  const [homebrew, setHomebrew] = useState<Record<string, HomebrewMeta>>({});
  const loadHomebrew = async () => setHomebrew(await invoke("cmd_get_installed_homebrew"));

  const sourcesHook = useSources(addLog, async () => {
    await updatesHook.loadInstallPlans();
  });
  const {
    sources,
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
    restoreDefaultSources,
    importSourcesFromFile,
    bulkDeleteSources,
  } = sourcesHook;

  const updatesHook = useUpdates(addLog, loadSources, loadWorkspaceValidation, loadHomebrew);
  const {
    updateQuery,
    setUpdateQuery,
    installPlanAll,
    installPlanUpdates,
    isSearching,
    isUpdating,
    showSafeEjectReminder,
    setShowSafeEjectReminder,
    lastPostInstallSummary,
    stats,
    filteredUpdates,
    groupedUpdates,
    fetchUpdates,
    runUpdate,
    runRemoteUpdate,
    runPlannedUpdate,
    syncCustomStuff,
    applyPostInstallActions,
    resetManifest,
  } = updatesHook;

  const configsHook = useConfigs(addLog, uiSettings.backup_before_config_apply);
  const {
    manageableConfigs,
    selectedConfigId,
    currentConfig,
    setCurrentConfig,
    originalConfig,
    rawConfigContent,
    setRawConfigContent,
    originalRawConfig,
    missingConfig,
    isConfigLoading,
    configPreviewMode,
    setConfigPreviewMode,
    loadConfigs,
    selectConfig,
    saveStructuredConfig,
    saveRawConfig,
    createMissingConfig,
  } = configsHook;

  const sshHook = useSsh(addLog);
  const {
    sshHost,
    setSshHost,
    sshUser,
    setSshUser,
    sshPass,
    setSshPass,
    isSshConnected,
    remoteRoot,
    setRemoteRoot,
    remotePath,
    setRemotePath,
    remoteConfig,
    setRemoteConfig,
    connectSsh,
    readRemote,
    writeRemote,
  } = sshHook;

  // 2. Computed Diffs
  const structuredConfigChanges = useMemo(
    () => buildStructuredConfigChanges(originalConfig, currentConfig),
    [currentConfig, originalConfig],
  );

  const rawConfigDiff = useMemo(
    () => buildTextDiff(originalRawConfig, rawConfigContent),
    [originalRawConfig, rawConfigContent],
  );

  // 3. Walkthrough Configuration
  const walkthroughSteps = [
    {
      title: "Choose your SD target",
      description:
        "Set the active SD destination first. You can keep a local prep folder or point directly at a mounted card.",
      tab: "settings",
    },
    {
      title: "Optional Boot Bin output",
      description:
        "Payload mirroring is enabled by default for convenience, but you can disable it or change the output template anytime.",
      tab: "settings",
    },
    {
      title: "Choose a source setup",
      description:
        "Stay empty, import an existing sources file, or use the bundled starter sources before your first scan.",
      tab: "sources",
    },
    {
      title: "Scan your sources",
      description:
        "Use Check for updates to resolve versions, then review the phased install plan before running anything.",
      tab: "updates",
    },
    {
      title: "Install core packages first",
      description:
        "Install all respects the smart order: Atmosphere first, Hekate second, then everything else.",
      tab: "updates",
    },
    {
      title: "Run post-install actions",
      description:
        "After installs, apply config defaults and optional override files so your finishing touches land after the main packages.",
      tab: "dashboard",
    },
    {
      title: "Use SSH when the card stays in the Switch",
      description:
        "Connect over SSH to push install queues or edit config files without pulling the SD card out.",
      tab: "remote",
    },
  ] as const;

  // 4. Initialization and Subscriptions
  const loadGlobalBlacklist = async () =>
    setGlobalBlacklist((await invoke<string[]>("cmd_get_global_blacklist")).join("\n"));

  const init = async () => {
    try {
      await uiSettingsHook.loadUiSettings();
      await loadPaths();
      await loadWorkspaceValidation();
      await loadSources();
      await loadConfigs();
      await loadGlobalBlacklist();
      await loadStorageTargets();
      await fetchUpdates();
      await loadHomebrew();
    } finally {
      setInitComplete(true);
    }
  };

  useEffect(() => {
    void init();
  }, []);

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) {
        return;
      }
      event.preventDefault();
    };
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (initComplete && !showWalkthrough && !starterChoicePrompted.current && sources.length === 0) {
      setShowStarterSourcesModal(true);
      starterChoicePrompted.current = true;
    }
  }, [initComplete, sources.length, showWalkthrough]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<ProgressPayload>("sd-updater://progress", (event) =>
      addLog(event.payload.message, event.payload.stage === "update" ? "info" : "warn"),
    ).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  // 5. Context UI Handlers and Composites
  const moveSourcePriority = async (source: SourceRecord, direction: "up" | "down") => {
    const currentIndex = sources.findIndex((item) => item.id === source.id);
    if (currentIndex < 0) {
      return;
    }
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sources.length) {
      return;
    }
    const nextIds = [...sources.map((item) => item.id)];
    const [moved] = nextIds.splice(currentIndex, 1);
    nextIds.splice(targetIndex, 0, moved);
    await invoke("cmd_reorder_sources", { ids: nextIds });
    await loadSources();
    await updatesHook.loadInstallPlans();
    addLog(`${source.name} moved ${direction} in the source order.`, "success");
  };

  const reorderSources = async (draggedId: string, targetId: string) => {
    const currentIds = sources.map((item) => item.id);
    const draggedIndex = currentIds.indexOf(draggedId);
    const targetIndex = currentIds.indexOf(targetId);
    if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) {
      return;
    }

    const nextIds = [...currentIds];
    const [moved] = nextIds.splice(draggedIndex, 1);
    nextIds.splice(targetIndex, 0, moved);

    await invoke("cmd_reorder_sources", { ids: nextIds });
    await loadSources();
    await updatesHook.loadInstallPlans();
    const draggedSource = sources.find((item) => item.id === draggedId);
    const targetSource = sources.find((item) => item.id === targetId);
    addLog(
      `Reordered ${draggedSource?.name || draggedId} around ${targetSource?.name || targetId}.`,
      "success",
    );
  };

  const openAddSourceEditor = () => {
    setSourceDraft(emptySource());
    setEditingSourceId(null);
    setShowSourceEditor(true);
  };

  const openEditSourceEditor = (source: SourceRecord) => {
    setEditingSourceId(source.id);
    setSourceDraft({
      ...source,
      blacklist: source.blacklist || [],
      payload_info: source.payload_info || { folder: "", pattern: "" },
      alt_source: source.alt_source || { type: "github_release", repo: "" },
    });
    setShowSourceEditor(true);
  };

  const deleteSourceById = async (id: string) => {
    await invoke("cmd_delete_source", { id });
    await loadSources();
    await updatesHook.loadInstallPlans();
    addLog(`Deleted source ${id}.`, "success");
  };

  const useDetectedTarget = async (path: string) => {
    await savePaths({ sd_root: path });
    addLog(`Using detected storage target ${path}.`, "success");
  };

  const useDetectedRcmTarget = async (path: string) => {
    await savePaths({ rcm_root: path });
    addLog(`Using detected RCM Loader target ${path}.`, "success");
  };

  const openDetectedTarget = async (path: string) => {
    await invoke("cmd_open_path_in_file_manager", { path });
  };

  const ejectDetectedTarget = async (path: string) => {
    try {
      await invoke("cmd_eject_storage_target", { path });
      addLog(`Ejected ${path}.`, "success");
      await loadStorageTargets();
    } catch (error) {
      addLog(`Could not eject ${path}: ${error}`, "warn");
    }
  };

  const saveGlobalBlacklist = async () => {
    const lines = globalBlacklist
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    await invoke("cmd_set_global_blacklist", { blacklist: lines });
    addLog("Global blacklist updated.", "success");
  };

  const completeWalkthrough = async () => {
    await saveUiSettings({ walkthrough_completed: true });
    setShowWalkthrough(false);
    setWalkthroughStep(0);
    addLog("Welcome guide completed. You can reopen it from Help anytime.", "success");
  };

  const openExternal = async (url: string) => {
    try {
      await invoke("cmd_open_external", { url });
    } catch (error) {
      addLog(`Failed to open ${url}: ${error}`, "error");
    }
  };

  const openPathInManager = async (path: string) => {
    try {
      await invoke("cmd_open_path_in_file_manager", { path });
    } catch (error) {
      addLog(`Failed to open ${path}: ${error}`, "error");
    }
  };

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      addLog(`Copied ${label}.`, "success");
    } catch (error) {
      addLog(`Failed to copy ${label}: ${error}`, "error");
    }
  };

  const summaryCards: SummaryCardData[] = [
    {
      label: pathConfig?.target_mode === "portable" ? "SD target" : "Mounted / custom SD target",
      value: pathConfig?.sd_root || "Loading active SD target...",
      description: "Packages and extracted files land here.",
      icon: HardDrive,
      action: () => choosePath("sd_root"),
      actionLabel: "Change",
      isPath: true,
    },
    {
      label: "Boot Bin path",
      value: pathConfig?.rcm_root || "Loading Boot Bin path...",
      description: uiSettings.payload_output_enabled
        ? "Optional payload mirror output is enabled."
        : "Payload mirroring is currently disabled.",
      icon: Folder,
      action: () => choosePath("rcm_root"),
      actionLabel: "Change",
      isPath: true,
    },
    {
      label: "Theme",
      value: theme === "dark" ? "Dark mode enabled" : "Light mode enabled",
      description: "Appearance follows your saved workspace preference.",
      icon: Palette,
      action: () => setActiveTab("settings"),
      actionLabel: "Open",
      isPath: false,
    },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand elevated-card">
            <img src="/icon.svg" alt="Switch SD Manager icon" className="brand-logo" />
            <div>
              <strong>Switch SD Manager</strong>
              <span>Switch SD card environment manager</span>
            </div>
          </div>
          <ThemeToggle theme={theme} onChange={saveTheme} />
        </div>

        <nav className="nav-list">
          {navItems.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              className={`nav-item ${activeTab === id ? "active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={18} />
              <span>{id === "updates" && stats.updateCount ? `${label} (${stats.updateCount})` : label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="support-card elevated-card" onClick={() => openExternal("https://venmo.com/ItsYourBoyRoy")}>
            <div className="support-copy">
              <span className="support-kicker">Support</span>
              <strong>Buy me a hot cocoa</strong>
              <small>Venmo: @ItsYourBoyRoy</small>
            </div>
            <span className="support-icon-wrap">
              <Coffee size={18} />
              <ExternalLink size={14} />
            </span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="content-frame">
          {activeTab === "dashboard" && (
            <DashboardView
              storageTargets={storageTargets}
              loadStorageTargets={loadStorageTargets}
              useDetectedTarget={useDetectedTarget}
              useDetectedRcmTarget={useDetectedRcmTarget}
              openDetectedTarget={openDetectedTarget}
              ejectDetectedTarget={ejectDetectedTarget}
              showSafeEjectReminder={showSafeEjectReminder}
              dismissSafeEjectReminder={() => setShowSafeEjectReminder(false)}
              pathConfig={pathConfig}
              uiSettings={uiSettings}
              stats={stats}
              summaryCards={summaryCards}
              isSearching={isSearching}
              isUpdating={isUpdating}
              fetchUpdates={fetchUpdates}
              runPlannedUpdate={runPlannedUpdate}
              syncCustomStuff={syncCustomStuff}
              applyPostInstallActions={applyPostInstallActions}
              workspaceValidation={workspaceValidation}
              loadWorkspaceValidation={loadWorkspaceValidation}
              resetManifest={resetManifest}
              setActiveTab={setActiveTab}
              openStarterSources={() => setShowStarterSourcesModal(true)}
              installPlanAll={installPlanAll}
              installPlanUpdates={installPlanUpdates}
              lastPostInstallSummary={lastPostInstallSummary}
              copyToClipboard={copyToClipboard}
              openPathInManager={openPathInManager}
            />
          )}

          {activeTab === "updates" && (
            <UpdatesView
              installPlanAll={installPlanAll}
              installPlanUpdates={installPlanUpdates}
              groupedUpdates={groupedUpdates}
              filteredUpdatesCount={filteredUpdates.length}
              updateQuery={updateQuery}
              setUpdateQuery={setUpdateQuery}
              isUpdating={isUpdating}
              isSearching={isSearching}
              runPlannedUpdate={runPlannedUpdate}
              runUpdate={runUpdate}
              fetchUpdates={fetchUpdates}
              openSources={() => setActiveTab("sources")}
            />
          )}

          {activeTab === "sources" && (
            <SourcesView
              allSources={sources}
              filteredSources={filteredSources}
              filteredSourceQuery={filteredSourceQuery}
              setFilteredSourceQuery={setFilteredSourceQuery}
              selectedSourceIds={selectedSourceIds}
              setSelectedSourceIds={setSelectedSourceIds}
              bulkDeleteSources={bulkDeleteSources}
              openRawSources={openRawSources}
              openAddSource={openAddSourceEditor}
              openEditSource={openEditSourceEditor}
              deleteSource={deleteSourceById}
              moveSourcePriority={(source, direction) => void moveSourcePriority(source, direction)}
              reorderSources={(draggedId, targetId) => reorderSources(draggedId, targetId)}
              openExternal={(url) => void openExternal(url)}
              openStarterSources={() => setShowStarterSourcesModal(true)}
            />
          )}

          {activeTab === "config" && (
            <ConfigView
              manageableConfigs={manageableConfigs}
              selectedConfigId={selectedConfigId}
              selectConfig={(id) => void selectConfig(id)}
              isConfigLoading={isConfigLoading}
              missingConfig={missingConfig}
              createMissingConfig={(mode) => void createMissingConfig(mode)}
              currentConfig={currentConfig}
              setCurrentConfig={setCurrentConfig}
              structuredConfigChanges={structuredConfigChanges}
              openStructuredPreview={() => setConfigPreviewMode("structured")}
              rawConfigContent={rawConfigContent}
              setRawConfigContent={setRawConfigContent}
              openRawPreview={() => setConfigPreviewMode("raw")}
              saveRawConfig={() => void saveRawConfig()}
            />
          )}

          {activeTab === "firmware" && (
            <FirmwareView
              openSettings={() => setActiveTab("settings")}
              openUpdates={() => setActiveTab("updates")}
              sdRoot={pathConfig?.sd_root || ""}
            />
          )}

          {activeTab === "apps" && (
            <AppsView
              homebrew={homebrew}
              rescan={() => void loadHomebrew()}
              openSettings={() => setActiveTab("settings")}
              openUpdates={() => setActiveTab("updates")}
            />
          )}

          {activeTab === "remote" && (
            <RemoteView
              sshHost={sshHost}
              setSshHost={setSshHost}
              sshUser={sshUser}
              setSshUser={setSshUser}
              sshPass={sshPass}
              setSshPass={setSshPass}
              isSshConnected={isSshConnected}
              connectSsh={() => void connectSsh()}
              remoteRoot={remoteRoot}
              setRemoteRoot={setRemoteRoot}
              installPlanAll={installPlanAll}
              installPlanUpdates={installPlanUpdates}
              isUpdating={isUpdating}
              runRemoteUpdate={(ids) => void runRemoteUpdate(ids, remoteRoot)}
              remotePath={remotePath}
              setRemotePath={setRemotePath}
              readRemote={() => void readRemote()}
              writeRemote={() => void writeRemote()}
              remoteConfig={remoteConfig}
              setRemoteConfig={setRemoteConfig}
              openUpdates={() => setActiveTab("updates")}
            />
          )}

          {activeTab === "utilities" && (
            <UtilitiesView
              sdRoot={pathConfig?.sd_root || ""}
            />
          )}

          {activeTab === "settings" && (
            <SettingsView
              theme={theme}
              saveTheme={saveTheme}
              setShowWalkthrough={setShowWalkthrough}
              uiSettings={uiSettings}
              setUiSettings={setUiSettings}
              saveUiSettings={saveUiSettings}
              workspaceValidation={workspaceValidation}
              pathConfig={pathConfig}
              choosePath={choosePath}
              loadWorkspaceValidation={loadWorkspaceValidation}
              wipeTargets={wipeTargets}
              resetManifest={resetManifest}
              globalBlacklist={globalBlacklist}
              setGlobalBlacklist={setGlobalBlacklist}
              saveGlobalBlacklist={saveGlobalBlacklist}
              copyToClipboard={copyToClipboard}
              openPathInManager={openPathInManager}
            />
          )}

          {activeTab === "logs" && (
            <LogsView
              logs={logs}
              logRef={logRef}
              openUpdates={() => setActiveTab("updates")}
              openSources={() => setActiveTab("sources")}
            />
          )}

          {activeTab === "help" && (
            <HelpView
              openWalkthrough={() => setShowWalkthrough(true)}
              openSettings={() => setActiveTab("settings")}
              openExternal={(url) => void openExternal(url)}
            />
          )}
        </div>
      </main>

      <SourceEditorModal
        open={showSourceEditor}
        editingSourceId={editingSourceId}
        sourceDraft={sourceDraft}
        setSourceDraft={setSourceDraft}
        parseSourceUrl={parseSourceUrl}
        openExternal={(url) => void openExternal(url)}
        close={() => setShowSourceEditor(false)}
        saveSource={saveSource}
      />

      <StarterSourcesModal
        open={showStarterSourcesModal}
        close={() => setShowStarterSourcesModal(false)}
        startFresh={() => setShowStarterSourcesModal(false)}
        importLocal={() => void importSourcesFromFile()}
        useBundledDefaults={() => void restoreDefaultSources()}
      />

      <WalkthroughModal
        open={showWalkthrough}
        walkthroughStep={walkthroughStep}
        walkthroughSteps={walkthroughSteps}
        setWalkthroughStep={setWalkthroughStep}
        completeWalkthrough={() => void completeWalkthrough()}
        jumpToTab={setActiveTab}
      />

      <StructuredConfigPreviewModal
        open={configPreviewMode === "structured"}
        changes={structuredConfigChanges}
        close={() => setConfigPreviewMode(null)}
        save={() => void saveStructuredConfig(structuredConfigChanges)}
      />

      <RawConfigDiffModal
        open={configPreviewMode === "raw"}
        diff={rawConfigDiff}
        close={() => setConfigPreviewMode(null)}
        save={() => void saveRawConfig()}
      />

      <RawSourcesModal
        open={showRawEditor}
        rawSources={rawSources}
        setRawSources={setRawSources}
        close={() => setShowRawEditor(false)}
        save={() => void saveRawSources()}
      />
    </div>
  );
}

export default App;
