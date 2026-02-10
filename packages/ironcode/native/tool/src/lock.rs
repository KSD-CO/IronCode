use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};

/// Lock state for a single key
#[derive(Debug, Clone)]
struct LockState {
    readers: u32,
    writer: bool,
    waiting_readers: VecDeque<u64>,
    waiting_writers: VecDeque<u64>,
    next_ticket: u64,
}

impl LockState {
    fn new() -> Self {
        Self {
            readers: 0,
            writer: false,
            waiting_readers: VecDeque::new(),
            waiting_writers: VecDeque::new(),
            next_ticket: 0,
        }
    }

    fn is_empty(&self) -> bool {
        self.readers == 0
            && !self.writer
            && self.waiting_readers.is_empty()
            && self.waiting_writers.is_empty()
    }
}

/// Global lock registry
static LOCKS: Mutex<Option<Arc<Mutex<HashMap<String, LockState>>>>> = Mutex::new(None);

fn get_registry() -> Arc<Mutex<HashMap<String, LockState>>> {
    let mut guard = LOCKS.lock().unwrap();
    if guard.is_none() {
        *guard = Some(Arc::new(Mutex::new(HashMap::new())));
    }
    guard.as_ref().unwrap().clone()
}

/// Acquire a read lock for the given key.
/// Returns a ticket ID if the lock is immediately acquired,
/// or None if the caller must wait.
pub fn acquire_read_lock(key: &str) -> Result<(u64, bool), String> {
    let registry = get_registry();
    let mut locks = registry.lock().unwrap();
    let lock_state = locks.entry(key.to_string()).or_insert_with(LockState::new);

    let ticket = lock_state.next_ticket;
    lock_state.next_ticket += 1;

    // Can acquire immediately if no writer and no waiting writers
    if !lock_state.writer && lock_state.waiting_writers.is_empty() {
        lock_state.readers += 1;
        Ok((ticket, true)) // (ticket, acquired)
    } else {
        lock_state.waiting_readers.push_back(ticket);
        Ok((ticket, false)) // (ticket, not acquired yet)
    }
}

/// Acquire a write lock for the given key.
/// Returns a ticket ID if the lock is immediately acquired,
/// or None if the caller must wait.
pub fn acquire_write_lock(key: &str) -> Result<(u64, bool), String> {
    let registry = get_registry();
    let mut locks = registry.lock().unwrap();
    let lock_state = locks.entry(key.to_string()).or_insert_with(LockState::new);

    let ticket = lock_state.next_ticket;
    lock_state.next_ticket += 1;

    // Can acquire immediately if no writer and no readers
    if !lock_state.writer && lock_state.readers == 0 {
        lock_state.writer = true;
        Ok((ticket, true)) // (ticket, acquired)
    } else {
        lock_state.waiting_writers.push_back(ticket);
        Ok((ticket, false)) // (ticket, not acquired yet)
    }
}

/// Check if a read lock with the given ticket is ready
pub fn check_read_lock(key: &str, ticket: u64) -> Result<bool, String> {
    let registry = get_registry();
    let locks = registry.lock().unwrap();

    if let Some(lock_state) = locks.get(key) {
        // Already acquired if ticket is not in waiting queue
        if !lock_state.waiting_readers.contains(&ticket) {
            return Ok(true);
        }

        // Can acquire if we're first in queue, no writer, and no waiting writers
        if let Some(&first) = lock_state.waiting_readers.front() {
            if first == ticket && !lock_state.writer && lock_state.waiting_writers.is_empty() {
                return Ok(true);
            }
        }
    }

    Ok(false)
}

/// Check if a write lock with the given ticket is ready
pub fn check_write_lock(key: &str, ticket: u64) -> Result<bool, String> {
    let registry = get_registry();
    let locks = registry.lock().unwrap();

    if let Some(lock_state) = locks.get(key) {
        // Already acquired if ticket is not in waiting queue
        if !lock_state.waiting_writers.contains(&ticket) {
            return Ok(true);
        }

        // Can acquire if we're first in queue, no writer, and no readers
        if let Some(&first) = lock_state.waiting_writers.front() {
            if first == ticket && !lock_state.writer && lock_state.readers == 0 {
                return Ok(true);
            }
        }
    }

    Ok(false)
}

/// Finalize acquiring a read lock (after check_read_lock returns true)
pub fn finalize_read_lock(key: &str, ticket: u64) -> Result<(), String> {
    let registry = get_registry();
    let mut locks = registry.lock().unwrap();

    if let Some(lock_state) = locks.get_mut(key) {
        // Remove from waiting queue if present
        if let Some(pos) = lock_state.waiting_readers.iter().position(|&t| t == ticket) {
            lock_state.waiting_readers.remove(pos);
            lock_state.readers += 1;
        }
    }

    Ok(())
}

/// Finalize acquiring a write lock (after check_write_lock returns true)
pub fn finalize_write_lock(key: &str, ticket: u64) -> Result<(), String> {
    let registry = get_registry();
    let mut locks = registry.lock().unwrap();

    if let Some(lock_state) = locks.get_mut(key) {
        // Remove from waiting queue if present
        if let Some(pos) = lock_state.waiting_writers.iter().position(|&t| t == ticket) {
            lock_state.waiting_writers.remove(pos);
            lock_state.writer = true;
        }
    }

    Ok(())
}

