// ./src/views/UtilitiesView.tsx
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Flame,
  HardDrive,
  HelpCircle,
  Image as ImageIcon,
  Info,
  Layers,
  Play,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Tv,
  XCircle,
} from "lucide-react";

interface UtilitiesViewProps {
  sdRoot: string;
}

interface DnsStatus {
  static_default_blocked: boolean;
  static_emummc_blocked: boolean;
  live_pc_blocked: boolean;
  checked_domains: string[];
}

interface BenchmarkResult {
  write_speed_mbs: number;
  read_speed_mbs: number;
  integrity_passed: boolean;
  test_file_path: string;
  error: string | null;
}

interface BiosStatus {
  name: string;
  console: string;
  found: boolean;
  hash_valid: boolean;
  expected_hash: string;
  actual_hash: string;
}

type SubTab = "logo" | "security" | "storage" | "emulation" | "rcm";

export function UtilitiesView({ sdRoot }: UtilitiesViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("logo");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Logo Customizer State
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isInjectingLogo, setIsInjectingLogo] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Security Shield State
  const [securityLoading, setSecurityLoading] = useState(false);
  const [dnsStatus, setDnsStatus] = useState<DnsStatus | null>(null);

  // Benchmark State
  const [benchLoading, setBenchLoading] = useState(false);
  const [benchResult, setBenchResult] = useState<BenchmarkResult | null>(null);

  // Emulation BIOS State
  const [biosLoading, setBiosLoading] = useState(false);
  const [biosList, setBiosList] = useState<BiosStatus[]>([]);

  // Show a message helper
  const showMessage = (text: string, type: "success" | "error" | "info" = "info") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 8000);
  };

  // Run security audit on demand
  const runSecurityAudit = async (silent = false) => {
    if (!silent) setSecurityLoading(true);
    try {
      const res = await invoke<DnsStatus>("cmd_test_telemetry_blocks");
      setDnsStatus(res);
      if (!silent) showMessage("Security scan completed.", "success");
    } catch (e) {
      if (!silent) showMessage(`Failed to audit security blocks: ${e}`, "error");
    } finally {
      if (!silent) setSecurityLoading(false);
    }
  };

  // Run storage benchmark
  const runStorageBenchmark = async () => {
    setBenchLoading(true);
    setBenchResult(null);
    try {
      const res = await invoke<BenchmarkResult>("cmd_benchmark_storage");
      setBenchResult(res);
      if (res.error) {
        showMessage(`Benchmark finished with error: ${res.error}`, "error");
      } else if (!res.integrity_passed) {
        showMessage("CAUTION: Disk write-read integrity verification FAILED!", "error");
      } else {
        showMessage("SD Card speed test and data validation complete.", "success");
      }
    } catch (e) {
      showMessage(`Failed to run storage benchmark: ${e}`, "error");
    } finally {
      setBenchLoading(false);
    }
  };

  // Run BIOS Doctor validation
  const runBiosDoctor = async (silent = false) => {
    if (!silent) setBiosLoading(true);
    try {
      const res = await invoke<BiosStatus[]>("cmd_validate_retroarch_bios");
      setBiosList(res);
      if (!silent) showMessage("BIOS integrity audit completed.", "success");
    } catch (e) {
      if (!silent) showMessage(`Failed to scan BIOS files: ${e}`, "error");
    } finally {
      if (!silent) setBiosLoading(false);
    }
  };

  // Auto-run audits when tabs are active
  useEffect(() => {
    if (activeSubTab === "security" && !dnsStatus) {
      void runSecurityAudit(true);
    } else if (activeSubTab === "emulation" && biosList.length === 0) {
      void runBiosDoctor(true);
    }
  }, [activeSubTab]);

  // Image Dropper Logic
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadLogoImage(file);
  };

  const handleLogoDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) loadLogoImage(file);
  };

  const loadLogoImage = (file: File) => {
    if (!file.type.startsWith("image/")) {
      showMessage("Please upload a valid image file.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Reset canvas size to exactly 720x1280
        canvas.width = 720;
        canvas.height = 1280;

        // Clear canvas
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, 720, 1280);

        // Center Cover Scaling
        const imgRatio = img.width / img.height;
        const targetRatio = 720 / 1280;
        let drawWidth = 720;
        let drawHeight = 1280;
        let offsetX = 0;
        let offsetY = 0;

        if (imgRatio > targetRatio) {
          // Image is wider than 720x1280 aspect
          drawWidth = 1280 * imgRatio;
          offsetX = (720 - drawWidth) / 2;
        } else {
          // Image is taller than 720x1280 aspect
          drawHeight = 720 / imgRatio;
          offsetY = (1280 - drawHeight) / 2;
        }

        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        setImageLoaded(true);
        showMessage("Custom image loaded and scaled to exactly 720x1280.", "success");
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Inject Bootlogo Command Invocation
  const handleInjectLogo = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageLoaded) {
      showMessage("Please load an image first.", "error");
      return;
    }

    setIsInjectingLogo(true);
    try {
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get 2D canvas context");

      // Extract raw 32-bit RGBA pixel array
      const imgData = ctx.getImageData(0, 0, 720, 1280);
      const pixelBuffer = Array.from(imgData.data);

      const result = await invoke<string>("cmd_write_bootlogo", { pixelsRgba: pixelBuffer });
      showMessage(result, "success");
    } catch (e) {
      showMessage(`Logo injection failed: ${e}`, "error");
    } finally {
      setIsInjectingLogo(false);
    }
  };

  return (
    <div className="view-container animate-fade-in">
      <div className="view-header">
        <div className="view-title-wrap">
          <ShieldCheck size={32} className="text-accent" />
          <div>
            <h1>Premium Utilities</h1>
            <p className="view-subtitle">Enhance, audit, and safeguard your custom Switch SD setup</p>
          </div>
        </div>
        <div className="view-actions">
          <span className="badge badge-accent">Suite v1.2</span>
        </div>
      </div>

      {/* Global message banner */}
      {message && (
        <div className={`notification elevated-card border-left-${message.type === "success" ? "success" : message.type === "error" ? "error" : "accent"} animate-slide-up`}>
          <div className="notification-content">
            {message.type === "success" ? (
              <CheckCircle2 size={18} className="text-success" />
            ) : message.type === "error" ? (
              <XCircle size={18} className="text-error" />
            ) : (
              <Info size={18} className="text-accent" />
            )}
            <span>{message.text}</span>
          </div>
        </div>
      )}

      {/* Grid Layout: Left Nav Links + Right Panel Content */}
      <div className="dashboard-grid">
        <div className="grid-left-col">
          <div className="glass-panel elevated-card flex-col gap-2 p-2">
            <button
              onClick={() => setActiveSubTab("logo")}
              className={`nav-item text-left w-full justify-start ${activeSubTab === "logo" ? "active" : ""}`}
            >
              <ImageIcon size={18} />
              <span>Logo Customizer</span>
            </button>
            <button
              onClick={() => setActiveSubTab("security")}
              className={`nav-item text-left w-full justify-start ${activeSubTab === "security" ? "active" : ""}`}
            >
              <Shield size={18} />
              <span>Security Shield</span>
            </button>
            <button
              onClick={() => setActiveSubTab("storage")}
              className={`nav-item text-left w-full justify-start ${activeSubTab === "storage" ? "active" : ""}`}
            >
              <HardDrive size={18} />
              <span>Storage Benchmark</span>
            </button>
            <button
              onClick={() => setActiveSubTab("emulation")}
              className={`nav-item text-left w-full justify-start ${activeSubTab === "emulation" ? "active" : ""}`}
            >
              <Tv size={18} />
              <span>Emulation Doctor</span>
            </button>
            <button
              onClick={() => setActiveSubTab("rcm")}
              className={`nav-item text-left w-full justify-start ${activeSubTab === "rcm" ? "active" : ""}`}
            >
              <Layers size={18} />
              <span>RCM Injector Guide</span>
            </button>
          </div>

          {/* Quick Help Card */}
          <div className="help-card elevated-card glass-panel mt-4">
            <div className="help-card-header">
              <HelpCircle size={18} className="text-accent" />
              <strong>SD Target Active</strong>
            </div>
            <p className="text-xs opacity-75 mt-1 truncate">
              {sdRoot || "No SD card connected. Configured in Settings."}
            </p>
          </div>
        </div>

        {/* Dynamic Panel content */}
        <div className="grid-main-col">
          <div className="glass-panel elevated-card p-6">
            
            {/* TAB 1: LOGO CUSTOMIZER */}
            {activeSubTab === "logo" && (
              <div className="flex-col gap-4">
                <div className="flex-row justify-between items-center border-bottom pb-4 mb-2">
                  <div>
                    <h3 className="text-lg font-bold flex-row items-center gap-2">
                      <ImageIcon size={20} className="text-accent" />
                      Bootlogo Customizer
                    </h3>
                    <p className="text-sm opacity-70">
                      Inject a custom startup image directly into Hekate's boot process.
                    </p>
                  </div>
                </div>

                <div className="logo-converter-layout flex-row gap-6">
                  {/* Left Column: Drag & Drop Area */}
                  <div className="flex-col flex-1 gap-4">
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleLogoDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className="drag-drop-zone elevated-card"
                    >
                      <ImageIcon size={36} className="text-accent opacity-65 mb-2 animate-pulse" />
                      <strong>Drag & drop custom image</strong>
                      <span className="text-xs opacity-70">Supports PNG, JPG, WEBP, BMP</span>
                      <span className="text-xxs text-accent mt-2 font-mono">Will auto-crop to 720 x 1280 cover aspect</span>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleLogoFileChange}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>

                    <div className="alert-box alert-info elevated-card mt-2">
                      <Info size={16} />
                      <div className="alert-copy">
                        <strong>Formatting Details</strong>
                        <p className="text-xxs">
                          The Switch screens standard bootlogo demands uncompressed 32-bit ARGB/BGRA bitmaps sizing exactly 720 pixels wide by 1280 pixels tall. Our engine handles canvas downscaling, bottom-to-top flipping, and writes Hekate's <code>/bootloader/bootlogo.bmp</code> path securely.
                        </p>
                      </div>
                    </div>

                    <div className="flex-row gap-3 mt-2">
                      <button
                        onClick={handleInjectLogo}
                        disabled={!imageLoaded || isInjectingLogo}
                        className="btn btn-accent flex-row items-center justify-center gap-2 flex-1"
                      >
                        {isInjectingLogo ? (
                          <>
                            <RefreshCw size={16} className="animate-spin" />
                            <span>Injecting Bootlogo...</span>
                          </>
                        ) : (
                          <>
                            <Play size={16} />
                            <span>Apply Custom Bootlogo</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Canvas Live Preview */}
                  <div className="logo-preview-column flex-col items-center">
                    <span className="text-xs font-semibold mb-2 opacity-85">720x1280 Render Target Preview</span>
                    <div className="canvas-wrapper elevated-card">
                      <canvas
                        ref={canvasRef}
                        className={`logo-canvas-preview ${imageLoaded ? "active" : ""}`}
                        style={{ width: "180px", height: "320px" }}
                      />
                      {!imageLoaded && (
                        <div className="canvas-placeholder flex-col items-center justify-center">
                          <ImageIcon size={28} className="opacity-30 mb-1" />
                          <span className="text-xxs opacity-40">No Image Loaded</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SECURITY SHIELD */}
            {activeSubTab === "security" && (
              <div className="flex-col gap-4">
                <div className="flex-row justify-between items-center border-bottom pb-4 mb-2">
                  <div>
                    <h3 className="text-lg font-bold flex-row items-center gap-2">
                      <Shield size={20} className="text-accent" />
                      90DNS & Telemetry Block Tester
                    </h3>
                    <p className="text-sm opacity-70">
                      Audit SD configuration cards and local PC networks to prevent Nintendo telemetry tracking.
                    </p>
                  </div>
                  <button
                    onClick={() => void runSecurityAudit()}
                    disabled={securityLoading}
                    className="btn btn-secondary flex-row items-center gap-2"
                  >
                    <RefreshCw size={16} className={securityLoading ? "animate-spin" : ""} />
                    <span>Run Security Audit</span>
                  </button>
                </div>

                {securityLoading ? (
                  <div className="flex-col items-center justify-center py-12 gap-3">
                    <RefreshCw size={32} className="text-accent animate-spin" />
                    <span className="text-sm font-medium opacity-80">Auditing DNS blocks and hosts mappings...</span>
                  </div>
                ) : dnsStatus ? (
                  <div className="flex-col gap-4">
                    {/* Overall Summary Banner */}
                    <div className={`banner elevated-card flex-row gap-4 p-4 items-center ${
                      dnsStatus.static_default_blocked && dnsStatus.live_pc_blocked
                        ? "border-left-success bg-success-dim"
                        : "border-left-error bg-error-dim"
                    }`}>
                      {dnsStatus.static_default_blocked && dnsStatus.live_pc_blocked ? (
                        <>
                          <ShieldCheck size={28} className="text-success flex-shrink-0" />
                          <div>
                            <strong className="text-sm text-success">Double-Block Active (Extremely Secure)</strong>
                            <p className="text-xs opacity-85">
                              Both offline SD card hosts overrides and local network live DNS resolutions are safely blocking tracking endpoints.
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <ShieldAlert size={28} className="text-error flex-shrink-0" />
                          <div>
                            <strong className="text-sm text-error">Unsecured or Partially Vulnerable</strong>
                            <p className="text-xs opacity-85">
                              Ensure your Switch is using emuMMC hosts blocking or configure 90DNS to avoid getting console banned.
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Shield Status Cards */}
                    <div className="grid-cards-3 mt-2">
                      {/* Card 1: Default.txt */}
                      <div className="summary-card glass-panel elevated-card">
                        <div className="flex-row items-center justify-between">
                          <span className="text-xs opacity-75">Default hosts Configuration</span>
                          {dnsStatus.static_default_blocked ? (
                            <CheckCircle2 size={16} className="text-success" />
                          ) : (
                            <XCircle size={16} className="text-error" />
                          )}
                        </div>
                        <div className="metric-wrap mt-2">
                          <span className="text-sm font-bold">atmosphere/hosts/default.txt</span>
                        </div>
                        <span className={`text-xxs font-semibold mt-1 ${
                          dnsStatus.static_default_blocked ? "text-success" : "text-error"
                        }`}>
                          {dnsStatus.static_default_blocked ? "Blocked (Nintendo Blocked)" : "Missing / Not active"}
                        </span>
                      </div>

                      {/* Card 2: emummc.txt */}
                      <div className="summary-card glass-panel elevated-card">
                        <div className="flex-row items-center justify-between">
                          <span className="text-xs opacity-75">emuMMC hosts Configuration</span>
                          {dnsStatus.static_emummc_blocked ? (
                            <CheckCircle2 size={16} className="text-success" />
                          ) : (
                            <XCircle size={16} className="text-error" />
                          )}
                        </div>
                        <div className="metric-wrap mt-2">
                          <span className="text-sm font-bold">atmosphere/hosts/emummc.txt</span>
                        </div>
                        <span className={`text-xxs font-semibold mt-1 ${
                          dnsStatus.static_emummc_blocked ? "text-success" : "text-error"
                        }`}>
                          {dnsStatus.static_emummc_blocked ? "Blocked (Nintendo Blocked)" : "Missing / Not active"}
                        </span>
                      </div>

                      {/* Card 3: PC DNS Test */}
                      <div className="summary-card glass-panel elevated-card">
                        <div className="flex-row items-center justify-between">
                          <span className="text-xs opacity-75">Local PC network Resolution</span>
                          {dnsStatus.live_pc_blocked ? (
                            <CheckCircle2 size={16} className="text-success" />
                          ) : (
                            <XCircle size={16} className="text-warn" />
                          )}
                        </div>
                        <div className="metric-wrap mt-2">
                          <span className="text-sm font-bold">PC Live Telemetry resolving</span>
                        </div>
                        <span className={`text-xxs font-semibold mt-1 ${
                          dnsStatus.live_pc_blocked ? "text-success" : "text-warn"
                        }`}>
                          {dnsStatus.live_pc_blocked ? "DNS Blocked (Safe on PC network)" : "Telemetry Resolves (PC network bypasses)"}
                        </span>
                      </div>
                    </div>

                    <div className="alert-box alert-info elevated-card mt-2">
                      <Info size={16} />
                      <div className="alert-copy">
                        <strong>Telemetry Shielding Guide</strong>
                        <p className="text-xs">
                          Atmosphere CFW blocks telemetry tracking by creating overrides inside the <code>atmosphere/hosts/</code> folder. You can auto-generate a telemetry block list by going to the <strong>Config</strong> tab, choosing <strong>Create File</strong> on <code>default.txt</code>, and selecting the **Managed Defaults (Nintendo telemetry override)** starter choice.
                        </p>
                      </div>
                    </div>

                    {/* Audited domains list */}
                    <div className="glass-panel p-4 mt-2">
                      <span className="text-xs font-semibold block mb-2 opacity-85">Nintendo Endpoints Checked:</span>
                      <div className="flex-col gap-1">
                        {dnsStatus.checked_domains.map((domain) => (
                          <div key={domain} className="flex-row justify-between items-center text-xs border-bottom py-1 font-mono">
                            <span>{domain}</span>
                            <span className="badge badge-accent">127.0.0.1 / Sinkholed</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-col items-center justify-center py-12 gap-3 opacity-60">
                    <Shield size={36} className="text-accent animate-pulse" />
                    <span className="text-sm font-medium">Ready to perform network and hosts static audit.</span>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: STORAGE BENCHMARK */}
            {activeSubTab === "storage" && (
              <div className="flex-col gap-4">
                <div className="flex-row justify-between items-center border-bottom pb-4 mb-2">
                  <div>
                    <h3 className="text-lg font-bold flex-row items-center gap-2">
                      <HardDrive size={20} className="text-accent" />
                      SD Card Authenticity & Benchmark
                    </h3>
                    <p className="text-sm opacity-70">
                      Audit write-read speeds and verify data blocks integrity to flag counterfeit/fake expander cards.
                    </p>
                  </div>
                  <button
                    onClick={runStorageBenchmark}
                    disabled={benchLoading}
                    className="btn btn-accent flex-row items-center gap-2"
                  >
                    {benchLoading ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Benchmarking...</span>
                      </>
                    ) : (
                      <>
                        <Play size={16} />
                        <span>Start Storage Audit</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="alert-box alert-warn elevated-card mt-2">
                  <AlertCircle size={16} className="text-warn" />
                  <div className="alert-copy">
                    <strong>Storage Audit Operation Notice</strong>
                    <p className="text-xs">
                      This benchmark will perform a fast 20MB block sequence write to <code>.sd_speedtest.tmp</code> at your SD target directory, flush filesystem caches, read back the diagnostic blocks to compute validation signatures, and immediately delete the test file. Make sure your SD card has at least 20MB of free storage before running.
                    </p>
                  </div>
                </div>

                {benchLoading ? (
                  <div className="flex-col items-center justify-center py-12 gap-4">
                    <RefreshCw size={36} className="text-accent animate-spin" />
                    <div className="text-center">
                      <strong className="text-sm font-medium block">Writing mock diagnostic data...</strong>
                      <span className="text-xs opacity-70">Measuring write throughput, clearing caches, and checking byte integrity.</span>
                    </div>
                  </div>
                ) : benchResult ? (
                  <div className="flex-col gap-4 mt-2">
                    {/* Authenticity banner */}
                    {benchResult.error ? (
                      <div className="banner border-left-error bg-error-dim flex-row gap-3 p-4 items-center">
                        <ShieldAlert size={28} className="text-error" />
                        <div>
                          <strong className="text-sm text-error">Benchmark Failure</strong>
                          <p className="text-xs opacity-85">An error occurred: {benchResult.error}</p>
                        </div>
                      </div>
                    ) : benchResult.integrity_passed ? (
                      <div className="banner border-left-success bg-success-dim flex-row gap-3 p-4 items-center">
                        <ShieldCheck size={28} className="text-success" />
                        <div>
                          <strong className="text-sm text-success">Genuine Card Verified (Integrity Passed)</strong>
                          <p className="text-xs opacity-85">
                            Data blocks match exactly on read-back. The SD card successfully returned correct bytes, indicating it possesses correct sector memory tables.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="banner border-left-error bg-error-dim flex-row gap-3 p-4 items-center animate-pulse">
                        <ShieldAlert size={28} className="text-error" />
                        <div>
                          <strong className="text-sm text-error">CRITICAL WARNING: Fake / Counterfeit Card Flagged!</strong>
                          <p className="text-xs opacity-85">
                            Byte mismatch detected during read-back. The card failed data integrity checks. This is a primary sign of cheap fake expanders (e.g. 1TB cards that are actually modified 16GB cards that rewrite sector allocations). Do NOT put critical CFW data on this card!
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Gauges/Cards metrics */}
                    <div className="grid-cards-2">
                      {/* Write speed metric */}
                      <div className="summary-card glass-panel elevated-card flex-col items-center justify-center p-6 gap-2">
                        <span className="text-xs opacity-75">Write Speed Thruput</span>
                        <div className="flex-row items-baseline gap-1 text-accent">
                          <span className="text-3xl font-extrabold font-mono">
                            {benchResult.write_speed_mbs.toFixed(2)}
                          </span>
                          <span className="text-sm font-semibold">MB/s</span>
                        </div>
                        <span className="text-xxs opacity-70">Writing 20MB sequenced blocks</span>
                      </div>

                      {/* Read speed metric */}
                      <div className="summary-card glass-panel elevated-card flex-col items-center justify-center p-6 gap-2">
                        <span className="text-xs opacity-75">Read Speed Thruput</span>
                        <div className="flex-row items-baseline gap-1 text-accent">
                          <span className="text-3xl font-extrabold font-mono">
                            {benchResult.read_speed_mbs.toFixed(2)}
                          </span>
                          <span className="text-sm font-semibold">MB/s</span>
                        </div>
                        <span className="text-xxs opacity-70">Reading 20MB sequenced blocks</span>
                      </div>
                    </div>

                    {/* Drive Classification */}
                    {!benchResult.error && (
                      <div className="glass-panel p-4 flex-row items-center gap-3">
                        <Flame size={20} className="text-accent" />
                        <div>
                          <strong className="text-xs block">Expected Speed Class Performance</strong>
                          <span className="text-xxs opacity-75">
                            {benchResult.write_speed_mbs > 60.0 
                              ? "Class Classification: UHS-I U3 / V30 High Speed Card. Excellent for high speed asset loadtimes, CFW launchings, and large game titles."
                              : benchResult.write_speed_mbs > 25.0
                              ? "Class Classification: Class 10 / U1 Standard Card. Standard loading speeds."
                              : "Class Classification: Slow / Low Tier Card. May notice lagging in larger loading transitions."
                            }
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-col items-center justify-center py-12 gap-3 opacity-60">
                    <HardDrive size={36} className="text-accent animate-pulse" />
                    <span className="text-sm font-medium">Ready to perform read/write diagnostic operations.</span>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: EMULATION DOCTOR */}
            {activeSubTab === "emulation" && (
              <div className="flex-col gap-4">
                <div className="flex-row justify-between items-center border-bottom pb-4 mb-2">
                  <div>
                    <h3 className="text-lg font-bold flex-row items-center gap-2">
                      <Tv size={20} className="text-accent" />
                      Emulation BIOS doctor
                    </h3>
                    <p className="text-sm opacity-70">
                      Scan <code>/retroarch/cores/system/</code> against official MD5 databases to verify legitimate bios files.
                    </p>
                  </div>
                  <button
                    onClick={() => void runBiosDoctor()}
                    disabled={biosLoading}
                    className="btn btn-secondary flex-row items-center gap-2"
                  >
                    <RefreshCw size={16} className={biosLoading ? "animate-spin" : ""} />
                    <span>Scan System Folders</span>
                  </button>
                </div>

                {biosLoading ? (
                  <div className="flex-col items-center justify-center py-12 gap-3">
                    <RefreshCw size={32} className="text-accent animate-spin" />
                    <span className="text-sm font-medium opacity-80">Scanning system directories and hashing files...</span>
                  </div>
                ) : biosList.length > 0 ? (
                  <div className="flex-col gap-4">
                    {/* Statistics header */}
                    <div className="flex-row justify-between items-center bg-dark-card p-3 rounded-lg border">
                      <span className="text-xs font-semibold opacity-90">Scan results:</span>
                      <div className="flex-row gap-4 text-xs">
                        <span className="text-success flex-row items-center gap-1 font-semibold">
                          <CheckCircle2 size={14} />
                          {biosList.filter((b) => b.found && b.hash_valid).length} Verified
                        </span>
                        <span className="text-error flex-row items-center gap-1 font-semibold">
                          <AlertCircle size={14} />
                          {biosList.filter((b) => b.found && !b.hash_valid).length} Mismatched
                        </span>
                        <span className="text-muted flex-row items-center gap-1">
                          {biosList.filter((b) => !b.found).length} Missing
                        </span>
                      </div>
                    </div>

                    {/* BIOS Cards */}
                    <div className="flex-col gap-3">
                      {biosList.map((bios) => (
                        <div key={bios.name} className={`glass-panel elevated-card flex-col p-4 border-left-${
                          !bios.found ? "muted" : bios.hash_valid ? "success" : "error"
                        }`}>
                          <div className="flex-row justify-between items-center">
                            <div className="flex-col">
                              <span className="text-xs opacity-65 font-mono">{bios.console}</span>
                              <strong className="text-sm font-bold">{bios.name}</strong>
                            </div>
                            <span className={`badge ${
                              !bios.found 
                                ? "badge-secondary" 
                                : bios.hash_valid 
                                ? "badge-success" 
                                : "badge-error"
                            }`}>
                              {!bios.found 
                                ? "Missing File" 
                                : bios.hash_valid 
                                ? "Verified legitimate" 
                                : "Hash mismatch"
                              }
                            </span>
                          </div>

                          <div className="mt-3 text-xxs font-mono opacity-70 flex-col gap-1 border-top pt-2">
                            <div className="flex-row justify-between">
                              <span>Path:</span>
                              <span className="text-accent truncate">/retroarch/cores/system/{bios.name}</span>
                            </div>
                            <div className="flex-row justify-between">
                              <span>Expected MD5:</span>
                              <span>{bios.expected_hash}</span>
                            </div>
                            {bios.found && (
                              <div className="flex-row justify-between">
                                <span>Actual MD5:</span>
                                <span className={bios.hash_valid ? "text-success" : "text-error"}>
                                  {bios.actual_hash}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="alert-box alert-info elevated-card mt-2">
                      <Info size={16} />
                      <div className="alert-copy">
                        <strong>BIOS Directory Structuring</strong>
                        <p className="text-xs">
                          RetroArch on the Switch requires exact filenames and casing inside <code>/retroarch/cores/system/</code> to support hardware mapping. Use this screen to ensure yours match precisely to avoid crashes on PlayStation, GBA, or Dreamcast core starts.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-col items-center justify-center py-12 gap-3 opacity-60">
                    <Tv size={36} className="text-accent animate-pulse" />
                    <span className="text-sm font-medium">Ready to audit RetroArch system files.</span>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: RCM INJECTOR GUIDE */}
            {activeSubTab === "rcm" && (
              <div className="flex-col gap-4">
                <div className="flex-row justify-between items-center border-bottom pb-4 mb-2">
                  <div>
                    <h3 className="text-lg font-bold flex-row items-center gap-2">
                      <Layers size={20} className="text-accent" />
                      Recovery (RCM) Payload Injection Guide
                    </h3>
                    <p className="text-sm opacity-70">
                      Learn how to trigger Recovery Mode (RCM) on your hardware and safely inject custom payloads.
                    </p>
                  </div>
                </div>

                <div className="rcm-guide-steps flex-col gap-4 mt-2">
                  {/* Step 1 */}
                  <div className="flex-row gap-4 items-start">
                    <div className="step-number elevated-card">1</div>
                    <div className="flex-col flex-1">
                      <strong className="text-sm font-semibold">Power down Switch</strong>
                      <p className="text-xs opacity-75">
                        Hold down the physical power button on the top rail of the Switch for 5 seconds, choose **Power Options**, and select **Turn Off**. RCM cannot be triggered from standard sleep mode.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex-row gap-4 items-start">
                    <div className="step-number elevated-card">2</div>
                    <div className="flex-col flex-1">
                      <strong className="text-sm font-semibold">Insert Joy-Con RCM Jig</strong>
                      <p className="text-xs opacity-75">
                        Slide your custom physical RCM Jig fully down the **right-hand Joy-Con rail** until it clicks into the bottom pins. If you do not have a jig, you can use a bent paperclip or foil bridge on Pins 10 and 4.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex-row gap-4 items-start">
                    <div className="step-number elevated-card">3</div>
                    <div className="flex-col flex-1">
                      <strong className="text-sm font-semibold">Boot into Recovery (RCM)</strong>
                      <p className="text-xs opacity-75">
                        Hold down the **Volume Up (+)** button on the top, and while holding it, click the **Power** button once. The screen must remain completely black (indicating it has booted in RCM, not standard Switch OS).
                      </p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex-row gap-4 items-start">
                    <div className="step-number elevated-card">4</div>
                    <div className="flex-col flex-1">
                      <strong className="text-sm font-semibold">Connect to PC or Injector</strong>
                      <p className="text-xs opacity-75">
                        Connect the Switch to your PC using a reliable USB-C data cable. Alternatively, you can plug in a portable hardware payload injector (like an RCMLoader) or connect it to an Android phone using standard WebUSB OTG.
                      </p>
                    </div>
                  </div>

                  {/* Step 5 */}
                  <div className="flex-row gap-4 items-start">
                    <div className="step-number elevated-card">5</div>
                    <div className="flex-col flex-1">
                      <strong className="text-sm font-semibold">Inject Hekate / Payload.bin</strong>
                      <p className="text-xs opacity-75">
                        Launch your desktop payload launcher (such as TegraRCMGUI on Windows, fusee-launcher on macOS/Linux, or an online browser tool). Load the mirrored payload matching Hekate (e.g. <code>payload.bin</code>) to boot Atmosphere CFW.
                      </p>
                    </div>
                  </div>
                </div>

                {/* External links */}
                <div className="flex-row justify-end gap-3 mt-4 border-top pt-4">
                  <a
                    href="https://webxusa.github.io/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary flex-row items-center gap-2"
                  >
                    <span>WebUSB Injector Tool</span>
                    <ExternalLink size={14} />
                  </a>
                  <a
                    href="https://github.com/eliboa/TegraRcmGUI"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary flex-row items-center gap-2"
                  >
                    <span>Download TegraRcmGUI (PC)</span>
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
