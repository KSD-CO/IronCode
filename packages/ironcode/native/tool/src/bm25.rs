use std::collections::HashMap;

const K1: f64 = 1.2;
const B: f64 = 0.75;
const MIN_TOKEN_LEN: usize = 2;

/// Common code keywords that don't add meaningful search signal
const STOP_WORDS: &[&str] = &[
    "fn",
    "let",
    "const",
    "var",
    "if",
    "else",
    "return",
    "pub",
    "use",
    "mod",
    "impl",
    "struct",
    "enum",
    "trait",
    "type",
    "async",
    "await",
    "match",
    "true",
    "false",
    "null",
    "undefined",
    "void",
    "new",
    "class",
    "extends",
    "import",
    "export",
    "from",
    "default",
    "function",
    "this",
    "self",
    "super",
    "of",
    "as",
    "with",
    "not",
    "do",
    "while",
    "for",
    "try",
    "catch",
    "throw",
    "get",
    "set",
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "is",
    "it",
    "be",
    "was",
    "are",
    "has",
    "have",
    "had",
    "that",
    "this",
    "mut",
    "ref",
    "pub",
    "priv",
    "crate",
    "super",
];

pub struct Bm25Index {
    /// term -> Vec<(doc_id, term_frequency)>
    inverted_index: HashMap<String, Vec<(usize, usize)>>,
    /// doc_id -> token count (0 = deleted)
    doc_lengths: Vec<usize>,
    /// Number of active documents
    num_docs: usize,
    /// Average document length
    avg_doc_length: f64,
}

impl Default for Bm25Index {
    fn default() -> Self {
        Self::new()
    }
}

impl Bm25Index {
    pub fn new() -> Self {
        Self {
            inverted_index: HashMap::new(),
            doc_lengths: Vec::new(),
            num_docs: 0,
            avg_doc_length: 0.0,
        }
    }

    pub fn add_document(&mut self, doc_id: usize, tokens: &[String]) {
        // Grow if needed
        if doc_id >= self.doc_lengths.len() {
            self.doc_lengths.resize(doc_id + 1, 0);
        }
        // If already exists, remove first
        if self.doc_lengths[doc_id] > 0 {
            self.remove_document(doc_id);
        }

        // Count term frequencies
        let mut tf: HashMap<&str, usize> = HashMap::new();
        for token in tokens {
            *tf.entry(token.as_str()).or_insert(0) += 1;
        }

        let doc_len = tokens.len();
        self.doc_lengths[doc_id] = doc_len;

        for (term, count) in &tf {
            self.inverted_index
                .entry(term.to_string())
                .or_default()
                .push((doc_id, *count));
        }

        self.num_docs += 1;
        self.recalculate_avg();
    }

    pub fn remove_document(&mut self, doc_id: usize) {
        if doc_id >= self.doc_lengths.len() || self.doc_lengths[doc_id] == 0 {
            return;
        }
        self.doc_lengths[doc_id] = 0;
        self.num_docs = self.num_docs.saturating_sub(1);
        for postings in self.inverted_index.values_mut() {
            postings.retain(|(id, _)| *id != doc_id);
        }
        self.recalculate_avg();
    }

    fn recalculate_avg(&mut self) {
        let (total, count) = self
            .doc_lengths
            .iter()
            .filter(|&&l| l > 0)
            .fold((0usize, 0usize), |(s, c), &l| (s + l, c + 1));
        self.avg_doc_length = if count > 0 {
            total as f64 / count as f64
        } else {
            0.0
        };
    }

    /// BM25 search. Returns Vec<(doc_id, score)> sorted by score descending.
    pub fn search(&self, query_tokens: &[String], top_k: usize) -> Vec<(usize, f64)> {
        if self.num_docs == 0 || query_tokens.is_empty() {
            return vec![];
        }
        let n = self.num_docs as f64;
        let avgdl = self.avg_doc_length.max(1.0);
        let mut scores: HashMap<usize, f64> = HashMap::new();

        for token in query_tokens {
            if let Some(postings) = self.inverted_index.get(token) {
                let df = postings.len() as f64;
                let idf = ((n - df + 0.5) / (df + 0.5) + 1.0).ln().max(0.0);
                for &(doc_id, tf) in postings {
                    let dl = self.doc_lengths.get(doc_id).copied().unwrap_or(0);
                    if dl == 0 {
                        continue;
                    }
                    let tf_f = tf as f64;
                    let dl_f = dl as f64;
                    let score =
                        idf * (tf_f * (K1 + 1.0)) / (tf_f + K1 * (1.0 - B + B * dl_f / avgdl));
                    *scores.entry(doc_id).or_insert(0.0) += score;
                }
            }
        }

        let mut results: Vec<(usize, f64)> = scores.into_iter().collect();
        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        results.truncate(top_k);
        results
    }

