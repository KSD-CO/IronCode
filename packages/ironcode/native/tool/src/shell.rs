use serde::{Deserialize, Serialize};
use tree_sitter::Parser;

#[derive(Debug, Serialize, Deserialize)]
pub struct BashParseResult {
    pub directories: Vec<String>,
    pub patterns: Vec<String>,
    pub always: Vec<String>,
}

/// Parse a bash command and extract directories, command patterns, and always-allow patterns
/// This replaces the WASM tree-sitter parsing in bash.ts
pub fn parse_bash_command(command: &str, _cwd: &str) -> Result<BashParseResult, String> {
    let mut parser = Parser::new();
    let language = tree_sitter_bash::LANGUAGE;
    parser
        .set_language(&language.into())
        .map_err(|e| format!("Failed to set language: {}", e))?;

    let tree = parser
        .parse(command, None)
        .ok_or_else(|| "Failed to parse command".to_string())?;

    let root_node = tree.root_node();
    let mut directories = Vec::new();
    let mut patterns = Vec::new();
    let mut always = Vec::new();

    // Walk the tree and find all "command" nodes
    let mut cursor = root_node.walk();
    walk_tree(&mut cursor, command.as_bytes(), &mut |node| {
        if node.kind() == "command" {
            // Extract command text
            let command_text = if let Some(parent) = node.parent() {
                if parent.kind() == "redirected_statement" {
                    parent.utf8_text(command.as_bytes()).unwrap_or("")
                } else {
                    node.utf8_text(command.as_bytes()).unwrap_or("")
                }
            } else {
                node.utf8_text(command.as_bytes()).unwrap_or("")
            };

            // Extract command parts
            let mut command_parts = Vec::new();
            for i in 0..node.child_count() {
                if let Some(child) = node.child(i) {
                    let child_kind = child.kind();
                    if child_kind == "command_name"
                        || child_kind == "word"
                        || child_kind == "string"
                        || child_kind == "raw_string"
                        || child_kind == "concatenation"
                    {
                        if let Ok(text) = child.utf8_text(command.as_bytes()) {
                            command_parts.push(text.to_string());
                        }
                    }
                }
            }

            if command_parts.is_empty() {
                return;
            }

            let command_name = &command_parts[0];

            // Check for file-system commands that need directory tracking
            let fs_commands = [
                "cd", "rm", "cp", "mv", "mkdir", "touch", "chmod", "chown", "cat",
            ];
            if fs_commands.contains(&command_name.as_str()) {
                // Extract arguments (skip flags)
                for arg in &command_parts[1..] {
                    if arg.starts_with('-') || (command_name == "chmod" && arg.starts_with('+')) {
                        continue;
                    }
                    // In production, we'd resolve the path with realpath
                    // For now, we'll just add the arg as-is
                    // The TypeScript side can handle path resolution
                    directories.push(arg.clone());
                }
            }

            // Add command pattern (skip 'cd' for patterns)
            if !command_parts.is_empty() && command_name != "cd" {
                patterns.push(command_text.to_string());

                // Create "always" pattern with prefix + wildcard
                let prefix = extract_command_prefix(&command_parts);
                always.push(format!("{} *", prefix));
            }
        }
    });

    Ok(BashParseResult {
        directories,
        patterns,
        always,
    })
}

/// Helper function to walk the tree recursively
fn walk_tree<F>(cursor: &mut tree_sitter::TreeCursor, _source: &[u8], callback: &mut F)
where
    F: FnMut(tree_sitter::Node),
{
    callback(cursor.node());
    if cursor.goto_first_child() {
        loop {
            walk_tree(cursor, _source, callback);
            if !cursor.goto_next_sibling() {
                break;
            }
        }
        cursor.goto_parent();
    }
}

/// Extract command prefix (for "always" patterns)
/// This mimics BashArity.prefix() from TypeScript
fn extract_command_prefix(parts: &[String]) -> String {
    if parts.is_empty() {
        return String::new();
    }
    // For now, just return the command name
    // TODO: Implement full BashArity logic if needed
    parts[0].clone()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_command() {
        let result = parse_bash_command("ls -la", "/tmp").unwrap();
        assert!(!result.patterns.is_empty());
        assert_eq!(result.patterns[0], "ls -la");
    }

    #[test]
    fn test_parse_cd_command() {
        let result = parse_bash_command("cd /home/user", "/tmp").unwrap();
        assert!(!result.directories.is_empty());
        assert!(result.directories.contains(&"/home/user".to_string()));
    }

    #[test]
    fn test_parse_rm_command() {
        let result = parse_bash_command("rm -rf ./build", "/tmp").unwrap();
        assert!(!result.directories.is_empty());
        assert!(!result.patterns.is_empty());
    }

    #[test]
    fn test_parse_complex_command() {
        let result = parse_bash_command("mkdir test && cd test && touch file.txt", "/tmp").unwrap();
        assert!(!result.directories.is_empty());
        assert!(!result.patterns.is_empty());
    }

    #[test]
    fn test_empty_command() {
        let result = parse_bash_command("", "/tmp");
        assert!(result.is_ok());
    }
}
