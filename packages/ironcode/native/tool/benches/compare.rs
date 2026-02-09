use ironcode_tool::vcs;
use std::env;
use std::process::Command;
use std::time::Instant;

fn measure_rust_implementation(repo_path: &str, iterations: usize) -> (u128, u128, u128) {
    let mut times = Vec::new();

    for _ in 0..iterations {
        let start = Instant::now();
        let _ = vcs::get_info(repo_path);
        times.push(start.elapsed().as_micros());
    }

    times.sort();
    let avg = times.iter().sum::<u128>() / times.len() as u128;
    let min = *times.first().unwrap();
    let max = *times.last().unwrap();

    (avg, min, max)
}

fn measure_typescript_pattern(repo_path: &str, iterations: usize) -> (u128, u128, u128) {
    let mut times = Vec::new();

    for _ in 0..iterations {
        let start = Instant::now();

        // First call: get branch
        let branch_output = Command::new("git")
            .args(["rev-parse", "--abbrev-ref", "HEAD"])
            .current_dir(repo_path)
            .output()
            .unwrap();
        let _branch = String::from_utf8_lossy(&branch_output.stdout)
            .trim()
            .to_string();

        // Second call: get status
        let status_output = Command::new("git")
            .args(["status", "--porcelain"])
            .current_dir(repo_path)
            .output()
            .unwrap();
        let status_text = String::from_utf8_lossy(&status_output.stdout);

        // Parse status
        let mut added = 0;
        let mut modified = 0;
        let mut deleted = 0;

        for line in status_text.lines() {
            if line.is_empty() {
                continue;
            }
            if line.len() < 2 {
                continue;
            }
            let status = &line[..2];
            if status.contains('?') || status.contains('A') {
                added += 1;
            } else if status.contains('M') {
                modified += 1;
            } else if status.contains('D') {
                deleted += 1;
            }
        }

        times.push(start.elapsed().as_micros());
    }

    times.sort();
    let avg = times.iter().sum::<u128>() / times.len() as u128;
    let min = *times.first().unwrap();
    let max = *times.last().unwrap();

    (avg, min, max)
}

fn measure_memory() -> (u64, f32) {
    use sysinfo::{MemoryRefreshKind, RefreshKind, System};

    let mut sys =
        System::new_with_specifics(RefreshKind::new().with_memory(MemoryRefreshKind::everything()));

    sys.refresh_memory();
    let used_mb = sys.used_memory() / 1024 / 1024;
    let percent = (sys.used_memory() as f32 / sys.total_memory() as f32) * 100.0;

    (used_mb, percent)
}

fn main() {
    let cwd = env::current_dir().unwrap();

    // Navigate to git root (from native/tool to IronCode root)
    let git_root = cwd
        .parent() // native
        .and_then(|p| p.parent()) // ironcode
        .and_then(|p| p.parent()) // packages
        .and_then(|p| p.parent()) // IronCode
        .unwrap_or(&cwd);

    let repo_path = git_root.to_str().unwrap();

    println!("🔥 VCS Implementation Performance Comparison");
    println!("============================================\n");

    println!("📍 Repository: {}", repo_path);

    // Verify git repo
    match vcs::get_info(repo_path) {
        Ok(info) => {
            println!("📊 Current Status:");
            println!("   Branch: {}", info.branch);
            if let Some(a) = info.added {
                println!("   Added: {}", a);
            }
            if let Some(m) = info.modified {
                println!("   Modified: {}", m);
            }
            if let Some(d) = info.deleted {
                println!("   Deleted: {}", d);
            }
        }
        Err(e) => {
            println!("❌ Error: {}", e);
            return;
        }
    }

    println!("\n⏱️  Running benchmarks (50 iterations each)...\n");

    // Warm up
    for _ in 0..5 {
        let _ = vcs::get_info(repo_path);
    }

    // Measure Rust implementation
    println!("🦀 Native Rust Implementation:");
    let (rust_avg, rust_min, rust_max) = measure_rust_implementation(repo_path, 50);
    println!("   Average: {:.2} ms", rust_avg as f64 / 1000.0);
    println!("   Min:     {:.2} ms", rust_min as f64 / 1000.0);
    println!("   Max:     {:.2} ms", rust_max as f64 / 1000.0);

    println!("\n📝 TypeScript Pattern (2 git commands):");
    let (ts_avg, ts_min, ts_max) = measure_typescript_pattern(repo_path, 50);
    println!("   Average: {:.2} ms", ts_avg as f64 / 1000.0);
    println!("   Min:     {:.2} ms", ts_min as f64 / 1000.0);
    println!("   Max:     {:.2} ms", ts_max as f64 / 1000.0);

    // Calculate improvement
    let improvement = ((ts_avg as f64 - rust_avg as f64) / ts_avg as f64) * 100.0;
    let speedup = ts_avg as f64 / rust_avg as f64;

    println!("\n📈 Performance Comparison:");
    println!("   Rust is {:.1}% faster", improvement);
    println!("   Speedup: {:.2}x", speedup);

    // Fix overflow by using i128 for calculation
    let time_saved_micros = ts_avg as i128 - rust_avg as i128;
    let time_saved_ms = time_saved_micros as f64 / 1000.0;
    println!("   Time saved: {:.2} ms per call", time_saved_ms);

    // Memory usage
    let (used_mb, percent) = measure_memory();
    println!("\n💾 Memory Usage (current process):");
    println!("   Used: {} MB", used_mb);
    println!("   Percent: {:.1}%", percent);

    println!("\n✅ Benchmark complete!");
}
