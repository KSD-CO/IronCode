use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use ironcode_tool::vcs;
use std::env;
use std::process::Command;
use std::time::Duration;

fn benchmark_rust_vcs(c: &mut Criterion) {
    let cwd = env::current_dir().unwrap().to_str().unwrap().to_string();

    // Navigate to the root git directory (5 levels up from native/tool)
    let git_root = std::path::Path::new(&cwd)
        .parent()
        .and_then(|p| p.parent())
        .and_then(|p| p.parent())
        .and_then(|p| p.parent())
        .and_then(|p| p.parent())
        .unwrap_or(std::path::Path::new(&cwd));

    let repo_path = git_root.to_str().unwrap();

    let mut group = c.benchmark_group("vcs_operations");
    group.measurement_time(Duration::from_secs(10));
    group.sample_size(100);

    // Benchmark: Native Rust implementation (single call)
    group.bench_function("rust_get_info", |b| {
        b.iter(|| black_box(vcs::get_info(repo_path)))
    });

    // Benchmark: Individual git commands (simulating TypeScript approach)
    group.bench_function("git_branch_only", |b| {
        b.iter(|| {
            let output = Command::new("git")
                .args(["rev-parse", "--abbrev-ref", "HEAD"])
                .current_dir(repo_path)
                .output()
                .unwrap();
            black_box(String::from_utf8_lossy(&output.stdout).trim().to_string())
        })
    });

    group.bench_function("git_status_only", |b| {
        b.iter(|| {
            let output = Command::new("git")
                .args(["status", "--porcelain"])
                .current_dir(repo_path)
                .output()
                .unwrap();
            black_box(String::from_utf8_lossy(&output.stdout).to_string())
        })
    });

    // Benchmark: Two separate git calls (TypeScript pattern)
    group.bench_function("typescript_pattern_two_calls", |b| {
        b.iter(|| {
            // First call: get branch
            let branch_output = Command::new("git")
                .args(["rev-parse", "--abbrev-ref", "HEAD"])
                .current_dir(repo_path)
                .output()
                .unwrap();
            let branch = String::from_utf8_lossy(&branch_output.stdout)
                .trim()
                .to_string();

            // Second call: get status
            let status_output = Command::new("git")
                .args(["status", "--porcelain"])
                .current_dir(repo_path)
                .output()
                .unwrap();
            let status_text = String::from_utf8_lossy(&status_output.stdout);

            // Parse status (simplified)
            let mut added = 0;
            let mut modified = 0;
            let mut deleted = 0;

            for line in status_text.lines() {
                if line.is_empty() {
                    continue;
                }
                let status = &line[..2.min(line.len())];
                if status.contains('?') || status.contains('A') {
                    added += 1;
                } else if status.contains('M') {
                    modified += 1;
                } else if status.contains('D') {
                    deleted += 1;
                }
            }

            black_box((branch, added, modified, deleted))
        })
    });

    group.finish();
}

fn benchmark_memory_usage(c: &mut Criterion) {
    let cwd = env::current_dir().unwrap().to_str().unwrap().to_string();

    let git_root = std::path::Path::new(&cwd)
        .parent()
        .and_then(|p| p.parent())
        .and_then(|p| p.parent())
        .and_then(|p| p.parent())
        .and_then(|p| p.parent())
        .unwrap_or(std::path::Path::new(&cwd));

    let repo_path = git_root.to_str().unwrap();

    // Cold start benchmark - includes FFI overhead
    c.bench_function("rust_vcs_cold_start", |b| {
        b.iter(|| black_box(vcs::get_info(repo_path)))
    });

    // Warm benchmark - repeated calls
    c.bench_function("rust_vcs_warm", |b| {
        // Prime the function
        let _ = vcs::get_info(repo_path);

        b.iter(|| black_box(vcs::get_info(repo_path)))
    });
}

fn benchmark_parallel_calls(c: &mut Criterion) {
    let cwd = env::current_dir().unwrap().to_str().unwrap().to_string();

    let git_root = std::path::Path::new(&cwd)
        .parent()
        .and_then(|p| p.parent())
        .and_then(|p| p.parent())
        .and_then(|p| p.parent())
        .and_then(|p| p.parent())
        .unwrap_or(std::path::Path::new(&cwd));

    let repo_path = git_root.to_str().unwrap().to_string();

    let mut group = c.benchmark_group("parallel_calls");

    for count in [1, 5, 10, 20].iter() {
        group.bench_with_input(
            BenchmarkId::new("rust_sequential", count),
            count,
            |b, &count| {
                b.iter(|| {
                    for _ in 0..count {
                        black_box(vcs::get_info(&repo_path)).ok();
                    }
                })
            },
        );
    }

    group.finish();
}

criterion_group!(
    benches,
    benchmark_rust_vcs,
    benchmark_memory_usage,
    benchmark_parallel_calls
);
criterion_main!(benches);
