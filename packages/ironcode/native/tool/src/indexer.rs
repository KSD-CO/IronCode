use serde::{Deserialize, Serialize};
use std::path::Path;
use tree_sitter::Parser;

/// Max content bytes per symbol to keep memory bounded
const MAX_CONTENT_BYTES: usize = 8192;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SymbolKind {
    Function,
    Method,
    Class,
    Interface,
    Struct,
    Enum,
    Type,
    Trait,
    Module,
    Variable,
    Chunk, // fallback line-chunked content
}

impl std::fmt::Display for SymbolKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            SymbolKind::Function => "function",
            SymbolKind::Method => "method",
            SymbolKind::Class => "class",
            SymbolKind::Interface => "interface",
            SymbolKind::Struct => "struct",
            SymbolKind::Enum => "enum",
            SymbolKind::Type => "type",
            SymbolKind::Trait => "trait",
            SymbolKind::Module => "module",
            SymbolKind::Variable => "variable",
            SymbolKind::Chunk => "chunk",
        };
        write!(f, "{}", s)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeSymbol {
    pub file_path: String,
    pub line_start: usize,
    pub line_end: usize,
    pub name: String,
    pub kind: SymbolKind,
    /// Truncated source content of the symbol
    pub content: String,
    pub language: String,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Language {
    TypeScript,
    TypeScriptX,
    JavaScript,
    JavaScriptX,
    Python,
    Rust,
    Go,
    Java,
    CSharp,
    Ruby,
    C,
    Cpp,
    Php,
    Scala,
}

pub fn detect_language(path: &Path) -> Option<Language> {
    match path.extension()?.to_str()? {
        "ts" => Some(Language::TypeScript),
        "tsx" => Some(Language::TypeScriptX),
        "js" | "mjs" | "cjs" => Some(Language::JavaScript),
        "jsx" => Some(Language::JavaScriptX),
        "py" | "pyw" => Some(Language::Python),
        "rs" => Some(Language::Rust),
        "go" => Some(Language::Go),
        "java" => Some(Language::Java),
        "cs" => Some(Language::CSharp),
        "rb" | "rake" | "gemspec" => Some(Language::Ruby),
        "c" | "h" => Some(Language::C),
        "cpp" | "cc" | "cxx" | "hpp" | "hxx" => Some(Language::Cpp),
        "php" | "php8" | "php7" => Some(Language::Php),
        "scala" | "sc" => Some(Language::Scala),
        _ => None,
    }
}

pub fn language_name(lang: Language) -> &'static str {
    match lang {
        Language::TypeScript | Language::TypeScriptX => "typescript",
        Language::JavaScript | Language::JavaScriptX => "javascript",
        Language::Python => "python",
        Language::Rust => "rust",
        Language::Go => "go",
        Language::Java => "java",
        Language::CSharp => "csharp",
        Language::Ruby => "ruby",
        Language::C => "c",
        Language::Cpp => "cpp",
        Language::Php => "php",
        Language::Scala => "scala",
    }
}

fn ts_language(lang: Language) -> tree_sitter::Language {
    match lang {
        Language::TypeScript => tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into(),
        Language::TypeScriptX => tree_sitter_typescript::LANGUAGE_TSX.into(),
        Language::JavaScript | Language::JavaScriptX => tree_sitter_javascript::LANGUAGE.into(),
        Language::Python => tree_sitter_python::LANGUAGE.into(),
        Language::Rust => tree_sitter_rust::LANGUAGE.into(),
        Language::Go => tree_sitter_go::LANGUAGE.into(),
        Language::Java => tree_sitter_java::LANGUAGE.into(),
        Language::CSharp => tree_sitter_c_sharp::LANGUAGE.into(),
        Language::Ruby => tree_sitter_ruby::LANGUAGE.into(),
        Language::C => tree_sitter_c::LANGUAGE.into(),
        Language::Cpp => tree_sitter_cpp::LANGUAGE.into(),
        Language::Php => tree_sitter_php::LANGUAGE_PHP.into(),
        Language::Scala => tree_sitter_scala::LANGUAGE.into(),
    }
}

