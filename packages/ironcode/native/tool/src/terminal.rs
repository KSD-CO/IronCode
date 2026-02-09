use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
#[cfg(unix)]
use std::os::unix::io::AsRawFd;
use std::sync::{Arc, Mutex};

#[derive(Debug, Serialize, Deserialize)]
pub struct TerminalInfo {
    pub id: String,
    pub pid: u32,
    pub cwd: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TerminalOutput {
    pub data: String,
}

pub struct TerminalSession {
    master: Box<dyn MasterPty + Send>,
    #[allow(dead_code)]
    child: Box<dyn Child + Send + Sync>,
    reader: Arc<Mutex<Box<dyn Read + Send>>>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    #[cfg(unix)]
    reader_fd: std::os::unix::io::RawFd,
}

lazy_static::lazy_static! {
    static ref SESSIONS: Arc<Mutex<HashMap<String, TerminalSession>>> = Arc::new(Mutex::new(HashMap::new()));
}

pub fn create(id: &str, cwd: Option<&str>, rows: u16, cols: u16) -> Result<TerminalInfo, String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    let mut cmd = CommandBuilder::new(get_shell());
    cmd.cwd(cwd.unwrap_or("."));

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    let pid = child
        .process_id()
        .ok_or_else(|| "Failed to get process ID".to_string())?;

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone reader: {}", e))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take writer: {}", e))?;

    #[cfg(unix)]
    let reader_fd = { pair.master.as_raw_fd().expect("Failed to get raw FD") };

    let session = TerminalSession {
        master: pair.master,
        child,
        reader: Arc::new(Mutex::new(reader)),
        writer: Arc::new(Mutex::new(writer)),
        #[cfg(unix)]
        reader_fd,
    };

    let mut sessions = SESSIONS.lock().unwrap();
    sessions.insert(id.to_string(), session);

    Ok(TerminalInfo {
        id: id.to_string(),
        pid,
        cwd: cwd.unwrap_or(".").to_string(),
    })
}

pub fn write(id: &str, data: &str) -> Result<(), String> {
    let sessions = SESSIONS.lock().unwrap();
    let session = sessions
        .get(id)
        .ok_or_else(|| format!("Session {} not found", id))?;

    let mut writer = session.writer.lock().unwrap();
    writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write to PTY: {}", e))?;
    writer
        .flush()
        .map_err(|e| format!("Failed to flush PTY: {}", e))?;

    Ok(())
}

pub fn read(id: &str) -> Result<TerminalOutput, String> {
    let sessions = SESSIONS.lock().unwrap();
    let session = sessions
        .get(id)
        .ok_or_else(|| format!("Session {} not found", id))?;

    // Set non-blocking mode on the file descriptor
    #[cfg(unix)]
    {
        let fd = session.reader_fd;
        unsafe {
            let flags = libc::fcntl(fd, libc::F_GETFL, 0);
            libc::fcntl(fd, libc::F_SETFL, flags | libc::O_NONBLOCK);
        }
    }

    let mut reader = session.reader.lock().unwrap();
    let mut buffer = [0u8; 4096];

    match reader.read(&mut buffer) {
        Ok(n) if n > 0 => {
            let data = String::from_utf8_lossy(&buffer[..n]).to_string();
            Ok(TerminalOutput { data })
        }
        Ok(_) => Ok(TerminalOutput {
            data: String::new(),
        }),
        Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
            // No data available, return empty
            Ok(TerminalOutput {
                data: String::new(),
            })
        }
        Err(e) => Err(format!("Failed to read from PTY: {}", e)),
    }
}

pub fn resize(id: &str, rows: u16, cols: u16) -> Result<(), String> {
    let sessions = SESSIONS.lock().unwrap();
    let session = sessions
        .get(id)
        .ok_or_else(|| format!("Session {} not found", id))?;

    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to resize PTY: {}", e))?;

    Ok(())
}

pub fn close(id: &str) -> Result<(), String> {
    let mut sessions = SESSIONS.lock().unwrap();
    let session = sessions
        .remove(id)
        .ok_or_else(|| format!("Session {} not found", id))?;

    drop(session);
    Ok(())
}

fn get_shell() -> String {
    #[cfg(target_os = "windows")]
    {
        std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
    }
}
