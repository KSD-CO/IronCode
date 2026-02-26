use rexile::ReXile;

/// Build a regex pattern string from a wildcard pattern.
/// Escapes special regex chars, converts `*` → `.*` and `?` → `.`
fn build_regex_pattern(pattern: &str) -> String {
    let mut out = String::with_capacity(pattern.len() * 2);
    for c in pattern.chars() {
        match c {
            '.' | '+' | '^' | '$' | '{' | '}' | '(' | ')' | '|' | '[' | ']' | '\\' => {
                out.push('\\');
                out.push(c);
            }
            '*' => out.push_str(".*"),
            '?' => out.push('.'),
            _ => out.push(c),
        }
    }
    out
}

/// Match `s` against a wildcard `pattern`.
///
/// Rules (ported from `util/wildcard.ts`):
/// - `*` matches any sequence of characters (including empty)
/// - `?` matches any single character
/// - If the pattern ends with ` *` (space + wildcard), the trailing part is
///   optional: `"ls *"` matches both `"ls"` and `"ls -la"`.
pub fn wildcard_match(s: &str, pattern: &str) -> bool {
    // Special case: " *" at end → trailing " <anything>" is optional.
    // Equivalent to JS: if (escaped.endsWith(" .*")) { escaped = base + "( .*)?" }
    if pattern.ends_with(" *") {
        let base = &pattern[..pattern.len() - 2];
        let base_pat = build_regex_pattern(base);

        // Try exact match against base
        let exact = format!("^{base_pat}$");
        if ReXile::new(&exact).map(|re| re.is_match(s)).unwrap_or(false) {
            return true;
        }
        // Try base followed by a space and anything
        let with_tail = format!("^{base_pat} .*$");
        return ReXile::new(&with_tail).map(|re| re.is_match(s)).unwrap_or(false);
    }

    let regex = format!("^{}$", build_regex_pattern(pattern));
    ReXile::new(&regex).map(|re| re.is_match(s)).unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exact_match() {
        assert!(wildcard_match("bash", "bash"));
        assert!(!wildcard_match("bash", "edit"));
    }

    #[test]
    fn test_wildcard_star() {
        assert!(wildcard_match("anything", "*"));
        assert!(wildcard_match("", "*"));
        assert!(wildcard_match("src/foo.ts", "src/*"));
        assert!(!wildcard_match("test/foo.ts", "src/*"));
    }

    #[test]
    fn test_trailing_space_star() {
        // "ls *" should match "ls" (exact base) and "ls -la" (base + space + rest)
        assert!(wildcard_match("ls", "ls *"));
        assert!(wildcard_match("ls -la", "ls *"));
        assert!(wildcard_match("git commit", "git commit *"));
        assert!(wildcard_match("git commit -m msg", "git commit *"));
        // Should NOT match unrelated strings
        assert!(!wildcard_match("lsof", "ls *"));
    }

    #[test]
    fn test_question_mark() {
        assert!(wildcard_match("abc", "a?c"));
        assert!(!wildcard_match("ac", "a?c"));
    }

    #[test]
    fn test_glob_path() {
        assert!(wildcard_match("src/components/Button.tsx", "src/components/*"));
        assert!(!wildcard_match("src/util/foo.ts", "src/components/*"));
    }

    #[test]
    fn test_wildcard_permission() {
        assert!(wildcard_match("bash", "*"));
        assert!(wildcard_match("mcp_server_tool", "mcp_*"));
        assert!(!wildcard_match("bash", "edit"));
    }

    #[test]
    fn test_special_chars_escaped() {
        // Dots in patterns should be literal
        assert!(wildcard_match("src/foo.ts", "src/foo.ts"));
        assert!(!wildcard_match("src/fooXts", "src/foo.ts"));
    }
}
