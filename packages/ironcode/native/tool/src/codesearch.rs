use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

use ignore::Walk;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};

use crate::bm25::{tokenize, Bm25Index};
use crate::indexer::{detect_language, extract_symbols, language_name, CodeSymbol};

/// Max file size to index (512 KB)
const MAX_FILE_BYTES: u64 = 512 * 1024;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub symbol: CodeSymbol,
    pub score: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct IndexStats {
    pub total_files: usize,
    pub total_symbols: usize,
    pub total_terms: usize,
    pub languages: HashMap<String, usize>,
    pub index_time_ms: u64,
}

struct Inner {
    bm25: Bm25Index,
    /// doc_id → symbol (None = deleted slot)
    symbols: Vec<Option<CodeSymbol>>,
    /// file_path → list of doc_ids
    file_docs: HashMap<String, Vec<usize>>,
    /// Freed doc_id slots for reuse
    free_ids: Vec<usize>,
    next_id: usize,
    stats: IndexStats,
}

impl Inner {
    fn new() -> Self {
        Self {
            bm25: Bm25Index::new(),
            symbols: Vec::new(),
            file_docs: HashMap::new(),
            free_ids: Vec::new(),
            next_id: 0,
            stats: IndexStats::default(),
        }
    }

    fn alloc_id(&mut self) -> usize {
        if let Some(id) = self.free_ids.pop() {
            id
        } else {
            let id = self.next_id;
            self.next_id += 1;
            self.symbols.resize(self.next_id, None);
            id
        }
    }

    fn add_file(&mut self, file_path: &str, source: &[u8], lang: crate::indexer::Language) {
        self.remove_file(file_path);

        let syms = extract_symbols(file_path, source, lang);
        if syms.is_empty() {
            return;
        }

        let lang_str = language_name(lang).to_string();
        *self.stats.languages.entry(lang_str).or_insert(0) += syms.len();
        self.stats.total_symbols += syms.len();
        self.stats.total_files += 1;

        let mut doc_ids = Vec::with_capacity(syms.len());
        for sym in syms {
            let doc_id = self.alloc_id();
            // Index: name + kind + content
            let text = format!("{} {} {}", sym.name, sym.kind, sym.content);
            let tokens = tokenize(&text);
            self.bm25.add_document(doc_id, &tokens);
            self.symbols[doc_id] = Some(sym);
            doc_ids.push(doc_id);
        }
        self.file_docs.insert(file_path.to_string(), doc_ids);
    }

    fn remove_file(&mut self, file_path: &str) {
        if let Some(doc_ids) = self.file_docs.remove(file_path) {
            for doc_id in &doc_ids {
                self.bm25.remove_document(*doc_id);
                if *doc_id < self.symbols.len() {
                    if let Some(sym) = self.symbols[*doc_id].take() {
                        if let Some(cnt) = self.stats.languages.get_mut(&sym.language) {
                            *cnt = cnt.saturating_sub(1);
                        }
                        self.stats.total_symbols = self.stats.total_symbols.saturating_sub(1);
                    }
                    self.free_ids.push(*doc_id);
                }
            }
            self.stats.total_files = self.stats.total_files.saturating_sub(1);
        }
    }

    fn search(&self, query: &str, top_k: usize) -> Vec<SearchResult> {
        let tokens = tokenize(query);
        self.bm25
            .search(&tokens, top_k)
            .into_iter()
            .filter_map(|(doc_id, score)| {
                self.symbols.get(doc_id)?.as_ref().map(|sym| SearchResult {
                    symbol: sym.clone(),
                    score,
                })
            })
            .collect()
    }

    fn stats(&self) -> IndexStats {
        IndexStats {
            total_files: self.stats.total_files,
            total_symbols: self.stats.total_symbols,
            total_terms: self.bm25.term_count(),
            languages: self.stats.languages.clone(),
            index_time_ms: self.stats.index_time_ms,
        }
    }
}

lazy_static! {
    static ref INDEX: Mutex<Inner> = Mutex::new(Inner::new());
}

// ── Public API ────────────────────────────────────────────────────────────────

/// Walk a project directory and build the BM25 index.
/// Respects .gitignore via the `ignore` crate.
pub fn index_project(project_path: &str) -> Result<IndexStats, String> {
    let start = std::time::Instant::now();

    let mut inner = INDEX.lock().map_err(|e| format!("lock: {}", e))?;
    *inner = Inner::new();

    for result in Walk::new(project_path) {
        let entry = match result {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        // Skip large files
        if let Ok(meta) = path.metadata() {
            if meta.len() > MAX_FILE_BYTES {
                continue;
            }
        }
        let lang = match detect_language(path) {
            Some(l) => l,
            None => continue,
        };
        let source = match std::fs::read(path) {
            Ok(s) => s,
            Err(_) => continue,
        };
        let path_str = path.to_string_lossy().to_string();
        inner.add_file(&path_str, &source, lang);
    }

    inner.stats.index_time_ms = start.elapsed().as_millis() as u64;
    Ok(inner.stats())
}

/// Search the index for the given query string.
pub fn search(query: &str, top_k: usize) -> Result<Vec<SearchResult>, String> {
    let inner = INDEX.lock().map_err(|e| format!("lock: {}", e))?;
    Ok(inner.search(query, top_k))
}

/// Re-index a single file (add/update).
pub fn update_file(file_path: &str) -> Result<(), String> {
    let path = Path::new(file_path);
    let lang = match detect_language(path) {
        Some(l) => l,
        None => return Ok(()), // unsupported extension — silently skip
    };
    // Skip large files
    let meta = path.metadata().map_err(|e| format!("stat: {}", e))?;
    if meta.len() > MAX_FILE_BYTES {
        return Ok(());
    }
    let source = std::fs::read(path).map_err(|e| format!("read: {}", e))?;
    let mut inner = INDEX.lock().map_err(|e| format!("lock: {}", e))?;
    inner.add_file(file_path, &source, lang);
    Ok(())
}

/// Remove a file's symbols from the index.
pub fn remove_file(file_path: &str) -> Result<(), String> {
    let mut inner = INDEX.lock().map_err(|e| format!("lock: {}", e))?;
    inner.remove_file(file_path);
    Ok(())
}

/// Current index stats.
pub fn get_stats() -> Result<IndexStats, String> {
    let inner = INDEX.lock().map_err(|e| format!("lock: {}", e))?;
    Ok(inner.stats())
}