/// Extract code symbols from a file.
pub fn extract_symbols(file_path: &str, source: &[u8], lang: Language) -> Vec<CodeSymbol> {
    let ts_lang = ts_language(lang);
    let lang_name = language_name(lang);
    let mut parser = Parser::new();

    if parser.set_language(&ts_lang).is_err() {
        return chunk_by_lines(file_path, source, lang_name);
    }

    let tree = match parser.parse(source, None) {
        Some(t) => t,
        None => return chunk_by_lines(file_path, source, lang_name),
    };

    let root = tree.root_node();
    let mut symbols = Vec::new();

    match lang {
        Language::TypeScript
        | Language::TypeScriptX
        | Language::JavaScript
        | Language::JavaScriptX => {
            extract_js_ts(source, root, file_path, lang_name, &mut symbols);
        }
        Language::Python => {
            extract_python(source, root, file_path, &mut symbols);
        }
        Language::Rust => {
            extract_rust(source, root, file_path, &mut symbols);
        }
        Language::Go => {
            extract_go(source, root, file_path, &mut symbols);
        }
        Language::Java => {
            extract_java(source, root, file_path, &mut symbols);
        }
        Language::CSharp => {
            extract_csharp(source, root, file_path, &mut symbols);
        }
        Language::Ruby => {
            extract_ruby(source, root, file_path, &mut symbols);
        }
        Language::C => {
            extract_c(source, root, file_path, &mut symbols);
        }
        Language::Cpp => {
            extract_cpp(source, root, file_path, &mut symbols);
        }
        Language::Php => {
            extract_php(source, root, file_path, &mut symbols);
        }
        Language::Scala => {
            extract_scala(source, root, file_path, &mut symbols);
        }
    }

    if symbols.is_empty() {
        chunk_by_lines(file_path, source, lang_name)
    } else {
        symbols
    }
}

// ── helpers ──────────────────────────────────────────────────────────────────

fn node_text<'a>(node: &tree_sitter::Node, source: &'a [u8]) -> &'a str {
    node.utf8_text(source).unwrap_or("")
}

fn make_symbol(
    node: &tree_sitter::Node,
    source: &[u8],
    name: &str,
    kind: SymbolKind,
    file_path: &str,
    language: &str,
) -> CodeSymbol {
    let start = node.start_byte();
    let end = node.end_byte().min(start + MAX_CONTENT_BYTES);
    let content = std::str::from_utf8(&source[start..end])
        .unwrap_or("")
        .to_string();
    CodeSymbol {
        file_path: file_path.to_string(),
        line_start: node.start_position().row + 1,
        line_end: node.end_position().row + 1,
        name: name.to_string(),
        kind,
        content,
        language: language.to_string(),
    }
}

// ── TypeScript / JavaScript ───────────────────────────────────────────────────

fn extract_js_ts(
    source: &[u8],
    node: tree_sitter::Node,
    file_path: &str,
    lang_name: &str,
    symbols: &mut Vec<CodeSymbol>,
) {
    extract_js_ts_scope(source, node, file_path, lang_name, None, symbols);
}

/// Recursively extract symbols from a TS/JS scope (module, namespace, or class body).
/// `ns_prefix` is set when inside a namespace (e.g. "ToolRegistry" → "ToolRegistry.register").
fn extract_js_ts_scope(
    source: &[u8],
    node: tree_sitter::Node,
    file_path: &str,
    lang_name: &str,
    ns_prefix: Option<&str>,
    symbols: &mut Vec<CodeSymbol>,
) {
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        extract_js_ts_node(source, child, file_path, lang_name, ns_prefix, symbols);
    }
}

fn qualify(ns: Option<&str>, name: &str) -> String {
    match ns {
        Some(prefix) => format!("{}.{}", prefix, name),
        None => name.to_string(),
    }
}

