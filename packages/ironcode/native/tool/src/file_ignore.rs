/// File/folder ignore matching — mirrors `FileIgnore` from `file/ignore.ts`.
///
/// Logic:
/// 1. If any whitelist pattern matches → not ignored (return false).
/// 2. If any path *segment* is a known ignored folder → ignored (return true).
/// 3. If any file glob pattern (builtin + extra) matches → ignored (return true).
/// 4. Otherwise → not ignored (return false).
use globset::{Glob, GlobSetBuilder};

const FOLDERS: &[&str] = &[
    "node_modules",
    "bower_components",
    ".pnpm-store",
    "vendor",
    ".npm",
    "dist",
    "build",
    "out",
    ".next",
    "target",
    "bin",
    "obj",
    ".git",
    ".svn",
    ".hg",
    ".vscode",
    ".idea",
    ".turbo",
    ".output",
    "desktop",
    ".sst",
    ".cache",
    ".webkit-cache",
    "__pycache__",
    ".pytest_cache",
    "mypy_cache",
    ".history",
    ".gradle",
];

const FILE_GLOBS: &[&str] = &[
    "**/*.swp",
    "**/*.swo",
    "**/*.pyc",
    "**/.DS_Store",
    "**/Thumbs.db",
    "**/logs/**",
    "**/tmp/**",
    "**/temp/**",
    "**/*.log",
    "**/coverage/**",
    "**/.nyc_output/**",
];

/// Match a filepath against the ignore rules.
///
/// - `whitelist`: glob patterns that exempt the file from being ignored
/// - `extra`: additional glob patterns to treat as ignored
pub fn file_ignore_match(filepath: &str, whitelist: &[String], extra: &[String]) -> bool {
    // 1. Whitelist check
    if !whitelist.is_empty() {
        let mut builder = GlobSetBuilder::new();
        for pattern in whitelist {
            if let Ok(g) = Glob::new(pattern) {
                builder.add(g);
            }
        }
        if let Ok(set) = builder.build() {
            if set.is_match(filepath) {
                return false;
            }
        }
    }

    // 2. Folder segment check (any path component matches a known ignored folder)
    for part in filepath.split('/') {
        if FOLDERS.contains(&part) {
            return true;
        }
    }
    // Also handle Windows-style backslash separators
    if filepath.contains('\\') {
        for part in filepath.split('\\') {
            if FOLDERS.contains(&part) {
                return true;
            }
        }
    }

    // 3. File glob check (builtin + extra)
    let mut builder = GlobSetBuilder::new();
    for pattern in FILE_GLOBS {
        if let Ok(g) = Glob::new(pattern) {
            builder.add(g);
        }
    }
    for pattern in extra {
        if let Ok(g) = Glob::new(pattern) {
            builder.add(g);
        }
    }
    if let Ok(set) = builder.build() {
        if set.is_match(filepath) {
            return true;
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    fn no_opts() -> (Vec<String>, Vec<String>) {
        (vec![], vec![])
    }

    #[test]
    fn test_node_modules_ignored() {
        let (w, e) = no_opts();
        assert!(file_ignore_match("node_modules/react/index.js", &w, &e));
        assert!(file_ignore_match("src/node_modules/foo", &w, &e));
    }

    #[test]
    fn test_dot_git_ignored() {
        let (w, e) = no_opts();
        assert!(file_ignore_match(".git/COMMIT_EDITMSG", &w, &e));
        assert!(file_ignore_match("repo/.git/config", &w, &e));
    }

    #[test]
    fn test_target_ignored() {
        let (w, e) = no_opts();
        assert!(file_ignore_match("target/release/binary", &w, &e));
    }

    #[test]
    fn test_dist_ignored() {
        let (w, e) = no_opts();
        assert!(file_ignore_match("dist/bundle.js", &w, &e));
    }

    #[test]
    fn test_swp_file_ignored() {
        let (w, e) = no_opts();
        assert!(file_ignore_match("src/foo.ts.swp", &w, &e));
        assert!(file_ignore_match(".foo.swp", &w, &e));
    }

    #[test]
    fn test_log_file_ignored() {
        let (w, e) = no_opts();
        assert!(file_ignore_match("app.log", &w, &e));
        assert!(file_ignore_match("logs/access.log", &w, &e));
    }

    #[test]
    fn test_ds_store_ignored() {
        let (w, e) = no_opts();
        assert!(file_ignore_match(".DS_Store", &w, &e));
        assert!(file_ignore_match("src/.DS_Store", &w, &e));
    }

    #[test]
    fn test_coverage_ignored() {
        let (w, e) = no_opts();
        assert!(file_ignore_match("coverage/lcov.info", &w, &e));
    }

    #[test]
    fn test_normal_files_not_ignored() {
        let (w, e) = no_opts();
        assert!(!file_ignore_match("src/main.ts", &w, &e));
        assert!(!file_ignore_match("README.md", &w, &e));
        assert!(!file_ignore_match("package.json", &w, &e));
        assert!(!file_ignore_match("src/components/Button.tsx", &w, &e));
    }

    #[test]
    fn test_whitelist_exempts_match() {
        let whitelist = vec!["node_modules/my-local-pkg/**".to_string()];
        let extra = vec![];
        // whitelisted path → not ignored even though it's inside node_modules
        assert!(!file_ignore_match(
            "node_modules/my-local-pkg/index.js",
            &whitelist,
            &extra
        ));
        // non-whitelisted node_modules → still ignored
        assert!(file_ignore_match(
            "node_modules/react/index.js",
            &whitelist,
            &extra
        ));
    }

    #[test]
    fn test_extra_patterns() {
        let whitelist = vec![];
        let extra = vec!["**/fixtures/**".to_string()];
        assert!(file_ignore_match("src/fixtures/data.json", &whitelist, &extra));
        assert!(!file_ignore_match("src/utils/helper.ts", &whitelist, &extra));
    }

    #[test]
    fn test_pycache_ignored() {
        let (w, e) = no_opts();
        assert!(file_ignore_match("__pycache__/foo.pyc", &w, &e));
        assert!(file_ignore_match("src/__pycache__/module.cpython-311.pyc", &w, &e));
    }

    #[test]
    fn test_pyc_file_ignored() {
        let (w, e) = no_opts();
        assert!(file_ignore_match("app.pyc", &w, &e));
        assert!(file_ignore_match("src/module.pyc", &w, &e));
    }
}
