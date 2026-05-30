import type { Dispatch, SetStateAction } from "react";
import { EmptyStateCard, PageHeader } from "../components/ui";
import { Upload, Wifi } from "lucide-react";
import type { InstallPlanResponse } from "../app-types";

interface RemoteViewProps {
  sshHost: string;
  setSshHost: Dispatch<SetStateAction<string>>;
  sshUser: string;
  setSshUser: Dispatch<SetStateAction<string>>;
  sshPass: string;
  setSshPass: Dispatch<SetStateAction<string>>;
  isSshConnected: boolean;
  connectSsh: () => void;
  remoteRoot: string;
  setRemoteRoot: Dispatch<SetStateAction<string>>;
  installPlanAll: InstallPlanResponse | null;
  installPlanUpdates: InstallPlanResponse | null;
  isUpdating: boolean;
  runRemoteUpdate: (ids: string[]) => void;
  remotePath: string;
  setRemotePath: Dispatch<SetStateAction<string>>;
  readRemote: () => void;
  writeRemote: () => void;
  remoteConfig: string;
  setRemoteConfig: Dispatch<SetStateAction<string>>;
  openUpdates: () => void;
}

export function RemoteView({
  sshHost,
  setSshHost,
  sshUser,
  setSshUser,
  sshPass,
  setSshPass,
  isSshConnected,
  connectSsh,
  remoteRoot,
  setRemoteRoot,
  installPlanAll,
  installPlanUpdates,
  isUpdating,
  runRemoteUpdate,
  remotePath,
  setRemotePath,
  readRemote,
  writeRemote,
  remoteConfig,
  setRemoteConfig,
  openUpdates,
}: RemoteViewProps) {
  const totalTransferable = installPlanAll?.total_count || 0;

  return (
    <section className="view fade-in">
      <PageHeader
        title="SSH Remote Management"
        subtitle="Connect directly to the Switch, push install queues over SSH, and manage remote config files without pulling the SD card out."
      />
      <div className="panel-grid remote-grid">
        <div className="panel elevated-card">
          <div className="panel-header">
            <div>
              <h3>Connection</h3>
              <small>Use the Switch IP, keep the root user if needed, and reconnect any time the console restarts.</small>
            </div>
          </div>
          <div className="field-grid">
            <input placeholder="Host / IP" value={sshHost} onChange={(e) => setSshHost(e.target.value)} />
            <input placeholder="User" value={sshUser} onChange={(e) => setSshUser(e.target.value)} />
            <input
              placeholder="Password"
              type="password"
              value={sshPass}
              onChange={(e) => setSshPass(e.target.value)}
            />
          </div>
          <div className="button-row compact-row">
            <button className="btn-primary" onClick={connectSsh}>
              <Wifi size={16} />
              {isSshConnected ? "Reconnect" : "Connect"}
            </button>
            <span className={`status-pill ${isSshConnected ? "up_to_date" : "not_installed"}`}>
              {isSshConnected ? "Connected" : "Not connected"}
            </span>
          </div>
          <div className="field-stack">
            <span className="form-label">Remote SD root</span>
            <input placeholder="/" value={remoteRoot} onChange={(e) => setRemoteRoot(e.target.value)} />
          </div>

          {totalTransferable > 0 ? (
            <>
              <div className="button-row compact-row">
                <button
                  className="btn-secondary"
                  disabled={!isSshConnected || !installPlanAll?.total_count || isUpdating}
                  onClick={() => runRemoteUpdate((installPlanAll?.entries || []).map((entry) => entry.id))}
                >
                  <Upload size={16} />
                  Install all to Switch
                </button>
                <button
                  className="btn-secondary"
                  disabled={!isSshConnected || !installPlanUpdates?.total_count || isUpdating}
                  onClick={() => runRemoteUpdate((installPlanUpdates?.entries || []).map((entry) => entry.id))}
                >
                  <Upload size={16} />
                  Install updates to Switch
                </button>
              </div>
              <small className="inline-helper">
                Remote transfers respect the same Atmosphere → Hekate → everything else install order, but they do not rewrite the local manifest.
              </small>
            </>
          ) : (
            <EmptyStateCard
              title="Nothing queued for remote transfer"
              description="Run a scan first, then install missing packages or updates locally or over SSH from the same smart install plan."
              actions={
                <div className="button-row compact-row">
                  <button className="btn-primary" onClick={openUpdates}>
                    Open updates
                  </button>
                </div>
              }
            />
          )}
        </div>

        <div className="panel elevated-card">
          <div className="panel-header">
            <div>
              <h3>Remote file editor</h3>
              <small>Read and write a remote config file directly when you want to tweak one file without a full transfer.</small>
            </div>
          </div>
          <div className="field-stack">
            <span className="form-label">Remote path</span>
            <input value={remotePath} onChange={(e) => setRemotePath(e.target.value)} />
          </div>
          <div className="button-row compact-row">
            <button className="btn-secondary" onClick={readRemote}>
              Read
            </button>
            <button className="btn-primary" onClick={writeRemote}>
              Save
            </button>
          </div>
          <textarea
            className="editor-area"
            value={remoteConfig}
            onChange={(e) => setRemoteConfig(e.target.value)}
            placeholder="Remote file content will appear here after you read it."
          />
        </div>
      </div>
    </section>
  );
}
