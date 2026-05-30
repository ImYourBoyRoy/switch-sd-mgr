import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { 
  Download, 
  AlertTriangle, 
  CheckCircle, 
  Cpu, 
  BookOpen, 
  Info, 
  ChevronRight
} from "lucide-react";
import { PageHeader } from "../components/ui";

interface ProgressPayload {
  stage: string;
  message: string;
  source_id: string | null;
  current: number | null;
  total: number | null;
}

interface FirmwareVersion {
  version: string;
  url: string;
  minAtmosphere: string;
  releaseDate: string;
  description: string;
}

const DEFAULT_FIRMWARES: FirmwareVersion[] = [
  {
    version: "22.1.0",
    url: "https://archive.org/download/nintendo-switch-global-firmwares/Firmware%2022.1.0.zip",
    minAtmosphere: "1.11.1",
    releaseDate: "2026-04-06",
    description: "Latest core firmware. Adds handheld mode boost support and general system stability enhancements."
  },
  {
    version: "22.0.0",
    url: "https://archive.org/download/nintendo-switch-global-firmwares/Firmware%2022.0.0.zip",
    minAtmosphere: "1.11.0",
    releaseDate: "2026-03-09",
    description: "Initial system update for Switch 2 system integration and standard platform stability."
  },
  {
    version: "21.0.0",
    url: "https://archive.org/download/nintendo-switch-global-firmwares/Firmware%2021.0.0.zip",
    minAtmosphere: "1.10.0",
    releaseDate: "2025-10-14",
    description: "Major core OS update with structural enhancements and improved Homebrew sandbox stability."
  },
  {
    version: "20.0.0",
    url: "https://archive.org/download/nintendo-switch-global-firmwares/Firmware%2020.0.0.zip",
    minAtmosphere: "1.9.0",
    releaseDate: "2025-04-30",
    description: "Supports local GameShare & Virtual Game Cards with Switch 2 systems."
  },
  {
    version: "19.0.1",
    url: "https://archive.org/download/nintendo-switch-global-firmwares/Firmware%2019.0.1.zip",
    minAtmosphere: "1.8.0",
    releaseDate: "2024-10-22",
    description: "System stability improvements and compatibility adjustments."
  },
  {
    version: "18.1.0",
    url: "https://archive.org/download/nintendo-switch-global-firmwares/Firmware%2018.1.0.zip",
    minAtmosphere: "1.7.1",
    releaseDate: "2024-06-10",
    description: "Community-standard system firmware compatible with 1.7.x custom setups."
  }
];

interface FirmwareViewProps {
  openSettings: () => void;
  openUpdates: () => void;
  sdRoot: string;
}

