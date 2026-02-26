use serde::{Deserialize, Serialize};
use sysinfo::{
    CpuRefreshKind, MemoryRefreshKind, Pid, ProcessRefreshKind, ProcessesToUpdate, RefreshKind,
    System,
};

#[derive(Serialize, Deserialize)]
pub struct SystemStats {
    pub cpu_usage: f32,
    pub memory_used_mb: u64,
    pub memory_total_mb: u64,
    pub memory_percent: f32,
}

pub fn get_stats() -> Result<SystemStats, String> {
    // Refresh CPU, memory and process info. We focus on the current process stats.
    let mut sys = System::new_with_specifics(
        RefreshKind::new()
            .with_cpu(CpuRefreshKind::everything())
            .with_memory(MemoryRefreshKind::everything())
            .with_processes(ProcessRefreshKind::everything()),
    );

    // Need to refresh twice for accurate CPU readings
    std::thread::sleep(std::time::Duration::from_millis(100));
    sys.refresh_cpu_all();
    sys.refresh_memory();

    // Current process id (convert to sysinfo::Pid)
    let pid = Pid::from(std::process::id() as usize);
    // Refresh only the current process for efficiency
    sys.refresh_processes(ProcessesToUpdate::Some(&[pid]), false);

    // Try to read process-level stats. If unavailable, fall back to system-wide.
    if let Some(proc) = sys.process(pid) {
        let cpu_usage = proc.cpu_usage();
        let memory_used = proc.memory(); // in KB
        let memory_total = sys.total_memory(); // in KB
        let memory_percent = if memory_total > 0 {
            (memory_used as f32 / memory_total as f32) * 100.0
        } else {
            0.0
        };

        Ok(SystemStats {
            cpu_usage,
            // Keep same unit conversion as before (divide by 1024*1024)
            memory_used_mb: memory_used / 1024 / 1024,
            memory_total_mb: memory_total / 1024 / 1024,
            memory_percent,
        })
    } else {
        // Fallback to system-wide stats if process info is not available
        let cpu_usage = sys.global_cpu_usage();
        let memory_used = sys.used_memory();
        let memory_total = sys.total_memory();
        let memory_percent = if memory_total > 0 {
            (memory_used as f32 / memory_total as f32) * 100.0
        } else {
            0.0
        };

        Ok(SystemStats {
            cpu_usage,
            memory_used_mb: memory_used / 1024 / 1024,
            memory_total_mb: memory_total / 1024 / 1024,
            memory_percent,
        })
    }
}