fn extract_js_ts_node(
    source: &[u8],
    child: tree_sitter::Node,
    file_path: &str,
    lang_name: &str,
    ns_prefix: Option<&str>,
    symbols: &mut Vec<CodeSymbol>,
) {
    match child.kind() {
        "function_declaration" | "generator_function_declaration" => {
            if let Some(n) = child.child_by_field_name("name") {
                let name = qualify(ns_prefix, node_text(&n, source));
                symbols.push(make_symbol(
                    &child,
                    source,
                    &name,
                    SymbolKind::Function,
                    file_path,
                    lang_name,
                ));
            }
        }
        "class_declaration" => {
            if let Some(n) = child.child_by_field_name("name") {
                let name = qualify(ns_prefix, node_text(&n, source));
                symbols.push(make_symbol(
                    &child,
                    source,
                    &name,
                    SymbolKind::Class,
                    file_path,
                    lang_name,
                ));
            }
        }
        "interface_declaration" => {
            if let Some(n) = child.child_by_field_name("name") {
                let name = qualify(ns_prefix, node_text(&n, source));
                symbols.push(make_symbol(
                    &child,
                    source,
                    &name,
                    SymbolKind::Interface,
                    file_path,
                    lang_name,
                ));
            }
        }
        "type_alias_declaration" => {
            if let Some(n) = child.child_by_field_name("name") {
                let name = qualify(ns_prefix, node_text(&n, source));
                symbols.push(make_symbol(
                    &child,
                    source,
                    &name,
                    SymbolKind::Type,
                    file_path,
                    lang_name,
                ));
            }
        }
        "enum_declaration" => {
            if let Some(n) = child.child_by_field_name("name") {
                let name = qualify(ns_prefix, node_text(&n, source));
                symbols.push(make_symbol(
                    &child,
                    source,
                    &name,
                    SymbolKind::Enum,
                    file_path,
                    lang_name,
                ));
            }
        }
        // export namespace Foo { ... }  or  namespace Foo { ... }
        // tree-sitter-typescript uses "internal_module" for namespace/module declarations
        "internal_module" => {
            if let Some(n) = child.child_by_field_name("name") {
                let ns_name = node_text(&n, source);
                let qualified_ns = qualify(ns_prefix, ns_name);
                // body is a statement_block — recurse into it
                if let Some(body) = child.child_by_field_name("body") {
                    extract_js_ts_scope(
                        source,
                        body,
                        file_path,
                        lang_name,
                        Some(&qualified_ns),
                        symbols,
                    );
                }
            }
        }
        "export_statement" => {
            let mut ec = child.walk();
            for export_child in child.children(&mut ec) {
                // Pass `in_export = true` by using a dedicated call so that
                // exported const declarations are always indexed.
                extract_js_ts_node_exported(
                    source,
                    export_child,
                    file_path,
                    lang_name,
                    ns_prefix,
                    symbols,
                );
            }
        }
        "lexical_declaration" | "variable_declaration" => {
            // Non-exported: only index const foo = () => { ... } or const foo = function() { ... }
            extract_js_ts_var_decl(
                source, child, file_path, lang_name, ns_prefix, false, symbols,
            );
        }
        _ => {}
    }
}

/// Called for children of `export_statement`: same as `extract_js_ts_node` but
/// also indexes exported `const X = call_expression(...)` as Variable.
fn extract_js_ts_node_exported(
    source: &[u8],
    child: tree_sitter::Node,
    file_path: &str,
    lang_name: &str,
    ns_prefix: Option<&str>,
    symbols: &mut Vec<CodeSymbol>,
) {
    match child.kind() {
        "lexical_declaration" | "variable_declaration" => {
            extract_js_ts_var_decl(
                source, child, file_path, lang_name, ns_prefix, true, symbols,
            );
        }
        _ => {
            extract_js_ts_node(source, child, file_path, lang_name, ns_prefix, symbols);
        }
    }
}