    pub fn doc_count(&self) -> usize {
        self.num_docs
    }

    pub fn term_count(&self) -> usize {
        self.inverted_index.len()
    }
}

/// Tokenize code text into searchable terms.
/// Handles camelCase, snake_case, kebab-case, removes stop words.
pub fn tokenize(text: &str) -> Vec<String> {
    let stop: std::collections::HashSet<&str> = STOP_WORDS.iter().copied().collect();
    let mut tokens = Vec::new();

    let separators = |c: char| -> bool {
        c.is_whitespace()
            || matches!(
                c,
                '.' | ','
                    | ';'
                    | ':'
                    | '!'
                    | '?'
                    | '('
                    | ')'
                    | '['
                    | ']'
                    | '{'
                    | '}'
                    | '"'
                    | '\''
                    | '`'
                    | '/'
                    | '\\'
                    | '|'
                    | '<'
                    | '>'
                    | '@'
                    | '#'
                    | '$'
                    | '%'
                    | '^'
                    | '&'
                    | '*'
                    | '+'
                    | '='
                    | '~'
                    | '-'
            )
    };

    for word in text.split(separators) {
        if word.is_empty() {
            continue;
        }
        for sub in split_identifier(word) {
            let lower = sub.to_lowercase();
            if lower.len() >= MIN_TOKEN_LEN
                && !stop.contains(lower.as_str())
                && !lower.chars().all(|c| c.is_ascii_digit())
            {
                tokens.push(lower);
            }
        }
    }
    tokens
}

/// Split identifier into sub-words: camelCase, snake_case, PascalCase.
/// e.g. "getUserById" → ["get", "user", "by", "id", "getuserbyid"]
fn split_identifier(word: &str) -> Vec<String> {
    // Handle underscore-separated identifiers
    let underscore_parts: Vec<&str> = word.split('_').filter(|p| !p.is_empty()).collect();
    let mut parts: Vec<String> = Vec::new();

    if underscore_parts.len() > 1 {
        for part in &underscore_parts {
            parts.extend(split_camel(part));
        }
        // Also add original lowercased
        parts.push(word.to_lowercase());
        return parts;
    }

    // Handle camelCase
    let camel = split_camel(word);
    if camel.len() > 1 {
        parts.extend(camel);
        parts.push(word.to_lowercase()); // add original as a whole token too
    } else {
        parts.extend(camel);
    }
    parts
}

fn split_camel(s: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut current = String::new();
    let mut prev_lower = false;

    for ch in s.chars() {
        if ch.is_uppercase() && prev_lower && !current.is_empty() {
            result.push(current.clone());
            current.clear();
        }
        prev_lower = ch.is_lowercase();
        current.push(ch);
    }
    if !current.is_empty() {
        result.push(current);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tokenize_camel() {
        let tokens = tokenize("getUserById");
        assert!(tokens.contains(&"get".to_string()));
        assert!(tokens.contains(&"user".to_string()));
        assert!(tokens.contains(&"id".to_string()));
    }

    #[test]
    fn test_tokenize_snake() {
        let tokens = tokenize("get_user_by_id");
        assert!(tokens.contains(&"user".to_string()));
        assert!(tokens.contains(&"id".to_string()));
    }

    #[test]
    fn test_bm25_basic() {
        let mut idx = Bm25Index::new();
        idx.add_document(0, &tokenize("authenticate user login password session"));
        idx.add_document(1, &tokenize("read file from disk path"));
        idx.add_document(2, &tokenize("user profile update name email"));

        let results = idx.search(&tokenize("user authentication"), 5);
        assert!(!results.is_empty());
        // Document 0 should rank highest for "user authentication"
        assert_eq!(results[0].0, 0);
    }
}
