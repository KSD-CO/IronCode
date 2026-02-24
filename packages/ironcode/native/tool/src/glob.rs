use crate::types::{Metadata, Output};
use globset::{GlobBuilder, GlobSetBuilder};
use ignore::WalkBuilder;
use std::time::UNIX_EPOCH;

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
        // Check match on borrowed path first — avoid allocating PathBuf for non-matching files
        let path = entry.path();
        let rel = path.strip_prefix(search).unwrap_or(path);
        if !(matcher.is_match(path) || matcher.is_match(rel)) {
            continue;
        }

        // Use cached DirEntry metadata instead of an extra fs::metadata syscall
        let mtime = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .map(|t| t.duration_since(UNIX_EPOCH).unwrap_or_default().as_millis())
            .unwrap_or(0);

        files.push((path.to_string_lossy().to_string(), mtime));
    }

    let limit = 100usize;
    let truncated = files.len() > limit;
    // Partial sort: only fully sort the top N elements instead of the entire Vec
    if files.len() > limit {
        files.select_nth_unstable_by(limit, |a, b| b.1.cmp(&a.1));
        files.truncate(limit);
    }
    files.sort_by(|a, b| b.1.cmp(&a.1));

    let output = if files.is_empty() {
        "No files found".to_string()
    } else {
        let mut out: Vec<String> = files.iter().map(|(p, _)| p.clone()).collect();
        if truncated {
            out.push(String::new());
            out.push(
                "(Results are truncated. Consider using a more specific path or pattern.)"
                    .to_string(),
            );
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
