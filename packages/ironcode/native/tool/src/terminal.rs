use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::io::{Read, Write};
#[cfg(unix)]
use std::os::unix::io::AsRawFd;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

// Buffer constants matching TypeScript implementation
const BUFFER_LIMIT: usize = 1024 * 1024 * 2; // 2MB
const BUFFER_CHUNK: usize = 64 * 1024; // 64KB
const READ_CHUNK: usize = 4096; // 4KB read chunks

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ProcessStatus {
    Running,
    Exited,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalInfo {
    pub id: String,
    pub pid: u32,
    pub cwd: String,
    pub status: ProcessStatus,
    pub title: String,
    pub command: String,
    pub args: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TerminalOutput {
    pub data: Vec<u8>,
    pub buffered_size: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BufferInfo {
    pub size: usize,
    pub limit: usize,
    pub chunks: usize,
}

// Ring buffer for efficient terminal output storage
struct RingBuffer {
    data: VecDeque<u8>,
    limit: usize,
}

impl RingBuffer {
    fn new(limit: usize) -> Self {
        Self {
            data: VecDeque::with_capacity(limit),
            limit,
        }
    }

    fn push(&mut self, bytes: &[u8]) {
        for &byte in bytes {
            if self.data.len() >= self.limit {
                self.data.pop_front();
            }
            self.data.push_back(byte);
        }
    }

    fn drain_all(&mut self) -> Vec<u8> {
        self.data.drain(..).collect()
    }

    fn len(&self) -> usize {
        self.data.len()
    }

    fn is_empty(&self) -> bool {
        self.data.is_empty()
    }

    fn peek_all(&self) -> Vec<u8> {
        self.data.iter().copied().collect()
    }

    fn clear(&mut self) {
        self.data.clear();
    }
}

pub struct TerminalSession {
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn Child + Send + Sync>,
    reader: Arc<Mutex<Box<dyn Read + Send>>>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    buffer: Arc<Mutex<RingBuffer>>,
    info: Arc<Mutex<TerminalInfo>>,
    last_read: Arc<Mutex<Instant>>,
    #[cfg(unix)]
    reader_fd: std::os::unix::io::RawFd,
}

lazy_static::lazy_static! {
    static ref SESSIONS: Arc<Mutex<HashMap<String, TerminalSession>>> = Arc::new(Mutex::new(HashMap::new()));
}

pub fn create(
    id: &str,
    command: Option<&str>,
    args: Vec<String>,
    cwd: Option<&str>,
    title: Option<&str>,
    rows: u16,
    cols: u16,
) -> Result<TerminalInfo, String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    let shell = command
        .map(|s| s.to_string())
        .unwrap_or_else(|| get_shell());
    let mut cmd = CommandBuilder::new(&shell);
    let working_dir = cwd.unwrap_or(".");
    cmd.cwd(working_dir);

    // Add args
    for arg in &args {
        cmd.arg(arg);
    }

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

    let info = TerminalInfo {
        id: id.to_string(),
        pid,
        cwd: working_dir.to_string(),
        status: ProcessStatus::Running,
        title: title
            .unwrap_or(&format!("Terminal {}", &id[id.len().saturating_sub(4)..]))
            .to_string(),
        command: shell.clone(),
        args: args.clone(),
    };

    let session = TerminalSession {
        master: pair.master,
        child,
        reader: Arc::new(Mutex::new(reader)),
        writer: Arc::new(Mutex::new(writer)),
        buffer: Arc::new(Mutex::new(RingBuffer::new(BUFFER_LIMIT))),
        info: Arc::new(Mutex::new(info.clone())),
        last_read: Arc::new(Mutex::new(Instant::now())),
        #[cfg(unix)]
        reader_fd,
    };

    let mut sessions = SESSIONS.lock().unwrap();
    sessions.insert(id.to_string(), session);

    Ok(info)
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
    let mut temp_buffer = [0u8; READ_CHUNK];
    let mut total_read = Vec::new();

    // Read all available data in chunks
    loop {
        match reader.read(&mut temp_buffer) {
            Ok(n) if n > 0 => {
                total_read.extend_from_slice(&temp_buffer[..n]);
                // Update last read time
                *session.last_read.lock().unwrap() = Instant::now();
            }
            Ok(_) => break, // EOF or no more data
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => break,
            Err(e) => return Err(format!("Failed to read from PTY: {}", e)),
        }
    }

    // If we read new data, add it to buffer
    if !total_read.is_empty() {
        let mut buffer = session.buffer.lock().unwrap();
        buffer.push(&total_read);
    }

    let buffer = session.buffer.lock().unwrap();
    let buffered_size = buffer.len();

    Ok(TerminalOutput {
        data: total_read,
        buffered_size,
    })
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

// Get terminal info (including status)
pub fn get_info(id: &str) -> Result<TerminalInfo, String> {
    let sessions = SESSIONS.lock().unwrap();
    let session = sessions
        .get(id)
        .ok_or_else(|| format!("Session {} not found", id))?;

    let info = session.info.lock().unwrap();
    Ok(info.clone())
}

// Update terminal title
pub fn update_title(id: &str, title: &str) -> Result<(), String> {
    let sessions = SESSIONS.lock().unwrap();
    let session = sessions
        .get(id)
        .ok_or_else(|| format!("Session {} not found", id))?;

    let mut info = session.info.lock().unwrap();
    info.title = title.to_string();
    Ok(())
}

// Check if process has exited and update status
pub fn check_status(id: &str) -> Result<ProcessStatus, String> {
    let sessions = SESSIONS.lock().unwrap();
    let session = sessions
        .get(id)
        .ok_or_else(|| format!("Session {} not found", id))?;

    // Try to get exit status from child process
    let info = session.info.lock().unwrap();

    // Note: portable-pty doesn't provide direct exit status check
    // We rely on read() returning EOF when process exits
    // TypeScript layer should call this periodically or on read EOF

    Ok(info.status.clone())
}

// Mark session as exited (called from TypeScript when detecting EOF)
pub fn mark_exited(id: &str) -> Result<(), String> {
    let sessions = SESSIONS.lock().unwrap();
    let session = sessions
        .get(id)
        .ok_or_else(|| format!("Session {} not found", id))?;

    let mut info = session.info.lock().unwrap();
    info.status = ProcessStatus::Exited;
    Ok(())
}

// Get buffered data (for when client connects)
pub fn get_buffer(id: &str) -> Result<Vec<u8>, String> {
    let sessions = SESSIONS.lock().unwrap();
    let session = sessions
        .get(id)
        .ok_or_else(|| format!("Session {} not found", id))?;

    let buffer = session.buffer.lock().unwrap();
    Ok(buffer.peek_all())
}

// Get buffer in chunks for streaming
pub fn get_buffer_chunked(id: &str, chunk_size: usize) -> Result<Vec<Vec<u8>>, String> {
    let sessions = SESSIONS.lock().unwrap();
    let session = sessions
        .get(id)
        .ok_or_else(|| format!("Session {} not found", id))?;

    let buffer = session.buffer.lock().unwrap();
    let data = buffer.peek_all();

    let chunks: Vec<Vec<u8>> = data
        .chunks(chunk_size)
        .map(|chunk| chunk.to_vec())
        .collect();

    Ok(chunks)
}

// Drain buffer (consume and clear)
pub fn drain_buffer(id: &str) -> Result<Vec<u8>, String> {
    let sessions = SESSIONS.lock().unwrap();
    let session = sessions
        .get(id)
        .ok_or_else(|| format!("Session {} not found", id))?;

    let mut buffer = session.buffer.lock().unwrap();
    Ok(buffer.drain_all())
}

// Clear buffer without returning data
pub fn clear_buffer(id: &str) -> Result<(), String> {
    let sessions = SESSIONS.lock().unwrap();
    let session = sessions
        .get(id)
        .ok_or_else(|| format!("Session {} not found", id))?;

    let mut buffer = session.buffer.lock().unwrap();
    buffer.clear();
    Ok(())
}

// Get buffer info (size, limit, etc.)
pub fn get_buffer_info(id: &str) -> Result<BufferInfo, String> {
    let sessions = SESSIONS.lock().unwrap();
    let session = sessions
        .get(id)
        .ok_or_else(|| format!("Session {} not found", id))?;

    let buffer = session.buffer.lock().unwrap();
    let size = buffer.len();

    Ok(BufferInfo {
        size,
        limit: BUFFER_LIMIT,
        chunks: (size + BUFFER_CHUNK - 1) / BUFFER_CHUNK,
    })
}

// List all sessions
pub fn list() -> Vec<TerminalInfo> {
    let sessions = SESSIONS.lock().unwrap();
    sessions
        .values()
        .map(|session| {
            let info = session.info.lock().unwrap();
            info.clone()
        })
        .collect()
}

// Cleanup idle sessions (sessions not read for timeout duration)
pub fn cleanup_idle(timeout_secs: u64) -> Vec<String> {
    let sessions = SESSIONS.lock().unwrap();
    let now = Instant::now();
    let timeout = Duration::from_secs(timeout_secs);

    let mut to_remove = Vec::new();

    for (id, session) in sessions.iter() {
        let last_read = *session.last_read.lock().unwrap();
        let info = session.info.lock().unwrap();

        if info.status == ProcessStatus::Exited && now.duration_since(last_read) > timeout {
            to_remove.push(id.clone());
        }
    }

    to_remove
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ring_buffer_basic() {
        let mut buffer = RingBuffer::new(10);

        buffer.push(b"hello");
        assert_eq!(buffer.len(), 5);

        let data = buffer.peek_all();
        assert_eq!(&data, b"hello");
    }

    #[test]
    fn test_ring_buffer_overflow() {
        let mut buffer = RingBuffer::new(5);

        buffer.push(b"hello");
        assert_eq!(buffer.len(), 5);

        buffer.push(b"world");
        assert_eq!(buffer.len(), 5); // Should still be 5 (trimmed)

        let data = buffer.peek_all();
        assert_eq!(&data, b"world"); // Old data should be dropped
    }

    #[test]
    fn test_ring_buffer_drain() {
        let mut buffer = RingBuffer::new(10);

        buffer.push(b"test");
        assert_eq!(buffer.len(), 4);

        let drained = buffer.drain_all();
        assert_eq!(&drained, b"test");
        assert_eq!(buffer.len(), 0); // Should be empty after drain
    }

    #[test]
    fn test_ring_buffer_clear() {
        let mut buffer = RingBuffer::new(10);

        buffer.push(b"data");
        assert_eq!(buffer.len(), 4);

        buffer.clear();
        assert_eq!(buffer.len(), 0);
        assert!(buffer.is_empty());
    }

    #[test]
    fn test_process_status() {
        let status1 = ProcessStatus::Running;
        let status2 = ProcessStatus::Exited;

        assert_ne!(status1, status2);
        assert_eq!(status1, ProcessStatus::Running);
    }

    #[test]
    fn test_terminal_create_and_close() {
        let id = "test-terminal-1";
        let result = create(id, None, vec![], Some("."), Some("Test Terminal"), 24, 80);

        assert!(result.is_ok());
        let info = result.unwrap();
        assert_eq!(info.id, id);
        assert_eq!(info.status, ProcessStatus::Running);
        assert_eq!(info.cwd, ".");
        assert_eq!(info.title, "Test Terminal");

        let close_result = close(id);
        assert!(close_result.is_ok());
    }

    #[test]
    fn test_terminal_get_info() {
        let id = "test-terminal-2";
        create(id, None, vec![], Some("."), Some("Info Test"), 24, 80).unwrap();

        let info_result = get_info(id);
        assert!(info_result.is_ok());

        let info = info_result.unwrap();
        assert_eq!(info.id, id);
        assert_eq!(info.title, "Info Test");

        close(id).unwrap();
    }

    #[test]
    fn test_terminal_update_title() {
        let id = "test-terminal-3";
        create(id, None, vec![], Some("."), Some("Old Title"), 24, 80).unwrap();

        let update_result = update_title(id, "New Title");
        assert!(update_result.is_ok());

        let info = get_info(id).unwrap();
        assert_eq!(info.title, "New Title");

        close(id).unwrap();
    }
}