/// Extract variable declarators.
/// `exported`: when true, ANY non-primitive value is indexed (catches `const X = Tool.define(...)`).
/// When false, only arrow/function expressions are indexed.
fn extract_js_ts_var_decl(
    source: &[u8],
    node: tree_sitter::Node,
    file_path: &str,
    lang_name: &str,
    ns_prefix: Option<&str>,
    exported: bool,
    symbols: &mut Vec<CodeSymbol>,
) {
    let mut dc = node.walk();
    for declarator in node.children(&mut dc) {
        if declarator.kind() != "variable_declarator" {
            continue;
        }
        let name_node = match declarator.child_by_field_name("name") {
            Some(n) => n,
            None => continue,
        };
        let value_node = match declarator.child_by_field_name("value") {
            Some(v) => v,
            None => continue,
        };
        let name = qualify(ns_prefix, node_text(&name_node, source));
        let vk = value_node.kind();
        if matches!(vk, "arrow_function" | "function" | "function_expression") {
            symbols.push(make_symbol(
                &declarator,
                source,
                &name,
                SymbolKind::Function,
                file_path,
                lang_name,
            ));
        } else if exported {
            // e.g. `export const TaskTool = Tool.define(...)` or `export const Schema = z.object(...)`
            // Skip trivial primitives (string/number/boolean/null/undefined literals)
            if !matches!(
                vk,
                "string" | "number" | "true" | "false" | "null" | "undefined"
            ) {
                symbols.push(make_symbol(
                    &declarator,
                    source,
                    &name,
                    SymbolKind::Variable,
                    file_path,
                    lang_name,
                ));
            }
        }
    }
}

// ── Python ────────────────────────────────────────────────────────────────────

fn extract_python(
    source: &[u8],
    node: tree_sitter::Node,
    file_path: &str,
    symbols: &mut Vec<CodeSymbol>,
) {
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        match child.kind() {
            "function_definition" | "async_function_definition" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = node_text(&n, source).to_string();
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Function,
                        file_path,
                        "python",
                    ));
                }
            }
            "class_definition" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = node_text(&n, source).to_string();
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Class,
                        file_path,
                        "python",
                    ));
                }
            }
            "decorated_definition" => {
                let mut dc = child.walk();
                for inner in child.children(&mut dc) {
                    match inner.kind() {
                        "function_definition" | "async_function_definition" => {
                            if let Some(n) = inner.child_by_field_name("name") {
                                let name = node_text(&n, source).to_string();
                                symbols.push(make_symbol(
                                    &child,
                                    source,
                                    &name,
                                    SymbolKind::Function,
                                    file_path,
                                    "python",
                                ));
                            }
                        }
                        "class_definition" => {
                            if let Some(n) = inner.child_by_field_name("name") {
                                let name = node_text(&n, source).to_string();
                                symbols.push(make_symbol(
                                    &child,
                                    source,
                                    &name,
                                    SymbolKind::Class,
                                    file_path,
                                    "python",
                                ));
                            }
                        }
                        _ => {}
                    }
                }
            }
            _ => {}
        }
    }
}

// ── Rust ──────────────────────────────────────────────────────────────────────

fn extract_rust(
    source: &[u8],
    node: tree_sitter::Node,
    file_path: &str,
    symbols: &mut Vec<CodeSymbol>,
) {
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        match child.kind() {
            "function_item" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = node_text(&n, source).to_string();
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Function,
                        file_path,
                        "rust",
                    ));
                }
            }
            "struct_item" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = node_text(&n, source).to_string();
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Struct,
                        file_path,
                        "rust",
                    ));
                }
            }
            "enum_item" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = node_text(&n, source).to_string();
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Enum,
                        file_path,
                        "rust",
                    ));
                }
            }
            "trait_item" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = node_text(&n, source).to_string();
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Trait,
                        file_path,
                        "rust",
                    ));
                }
            }
            "type_item" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = node_text(&n, source).to_string();
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Type,
                        file_path,
                        "rust",
                    ));
                }
            }
            "impl_item" => {
                // Extract methods from impl blocks, prefixed with the impl type name
                let impl_type = child
                    .child_by_field_name("type")
                    .map(|n| node_text(&n, source).to_string())
                    .unwrap_or_default();
                if let Some(body) = child.child_by_field_name("body") {
                    let mut bc = body.walk();
                    for method in body.children(&mut bc) {
                        if method.kind() == "function_item" {
                            if let Some(n) = method.child_by_field_name("name") {
                                let method_name = node_text(&n, source).to_string();
                                let full_name = if impl_type.is_empty() {
                                    method_name
                                } else {
                                    format!("{}::{}", impl_type, method_name)
                                };
                                symbols.push(make_symbol(
                                    &method,
                                    source,
                                    &full_name,
                                    SymbolKind::Method,
                                    file_path,
                                    "rust",
                                ));
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }
}

// ── Go ────────────────────────────────────────────────────────────────────────

fn extract_go(
    source: &[u8],
    node: tree_sitter::Node,
    file_path: &str,
    symbols: &mut Vec<CodeSymbol>,
) {
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        match child.kind() {
            "function_declaration" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = node_text(&n, source).to_string();
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Function,
                        file_path,
                        "go",
                    ));
                }
            }
            "method_declaration" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = node_text(&n, source).to_string();
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Method,
                        file_path,
                        "go",
                    ));
                }
            }
            "type_declaration" => {
                let mut tc = child.walk();
                for type_spec in child.children(&mut tc) {
                    if type_spec.kind() == "type_spec" {
                        if let Some(n) = type_spec.child_by_field_name("name") {
                            let name = node_text(&n, source).to_string();
                            let kind = type_spec
                                .child_by_field_name("type")
                                .map(|tn| match tn.kind() {
                                    "struct_type" => SymbolKind::Struct,
                                    "interface_type" => SymbolKind::Interface,
                                    _ => SymbolKind::Type,
                                })
                                .unwrap_or(SymbolKind::Type);
                            symbols.push(make_symbol(
                                &type_spec, source, &name, kind, file_path, "go",
                            ));
                        }
                    }
                }
            }
            _ => {}
        }
    }
}

