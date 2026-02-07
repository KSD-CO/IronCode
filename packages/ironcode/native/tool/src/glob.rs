use std::fs;
use std::time::UNIX_EPOCH;
use globset::{GlobBuilder, GlobSetBuilder};
use ignore::WalkBuilder;
use crate::types::{Metadata, Output};

pub fn execute(pattern: &str, search: &str) -> Result<Output, String> {
    let mut set_builder = GlobSetBuilder::new();
    let g = GlobBuilder::new(pattern)
        .literal_separator(false)
        .build()
        .map_err(|e| format!("Invalid glob: {}", e))?;
    
    set_builder.add(g);
    let matcher = set_builder
        .build()
        .map_err(|e| format!("Failed to build glob set: {}", e))?;

    let mut files: Vec<(String, u128)> = Vec::new();

    let mut builder = WalkBuilder::new(search);
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
        if !entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
            continue;
        }
        let path = entry.path().to_path_buf();
        let rel = path.strip_prefix(search).unwrap_or(path.as_path()).to_path_buf();
        if !(matcher.is_match(path.as_path()) || matcher.is_match(rel.as_path())) {
            continue;
        }

        let mtime = fs::metadata(&path)
            .and_then(|m| m.modified())
            .map(|t| t.duration_since(UNIX_EPOCH).unwrap_or_default().as_millis())
            .unwrap_or(0);

        files.push((path.to_string_lossy().to_string(), mtime));
    }

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

    Ok(Output {
        title: search.to_string(),
        metadata: Metadata {
            count: files.len(),
            truncated,
        },
        output,
    })
}
