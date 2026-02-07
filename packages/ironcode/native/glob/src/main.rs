use std::env;
use std::fs;
use std::time::UNIX_EPOCH;

use globset::{GlobBuilder, GlobSetBuilder};
use ignore::WalkBuilder;
use serde::Serialize;

#[derive(Serialize)]
struct Metadata {
    count: usize,
    truncated: bool,
}

#[derive(Serialize)]
struct Output {
    title: String,
    metadata: Metadata,
    output: String,
}

fn main() {
    let mut args = env::args().skip(1);
    let pattern = match args.next() {
        Some(p) => p,
        None => {
            eprintln!("Missing pattern");
            std::process::exit(2);
        }
    };
    let search = args.next().unwrap_or_else(|| ".".to_string());

    let mut set_builder = GlobSetBuilder::new();
    let g = match GlobBuilder::new(&pattern).literal_separator(false).build() {
        Ok(x) => x,
        Err(e) => {
            eprintln!("Invalid glob: {}", e);
            std::process::exit(2);
        }
    };
    set_builder.add(g);
    let matcher = match set_builder.build() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Failed to build glob set: {}", e);
            std::process::exit(2);
        }
    };

    let mut files: Vec<(String, u128)> = Vec::new();

    let mut builder = WalkBuilder::new(&search);
    builder
        .git_ignore(true)
        .git_exclude(true)
        .hidden(true)
        .ignore(true);

    for result in builder.build() {
        let entry = match result {
            Ok(e) => e,
            Err(_) => continue,
        };
        if !entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) { continue; }
        let path = entry.path().to_path_buf();
        let rel = path.strip_prefix(&search).unwrap_or(path.as_path()).to_path_buf();
        if !(matcher.is_match(path.as_path()) || matcher.is_match(rel.as_path())) { continue; }

        let mtime = fs::metadata(&path)
            .and_then(|m| m.modified())
            .map(|t| t.duration_since(UNIX_EPOCH).unwrap_or_default().as_millis())
            .unwrap_or(0);

        files.push((path.to_string_lossy().to_string(), mtime));
    }

    // sort by mtime desc and then truncate to limit so behavior matches sorting semantics
    files.sort_by(|a, b| b.1.cmp(&a.1));
    let limit = 100usize;
    let truncated = files.len() > limit;
    let files = files.into_iter().take(limit).collect::<Vec<_>>();

    let output = if files.is_empty() {
        "No files found".to_string()
    } else {
        let mut out: Vec<String> = files.iter().map(|(p, _)| p.clone()).collect();
        if truncated {
            out.push(String::new());
            out.push("(Results are truncated. Consider using a more specific path or pattern.)".to_string());
        }
        out.join("\n")
    };

    let result = Output {
        title: search,
        metadata: Metadata { count: files.len(), truncated },
        output,
    };

    println!("{}", serde_json::to_string(&result).unwrap());
}
