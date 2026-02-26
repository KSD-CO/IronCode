use globset::{Glob, GlobSetBuilder};
use lazy_static::lazy_static;
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatcherEvent {
    pub path: String,
    pub event_type: String, // "add", "change", "unlink"
    pub timestamp: u64,     // Unix timestamp in milliseconds
}

struct WatcherState {
    #[allow(dead_code)]
    watcher: RecommendedWatcher,
    ignore_patterns: Vec<String>,
    event_queue: Arc<Mutex<VecDeque<WatcherEvent>>>,
    max_queue_size: usize,
}

lazy_static! {
    static ref WATCHERS: Mutex<HashMap<String, WatcherState>> = Mutex::new(HashMap::new());
}

/// Create a new file watcher with event queue
///
/// # Arguments
/// * `id` - Unique identifier for this watcher
/// * `path` - Directory path to watch
/// * `ignore_patterns` - List of glob patterns to ignore
/// * `max_queue_size` - Maximum events to queue (older events dropped if exceeded)
///
/// Returns: Result<(), String>
pub fn create(
    id: String,
    path: String,
    ignore_patterns: Vec<String>,
    max_queue_size: usize,
) -> Result<(), String> {
    let mut watchers = WATCHERS.lock().map_err(|e| format!("Lock error: {}", e))?;

    if watchers.contains_key(&id) {
        return Err(format!("Watcher {} already exists", id));
    }

    // Build glob set from ignore patterns
    let mut glob_builder = GlobSetBuilder::new();
    for pattern in &ignore_patterns {
        let glob = Glob::new(pattern).map_err(|e| format!("Invalid glob pattern: {}", e))?;
        glob_builder.add(glob);
    }
    let glob_set = glob_builder
        .build()
        .map_err(|e| format!("Failed to build glob set: {}", e))?;

    let path_buf = PathBuf::from(&path);
    let glob_set_arc = Arc::new(glob_set);
    let event_queue = Arc::new(Mutex::new(VecDeque::with_capacity(max_queue_size)));
    let event_queue_clone = event_queue.clone();

    // Create watcher with event handler that queues events
    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        match res {
            Ok(event) => {
                // Filter event types
                let event_type = match event.kind {
                    EventKind::Create(_) => "add",
                    EventKind::Modify(_) => "change",
                    EventKind::Remove(_) => "unlink",
                    _ => return, // Ignore other events
                };

                let timestamp = SystemTime::now()
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64;

                for path in event.paths {
                    let path_str = match path.to_str() {
                        Some(s) => s,
                        None => continue,
                    };

                    // Check if path matches any ignore pattern
                    if glob_set_arc.is_match(&path) {
                        continue;
                    }

                    // Queue the event
                    let watcher_event = WatcherEvent {
                        path: path_str.to_string(),
                        event_type: event_type.to_string(),
                        timestamp,
                    };

                    if let Ok(mut queue) = event_queue_clone.lock() {
                        // If queue is full, remove oldest event
                        if queue.len() >= max_queue_size {
                            queue.pop_front();
                        }
                        queue.push_back(watcher_event);
                    }
                }
            }
            Err(e) => {
                eprintln!("File watcher error: {:?}", e);
            }
        }
    })
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    // Start watching BEFORE inserting into HashMap
    watcher
        .watch(&path_buf, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch path: {}", e))?;

    let state = WatcherState {
        watcher,
        ignore_patterns,
        event_queue,
        max_queue_size,
    };

    watchers.insert(id, state);

    Ok(())
}

/// Poll events from the watcher queue (non-blocking)
///
/// Returns: Vec of events (may be empty if no events)
pub fn poll_events(id: &str) -> Result<Vec<WatcherEvent>, String> {
    let watchers = WATCHERS.lock().map_err(|e| format!("Lock error: {}", e))?;

    if let Some(state) = watchers.get(id) {
        let mut queue = state
            .event_queue
            .lock()
            .map_err(|e| format!("Queue lock error: {}", e))?;

        // Drain all events from queue
        let events: Vec<WatcherEvent> = queue.drain(..).collect();
        Ok(events)
    } else {
        Err(format!("Watcher {} not found", id))
    }
}

