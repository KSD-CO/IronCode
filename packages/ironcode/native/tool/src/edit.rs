use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ReplaceResult {
    pub content: String,
    pub replaced: bool,
}

#[derive(Debug)]
pub enum ReplaceError {
    NotFound,
    MultipleMatches,
    SameStrings,
}

const SINGLE_CANDIDATE_SIMILARITY_THRESHOLD: f64 = 0.0;
const MULTIPLE_CANDIDATES_SIMILARITY_THRESHOLD: f64 = 0.3;

/// Levenshtein distance algorithm - optimized for performance
pub fn levenshtein(a: &str, b: &str) -> usize {
    if a.is_empty() {
        return b.len();
    }
    if b.is_empty() {
        return a.len();
    }

    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    let a_len = a_chars.len();
    let b_len = b_chars.len();

    // Use a single vector and swap between rows for memory efficiency
    let mut prev_row: Vec<usize> = (0..=b_len).collect();
    let mut curr_row: Vec<usize> = vec![0; b_len + 1];

    for i in 1..=a_len {
        curr_row[0] = i;
        for j in 1..=b_len {
            let cost = if a_chars[i - 1] == b_chars[j - 1] {
                0
            } else {
                1
            };
            curr_row[j] = (prev_row[j] + 1)
                .min(curr_row[j - 1] + 1)
                .min(prev_row[j - 1] + cost);
        }
        std::mem::swap(&mut prev_row, &mut curr_row);
    }

    prev_row[b_len]
}

/// Normalize whitespace without intermediate Vec allocation
fn normalize_whitespace(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    for word in text.split_whitespace() {
        if !result.is_empty() {
            result.push(' ');
        }
        result.push_str(word);
    }
    result
}

/// Simple exact match replacer
fn simple_replacer(content: &str, find: &str, _content_lines: &[&str]) -> Vec<String> {
    if content.contains(find) {
        vec![find.to_string()]
    } else {
        vec![]
    }
}

/// Line trimmed replacer - matches lines with trimmed content
fn line_trimmed_replacer(content: &str, find: &str, content_lines: &[&str]) -> Vec<String> {
    let mut results = Vec::new();
    let mut search_lines: Vec<&str> = find.split('\n').collect();

    // Remove trailing empty line
    if search_lines.last() == Some(&"") {
        search_lines.pop();
    }

    if search_lines.is_empty() {
        return results;
    }

    let search_len = search_lines.len();
    if content_lines.len() < search_len {
        return results;
    }

    for i in 0..=content_lines.len() - search_len {
        let mut matches = true;

        for j in 0..search_len {
            if content_lines[i + j].trim() != search_lines[j].trim() {
                matches = false;
                break;
            }
        }

        if matches {
            let mut match_start = 0;
            for line in content_lines.iter().take(i) {
                match_start += line.len() + 1; // +1 for newline
            }

            let mut match_end = match_start;
            for k in 0..search_len {
                match_end += content_lines[i + k].len();
                if k < search_len - 1 {
                    match_end += 1; // Add newline except for last line
                }
            }

            if match_end <= content.len() {
                results.push(content[match_start..match_end].to_string());
            }
        }
    }

    results
}