// ── Java ──────────────────────────────────────────────────────────────────────

fn extract_java(
    source: &[u8],
    node: tree_sitter::Node,
    file_path: &str,
    symbols: &mut Vec<CodeSymbol>,
) {
    extract_java_scope(source, node, file_path, None, symbols);
}

fn extract_java_scope(
    source: &[u8],
    node: tree_sitter::Node,
    file_path: &str,
    class_prefix: Option<&str>,
    symbols: &mut Vec<CodeSymbol>,
) {
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        match child.kind() {
            "class_declaration" | "record_declaration" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(class_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Class,
                        file_path,
                        "java",
                    ));
                    // Recurse into class body for methods
                    if let Some(body) = child.child_by_field_name("body") {
                        let class_name = qualify(class_prefix, node_text(&n, source));
                        extract_java_scope(source, body, file_path, Some(&class_name), symbols);
                    }
                }
            }
            "interface_declaration" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(class_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Interface,
                        file_path,
                        "java",
                    ));
                }
            }
            "enum_declaration" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(class_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Enum,
                        file_path,
                        "java",
                    ));
                }
            }
            "annotation_type_declaration" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(class_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Interface,
                        file_path,
                        "java",
                    ));
                }
            }
            "method_declaration" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(class_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Method,
                        file_path,
                        "java",
                    ));
                }
            }
            "constructor_declaration" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(class_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Function,
                        file_path,
                        "java",
                    ));
                }
            }
            _ => {}
        }
    }
}

// ── C# ────────────────────────────────────────────────────────────────────────

fn extract_csharp(
    source: &[u8],
    node: tree_sitter::Node,
    file_path: &str,
    symbols: &mut Vec<CodeSymbol>,
) {
    extract_csharp_scope(source, node, file_path, None, symbols);
}

fn extract_csharp_scope(
    source: &[u8],
    node: tree_sitter::Node,
    file_path: &str,
    ns_prefix: Option<&str>,
    symbols: &mut Vec<CodeSymbol>,
) {
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        match child.kind() {
            "namespace_declaration" | "file_scoped_namespace_declaration" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let ns_name = node_text(&n, source);
                    let qualified = qualify(ns_prefix, ns_name);
                    if let Some(body) = child.child_by_field_name("body") {
                        extract_csharp_scope(source, body, file_path, Some(&qualified), symbols);
                    } else {
                        // file-scoped namespace: rest of children are the body
                        extract_csharp_scope(source, child, file_path, Some(&qualified), symbols);
                    }
                }
            }
            "class_declaration" | "record_declaration" | "struct_declaration" => {
                let kind = if child.kind() == "struct_declaration" {
                    SymbolKind::Struct
                } else {
                    SymbolKind::Class
                };
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(ns_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child, source, &name, kind, file_path, "csharp",
                    ));
                    // Recurse for nested methods
                    if let Some(body) = child.child_by_field_name("body") {
                        let class_name = qualify(ns_prefix, node_text(&n, source));
                        extract_csharp_scope(source, body, file_path, Some(&class_name), symbols);
                    }
                }
            }
            "interface_declaration" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(ns_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Interface,
                        file_path,
                        "csharp",
                    ));
                }
            }
            "enum_declaration" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(ns_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Enum,
                        file_path,
                        "csharp",
                    ));
                }
            }
            "method_declaration" | "local_function_statement" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(ns_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Method,
                        file_path,
                        "csharp",
                    ));
                }
            }
            "constructor_declaration" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(ns_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Function,
                        file_path,
                        "csharp",
                    ));
                }
            }
            _ => {}
        }
    }
}

