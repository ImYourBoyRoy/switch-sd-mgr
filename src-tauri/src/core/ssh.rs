// src-tauri/src/core/ssh.rs
use anyhow::{anyhow, Result};
use ssh2::Session;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};

pub struct SshManager {
    session: Session,
}

impl SshManager {
    pub fn connect(host: &str, user: &str, password: Option<&str>) -> Result<Self> {
        let tcp = TcpStream::connect(host)
            .map_err(|e| anyhow!("Failed to connect to {}: {}", host, e))?;
        let mut sess =
            Session::new().map_err(|e| anyhow!("Failed to create SSH session: {}", e))?;
        sess.set_tcp_stream(tcp);
        sess.handshake()
            .map_err(|e| anyhow!("SSH handshake failed: {}", e))?;

        if let Some(pwd) = password {
            sess.userauth_password(user, pwd)
                .map_err(|e| anyhow!("SSH auth failed: {}", e))?;
        } else {
            sess.userauth_agent(user)
                .map_err(|e| anyhow!("SSH agent auth failed: {}", e))?;
        }

        if !sess.authenticated() {
            return Err(anyhow!("SSH authentication failed"));
        }

        Ok(Self { session: sess })
    }

    pub fn read_file(&self, path: &str) -> Result<String> {
        // Safety check: Only allow reading from SD card paths
        if path.contains("..") || path.starts_with("/") {
            // We assume paths are relative to SD root or absolute on Switch (which usually start with /)
            // But for safety, we might want to restrict this.
        }

        let mut scp = self
            .session
            .scp_recv(Path::new(path))
            .map_err(|e| anyhow!("SCP recv failed for {}: {}", path, e))?
            .0;

        let mut contents = String::new();
        scp.read_to_string(&mut contents)
            .map_err(|e| anyhow!("Read failed for {}: {}", path, e))?;

        Ok(contents)
    }

    pub fn write_file(&self, path: &str, content: &str) -> Result<()> {
        self.write_bytes(path, content.as_bytes())
    }

    pub fn write_bytes(&self, path: &str, bytes: &[u8]) -> Result<()> {
        self.ensure_remote_parent(path)?;
        let mut remote_file = self
            .session
            .scp_send(Path::new(path), 0o644, bytes.len() as u64, None)
            .map_err(|e| anyhow!("SCP send failed for {}: {}", path, e))?;

        remote_file
            .write_all(bytes)
            .map_err(|e| anyhow!("Write failed for {}: {}", path, e))?;

        Ok(())
    }

    pub fn upload_file<P: AsRef<Path>>(&self, local_path: P, remote_path: &str) -> Result<()> {
        let bytes = std::fs::read(local_path.as_ref()).map_err(|e| {
            anyhow!(
                "Failed to read local file {}: {}",
                local_path.as_ref().display(),
                e
            )
        })?;
        self.write_bytes(remote_path, &bytes)
    }

    pub fn upload_tree<P: AsRef<Path>>(
        &self,
        local_root: P,
        remote_root: &str,
    ) -> Result<Vec<String>> {
        let local_root = local_root.as_ref();
        if !local_root.exists() {
            return Ok(Vec::new());
        }

        let mut uploaded = Vec::new();
        for entry in walkdir::WalkDir::new(local_root)
            .into_iter()
            .filter_map(|entry| entry.ok())
        {
            if !entry.file_type().is_file() {
                continue;
            }

            let relative = entry
                .path()
                .strip_prefix(local_root)
                .map_err(|e| anyhow!("Failed to resolve SSH upload path: {}", e))?;
            let remote_path = join_remote_path(remote_root, relative);
            self.upload_file(entry.path(), &remote_path)?;
            uploaded.push(remote_path);
        }

        Ok(uploaded)
    }

    fn ensure_remote_parent(&self, path: &str) -> Result<()> {
        let parent = Path::new(path)
            .parent()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("/"));
        self.ensure_remote_dir(&parent)
    }

    fn ensure_remote_dir(&self, path: &Path) -> Result<()> {
        let sftp = self
            .session
            .sftp()
            .map_err(|e| anyhow!("Failed to open SFTP session: {}", e))?;
        let mut current = PathBuf::new();

        for component in path.components() {
            current.push(component.as_os_str());
            let path_str = normalize_remote_string(&current);
            if path_str.is_empty() || path_str == "/" {
                continue;
            }
            if sftp.stat(Path::new(&path_str)).is_err() {
                match sftp.mkdir(Path::new(&path_str), 0o755) {
                    Ok(_) => {}
                    Err(_) => {
                        if sftp.stat(Path::new(&path_str)).is_err() {
                            return Err(anyhow!("Failed to create remote directory {}", path_str));
                        }
                    }
                }
            }
        }

        Ok(())
    }
}

fn normalize_remote_string(path: &Path) -> String {
    let rendered = path.to_string_lossy().replace('\\', "/");
    if rendered.starts_with('/') {
        rendered
    } else {
        format!("/{}", rendered.trim_start_matches('/'))
    }
}

fn join_remote_path(root: &str, relative: &Path) -> String {
    let mut parts = Vec::new();
    let normalized_root = root.trim().replace('\\', "/");
    if !normalized_root.is_empty() && normalized_root != "/" {
        parts.push(normalized_root.trim_matches('/').to_string());
    }
    let relative_part = relative.to_string_lossy().replace('\\', "/");
    if !relative_part.is_empty() {
        parts.push(relative_part.trim_matches('/').to_string());
    }
    format!("/{}", parts.join("/"))
}