/// Block anchor replacer - uses first and last lines as anchors with similarity matching
fn block_anchor_replacer(content: &str, find: &str, content_lines: &[&str]) -> Vec<String> {
    let mut results = Vec::new();
    let mut search_lines: Vec<&str> = find.split('\n').collect();

    if search_lines.len() < 3 {
        return results;
    }

    if search_lines.last() == Some(&"") {
        search_lines.pop();
    }

    let first_line_search = search_lines[0].trim();
    let last_line_search = search_lines[search_lines.len() - 1].trim();
    let search_block_size = search_lines.len();

    // Collect candidates
    let mut candidates: Vec<(usize, usize)> = Vec::new();
    for i in 0..content_lines.len() {
        if content_lines[i].trim() != first_line_search {
            continue;
        }

        for (j, line) in content_lines.iter().enumerate().skip(i + 2) {
            if line.trim() == last_line_search {
                candidates.push((i, j));
                break;
            }
        }
    }

    if candidates.is_empty() {
        return results;
    }

    // Single candidate scenario
    if candidates.len() == 1 {
        let (start_line, end_line) = candidates[0];
        let actual_block_size = end_line - start_line + 1;

        let lines_to_check = (search_block_size - 2).min(actual_block_size - 2);
        let mut similarity = 0.0;

        if lines_to_check > 0 {
            for j in 1..search_block_size - 1 {
                if j >= actual_block_size - 1 {
                    break;
                }
                let original_line = content_lines[start_line + j].trim();
                let search_line = search_lines[j].trim();
                let max_len = original_line.len().max(search_line.len());
                if max_len == 0 {
                    continue;
                }
                let distance = levenshtein(original_line, search_line);
                similarity += (1.0 - distance as f64 / max_len as f64) / lines_to_check as f64;

                if similarity >= SINGLE_CANDIDATE_SIMILARITY_THRESHOLD {
                    break;
                }
            }
        } else {
            similarity = 1.0;
        }

        if similarity >= SINGLE_CANDIDATE_SIMILARITY_THRESHOLD {
            let mut match_start = 0;
            for line in content_lines.iter().take(start_line) {
                match_start += line.len() + 1;
            }
            let mut match_end = match_start;
            for (k, line) in content_lines
                .iter()
                .enumerate()
                .take(end_line + 1)
                .skip(start_line)
            {
                match_end += line.len();
                if k < end_line {
                    match_end += 1;
                }
            }
            if match_end <= content.len() {
                results.push(content[match_start..match_end].to_string());
            }
        }
        return results;
    }

    // Multiple candidates scenario
    let mut best_match: Option<(usize, usize)> = None;
    let mut max_similarity = -1.0;

    for &(start_line, end_line) in &candidates {
        let actual_block_size = end_line - start_line + 1;
        let lines_to_check = (search_block_size - 2).min(actual_block_size - 2);
        let mut similarity = 0.0;

        if lines_to_check > 0 {
            for j in 1..search_block_size - 1 {
                if j >= actual_block_size - 1 {
                    break;
                }
                let original_line = content_lines[start_line + j].trim();
                let search_line = search_lines[j].trim();
                let max_len = original_line.len().max(search_line.len());
                if max_len == 0 {
                    continue;
                }
                let distance = levenshtein(original_line, search_line);
                similarity += 1.0 - distance as f64 / max_len as f64;
            }
            similarity /= lines_to_check as f64;
        } else {
            similarity = 1.0;
        }

        if similarity > max_similarity {
            max_similarity = similarity;
            best_match = Some((start_line, end_line));
        }
    }

    if max_similarity >= MULTIPLE_CANDIDATES_SIMILARITY_THRESHOLD {
        if let Some((start_line, end_line)) = best_match {
            let mut match_start = 0;
            for line in content_lines.iter().take(start_line) {
                match_start += line.len() + 1;
            }
            let mut match_end = match_start;
            for (k, line) in content_lines
                .iter()
                .enumerate()
                .take(end_line + 1)
                .skip(start_line)
            {
                match_end += line.len();
                if k < end_line {
                    match_end += 1;
                }
            }
            if match_end <= content.len() {
                results.push(content[match_start..match_end].to_string());
            }
        }
    }

    results
}

/// Whitespace normalized replacer
fn whitespace_normalized_replacer(_content: &str, find: &str, content_lines: &[&str]) -> Vec<String> {
    let mut results = Vec::new();

    let normalized_find = normalize_whitespace(find);

    // Single line matches
    for line in content_lines {
        if normalize_whitespace(line) == normalized_find {
            results.push(line.to_string());
        } else {
            let normalized_line = normalize_whitespace(line);
            if normalized_line.contains(&normalized_find) {
                // Try to find substring match with flexible whitespace
                let words: Vec<&str> = find.split_whitespace().collect();
                if !words.is_empty() && words.len() == 1 {
                    // Single word - just find it
                    if line.contains(words[0]) {
                        results.push(words[0].to_string());
                    }
                }
                // For multi-word patterns, just return the line if normalized version matches
                else if words.len() > 1 {
                    results.push(line.to_string());
                }
            }
        }
    }

    // Multi-line matches
    let find_lines: Vec<&str> = find.split('\n').collect();
    if find_lines.len() > 1 {
        for i in 0..=content_lines.len().saturating_sub(find_lines.len()) {
            let block = content_lines[i..i + find_lines.len()].join("\n");
            if normalize_whitespace(&block) == normalized_find {
                results.push(block);
            }
        }
    }

    results
}

