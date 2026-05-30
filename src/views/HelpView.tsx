import { Coffee, LifeBuoy, Settings } from "lucide-react";
import { PageHeader } from "../components/ui";

interface HelpViewProps {
  openWalkthrough: () => void;
  openSettings: () => void;
  openExternal: (url: string) => void;
}

export function HelpView({ openWalkthrough, openSettings, openExternal }: HelpViewProps) {
  return (
    <section className="view fade-in">
      <PageHeader
        title="Help & About"
        subtitle="A quick refresher for first-time setup, install flow, payload mirroring, and SSH workflows."
      />
      <div className="panel-grid dashboard-grid">
        <section className="panel elevated-card">
          <div className="panel-header">
            <div>
              <h3>Recommended flow</h3>
              <small>Keep things simple: scan, install core packages, then finish with post-install actions.</small>
            </div>
          </div>
          <ol className="detail-list ordered">
            <li>Choose an SD target or detected mounted volume.</li>
            <li>Optionally set a Boot Bin output path if you want payload mirrors.</li>
            <li>Choose a source setup: bundled starter sources, import a JSON file, or stay fully custom.</li>
            <li>Check sources, then run Install all or Install updates.</li>
            <li>Run post-install actions to apply config defaults and advanced overrides.</li>
            <li>Use SSH when the SD card stays in the console.</li>
          </ol>
          <div className="button-row compact-row">
            <button className="btn-primary" onClick={openWalkthrough}>
              <LifeBuoy size={16} />
              Start walkthrough
            </button>
            <button className="btn-secondary" onClick={openSettings}>
              <Settings size={16} />
              Open settings
            </button>
          </div>
        </section>

        <section className="panel elevated-card">
          <div className="panel-header">
            <div>
              <h3>Concepts</h3>
              <small>Short plain-English reminders for the main moving pieces.</small>
            </div>
          </div>
          <ul className="detail-list">
            <li><strong>SD target:</strong> where package files are installed.</li>
            <li><strong>Boot Bin path:</strong> optional payload mirror output for devices or tools that want a separate .bin layout.</li>
            <li><strong>Post-install actions:</strong> apply config defaults and override files after packages land.</li>
            <li><strong>Global blacklist:</strong> skip noisy or unwanted assets everywhere.</li>
            <li><strong>SSH transfer:</strong> send install contents to the Switch without touching the local manifest.</li>
          </ul>
        </section>

        <section className="panel elevated-card">
          <div className="panel-header">
            <div>
              <h3>Support this project</h3>
              <small>If this utility saves you time, you can tip Roy directly in your system browser.</small>
            </div>
          </div>
          <div className="support-panel">
            <p>Buy me a hot cocoa</p>
            <strong>Venmo: @ItsYourBoyRoy</strong>
            <button className="btn-primary" onClick={() => openExternal("https://venmo.com/ItsYourBoyRoy")}>
              <Coffee size={16} />
              Open Venmo
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
