use crate::types::{Metadata, Output};
use ignore::WalkBuilder;
use std::collections::{HashMap, HashSet};
use std::path::Path;

const LIMIT: usize = 100;

pub fn execute(search_path: &str, ignore_patterns: Vec<String>) -> Result<Output, String> {
    let mut builder = WalkBuilder::new(search_path);
    builder
        .git_ignore(false)
        .git_exclude(false)
        .hidden(false)
        .ignore(false);

    let mut files = Vec::new();

    for result in builder.build() {
        let entry = match result {
            Ok(e) => e,
            Err(_) => continue,
        };
        if !entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
            continue;
        }

        let path = entry.path();
        let rel_path = path
            .strip_prefix(search_path)
            .unwrap_or(path)
            .to_string_lossy()
            .to_string();

        // Skip if empty (root dir)
        if rel_path.is_empty() {
            continue;
        }

        // Check ignore patterns
        let should_ignore = ignore_patterns.iter().any(|pattern| {
            let pattern_trimmed = pattern.trim_end_matches('/');
            rel_path == pattern_trimmed
                || rel_path.starts_with(&format!("{}/", pattern_trimmed))
                || rel_path.contains(&format!("/{}/", pattern_trimmed))
        });

        if should_ignore {
            continue;
        }

        files.push(rel_path);
        if files.len() >= LIMIT {
            break;
        }
    }

    // Build directory structure
    let mut dirs = HashSet::new();
    let mut files_by_dir: HashMap<String, Vec<String>> = HashMap::new();

    for file in &files {
        let path = Path::new(file);
        let dir = path
            .parent()
            .and_then(|p| p.to_str())
            .unwrap_or(".")
            .to_string();

        let parts: Vec<&str> = if dir == "." {
            vec![]
        } else {
            dir.split('/').collect()
        };

        // Add all parent directories
        for i in 0..=parts.len() {
            let dir_path = if i == 0 {
                ".".to_string()
            } else {
                parts[..i].join("/")
            };
            dirs.insert(dir_path);
        }

        // Add file to its directory
        files_by_dir
            .entry(dir.clone())
            .or_default()
            .push(path.file_name().unwrap().to_string_lossy().to_string());
    }

    fn render_dir(
        dir_path: &str,
        depth: usize,
        dirs: &HashSet<String>,
        files_by_dir: &HashMap<String, Vec<String>>,
    ) -> String {
        let indent = "  ".repeat(depth);
        let mut output = String::new();

        if depth > 0 {
            let basename = Path::new(dir_path).file_name().unwrap().to_string_lossy();
            output.push_str(&format!("{}{}/\n", indent, basename));
        }

        let child_indent = "  ".repeat(depth + 1);

        // Get and sort children directories
        let mut children: Vec<String> = dirs
            .iter()
            .filter(|d| {
                if *d == dir_path {
                    return false;
                }
                let parent = if d.contains('/') {
                    d.rsplit_once('/').map(|x| x.0).unwrap_or(".")
                } else {
                    "."
                };
                parent == dir_path
            })
            .cloned()
            .collect();
        children.sort();

        // Render subdirectories first
        for child in children {
            output.push_str(&render_dir(&child, depth + 1, dirs, files_by_dir));
        }

        // Render files
        if let Some(files) = files_by_dir.get(dir_path) {
            let mut sorted_files = files.clone();
            sorted_files.sort();
            for file in sorted_files {
                output.push_str(&format!("{}{}\n", child_indent, file));
            }
        }

        output
    }

    let tree_output = render_dir(".", 0, &dirs, &files_by_dir);
    let output = format!("{}/\n{}", search_path, tree_output);

    Ok(Output {
        title: search_path.to_string(),
        metadata: Metadata {
            count: files.len(),
            truncated: files.len() >= LIMIT,
        },
        output,
    })
}
