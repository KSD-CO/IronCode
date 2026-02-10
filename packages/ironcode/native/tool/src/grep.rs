use crate::types::{Metadata, Output};
use ignore::WalkBuilder;
use rexile::ReXile;
use serde::{Deserialize, Serialize};
use std::fs;
use std::time::SystemTime;

#[derive(Serialize, Deserialize)]
pub struct GrepMatch {
    path: String,
    #[serde(rename = "modTime")]
    mod_time: u64,
    #[serde(rename = "lineNum")]
    line_num: usize,
    #[serde(rename = "lineText")]
    line_text: String,
}

pub fn execute(
    pattern: &str,
    search_path: &str,
    include_glob: Option<&str>,
) -> Result<Output, String> {
    grep(pattern, search_path, include_glob).map_err(|e| e.to_string())
}

fn grep(
    pattern: &str,
    search_path: &str,
    include_glob: Option<&str>,
) -> Result<Output, Box<dyn std::error::Error>> {
    let regex = ReXile::new(pattern)?;
    let mut matches = Vec::new();

    let mut builder = WalkBuilder::new(search_path);
    builder
        .hidden(false)
        .ignore(false)
        .git_ignore(false)
        .git_global(false)
        .git_exclude(false);

    for entry in builder.build() {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        if !entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
            continue;
        }

        let path = entry.path();

        // Apply include glob filter if specified
        if let Some(glob_pattern) = include_glob {
            let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

            // Simple glob matching for common patterns
            let matches_glob = if let Some(ext) = glob_pattern.strip_prefix("*.") {
                file_name.ends_with(ext)
            } else if glob_pattern.contains("*.{") && glob_pattern.ends_with("}") {
                // Handle *.{ts,tsx} pattern
                if let Some(start) = glob_pattern.find("{") {
                    if let Some(end) = glob_pattern.find("}") {
                        let exts = &glob_pattern[start + 1..end];
                        exts.split(',').any(|ext| file_name.ends_with(ext))
                    } else {
                        true
                    }
                } else {
                    true
                }
            } else {
                true
            };

            if !matches_glob {
                continue;
            }
        }

        // Read file and search for pattern
        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let mod_time = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .unwrap_or(SystemTime::UNIX_EPOCH)
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        for (line_num, line) in content.lines().enumerate() {
            if regex.is_match(line) {
                matches.push(GrepMatch {
                    path: path.to_string_lossy().to_string(),
                    mod_time,
                    line_num: line_num + 1,
                    line_text: line.to_string(),
                });
            }
        }
    }

    // Sort by modification time (newest first)
    matches.sort_by(|a, b| b.mod_time.cmp(&a.mod_time));

    let limit = 100;
    let truncated = matches.len() > limit;
    let final_matches: Vec<_> = if truncated {
        matches.into_iter().take(limit).collect()
    } else {
        matches
    };

    if final_matches.is_empty() {
        return Ok(Output {
            title: pattern.to_string(),
            metadata: Metadata {
                count: 0,
                truncated: false,
            },
            output: "No files found".to_string(),
        });
    }

    let mut output_lines = vec![format!("Found {} matches", final_matches.len())];
    let mut current_file = String::new();

    const MAX_LINE_LENGTH: usize = 2000;

    for m in &final_matches {
        if current_file != m.path {
            if !current_file.is_empty() {
                output_lines.push(String::new());
            }
            current_file = m.path.clone();
            output_lines.push(format!("{}:", m.path));
        }

        let truncated_line = if m.line_text.len() > MAX_LINE_LENGTH {
            format!("{}...", &m.line_text[..MAX_LINE_LENGTH])
        } else {
            m.line_text.clone()
        };

        output_lines.push(format!("  Line {}: {}", m.line_num, truncated_line));
    }

    if truncated {
        output_lines.push(String::new());
        output_lines.push(
            "(Results are truncated. Consider using a more specific path or pattern.)".to_string(),
        );
    }

    Ok(Output {
        title: pattern.to_string(),
        metadata: Metadata {
            count: final_matches.len(),
            truncated,
        },
        output: output_lines.join("\n"),
    })
}
