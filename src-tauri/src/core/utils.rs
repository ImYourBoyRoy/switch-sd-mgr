// src-tauri/src/core/utils.rs
use std::fs;
use std::path::Path;
use std::thread;
use std::time::Duration;
use tracing::warn;

/// Retries an Operation that might fail due to file locks (Windows)
pub fn retry_op<F, T, E>(mut op: F, retries: u32, delay: Duration) -> Result<T, E>
where
    F: FnMut() -> Result<T, E>,
    E: std::fmt::Display,
{
    let mut last_err = None;
    for i in 0..retries {
        match op() {
            Ok(val) => return Ok(val),
            Err(e) => {
                warn!(
                    "   [WAIT] Operation failed, retrying ({}/{}): {}",
                    i + 1,
                    retries,
                    e
                );
                last_err = Some(e);
                if i < retries - 1 {
                    thread::sleep(delay);
                }
            }
        }
    }
    Err(last_err.expect("Retry failed without error"))
}

pub fn safe_delete<P: AsRef<Path>>(path: P) -> std::io::Result<()> {
    let path = path.as_ref();
    if !path.exists() {
        return Ok(());
    }

    retry_op(
        || {
            if path.is_dir() {
                fs::remove_dir_all(path)
            } else {
                fs::remove_file(path)
            }
        },
        5,
        Duration::from_millis(1500),
    )
}

pub fn clean_version(version: &str) -> String {
    let v = version.trim().trim_matches('"');
    if v.to_lowercase().starts_with('v') {
        v[1..].to_string()
    } else {
        v.to_string()
    }
}