/// Indentation flexible replacer
fn indentation_flexible_replacer(_content: &str, find: &str, content_lines: &[&str]) -> Vec<String> {
    let mut results = Vec::new();

    let remove_indentation = |text: &str| -> String {
        let lines: Vec<&str> = text.split('\n').collect();
        let min_indent = lines
            .iter()
            .filter(|line| !line.trim().is_empty())
            .map(|line| line.chars().take_while(|c| c.is_whitespace()).count())
            .min()
            .unwrap_or(0);

        let mut result = String::with_capacity(text.len());
        for (i, line) in lines.iter().enumerate() {
            if i > 0 {
                result.push('\n');
            }
            if line.trim().is_empty() {
                result.push_str(line);
            } else {
                result.extend(line.chars().skip(min_indent));
            }
        }
        result
    };

    let normalized_find = remove_indentation(find);
    let find_lines: Vec<&str> = find.split('\n').collect();

    for i in 0..=content_lines.len().saturating_sub(find_lines.len()) {
        let block = content_lines[i..i + find_lines.len()].join("\n");
        if remove_indentation(&block) == normalized_find {
            results.push(block);
        }
    }

    results
}

/// Escape normalized replacer
fn escape_normalized_replacer(content: &str, find: &str, content_lines: &[&str]) -> Vec<String> {
    let mut results = Vec::new();

    let unescape_string = |s: &str| -> String {
        let mut result = String::new();
        let mut chars = s.chars().peekable();

        while let Some(ch) = chars.next() {
            if ch == '\\' {
                if let Some(&next_ch) = chars.peek() {
                    chars.next();
                    match next_ch {
                        'n' => result.push('\n'),
                        't' => result.push('\t'),
                        'r' => result.push('\r'),
                        '\'' | '"' | '`' | '\\' | '$' => result.push(next_ch),
                        '\n' => result.push('\n'),
                        _ => {
                            result.push('\\');
                            result.push(next_ch);
                        }
                    }
                } else {
                    result.push('\\');
                }
            } else {
                result.push(ch);
            }
        }
        result
    };

    let unescaped_find = unescape_string(find);

    if content.contains(&unescaped_find) {
        results.push(unescaped_find.clone());
    }

    let find_lines: Vec<&str> = unescaped_find.split('\n').collect();

    for i in 0..=content_lines.len().saturating_sub(find_lines.len()) {
        let block = content_lines[i..i + find_lines.len()].join("\n");
        let unescaped_block = unescape_string(&block);
        if unescaped_block == unescaped_find {
            results.push(block);
        }
    }

    results
}

/// Trimmed boundary replacer
fn trimmed_boundary_replacer(content: &str, find: &str, content_lines: &[&str]) -> Vec<String> {
    let mut results = Vec::new();
    let trimmed_find = find.trim();

    if trimmed_find == find {
        return results;
    }

    if content.contains(trimmed_find) {
        results.push(trimmed_find.to_string());
    }

    let find_lines: Vec<&str> = find.split('\n').collect();

    for i in 0..=content_lines.len().saturating_sub(find_lines.len()) {
        let block = content_lines[i..i + find_lines.len()].join("\n");
        if block.trim() == trimmed_find {
            results.push(block);
        }
    }

    results
}

/// Context aware replacer
fn context_aware_replacer(_content: &str, find: &str, content_lines: &[&str]) -> Vec<String> {
    let mut results = Vec::new();
    let mut find_lines: Vec<&str> = find.split('\n').collect();

    if find_lines.len() < 3 {
        return results;
    }

    if find_lines.last() == Some(&"") {
        find_lines.pop();
    }

    let first_line = find_lines[0].trim();
    let last_line = find_lines[find_lines.len() - 1].trim();

    for i in 0..content_lines.len() {
        if content_lines[i].trim() != first_line {
            continue;
        }

        for j in i + 2..content_lines.len() {
            if content_lines[j].trim() == last_line {
                let block_lines = &content_lines[i..=j];

                if block_lines.len() == find_lines.len() {
                    let mut matching_lines = 0;
                    let mut total_non_empty = 0;

                    for k in 1..block_lines.len() - 1 {
                        let block_line = block_lines[k].trim();
                        let find_line = find_lines[k].trim();

                        if !block_line.is_empty() || !find_line.is_empty() {
                            total_non_empty += 1;
                            if block_line == find_line {
                                matching_lines += 1;
                            }
                        }
                    }

                    if total_non_empty == 0 || matching_lines as f64 / total_non_empty as f64 >= 0.5
                    {
                        results.push(block_lines.join("\n"));
                        break;
                    }
                }
                break;
            }
        }
    }

    results
}

