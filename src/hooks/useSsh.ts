// src/hooks/useSsh.ts
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useSsh(addLog: (message: string, type?: "info" | "warn" | "error" | "success") => void) {
  const [sshHost, setSshHost] = useState("");
  const [sshUser, setSshUser] = useState("root");
  const [sshPass, setSshPass] = useState("");
  const [isSshConnected, setIsSshConnected] = useState(false);
  const [remoteRoot, setRemoteRoot] = useState("/");
  const [remotePath, setRemotePath] = useState("/atmosphere/config/system_settings.ini");
  const [remoteConfig, setRemoteConfig] = useState("");

  const connectSsh = async () => {
    try {
      await invoke("ssh_connect", { host: sshHost, user: sshUser, password: sshPass });
      setIsSshConnected(true);
      addLog("SSH connected.", "success");
    } catch (error) {
      addLog(`SSH connection failed: ${error}`, "error");
    }
  };

  const readRemote = async () => {
    try {
      setRemoteConfig(await invoke<string>("ssh_read_config", { path: remotePath }));
      addLog("Remote file loaded.", "success");
    } catch (error) {
      addLog(`Remote read failed: ${error}`, "error");
    }
  };

  const writeRemote = async () => {
    try {
      await invoke("ssh_write_config", { path: remotePath, content: remoteConfig });
      addLog("Remote file saved.", "success");
    } catch (error) {
      addLog(`Remote save failed: ${error}`, "error");
    }
  };

  return {
    sshHost,
    setSshHost,
    sshUser,
    setSshUser,
    sshPass,
    setSshPass,
    isSshConnected,
    setIsSshConnected,
    remoteRoot,
    setRemoteRoot,
    remotePath,
    setRemotePath,
    remoteConfig,
    setRemoteConfig,
    connectSsh,
    readRemote,
    writeRemote,
  };
}