// ── Ruby ──────────────────────────────────────────────────────────────────────

fn extract_ruby(
    source: &[u8],
    node: tree_sitter::Node,
    file_path: &str,
    symbols: &mut Vec<CodeSymbol>,
) {
    extract_ruby_scope(source, node, file_path, None, symbols);
}

fn extract_ruby_scope(
    source: &[u8],
    node: tree_sitter::Node,
    file_path: &str,
    class_prefix: Option<&str>,
    symbols: &mut Vec<CodeSymbol>,
) {
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        match child.kind() {
            "class" | "singleton_class" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(class_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Class,
                        file_path,
                        "ruby",
                    ));
                    if let Some(body) = child.child_by_field_name("body") {
                        let class_name = qualify(class_prefix, node_text(&n, source));
                        extract_ruby_scope(source, body, file_path, Some(&class_name), symbols);
                    }
                }
            }
            "module" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(class_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Module,
                        file_path,
                        "ruby",
                    ));
                    if let Some(body) = child.child_by_field_name("body") {
                        let mod_name = qualify(class_prefix, node_text(&n, source));
                        extract_ruby_scope(source, body, file_path, Some(&mod_name), symbols);
                    }
                }
            }
            "method" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(class_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Method,
                        file_path,
                        "ruby",
                    ));
                }
            }
            "singleton_method" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(class_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Method,
                        file_path,
                        "ruby",
                    ));
                }
            }
            _ => {}
        }
    }
}

// ── C ─────────────────────────────────────────────────────────────────────────

/// Walk declarator chain to find the innermost function/identifier name.
fn c_declarator_name<'a>(node: tree_sitter::Node<'a>, source: &'a [u8]) -> Option<&'a str> {
    match node.kind() {
        "identifier" | "field_identifier" | "type_identifier" => Some(node_text(&node, source)),
        "function_declarator"
        | "pointer_declarator"
        | "reference_declarator"
        | "abstract_declarator"
        | "abstract_function_declarator"
        | "qualified_identifier" => node
            .child_by_field_name("declarator")
            .and_then(|d| c_declarator_name(d, source)),
        _ => None,
    }
}

fn extract_c(
    source: &[u8],
    node: tree_sitter::Node,
    file_path: &str,
    symbols: &mut Vec<CodeSymbol>,
) {
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        match child.kind() {
            "function_definition" => {
                if let Some(decl) = child.child_by_field_name("declarator") {
                    if let Some(name) = c_declarator_name(decl, source) {
                        symbols.push(make_symbol(
                            &child,
                            source,
                            name,
                            SymbolKind::Function,
                            file_path,
                            "c",
                        ));
                    }
                }
            }
            "declaration" => {
                // struct Foo { ... }; and enum Bar { ... }; are declarations in C,
                // with the struct/enum specifier as the `type` field child.
                let mut dc = child.walk();
                for decl_child in child.children(&mut dc) {
                    match decl_child.kind() {
                        "struct_specifier" | "union_specifier" => {
                            if let Some(n) = decl_child.child_by_field_name("name") {
                                if decl_child.child_by_field_name("body").is_some() {
                                    let name = node_text(&n, source);
                                    symbols.push(make_symbol(
                                        &decl_child,
                                        source,
                                        name,
                                        SymbolKind::Struct,
                                        file_path,
                                        "c",
                                    ));
                                }
                            }
                        }
                        "enum_specifier" => {
                            if let Some(n) = decl_child.child_by_field_name("name") {
                                if decl_child.child_by_field_name("body").is_some() {
                                    let name = node_text(&n, source);
                                    symbols.push(make_symbol(
                                        &decl_child,
                                        source,
                                        name,
                                        SymbolKind::Enum,
                                        file_path,
                                        "c",
                                    ));
                                }
                            }
                        }
                        "type_identifier" => {
                            // typedef struct { ... } TypeName; — the TypeName is the last declarator
                            if child
                                .child_by_field_name("type")
                                .map(|t| {
                                    matches!(
                                        t.kind(),
                                        "struct_specifier" | "union_specifier" | "enum_specifier"
                                    )
                                })
                                .unwrap_or(false)
                            {
                                let name = node_text(&decl_child, source);
                                symbols.push(make_symbol(
                                    &child,
                                    source,
                                    name,
                                    SymbolKind::Type,
                                    file_path,
                                    "c",
                                ));
                            }
                        }
                        _ => {}
                    }
                }
            }
            _ => {}
        }
    }
}

