use nucleo_matcher::{Config, Matcher, Utf32Str};

/// Nucleo implementation (Helix editor's algorithm - closest to fuzzysort)
/// Kept for future optimization attempts
pub fn search_nucleo(query: &str, items: &[String], limit: Option<usize>) -> Vec<String> {
    if query.is_empty() {
        let limit = limit.unwrap_or(items.len());
        return items.iter().take(limit).cloned().collect();
    }

    let mut matcher = Matcher::new(Config::DEFAULT);
    let mut query_buf = Vec::new();
    let query_utf32 = Utf32Str::new(query, &mut query_buf);

    let mut scored: Vec<(u16, &String)> = items
        .iter()
        .filter_map(|item| {
            let mut item_buf = Vec::new();
            let item_utf32 = Utf32Str::new(item, &mut item_buf);

            matcher
                .fuzzy_match(item_utf32, query_utf32)
                .map(|score| (score, item))
        })
        .collect();

    scored.sort_by(|a, b| b.0.cmp(&a.0));

    let limit = limit.unwrap_or(scored.len());
    scored
        .into_iter()
        .take(limit)
        .map(|(_, item)| item.clone())
        .collect()
}

/// Default search function (uses nucleo)
/// NOTE: Currently NOT used in production - fuzzysort (JavaScript) is faster
/// See RUST_MIGRATION_PLAN.md section 2.1 for benchmark results
pub fn search(query: &str, items: &[String], limit: Option<usize>) -> Vec<String> {
    search_nucleo(query, items, limit)
}

/// Optimized version that returns newline-separated string
pub fn search_raw(query: &str, items: &[String], limit: Option<usize>) -> String {
    let results = search(query, items, limit);
    results.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fuzzy_search_empty_query() {
        let items = vec!["foo".to_string(), "bar".to_string(), "baz".to_string()];
        let results = search("", &items, Some(2));
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_fuzzy_search_exact_match() {
        let items = vec![
            "src/main.rs".to_string(),
            "src/lib.rs".to_string(),
            "tests/test.rs".to_string(),
        ];
        let results = search("main", &items, None);
        assert!(results.len() > 0);
        assert_eq!(results[0], "src/main.rs");
    }

    #[test]
    fn test_fuzzy_search_with_limit() {
        let items = vec![
            "file1.txt".to_string(),
            "file2.txt".to_string(),
            "file3.txt".to_string(),
            "file4.txt".to_string(),
        ];
        let results = search("file", &items, Some(2));
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_fuzzy_search_no_match() {
        let items = vec!["foo".to_string(), "bar".to_string()];
        let results = search("xyz", &items, None);
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn test_fuzzy_search_raw() {
        let items = vec![
            "src/main.rs".to_string(),
            "src/lib.rs".to_string(),
            "tests/test.rs".to_string(),
        ];
        let result = search_raw("main", &items, None);
        assert!(result.contains("src/main.rs"));
    }

    #[test]
    fn test_nucleo_strategy() {
        let items = vec![
            "src/components/Button.tsx".to_string(),
            "src/components/Badge.tsx".to_string(),
            "src/utils/base.ts".to_string(),
        ];

        let nucleo_results = search_nucleo("bt", &items, None);
        assert!(nucleo_results.len() >= 2);
    }
}