/// Release a read lock and process any waiting locks
pub fn release_read_lock(key: &str) -> Result<(), String> {
    let registry = get_registry();
    let mut locks = registry.lock().unwrap();

    let should_remove = if let Some(lock_state) = locks.get_mut(key) {
        if lock_state.readers > 0 {
            lock_state.readers -= 1;
        }
        // Check if we should remove the lock
        lock_state.writer == false
            && lock_state.readers == 0
            && lock_state.waiting_readers.is_empty()
            && lock_state.waiting_writers.is_empty()
    } else {
        false
    };

    if should_remove {
        locks.remove(key);
    }

    Ok(())
}

/// Release a write lock and process any waiting locks
pub fn release_write_lock(key: &str) -> Result<(), String> {
    let registry = get_registry();
    let mut locks = registry.lock().unwrap();

    let should_remove = if let Some(lock_state) = locks.get_mut(key) {
        lock_state.writer = false;
        // Check if we should remove the lock
        lock_state.readers == 0
            && lock_state.waiting_readers.is_empty()
            && lock_state.waiting_writers.is_empty()
    } else {
        false
    };

    if should_remove {
        locks.remove(key);
    }

    Ok(())
}

/// Get statistics about current locks (for debugging/monitoring)
#[derive(Debug)]
pub struct LockStats {
    pub total_locks: usize,
    pub active_readers: u32,
    pub active_writers: u32,
    pub waiting_readers: usize,
    pub waiting_writers: usize,
}

pub fn get_lock_stats() -> LockStats {
    let registry = get_registry();
    let locks = registry.lock().unwrap();

    let mut stats = LockStats {
        total_locks: locks.len(),
        active_readers: 0,
        active_writers: 0,
        waiting_readers: 0,
        waiting_writers: 0,
    };

    for lock_state in locks.values() {
        stats.active_readers += lock_state.readers;
        if lock_state.writer {
            stats.active_writers += 1;
        }
        stats.waiting_readers += lock_state.waiting_readers.len();
        stats.waiting_writers += lock_state.waiting_writers.len();
    }

    stats
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_single_reader() {
        let key = "test1";
        let (_ticket, acquired) = acquire_read_lock(key).unwrap();
        assert!(acquired);
        release_read_lock(key).unwrap();

        let stats = get_lock_stats();
        assert_eq!(stats.total_locks, 0); // Should be cleaned up
    }

    #[test]
    fn test_multiple_readers() {
        let key = "test2";
        let (_t1, acq1) = acquire_read_lock(key).unwrap();
        assert!(acq1);

        let (_t2, acq2) = acquire_read_lock(key).unwrap();
        assert!(acq2);

        let stats = get_lock_stats();
        assert_eq!(stats.active_readers, 2);

        release_read_lock(key).unwrap();
        release_read_lock(key).unwrap();

        let stats = get_lock_stats();
        assert_eq!(stats.total_locks, 0);
    }

    #[test]
    fn test_writer_exclusivity() {
        let key = "test3";
        let (t1, acq1) = acquire_write_lock(key).unwrap();
        assert!(acq1);

        // Second writer should block
        let (t2, acq2) = acquire_write_lock(key).unwrap();
        assert!(!acq2);

        // Reader should also block
        let (t3, acq3) = acquire_read_lock(key).unwrap();
        assert!(!acq3);

        release_write_lock(key).unwrap();

        // After release, writer should be able to acquire (priority)
        let ready2 = check_write_lock(key, t2).unwrap();
        assert!(ready2);
        finalize_write_lock(key, t2).unwrap();

        release_write_lock(key).unwrap();

        // Now reader can acquire
        let ready3 = check_read_lock(key, t3).unwrap();
        assert!(ready3);
        finalize_read_lock(key, t3).unwrap();

        release_read_lock(key).unwrap();

        let stats = get_lock_stats();
        assert_eq!(stats.total_locks, 0);
    }

    #[test]
    fn test_writer_priority() {
        let key = "test4";

        // Acquire read lock
        let (_t1, acq1) = acquire_read_lock(key).unwrap();
        assert!(acq1);

        // Writer waits
        let (t2, acq2) = acquire_write_lock(key).unwrap();
        assert!(!acq2);

        // Another reader waits (because writer is waiting)
        let (t3, acq3) = acquire_read_lock(key).unwrap();
        assert!(!acq3);

        // Release first reader
        release_read_lock(key).unwrap();

        // Writer should be next (not the waiting reader)
        let ready2 = check_write_lock(key, t2).unwrap();
        assert!(ready2);
        finalize_write_lock(key, t2).unwrap();

        // Reader still waiting
        let ready3 = check_read_lock(key, t3).unwrap();
        assert!(!ready3);

        // Release writer
        release_write_lock(key).unwrap();

        // Now reader can acquire
        let ready3 = check_read_lock(key, t3).unwrap();
        assert!(ready3);
        finalize_read_lock(key, t3).unwrap();

        // Release the last reader
        release_read_lock(key).unwrap();

        // Now should be cleaned up
        let stats = get_lock_stats();
        assert_eq!(stats.total_locks, 0);
    }

    #[test]
    fn test_concurrent_readers() {
        let key = "test5";

        let (_t1, acq1) = acquire_read_lock(key).unwrap();
        assert!(acq1);

        let (_t2, acq2) = acquire_read_lock(key).unwrap();
        assert!(acq2);

        let (_t3, acq3) = acquire_read_lock(key).unwrap();
        assert!(acq3);

        let stats = get_lock_stats();
        assert_eq!(stats.active_readers, 3);
        assert_eq!(stats.active_writers, 0);

        release_read_lock(key).unwrap();
        release_read_lock(key).unwrap();
        release_read_lock(key).unwrap();

        let stats = get_lock_stats();
        assert_eq!(stats.total_locks, 0);
    }
}