// ── C++ ───────────────────────────────────────────────────────────────────────

fn extract_cpp(
    source: &[u8],
    node: tree_sitter::Node,
    file_path: &str,
    symbols: &mut Vec<CodeSymbol>,
) {
    extract_cpp_scope(source, node, file_path, None, symbols);
}

fn extract_cpp_scope(
    source: &[u8],
    node: tree_sitter::Node,
    file_path: &str,
    ns_prefix: Option<&str>,
    symbols: &mut Vec<CodeSymbol>,
) {
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        match child.kind() {
            "namespace_definition" => {
                let ns_name = child
                    .child_by_field_name("name")
                    .map(|n| node_text(&n, source))
                    .unwrap_or("anonymous");
                let qualified = qualify(ns_prefix, ns_name);
                if let Some(body) = child.child_by_field_name("body") {
                    extract_cpp_scope(source, body, file_path, Some(&qualified), symbols);
                }
            }
            "class_specifier" | "struct_specifier" => {
                let kind = if child.kind() == "struct_specifier" {
                    SymbolKind::Struct
                } else {
                    SymbolKind::Class
                };
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(ns_prefix, node_text(&n, source));
                    symbols.push(make_symbol(&child, source, &name, kind, file_path, "cpp"));
                    if let Some(body) = child.child_by_field_name("body") {
                        let class_name = qualify(ns_prefix, node_text(&n, source));
                        extract_cpp_scope(source, body, file_path, Some(&class_name), symbols);
                    }
                }
            }
            "function_definition" => {
                if let Some(decl) = child.child_by_field_name("declarator") {
                    if let Some(name) = c_declarator_name(decl, source) {
                        let full = qualify(ns_prefix, name);
                        let kind = if ns_prefix.is_some() {
                            SymbolKind::Method
                        } else {
                            SymbolKind::Function
                        };
                        symbols.push(make_symbol(&child, source, &full, kind, file_path, "cpp"));
                    }
                }
            }
            "enum_specifier" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(ns_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Enum,
                        file_path,
                        "cpp",
                    ));
                }
            }
            "type_alias_declaration" | "alias_declaration" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(ns_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Type,
                        file_path,
                        "cpp",
                    ));
                }
            }
            _ => {}
        }
    }
}

// ── PHP ───────────────────────────────────────────────────────────────────────

fn extract_php(
    source: &[u8],
    node: tree_sitter::Node,
    file_path: &str,
    symbols: &mut Vec<CodeSymbol>,
) {
    extract_php_scope(source, node, file_path, None, symbols);
}

fn extract_php_scope(
    source: &[u8],
    node: tree_sitter::Node,
    file_path: &str,
    class_prefix: Option<&str>,
    symbols: &mut Vec<CodeSymbol>,
) {
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        match child.kind() {
            "function_definition" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(class_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Function,
                        file_path,
                        "php",
                    ));
                }
            }
            "class_declaration" | "abstract_class_declaration" | "final_class_declaration" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(class_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Class,
                        file_path,
                        "php",
                    ));
                    if let Some(body) = child.child_by_field_name("body") {
                        let class_name = qualify(class_prefix, node_text(&n, source));
                        extract_php_scope(source, body, file_path, Some(&class_name), symbols);
                    }
                }
            }
            "interface_declaration" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(class_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Interface,
                        file_path,
                        "php",
                    ));
                }
            }
            "trait_declaration" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(class_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Trait,
                        file_path,
                        "php",
                    ));
                }
            }
            "method_declaration" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(class_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Method,
                        file_path,
                        "php",
                    ));
                }
            }
            "enum_declaration" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(class_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Enum,
                        file_path,
                        "php",
                    ));
                }
            }
            // PHP wraps content in several container nodes — recurse into them
            "program" | "php_text" | "compound_statement" | "namespace_definition" => {
                // For namespace_definition, try body field first, then fall through to children
                let target = child.child_by_field_name("body").unwrap_or(child);
                extract_php_scope(source, target, file_path, class_prefix, symbols);
            }
            _ => {}
        }
    }
}

