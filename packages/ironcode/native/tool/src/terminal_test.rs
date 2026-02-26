// Tests for terminal module
use crate::terminal;

#[test]
fn test_ring_buffer_basic() {
    let mut buffer = terminal::RingBuffer::new(10);

    buffer.push(b"hello");
    assert_eq!(buffer.len(), 5);

    let data = buffer.peek_all();
    assert_eq!(&data, b"hello");
}

#[test]
fn test_ring_buffer_overflow() {
    let mut buffer = terminal::RingBuffer::new(5);

    buffer.push(b"hello");
    assert_eq!(buffer.len(), 5);

    buffer.push(b"world");
    assert_eq!(buffer.len(), 5); // Should still be 5 (trimmed)

    let data = buffer.peek_all();
    assert_eq!(&data, b"world"); // Old data should be dropped
}

#[test]
fn test_ring_buffer_drain() {
    let mut buffer = terminal::RingBuffer::new(10);

    buffer.push(b"test");
    assert_eq!(buffer.len(), 4);

    let drained = buffer.drain_all();
    assert_eq!(&drained, b"test");
    assert_eq!(buffer.len(), 0); // Should be empty after drain
}

#[test]
fn test_ring_buffer_clear() {
    let mut buffer = terminal::RingBuffer::new(10);

    buffer.push(b"data");
    assert_eq!(buffer.len(), 4);

    buffer.clear();
    assert_eq!(buffer.len(), 0);
    assert!(buffer.is_empty());
}

#[test]
fn test_process_status() {
    let status1 = terminal::ProcessStatus::Running;
    let status2 = terminal::ProcessStatus::Exited;

    assert_ne!(status1, status2);
    assert_eq!(status1, terminal::ProcessStatus::Running);
}

// Integration test: Create and close terminal
#[test]
fn test_terminal_create_and_close() {
    let id = "test-terminal-1";
    let result = terminal::create(id, None, vec![], Some("."), Some("Test Terminal"), 24, 80);

    assert!(result.is_ok());
    let info = result.unwrap();
    assert_eq!(info.id, id);
    assert_eq!(info.status, terminal::ProcessStatus::Running);
    assert_eq!(info.cwd, ".");
    assert_eq!(info.title, "Test Terminal");

    // Close the terminal
    let close_result = terminal::close(id);
    assert!(close_result.is_ok());
}

// Test terminal info retrieval
#[test]
fn test_terminal_get_info() {
    let id = "test-terminal-2";
    terminal::create(id, None, vec![], Some("."), Some("Info Test"), 24, 80).unwrap();

    let info_result = terminal::get_info(id);
    assert!(info_result.is_ok());

    let info = info_result.unwrap();
    assert_eq!(info.id, id);
    assert_eq!(info.title, "Info Test");

    terminal::close(id).unwrap();
}

// Test terminal title update
#[test]
fn test_terminal_update_title() {
    let id = "test-terminal-3";
    terminal::create(id, None, vec![], Some("."), Some("Old Title"), 24, 80).unwrap();

    let update_result = terminal::update_title(id, "New Title");
    assert!(update_result.is_ok());

    let info = terminal::get_info(id).unwrap();
    assert_eq!(info.title, "New Title");

    terminal::close(id).unwrap();
}

// Test buffer operations
#[test]
fn test_terminal_buffer_operations() {
    let id = "test-terminal-4";
    terminal::create(id, None, vec![], Some("."), Some("Buffer Test"), 24, 80).unwrap();

    // Get buffer info
    let buffer_info = terminal::get_buffer_info(id);
    assert!(buffer_info.is_ok());
    let info = buffer_info.unwrap();
    assert_eq!(info.size, 0); // Should be empty initially
    assert_eq!(info.limit, 1024 * 1024 * 2); // 2MB limit

    // Clear buffer
    let clear_result = terminal::clear_buffer(id);
    assert!(clear_result.is_ok());

    terminal::close(id).unwrap();
}

// Test terminal list
#[test]
fn test_terminal_list() {
    let id1 = "test-terminal-list-1";
    let id2 = "test-terminal-list-2";

    terminal::create(id1, None, vec![], Some("."), Some("List Test 1"), 24, 80).unwrap();
    terminal::create(id2, None, vec![], Some("."), Some("List Test 2"), 24, 80).unwrap();

    let sessions = terminal::list();
    assert!(sessions.len() >= 2); // At least our 2 sessions

    let has_id1 = sessions.iter().any(|s| s.id == id1);
    let has_id2 = sessions.iter().any(|s| s.id == id2);
    assert!(has_id1);
    assert!(has_id2);

    terminal::close(id1).unwrap();
    terminal::close(id2).unwrap();
}

// Test terminal write
#[test]
fn test_terminal_write() {
    let id = "test-terminal-write";
    terminal::create(id, None, vec![], Some("."), Some("Write Test"), 24, 80).unwrap();

    let write_result = terminal::write(id, "echo hello\n");
    assert!(write_result.is_ok());

    // Give it a moment to process
    std::thread::sleep(std::time::Duration::from_millis(100));

    terminal::close(id).unwrap();
}

// Test terminal resize
#[test]
fn test_terminal_resize() {
    let id = "test-terminal-resize";
    terminal::create(id, None, vec![], Some("."), Some("Resize Test"), 24, 80).unwrap();

    let resize_result = terminal::resize(id, 40, 120);
    assert!(resize_result.is_ok());

    terminal::close(id).unwrap();
}