/// Multi occurrence replacer
fn multi_occurrence_replacer(content: &str, find: &str, _content_lines: &[&str]) -> Vec<String> {
    let mut results = Vec::new();
    let mut start = 0;

    while let Some(index) = content[start..].find(find) {
        results.push(find.to_string());
        start += index + find.len();
    }

    results
}

type ReplacerFn = fn(&str, &str, &[&str]) -> Vec<String>;

/// Main replace function that tries all strategies
pub fn replace(
    content: &str,
    old_string: &str,
    new_string: &str,
    replace_all: bool,
) -> Result<String, ReplaceError> {
    if old_string == new_string {
        return Err(ReplaceError::SameStrings);
    }

    // Split content lines once, shared across all replacers
    let content_lines: Vec<&str> = content.split('\n').collect();

    let replacers: Vec<ReplacerFn> = vec![
        simple_replacer,
        line_trimmed_replacer,
        block_anchor_replacer,
        whitespace_normalized_replacer,
        indentation_flexible_replacer,
        escape_normalized_replacer,
        trimmed_boundary_replacer,
        context_aware_replacer,
        multi_occurrence_replacer,
    ];

    let mut not_found = true;

    for replacer in replacers {
        let matches = replacer(content, old_string, &content_lines);
        for search in matches {
            if let Some(index) = content.find(&search) {
                not_found = false;

                if replace_all {
                    return Ok(content.replace(&search, new_string));
                }

                // Check if there are multiple occurrences
                if let Some(last_index) = content.rfind(&search) {
                    if index != last_index {
                        continue; // Multiple matches, skip
                    }
                }

                // Single match found
                let mut result =
                    String::with_capacity(content.len() + new_string.len() - search.len());
                result.push_str(&content[..index]);
                result.push_str(new_string);
                result.push_str(&content[index + search.len()..]);
                return Ok(result);
            }
        }
    }

    if not_found {
        return Err(ReplaceError::NotFound);
    }
    Err(ReplaceError::MultipleMatches)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_levenshtein() {
        assert_eq!(levenshtein("", ""), 0);
        assert_eq!(levenshtein("abc", "abc"), 0);
        assert_eq!(levenshtein("abc", "def"), 3);
        assert_eq!(levenshtein("kitten", "sitting"), 3);
        assert_eq!(levenshtein("", "abc"), 3);
        assert_eq!(levenshtein("abc", ""), 3);
    }

    #[test]
    fn test_simple_replace() {
        let content = "Hello world";
        let result = replace(content, "world", "Rust", false).unwrap();
        assert_eq!(result, "Hello Rust");
    }

    #[test]
    fn test_replace_all() {
        let content = "foo bar foo";
        let result = replace(content, "foo", "baz", true).unwrap();
        assert_eq!(result, "baz bar baz");
    }

    #[test]
    fn test_line_trimmed_replace() {
        let content = "  hello\n  world";
        let result = replace(content, "hello\nworld", "goodbye\nworld", false).unwrap();
        assert_eq!(result, "goodbye\nworld");
    }

    #[test]
    fn test_indentation_preserved() {
        let content = "  hello\n  world\n  test";
        let result = replace(
            content,
            "hello\nworld\ntest",
            "goodbye\ncruel\nworld",
            false,
        )
        .unwrap();
        assert_eq!(result, "goodbye\ncruel\nworld");
    }

    #[test]
    fn test_not_found() {
        let content = "Hello world";
        let result = replace(content, "Rust", "Go", false);
        assert!(matches!(result, Err(ReplaceError::NotFound)));
    }

    #[test]
    fn test_same_strings() {
        let content = "Hello world";
        let result = replace(content, "world", "world", false);
        assert!(matches!(result, Err(ReplaceError::SameStrings)));
    }
}