/// Get pending event count without consuming them
pub fn pending_count(id: &str) -> Result<usize, String> {
    let watchers = WATCHERS.lock().map_err(|e| format!("Lock error: {}", e))?;

    if let Some(state) = watchers.get(id) {
        let queue = state
            .event_queue
            .lock()
            .map_err(|e| format!("Queue lock error: {}", e))?;
        Ok(queue.len())
    } else {
        Err(format!("Watcher {} not found", id))
    }
}

/// Stop and remove a watcher
pub fn remove(id: String) -> Result<(), String> {
    let mut watchers = WATCHERS.lock().map_err(|e| format!("Lock error: {}", e))?;

    if watchers.remove(&id).is_some() {
        // Watcher is automatically dropped and stopped
        Ok(())
    } else {
        Err(format!("Watcher {} not found", id))
    }
}

/// List all active watchers
pub fn list() -> Vec<String> {
    let watchers = WATCHERS.lock().unwrap();
    watchers.keys().cloned().collect()
}

/// Get watcher info
pub fn get_info(id: String) -> Result<String, String> {
    let watchers = WATCHERS.lock().map_err(|e| format!("Lock error: {}", e))?;

    if let Some(state) = watchers.get(&id) {
        let queue_len = state.event_queue.lock().unwrap().len();

        let info = serde_json::json!({
            "id": id,
            "ignore_patterns": state.ignore_patterns,
            "max_queue_size": state.max_queue_size,
            "pending_events": queue_len,
        });
        Ok(info.to_string())
    } else {
        Err(format!("Watcher {} not found", id))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_watcher_create_remove() {
        let temp_dir = std::env::temp_dir().join("ironcode_watcher_test_queue");
        fs::create_dir_all(&temp_dir).unwrap();

        let result = create(
            "test1".to_string(),
            temp_dir.to_str().unwrap().to_string(),
            vec![],
            100,
        );
        assert!(result.is_ok());

        let list_result = list();
        assert!(list_result.contains(&"test1".to_string()));

        let result = remove("test1".to_string());
        assert!(result.is_ok());

        let list_result = list();
        assert!(!list_result.contains(&"test1".to_string()));

        fs::remove_dir_all(&temp_dir).ok();
    }

    #[test]
    fn test_watcher_events() {
        let temp_dir = std::env::temp_dir().join("ironcode_watcher_test_events");
        fs::create_dir_all(&temp_dir).unwrap();

        create(
            "test2".to_string(),
            temp_dir.to_str().unwrap().to_string(),
            vec![],
            100,
        )
        .unwrap();

        // Create a file
        let test_file = temp_dir.join("test.txt");
        fs::write(&test_file, "content").unwrap();

        // Wait for event to be processed
        thread::sleep(Duration::from_millis(200));

        // Poll events
        let events = poll_events("test2").unwrap();
        assert!(!events.is_empty());

        // Verify event
        let event = &events[0];
        assert_eq!(event.event_type, "add");
        assert!(event.path.contains("test.txt"));

        remove("test2".to_string()).ok();
        fs::remove_dir_all(&temp_dir).ok();
    }

    #[test]
    fn test_queue_limit() {
        let temp_dir = std::env::temp_dir().join("ironcode_watcher_test_limit");
        fs::create_dir_all(&temp_dir).unwrap();

        // Create watcher with small queue (5 events)
        create(
            "test3".to_string(),
            temp_dir.to_str().unwrap().to_string(),
            vec![],
            5,
        )
        .unwrap();

        // Create 10 files rapidly
        for i in 0..10 {
            let file = temp_dir.join(format!("file{}.txt", i));
            fs::write(&file, "content").unwrap();
        }

        thread::sleep(Duration::from_millis(500));

        let events = poll_events("test3").unwrap();
        // Should have at most 5 events due to queue limit
        assert!(events.len() <= 5);

        remove("test3".to_string()).ok();
        fs::remove_dir_all(&temp_dir).ok();
    }
}