export function FirmwareView({ openSettings, openUpdates, sdRoot }: FirmwareViewProps) {
  const [atmosphereVersion, setAtmosphereVersion] = useState<string | null>(null);
  const [firmwares, setFirmwares] = useState<FirmwareVersion[]>(DEFAULT_FIRMWARES);
  const [selectedFirmware, setSelectedFirmware] = useState<FirmwareVersion>(DEFAULT_FIRMWARES[0]);
  const [useCustomUrl, setUseCustomUrl] = useState(false);

  useEffect(() => {
    const fetchLatestMetadata = async () => {
      try {
        const response = await fetch("https://raw.githubusercontent.com/imyourboyroy/switch-sd-mgr-metadata/main/firmware_versions.json");
        if (response.ok) {
          const data = await response.json() as FirmwareVersion[];
          if (Array.isArray(data) && data.length > 0 && data[0].version) {
            setFirmwares(data);
            setSelectedFirmware(data[0]);
          }
        }
      } catch {
        // Fall back silently to default offline catalog if offline
      }
    };
    void fetchLatestMetadata();
  }, []);

  const [customUrl, setCustomUrl] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<string>("");
  const [downloadStage, setDownloadStage] = useState<string>("");
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

  const checkAtmosphere = async () => {
    try {
      const version = await invoke<string | null>("cmd_get_atmosphere_version");
      setAtmosphereVersion(version);
    } catch {
      setAtmosphereVersion(null);
    }
  };

  useEffect(() => {
    void checkAtmosphere();
  }, [sdRoot]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    
    if (isDownloading) {
      listen<ProgressPayload>("sd-updater://progress", (event) => {
        if (event.payload.stage === "firmware") {
          setDownloadStage(event.payload.stage);
          setDownloadProgress(event.payload.message);
        }
      }).then((fn) => {
        unlisten = fn;
      });
    }

    return () => {
      unlisten?.();
    };
  }, [isDownloading]);

  // Compatibility checking logic
  const checkCompatibility = () => {
    if (!atmosphereVersion) return { status: "unknown", message: "No active Atmosphere custom firmware detected." };
    if (atmosphereVersion === "detected") return { status: "warning", message: "Atmosphere folder detected, but exact version is untracked." };

    // Clean versions for comparison (strip leading 'v')
    const cleanAts = atmosphereVersion.replace(/^v/, "");
    const cleanMin = selectedFirmware.minAtmosphere;

    // Split semver chunks
    const atsParts = cleanAts.split(".").map(Number);
    const minParts = cleanMin.split(".").map(Number);

    for (let i = 0; i < 3; i++) {
      const a = atsParts[i] || 0;
      const m = minParts[i] || 0;
      if (a > m) return { status: "safe", message: `Compatible! Active Atmosphere (${atmosphereVersion}) is safe.` };
      if (a < m) return { status: "unsafe", message: `Incompatible! Selected Firmware requires Atmosphere v${selectedFirmware.minAtmosphere} or newer.` };
    }

    return { status: "safe", message: `Compatible! Active Atmosphere (${atmosphereVersion}) is safe.` };
  };

  const compatibility = checkCompatibility();

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadSuccess(null);
    setDownloadError(null);
    setDownloadProgress("Preparing download target...");
    
    const urlToUse = useCustomUrl ? customUrl.trim() : selectedFirmware.url;
    if (!urlToUse) {
      setDownloadError("Please provide a valid download URL.");
      setIsDownloading(false);
      return;
    }

    try {
      const result = await invoke<string>("cmd_download_firmware", {
        version: selectedFirmware.version,
        url: urlToUse
      });
      setDownloadSuccess(result);
      setCompletedSteps({}); // Reset steps helper
      void checkAtmosphere(); // Refresh Atmosphere status
    } catch (err) {
      setDownloadError(String(err));
    } finally {
      setIsDownloading(false);
    }
  };

  const toggleStep = (stepIndex: number) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [stepIndex]: !prev[stepIndex]
    }));
  };

  const installationSteps = [
    {
      title: "Confirm target /firmware folder",
      desc: `Check that all downloaded files exist on your SD target under '/firmware/'. The downloader flat-extracted them for Daybreak.`
    },
    {
      title: "Insert SD card and boot Switch",
      desc: "Safely eject the SD card, plug it into your Nintendo Switch, and boot the console into Atmosphere Custom Firmware."
    },
    {
      title: "Temporarily disable Switch themes",
      desc: "If you have custom console themes active, temporarily disable them now to prevent system crashes after the firmware update."
    },
    {
      title: "Launch Daybreak homebrew utility",
      desc: "Open the Album/HBMenu on your Switch and launch 'Daybreak' (Atmosphere's official, verified offline updater)."
    },
    {
      title: "Select firmware directory & check",
      desc: "Choose 'Install', select the '/firmware' directory, and wait for Daybreak to validate the system update files."
    },
    {
      title: "Perform installation (FAT32 + exFAT)",
      desc: "Select 'Preserve Settings' and then select 'Install (FAT32 + exFAT)'. Follow the prompts and click 'Reboot' to finish!"
    }
  ];

  return (
    <section className="view fade-in">
      <PageHeader
        title="Firmware Downloader"
        subtitle="Manage and download official Nintendo Switch system firmwares offline for safe installation via Daybreak."
      />

      <div className="panel-grid dashboard-grid">
        {/* Mirror & Selection Panel */}
        <section className="panel elevated-card">
          <div className="panel-header">
            <div>
              <h3>1. Select Firmware Version</h3>
              <small>Choose a trusted firmware release or configure a custom download mirror.</small>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
            <div className="settings-field">
              <label>Target Firmware Version</label>
              <select 
                value={selectedFirmware.version} 
                onChange={(e) => {
                  const selected = firmwares.find(f => f.version === e.target.value);
                  if (selected) setSelectedFirmware(selected);
                }}
                disabled={isDownloading}
                className="input-field"
                style={{ width: "100%" }}
              >
                {firmwares.map((f) => (
                  <option key={f.version} value={f.version}>
                    Firmware {f.version} ({f.releaseDate})
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-checkbox-row">
              <label className="checkbox-container">
                <input 
                  type="checkbox"
                  checked={useCustomUrl}
                  onChange={(e) => setUseCustomUrl(e.target.checked)}
                  disabled={isDownloading}
                />
                <span className="checkmark" />
                <span style={{ marginLeft: "0.5rem" }}>Use custom download mirror URL</span>
              </label>
            </div>

            {useCustomUrl && (
              <div className="settings-field fade-in">
                <label>Direct ZIP Download URL</label>
                <input 
                  type="text"
                  placeholder="https://example.com/firmware.zip"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  disabled={isDownloading}
                  className="input-field"
                  style={{ width: "100%" }}
                />
                <small className="help-text">Must point to a direct download link of a flat zip file containing official firmware files.</small>
              </div>
            )}

            <div className="info-alert" style={{ background: "rgba(255, 255, 255, 0.03)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <Info size={20} className="theme-color" style={{ marginTop: "2px", flexShrink: 0 }} />
                <div>
                  <h5 style={{ margin: 0, fontWeight: 600 }}>Release details</h5>
                  <p style={{ margin: "0.25rem 0 0", opacity: 0.8, fontSize: "0.85rem" }}>
                    {selectedFirmware.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Safety Guard Panel */}
        <section className="panel elevated-card">
          <div className="panel-header">
            <div>
              <h3>2. Atmosphere Safety Guard</h3>
              <small>Validates that the selected firmware is verified compatible with your active custom firmware.</small>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginTop: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <Cpu size={20} className="theme-color" />
                <span style={{ fontWeight: 500 }}>Active Atmosphere:</span>
              </div>
              <strong className="theme-color">
                {atmosphereVersion === "detected" ? "Folder Detected (Untracked)" : (atmosphereVersion || "Not Installed / Missing")}
              </strong>
            </div>

            {compatibility.status === "safe" && (
              <div className="info-alert" style={{ background: "rgba(46, 204, 113, 0.08)", borderColor: "rgba(46, 204, 113, 0.2)", color: "#2ecc71" }}>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                  <CheckCircle size={20} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>{compatibility.message}</span>
                </div>
              </div>
            )}

            {compatibility.status === "unsafe" && (
              <div className="info-alert" style={{ background: "rgba(231, 76, 60, 0.08)", borderColor: "rgba(231, 76, 60, 0.2)", color: "#e74c3c" }}>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <AlertTriangle size={20} style={{ marginTop: "2px", flexShrink: 0 }} />
                  <div>
                    <span style={{ fontSize: "0.9rem", fontWeight: 600, display: "block" }}>{compatibility.message}</span>
                    <small style={{ display: "block", marginTop: "0.25rem", opacity: 0.9 }}>
                      Warning: Bootloader panic or a black-screen crash will occur if you upgrade firmware beyond your Atmosphere support limits.
                    </small>
                    <button className="btn-secondary compact-btn" onClick={openUpdates} style={{ marginTop: "0.75rem", borderColor: "rgba(231, 76, 60, 0.2)", color: "#e74c3c", background: "transparent" }}>
                      Upgrade Atmosphere in Updates tab
                    </button>
                  </div>
                </div>
              </div>
            )}

            {compatibility.status === "unknown" && (
              <div className="info-alert" style={{ background: "rgba(241, 196, 15, 0.08)", borderColor: "rgba(241, 196, 15, 0.2)", color: "#f1c40f" }}>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <Info size={20} style={{ marginTop: "2px", flexShrink: 0 }} />
                  <div>
                    <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>{compatibility.message}</span>
                    <small style={{ display: "block", marginTop: "0.25rem", opacity: 0.9 }}>
                      Make sure Atmosphere v{selectedFirmware.minAtmosphere} or newer is planned or present on your SD target before installation.
                    </small>
                  </div>
                </div>
              </div>
            )}

            {compatibility.status === "warning" && (
              <div className="info-alert" style={{ background: "rgba(241, 196, 15, 0.08)", borderColor: "rgba(241, 196, 15, 0.2)", color: "#f1c40f" }}>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <AlertTriangle size={20} style={{ marginTop: "2px", flexShrink: 0 }} />
                  <div>
                    <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>{compatibility.message}</span>
                    <small style={{ display: "block", marginTop: "0.25rem", opacity: 0.9 }}>
                      An Atmosphere folder exists on the SD target but was not installed via this manager. Ensure it supports Firmware {selectedFirmware.version} (requires Atmosphere v{selectedFirmware.minAtmosphere}+).
                    </small>
                  </div>
                </div>
              </div>
            )}

            {/* Action Box */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
              <button 
                className="btn-primary" 
                onClick={handleDownload} 
                disabled={isDownloading || (compatibility.status === "unsafe" && !useCustomUrl)}
                style={{ width: "100%", justifyContent: "center" }}
              >
                <Download size={18} />
                Download Firmware {selectedFirmware.version}
              </button>

              <div className="settings-field" style={{ margin: 0 }}>
                <small className="help-text">
                  Downloads directly and extracts cleanly to <code style={{ color: "var(--theme-color-primary)" }}>{sdRoot ? `${sdRoot}/firmware/` : "SD/firmware/"}</code>.{" "}
                  <button 
                    onClick={openSettings}
                    style={{ background: "none", border: "none", padding: 0, color: "var(--theme-color-primary)", textDecoration: "underline", cursor: "pointer", fontSize: "inherit" }}
                  >
                    Configure path in Settings
                  </button>
                </small>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Progress & Output State panel */}
      {isDownloading && (
        <section className="panel elevated-card fade-in" style={{ marginTop: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div className="spinner theme-color" />
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: 0 }}>{downloadStage === "firmware" ? "Downloading & Extracting..." : "Preparing..."}</h4>
              <p style={{ margin: "0.25rem 0 0", opacity: 0.8, fontSize: "0.9rem" }}>{downloadProgress}</p>
            </div>
          </div>
        </section>
      )}

      {downloadSuccess && (
        <section className="panel elevated-card fade-in" style={{ marginTop: "1.5rem", borderColor: "rgba(46, 204, 113, 0.2)" }}>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
            <CheckCircle size={24} style={{ color: "#2ecc71", flexShrink: 0, marginTop: "2px" }} />
            <div>
              <h4 style={{ margin: 0, color: "#2ecc71" }}>Download & Extraction Complete!</h4>
              <p style={{ margin: "0.25rem 0 0", opacity: 0.9, fontSize: "0.9rem" }}>
                Firmware {selectedFirmware.version} update files have been successfully flat-extracted to your SD Card's <code style={{ color: "#2ecc71" }}>/firmware</code> directory.
              </p>
              <p style={{ margin: "0.5rem 0 0", opacity: 0.8, fontSize: "0.85rem", fontStyle: "italic" }}>
                You can now follow the Daybreak installation guide below to complete the update on your Switch!
              </p>
            </div>
          </div>
        </section>
      )}

      {downloadError && (
        <section className="panel elevated-card fade-in" style={{ marginTop: "1.5rem", borderColor: "rgba(231, 76, 60, 0.2)" }}>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
            <AlertTriangle size={24} style={{ color: "#e74c3c", flexShrink: 0, marginTop: "2px" }} />
            <div>
              <h4 style={{ margin: 0, color: "#e74c3c" }}>Download Failed</h4>
              <p style={{ margin: "0.25rem 0 0", opacity: 0.9, fontSize: "0.9rem", fontFamily: "monospace" }}>
                {downloadError}
              </p>
              <p style={{ margin: "0.5rem 0 0", opacity: 0.8, fontSize: "0.85rem" }}>
                Check your internet connection, ensure the SD target directory is writeable, and check the custom mirror URL if active.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Daybreak Tutorial Guide Panel */}
      <section className="panel elevated-card" style={{ marginTop: "1.5rem" }}>
        <div className="panel-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <BookOpen size={20} className="theme-color" />
            <h3>3. Daybreak Offline Installation Guide</h3>
          </div>
          <small>Interactive guide showing how to securely apply the downloaded firmware on your Nintendo Switch.</small>
        </div>

        <div className="walkthrough-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem", marginTop: "1.25rem" }}>
          {installationSteps.map((step, idx) => (
            <div 
              key={idx} 
              onClick={() => toggleStep(idx)}
              className={`step-card elevated-card ${completedSteps[idx] ? "completed" : ""}`}
              style={{
                padding: "1rem",
                borderRadius: "8px",
                background: completedSteps[idx] ? "rgba(46, 204, 113, 0.05)" : "rgba(255, 255, 255, 0.02)",
                border: completedSteps[idx] ? "1px solid rgba(46, 204, 113, 0.2)" : "1px solid rgba(255, 255, 255, 0.04)",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={{ 
                  fontSize: "0.75rem", 
                  fontWeight: "bold", 
                  textTransform: "uppercase", 
                  color: completedSteps[idx] ? "#2ecc71" : "var(--theme-color-primary)",
                  letterSpacing: "0.05em"
                }}>
                  Step {idx + 1}
                </span>
                {completedSteps[idx] ? (
                  <CheckCircle size={16} style={{ color: "#2ecc71" }} />
                ) : (
                  <ChevronRight size={16} style={{ opacity: 0.5 }} />
                )}
              </div>
              <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.95rem", fontWeight: 600, color: completedSteps[idx] ? "#2ecc71" : "#ffffff" }}>
                {step.title}
              </h4>
              <p style={{ margin: 0, fontSize: "0.85rem", opacity: completedSteps[idx] ? 0.7 : 0.8, lineHeight: 1.4 }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