// ── Scala ─────────────────────────────────────────────────────────────────────

fn extract_scala(
    source: &[u8],
    node: tree_sitter::Node,
    file_path: &str,
    symbols: &mut Vec<CodeSymbol>,
) {
    extract_scala_scope(source, node, file_path, None, symbols);
}

fn extract_scala_scope(
    source: &[u8],
    node: tree_sitter::Node,
    file_path: &str,
    ns_prefix: Option<&str>,
    symbols: &mut Vec<CodeSymbol>,
) {
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        match child.kind() {
            "class_definition" | "case_class_definition" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(ns_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Class,
                        file_path,
                        "scala",
                    ));
                    if let Some(body) = child.child_by_field_name("body") {
                        let class_name = qualify(ns_prefix, node_text(&n, source));
                        extract_scala_scope(source, body, file_path, Some(&class_name), symbols);
                    }
                }
            }
            "object_definition" | "case_object_definition" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(ns_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Module,
                        file_path,
                        "scala",
                    ));
                    if let Some(body) = child.child_by_field_name("body") {
                        let obj_name = qualify(ns_prefix, node_text(&n, source));
                        extract_scala_scope(source, body, file_path, Some(&obj_name), symbols);
                    }
                }
            }
            "trait_definition" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(ns_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Trait,
                        file_path,
                        "scala",
                    ));
                }
            }
            "function_definition" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(ns_prefix, node_text(&n, source));
                    let kind = if ns_prefix.is_some() {
                        SymbolKind::Method
                    } else {
                        SymbolKind::Function
                    };
                    symbols.push(make_symbol(&child, source, &name, kind, file_path, "scala"));
                }
            }
            "val_definition" | "var_definition" => {
                if let Some(n) = child.child_by_field_name("pattern") {
                    let name = qualify(ns_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Variable,
                        file_path,
                        "scala",
                    ));
                }
            }
            "type_definition" => {
                if let Some(n) = child.child_by_field_name("name") {
                    let name = qualify(ns_prefix, node_text(&n, source));
                    symbols.push(make_symbol(
                        &child,
                        source,
                        &name,
                        SymbolKind::Type,
                        file_path,
                        "scala",
                    ));
                }
            }
            _ => {}
        }
    }
}

// ── Fallback: line chunks ─────────────────────────────────────────────────────

/// Split file into overlapping 50-line chunks when tree-sitter parse fails
/// or yields no symbols.
pub fn chunk_by_lines(file_path: &str, source: &[u8], lang_name: &str) -> Vec<CodeSymbol> {
    let text = match std::str::from_utf8(source) {
        Ok(t) => t,
        Err(_) => return vec![],
    };
    let lines: Vec<&str> = text.lines().collect();
    let total = lines.len();
    if total == 0 {
        return vec![];
    }

    const CHUNK_SIZE: usize = 50;
    const OVERLAP: usize = 10;

    let mut symbols = Vec::new();
    let mut start = 0;

    loop {
        let end = (start + CHUNK_SIZE).min(total);
        let content = lines[start..end].join("\n");
        symbols.push(CodeSymbol {
            file_path: file_path.to_string(),
            line_start: start + 1,
            line_end: end,
            name: format!("lines {}-{}", start + 1, end),
            kind: SymbolKind::Chunk,
            content: content[..content.len().min(MAX_CONTENT_BYTES)].to_string(),
            language: lang_name.to_string(),
        });
        if end >= total {
            break;
        }
        start = end.saturating_sub(OVERLAP);
    }
    symbols
}
