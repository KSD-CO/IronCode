use ignore::WalkBuilder;
use std::path::Path;

/// List files in a directory using the ignore crate (respects .gitignore)
/// Returns a vector of relative file paths
pub fn list_files(
    cwd: &str,
    globs: Vec<String>,
    hidden: bool,
    follow: bool,
    max_depth: Option<usize>,
) -> Result<Vec<String>, String> {
    // Validate directory exists
    let cwd_path = Path::new(cwd);
    if !cwd_path.exists() || !cwd_path.is_dir() {
        return Err(format!("No such file or directory: '{}'", cwd));
    }

    let mut builder = WalkBuilder::new(cwd);
    builder
        .git_ignore(true)
        .git_exclude(true)
        .hidden(!hidden) // If hidden=true, show hidden files
        .ignore(true)
        .follow_links(follow);

    if let Some(depth) = max_depth {
        builder.max_depth(Some(depth));
    }

    // Build glob matcher if patterns provided
    // Separate positive and negative patterns
    let positive_globs: Vec<&String> = globs.iter().filter(|g| !g.starts_with('!')).collect();
    let negative_globs: Vec<String> = globs
        .iter()
        .filter(|g| g.starts_with('!'))
        .map(|g| g.strip_prefix('!').unwrap_or(g).to_string())
        .collect();

    let positive_matcher = if !positive_globs.is_empty() {
        use globset::{GlobBuilder, GlobSetBuilder};

        let mut glob_set_builder = GlobSetBuilder::new();
        for pattern in positive_globs {
            let glob = GlobBuilder::new(pattern)
                .literal_separator(false)
                .build()
                .map_err(|e| format!("Invalid glob pattern '{}': {}", pattern, e))?;
            glob_set_builder.add(glob);
        }

        Some(
            glob_set_builder
                .build()
                .map_err(|e| format!("Failed to build glob set: {}", e))?,
        )
    } else {
        None
    };

    let negative_matcher = if !negative_globs.is_empty() {
        use globset::{GlobBuilder, GlobSetBuilder};

        let mut glob_set_builder = GlobSetBuilder::new();
        for pattern in negative_globs {
            let glob = GlobBuilder::new(&pattern)
                .literal_separator(false)
                .build()
                .map_err(|e| format!("Invalid glob pattern '{}': {}", pattern, e))?;
            glob_set_builder.add(glob);
        }

        Some(
            glob_set_builder
                .build()
                .map_err(|e| format!("Failed to build glob set: {}", e))?,
        )
    } else {
        None
    };

    let mut files = Vec::new();

    for result in builder.build() {
        let entry = match result {
            Ok(e) => e,
            Err(_) => continue,
        };

        // Only process files, not directories
        if !entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
            continue;
        }

        let path = entry.path();

        // Get relative path from cwd
        let rel_path = path
            .strip_prefix(cwd)
            .unwrap_or(path)
            .to_string_lossy()
            .to_string();

        // Apply glob filter if provided
        // If positive patterns exist, file must match at least one
        if let Some(ref matcher) = positive_matcher {
            if !matcher.is_match(&rel_path) && !matcher.is_match(path) {
                continue;
            }
        }

        // If negative patterns exist, file must not match any
        if let Some(ref matcher) = negative_matcher {
            if matcher.is_match(&rel_path) || matcher.is_match(path) {
                continue;
            }
        }

        files.push(rel_path);
    }

    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn setup_test_dir() -> PathBuf {
        let temp_dir = std::env::temp_dir().join(format!(
            "ironcode_file_list_test_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&temp_dir).unwrap();

        // Create test files
        fs::write(temp_dir.join("file1.txt"), "test").unwrap();
        fs::write(temp_dir.join("file2.rs"), "test").unwrap();
        fs::create_dir_all(temp_dir.join("subdir")).unwrap();
        fs::write(temp_dir.join("subdir/file3.txt"), "test").unwrap();
        fs::write(temp_dir.join(".hidden"), "test").unwrap();

        temp_dir
    }

    fn cleanup_test_dir(dir: &PathBuf) {
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn test_list_files_basic() {
        let test_dir = setup_test_dir();
        let cwd = test_dir.to_str().unwrap();

        let files = list_files(cwd, vec![], false, false, None).unwrap();

        assert!(files.len() >= 2); // At least file1.txt and file2.rs
        assert!(files.iter().any(|f| f.contains("file1.txt")));
        assert!(files.iter().any(|f| f.contains("file2.rs")));

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_list_files_with_glob() {
        let test_dir = setup_test_dir();
        let cwd = test_dir.to_str().unwrap();

        let files = list_files(cwd, vec!["*.txt".to_string()], false, false, None).unwrap();

        assert!(files.iter().any(|f| f.contains("file1.txt")));
        assert!(!files.iter().any(|f| f.contains("file2.rs")));

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_list_files_hidden() {
        let test_dir = setup_test_dir();
        let cwd = test_dir.to_str().unwrap();

        let files_no_hidden = list_files(cwd, vec![], false, false, None).unwrap();
        let files_with_hidden = list_files(cwd, vec![], true, false, None).unwrap();

        assert!(files_with_hidden.len() >= files_no_hidden.len());

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_list_files_invalid_dir() {
        let result = list_files("/nonexistent_directory_12345", vec![], false, false, None);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("No such file or directory"));
    }

    #[test]
    fn test_list_files_max_depth() {
        let test_dir = setup_test_dir();
        let cwd = test_dir.to_str().unwrap();

        let files_depth_1 = list_files(cwd, vec![], false, false, Some(1)).unwrap();

        // With depth 1, should not include subdir/file3.txt
        assert!(!files_depth_1
            .iter()
            .any(|f| f.contains("subdir") && f.contains("file3")));

        cleanup_test_dir(&test_dir);
    }
}
