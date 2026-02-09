use ironcode_tool::edit::replace;
use std::time::Instant;

fn generate_test_content(lines: usize) -> String {
    let mut content = String::new();
    for i in 0..lines {
        content.push_str(&format!("    function test{}() {{\n", i));
        content.push_str("        console.log('hello');\n");
        content.push_str("        return 42;\n");
        content.push_str("    }\n");
    }
    content
}

fn format_bytes(bytes: usize) -> String {
    format!("{:.2} MB", bytes as f64 / 1024.0 / 1024.0)
}

fn format_time(micros: f64) -> String {
    if micros < 1.0 {
        format!("{:.2} ns", micros * 1000.0)
    } else if micros < 1000.0 {
        format!("{:.2} µs", micros)
    } else if micros < 1_000_000.0 {
        format!("{:.2} ms", micros / 1000.0)
    } else {
        format!("{:.2} s", micros / 1_000_000.0)
    }
}

#[cfg(target_os = "linux")]
fn get_memory_usage() -> usize {
    use std::fs;
    let status = fs::read_to_string("/proc/self/status").unwrap();
    for line in status.lines() {
        if line.starts_with("VmRSS:") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                return parts[1].parse::<usize>().unwrap() * 1024; // Convert kB to bytes
            }
        }
    }
    0
}

#[cfg(target_os = "macos")]
fn get_memory_usage() -> usize {
    use std::process::Command;
    let output = Command::new("ps")
        .args(&["-o", "rss=", "-p", &std::process::id().to_string()])
        .output()
        .unwrap();
    let rss_str = String::from_utf8_lossy(&output.stdout);
    rss_str.trim().parse::<usize>().unwrap_or(0) * 1024 // Convert kB to bytes
}

#[cfg(not(any(target_os = "linux", target_os = "macos")))]
fn get_memory_usage() -> usize {
    0 // Not implemented for other platforms
}

fn benchmark_size(lines: usize) {
    println!("\n{}", "=".repeat(60));
    println!("Benchmarking {} lines", lines);
    println!("{}", "=".repeat(60));

    let content = generate_test_content(lines);
    let content_size = content.len();
    println!("Content size: {}", format_bytes(content_size));

    let iterations = if lines <= 100 {
        1000
    } else if lines <= 1000 {
        100
    } else {
        10
    };

    // Warm up
    for _ in 0..5 {
        let _ = replace(
            &content,
            "console.log('hello');",
            "console.log('goodbye');",
            false,
        );
    }

    let start_mem = get_memory_usage();
    let start_time = Instant::now();

    for _ in 0..iterations {
        let _ = replace(
            &content,
            "console.log('hello');",
            "console.log('goodbye');",
            false,
        );
    }

    let duration = start_time.elapsed();
    let end_mem = get_memory_usage();

    let avg_micros = duration.as_micros() as f64 / iterations as f64;
    let mem_delta = if end_mem > start_mem {
        end_mem - start_mem
    } else {
        0
    };

    println!("\nRust Performance:");
    println!("  Time per operation: {}", format_time(avg_micros));
    println!("  Memory delta: {}", format_bytes(mem_delta));
    println!("  Peak RSS: {}", format_bytes(end_mem));
    println!("  Iterations: {}", iterations);
}

fn main() {
    println!("Edit Tool Memory & Performance Benchmark (Rust)");

    // Warm up
    println!("\nWarming up...");
    let warmup = generate_test_content(10);
    for _ in 0..100 {
        let _ = replace(&warmup, "hello", "goodbye", false);
    }

    // Run benchmarks
    benchmark_size(10);
    benchmark_size(100);
    benchmark_size(1000);
    benchmark_size(5000);
    benchmark_size(10000);

    println!("\n{}", "=".repeat(60));
    println!("Benchmark complete!");
    println!("{}", "=".repeat(60));
}
