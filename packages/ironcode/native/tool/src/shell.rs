use rust_rule_engine::rete::{FactValue, GrlReteLoader, IncrementalEngine, TypedFacts};
use serde::{Deserialize, Serialize};
use tree_sitter::Parser;

#[derive(Debug, Serialize, Deserialize)]
pub struct BashParseResult {
    pub directories: Vec<String>,
    pub patterns: Vec<String>,
    pub always: Vec<String>,
}

// ---------------------------------------------------------------------------
// BashArity via rust-rule-engine (GRL)
//
// Mirrors `BashArity.prefix()` from `permission/arity.ts`.
// Uses flat fact keys (token0, token1, arity) — rust-rule-engine uses flat
// key names, not Object.field notation.
// Salience controls priority: salience 20 (two-token) beats salience 10 (one-token).
// ---------------------------------------------------------------------------
const ARITY_GRL: &str = r#"
// ── Arity 1: single-token commands ─────────────────────────────────────────
rule "cat"     salience 10 no-loop { when Command.token0 == "cat"     then Command.arity = 1; }
rule "cd"      salience 10 no-loop { when Command.token0 == "cd"      then Command.arity = 1; }
rule "chmod"   salience 10 no-loop { when Command.token0 == "chmod"   then Command.arity = 1; }
rule "chown"   salience 10 no-loop { when Command.token0 == "chown"   then Command.arity = 1; }
rule "cp"      salience 10 no-loop { when Command.token0 == "cp"      then Command.arity = 1; }
rule "echo"    salience 10 no-loop { when Command.token0 == "echo"    then Command.arity = 1; }
rule "env"     salience 10 no-loop { when Command.token0 == "env"     then Command.arity = 1; }
rule "export"  salience 10 no-loop { when Command.token0 == "export"  then Command.arity = 1; }
rule "grep"    salience 10 no-loop { when Command.token0 == "grep"    then Command.arity = 1; }
rule "kill"    salience 10 no-loop { when Command.token0 == "kill"    then Command.arity = 1; }
rule "killall" salience 10 no-loop { when Command.token0 == "killall" then Command.arity = 1; }
rule "ln"      salience 10 no-loop { when Command.token0 == "ln"      then Command.arity = 1; }
rule "ls"      salience 10 no-loop { when Command.token0 == "ls"      then Command.arity = 1; }
rule "mkdir"   salience 10 no-loop { when Command.token0 == "mkdir"   then Command.arity = 1; }
rule "mv"      salience 10 no-loop { when Command.token0 == "mv"      then Command.arity = 1; }
rule "ps"      salience 10 no-loop { when Command.token0 == "ps"      then Command.arity = 1; }
rule "pwd"     salience 10 no-loop { when Command.token0 == "pwd"     then Command.arity = 1; }
rule "rm"      salience 10 no-loop { when Command.token0 == "rm"      then Command.arity = 1; }
rule "rmdir"   salience 10 no-loop { when Command.token0 == "rmdir"   then Command.arity = 1; }
rule "sleep"   salience 10 no-loop { when Command.token0 == "sleep"   then Command.arity = 1; }
rule "source"  salience 10 no-loop { when Command.token0 == "source"  then Command.arity = 1; }
rule "tail"    salience 10 no-loop { when Command.token0 == "tail"    then Command.arity = 1; }
rule "touch"   salience 10 no-loop { when Command.token0 == "touch"   then Command.arity = 1; }
rule "unset"   salience 10 no-loop { when Command.token0 == "unset"   then Command.arity = 1; }
rule "which"   salience 10 no-loop { when Command.token0 == "which"   then Command.arity = 1; }

// ── Arity 2: two-token commands (return 2 tokens) ──────────────────────────
rule "bazel"      salience 10 no-loop { when Command.token0 == "bazel"      then Command.arity = 2; }
rule "brew"       salience 10 no-loop { when Command.token0 == "brew"       then Command.arity = 2; }
rule "bun"        salience 10 no-loop { when Command.token0 == "bun"        then Command.arity = 2; }
rule "cargo"      salience 10 no-loop { when Command.token0 == "cargo"      then Command.arity = 2; }
rule "cdk"        salience 10 no-loop { when Command.token0 == "cdk"        then Command.arity = 2; }
rule "cf"         salience 10 no-loop { when Command.token0 == "cf"         then Command.arity = 2; }
rule "cmake"      salience 10 no-loop { when Command.token0 == "cmake"      then Command.arity = 2; }
rule "composer"   salience 10 no-loop { when Command.token0 == "composer"   then Command.arity = 2; }
rule "consul"     salience 10 no-loop { when Command.token0 == "consul"     then Command.arity = 2; }
rule "crictl"     salience 10 no-loop { when Command.token0 == "crictl"     then Command.arity = 2; }
rule "deno"       salience 10 no-loop { when Command.token0 == "deno"       then Command.arity = 2; }
rule "docker"     salience 10 no-loop { when Command.token0 == "docker"     then Command.arity = 2; }
rule "eksctl"     salience 10 no-loop { when Command.token0 == "eksctl"     then Command.arity = 2; }
rule "firebase"   salience 10 no-loop { when Command.token0 == "firebase"   then Command.arity = 2; }
rule "flyctl"     salience 10 no-loop { when Command.token0 == "flyctl"     then Command.arity = 2; }
rule "git"        salience 10 no-loop { when Command.token0 == "git"        then Command.arity = 2; }
rule "go"         salience 10 no-loop { when Command.token0 == "go"         then Command.arity = 2; }
rule "gradle"     salience 10 no-loop { when Command.token0 == "gradle"     then Command.arity = 2; }
rule "helm"       salience 10 no-loop { when Command.token0 == "helm"       then Command.arity = 2; }
rule "heroku"     salience 10 no-loop { when Command.token0 == "heroku"     then Command.arity = 2; }
rule "hugo"       salience 10 no-loop { when Command.token0 == "hugo"       then Command.arity = 2; }
rule "ip"         salience 10 no-loop { when Command.token0 == "ip"         then Command.arity = 2; }
rule "kind"       salience 10 no-loop { when Command.token0 == "kind"       then Command.arity = 2; }
rule "kubectl"    salience 10 no-loop { when Command.token0 == "kubectl"    then Command.arity = 2; }
rule "kustomize"  salience 10 no-loop { when Command.token0 == "kustomize"  then Command.arity = 2; }
rule "make"       salience 10 no-loop { when Command.token0 == "make"       then Command.arity = 2; }
rule "mc"         salience 10 no-loop { when Command.token0 == "mc"         then Command.arity = 2; }
rule "minikube"   salience 10 no-loop { when Command.token0 == "minikube"   then Command.arity = 2; }
rule "mongosh"    salience 10 no-loop { when Command.token0 == "mongosh"    then Command.arity = 2; }
rule "mysql"      salience 10 no-loop { when Command.token0 == "mysql"      then Command.arity = 2; }
rule "mvn"        salience 10 no-loop { when Command.token0 == "mvn"        then Command.arity = 2; }
rule "ng"         salience 10 no-loop { when Command.token0 == "ng"         then Command.arity = 2; }
rule "npm"        salience 10 no-loop { when Command.token0 == "npm"        then Command.arity = 2; }
rule "nvm"        salience 10 no-loop { when Command.token0 == "nvm"        then Command.arity = 2; }
rule "nx"         salience 10 no-loop { when Command.token0 == "nx"         then Command.arity = 2; }
rule "openssl"    salience 10 no-loop { when Command.token0 == "openssl"    then Command.arity = 2; }
rule "pip"        salience 10 no-loop { when Command.token0 == "pip"        then Command.arity = 2; }
rule "pipenv"     salience 10 no-loop { when Command.token0 == "pipenv"     then Command.arity = 2; }
rule "pnpm"       salience 10 no-loop { when Command.token0 == "pnpm"       then Command.arity = 2; }
rule "poetry"     salience 10 no-loop { when Command.token0 == "poetry"     then Command.arity = 2; }
rule "podman"     salience 10 no-loop { when Command.token0 == "podman"     then Command.arity = 2; }
rule "psql"       salience 10 no-loop { when Command.token0 == "psql"       then Command.arity = 2; }
rule "pulumi"     salience 10 no-loop { when Command.token0 == "pulumi"     then Command.arity = 2; }
rule "pyenv"      salience 10 no-loop { when Command.token0 == "pyenv"      then Command.arity = 2; }
rule "python"     salience 10 no-loop { when Command.token0 == "python"     then Command.arity = 2; }
rule "rake"       salience 10 no-loop { when Command.token0 == "rake"       then Command.arity = 2; }
rule "rbenv"      salience 10 no-loop { when Command.token0 == "rbenv"      then Command.arity = 2; }
rule "redis_cli"  salience 10 no-loop { when Command.token0 == "redis-cli"  then Command.arity = 2; }
rule "rustup"     salience 10 no-loop { when Command.token0 == "rustup"     then Command.arity = 2; }
rule "serverless" salience 10 no-loop { when Command.token0 == "serverless" then Command.arity = 2; }
rule "skaffold"   salience 10 no-loop { when Command.token0 == "skaffold"   then Command.arity = 2; }
rule "sls"        salience 10 no-loop { when Command.token0 == "sls"        then Command.arity = 2; }
rule "sst"        salience 10 no-loop { when Command.token0 == "sst"        then Command.arity = 2; }
rule "swift"      salience 10 no-loop { when Command.token0 == "swift"      then Command.arity = 2; }
rule "systemctl"  salience 10 no-loop { when Command.token0 == "systemctl"  then Command.arity = 2; }
rule "terraform"  salience 10 no-loop { when Command.token0 == "terraform"  then Command.arity = 2; }
rule "tmux"       salience 10 no-loop { when Command.token0 == "tmux"       then Command.arity = 2; }
rule "turbo"      salience 10 no-loop { when Command.token0 == "turbo"      then Command.arity = 2; }
rule "ufw"        salience 10 no-loop { when Command.token0 == "ufw"        then Command.arity = 2; }
rule "vault"      salience 10 no-loop { when Command.token0 == "vault"      then Command.arity = 2; }
rule "vercel"     salience 10 no-loop { when Command.token0 == "vercel"     then Command.arity = 2; }
rule "volta"      salience 10 no-loop { when Command.token0 == "volta"      then Command.arity = 2; }
rule "wp"         salience 10 no-loop { when Command.token0 == "wp"         then Command.arity = 2; }
rule "yarn"       salience 10 no-loop { when Command.token0 == "yarn"       then Command.arity = 2; }

// ── Arity 3: token0-only (return 3 tokens) ─────────────────────────────────
rule "aws"    salience 10 no-loop { when Command.token0 == "aws"    then Command.arity = 3; }
rule "az"     salience 10 no-loop { when Command.token0 == "az"     then Command.arity = 3; }
rule "doctl"  salience 10 no-loop { when Command.token0 == "doctl"  then Command.arity = 3; }
rule "gcloud" salience 10 no-loop { when Command.token0 == "gcloud" then Command.arity = 3; }
rule "gh"     salience 10 no-loop { when Command.token0 == "gh"     then Command.arity = 3; }
rule "sfdx"   salience 10 no-loop { when Command.token0 == "sfdx"   then Command.arity = 3; }

// ── Arity 3: token0+token1 overrides (salience 20 > token0-only salience 10) ─
rule "bun_run"             salience 20 no-loop { when Command.token0 == "bun"       && Command.token1 == "run"       then Command.arity = 3; }
rule "bun_x"               salience 20 no-loop { when Command.token0 == "bun"       && Command.token1 == "x"         then Command.arity = 3; }
rule "cargo_add"           salience 20 no-loop { when Command.token0 == "cargo"     && Command.token1 == "add"       then Command.arity = 3; }
rule "cargo_run"           salience 20 no-loop { when Command.token0 == "cargo"     && Command.token1 == "run"       then Command.arity = 3; }
rule "consul_kv"           salience 20 no-loop { when Command.token0 == "consul"    && Command.token1 == "kv"        then Command.arity = 3; }
rule "deno_task"           salience 20 no-loop { when Command.token0 == "deno"      && Command.token1 == "task"      then Command.arity = 3; }
rule "docker_builder"      salience 20 no-loop { when Command.token0 == "docker"    && Command.token1 == "builder"   then Command.arity = 3; }
rule "docker_compose"      salience 20 no-loop { when Command.token0 == "docker"    && Command.token1 == "compose"   then Command.arity = 3; }
rule "docker_container"    salience 20 no-loop { when Command.token0 == "docker"    && Command.token1 == "container" then Command.arity = 3; }
rule "docker_image"        salience 20 no-loop { when Command.token0 == "docker"    && Command.token1 == "image"     then Command.arity = 3; }
rule "docker_network"      salience 20 no-loop { when Command.token0 == "docker"    && Command.token1 == "network"   then Command.arity = 3; }
rule "docker_volume"       salience 20 no-loop { when Command.token0 == "docker"    && Command.token1 == "volume"    then Command.arity = 3; }
rule "eksctl_create"       salience 20 no-loop { when Command.token0 == "eksctl"    && Command.token1 == "create"    then Command.arity = 3; }
rule "git_config"          salience 20 no-loop { when Command.token0 == "git"       && Command.token1 == "config"    then Command.arity = 3; }
rule "git_remote"          salience 20 no-loop { when Command.token0 == "git"       && Command.token1 == "remote"    then Command.arity = 3; }
rule "git_stash"           salience 20 no-loop { when Command.token0 == "git"       && Command.token1 == "stash"     then Command.arity = 3; }
rule "ip_addr"             salience 20 no-loop { when Command.token0 == "ip"        && Command.token1 == "addr"      then Command.arity = 3; }
rule "ip_link"             salience 20 no-loop { when Command.token0 == "ip"        && Command.token1 == "link"      then Command.arity = 3; }
rule "ip_netns"            salience 20 no-loop { when Command.token0 == "ip"        && Command.token1 == "netns"     then Command.arity = 3; }
rule "ip_route"            salience 20 no-loop { when Command.token0 == "ip"        && Command.token1 == "route"     then Command.arity = 3; }
rule "kind_create"         salience 20 no-loop { when Command.token0 == "kind"      && Command.token1 == "create"    then Command.arity = 3; }
rule "kubectl_kustomize"   salience 20 no-loop { when Command.token0 == "kubectl"   && Command.token1 == "kustomize" then Command.arity = 3; }
rule "kubectl_rollout"     salience 20 no-loop { when Command.token0 == "kubectl"   && Command.token1 == "rollout"   then Command.arity = 3; }
rule "mc_admin"            salience 20 no-loop { when Command.token0 == "mc"        && Command.token1 == "admin"     then Command.arity = 3; }
rule "npm_exec"            salience 20 no-loop { when Command.token0 == "npm"       && Command.token1 == "exec"      then Command.arity = 3; }
rule "npm_init"            salience 20 no-loop { when Command.token0 == "npm"       && Command.token1 == "init"      then Command.arity = 3; }
rule "npm_run"             salience 20 no-loop { when Command.token0 == "npm"       && Command.token1 == "run"       then Command.arity = 3; }
rule "npm_view"            salience 20 no-loop { when Command.token0 == "npm"       && Command.token1 == "view"      then Command.arity = 3; }
rule "openssl_req"         salience 20 no-loop { when Command.token0 == "openssl"   && Command.token1 == "req"       then Command.arity = 3; }
rule "openssl_x509"        salience 20 no-loop { when Command.token0 == "openssl"   && Command.token1 == "x509"      then Command.arity = 3; }
rule "pnpm_dlx"            salience 20 no-loop { when Command.token0 == "pnpm"      && Command.token1 == "dlx"       then Command.arity = 3; }
rule "pnpm_exec"           salience 20 no-loop { when Command.token0 == "pnpm"      && Command.token1 == "exec"      then Command.arity = 3; }
rule "pnpm_run"            salience 20 no-loop { when Command.token0 == "pnpm"      && Command.token1 == "run"       then Command.arity = 3; }
rule "podman_container"    salience 20 no-loop { when Command.token0 == "podman"    && Command.token1 == "container" then Command.arity = 3; }
rule "podman_image"        salience 20 no-loop { when Command.token0 == "podman"    && Command.token1 == "image"     then Command.arity = 3; }
rule "pulumi_stack"        salience 20 no-loop { when Command.token0 == "pulumi"    && Command.token1 == "stack"     then Command.arity = 3; }
rule "terraform_workspace" salience 20 no-loop { when Command.token0 == "terraform" && Command.token1 == "workspace" then Command.arity = 3; }
rule "vault_auth"          salience 20 no-loop { when Command.token0 == "vault"     && Command.token1 == "auth"      then Command.arity = 3; }
rule "vault_kv"            salience 20 no-loop { when Command.token0 == "vault"     && Command.token1 == "kv"        then Command.arity = 3; }
rule "yarn_dlx"            salience 20 no-loop { when Command.token0 == "yarn"      && Command.token1 == "dlx"       then Command.arity = 3; }
rule "yarn_run"            salience 20 no-loop { when Command.token0 == "yarn"      && Command.token1 == "run"       then Command.arity = 3; }
"#;

fn rule_name_to_arity(name: &str) -> usize {
    match name {
        "cat" | "cd" | "chmod" | "chown" | "cp" | "echo" | "env" | "export" | "grep"
        | "kill" | "killall" | "ln" | "ls" | "mkdir" | "mv" | "ps" | "pwd" | "rm" | "rmdir"
        | "sleep" | "source" | "tail" | "touch" | "unset" | "which" => 1,
        "bazel" | "brew" | "bun" | "cargo" | "cdk" | "cf" | "cmake" | "composer" | "consul"
        | "crictl" | "deno" | "docker" | "eksctl" | "firebase" | "flyctl" | "git" | "go"
        | "gradle" | "helm" | "heroku" | "hugo" | "ip" | "kind" | "kubectl" | "kustomize"
        | "make" | "mc" | "minikube" | "mongosh" | "mysql" | "mvn" | "ng" | "npm" | "nvm"
        | "nx" | "openssl" | "pip" | "pipenv" | "pnpm" | "poetry" | "podman" | "psql"
        | "pulumi" | "pyenv" | "python" | "rake" | "rbenv" | "redis_cli" | "rustup"
        | "serverless" | "skaffold" | "sls" | "sst" | "swift" | "systemctl" | "terraform" | "tmux"
        | "turbo" | "ufw" | "vault" | "vercel" | "volta" | "wp" | "yarn" => 2,
        "aws" | "az" | "doctl" | "gcloud" | "gh" | "sfdx" | "bun_run" | "bun_x"
        | "cargo_add" | "cargo_run" | "consul_kv" | "deno_task" | "docker_builder"
        | "docker_compose" | "docker_container" | "docker_image" | "docker_network"
        | "docker_volume" | "eksctl_create" | "git_config" | "git_remote" | "git_stash"
        | "ip_addr" | "ip_link" | "ip_netns" | "ip_route" | "kind_create"
        | "kubectl_kustomize" | "kubectl_rollout" | "mc_admin" | "npm_exec" | "npm_init"
        | "npm_run" | "npm_view" | "openssl_req" | "openssl_x509" | "pnpm_dlx" | "pnpm_exec"
        | "pnpm_run" | "podman_container" | "podman_image" | "pulumi_stack"
        | "terraform_workspace" | "vault_auth" | "vault_kv" | "yarn_dlx" | "yarn_run" => 3,
        _ => 1,
    }
}

/// Determine the human-readable command prefix using rust-rule-engine (RETE).
///
/// All matching rules fire (no arity guard, no-loop prevents re-firing).
/// Taking the max arity from all fired rule names gives the most specific match —
/// a two-token override rule (salience 20, arity 3) beats the base single-token
/// rule (salience 10, arity 2) for the same command.
pub fn extract_command_prefix(parts: &[String]) -> String {
    if parts.is_empty() {
        return String::new();
    }

    let mut engine = IncrementalEngine::new();
    if GrlReteLoader::load_from_string(ARITY_GRL, &mut engine).is_err() {
        return parts[0].clone();
    }

    let mut cmd_facts = TypedFacts::new();
    cmd_facts.set("token0", FactValue::String(parts[0].clone()));
    cmd_facts.set(
        "token1",
        FactValue::String(parts.get(1).cloned().unwrap_or_default()),
    );
    engine.insert("Command".to_string(), cmd_facts);

    let fired = engine.fire_all();
    // Both the single-token base rule and any two-token override rule fire when they
    // match (no arity guard). Taking max arity across all fired rule names ensures
    // the most specific (longest-prefix) rule wins.
    let arity = fired
        .iter()
        .map(|n| rule_name_to_arity(n.as_str()))
        .max()
        .unwrap_or(1);

    parts[..arity.min(parts.len())].join(" ")
}

// ---------------------------------------------------------------------------
// Bash command parser (tree-sitter)
// ---------------------------------------------------------------------------

/// Parse a bash command and extract directories, command patterns, and
/// always-allow patterns.  Replaces the WASM tree-sitter parsing in `bash.ts`.
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

    let mut cursor = root_node.walk();
    walk_tree(&mut cursor, command.as_bytes(), &mut |node| {
        if node.kind() == "command" {
            let command_text = if let Some(parent) = node.parent() {
                if parent.kind() == "redirected_statement" {
                    parent.utf8_text(command.as_bytes()).unwrap_or("")
                } else {
                    node.utf8_text(command.as_bytes()).unwrap_or("")
                }
            } else {
                node.utf8_text(command.as_bytes()).unwrap_or("")
            };

            let mut command_parts = Vec::new();
            for i in 0..node.child_count() {
                if let Some(child) = node.child(i) {
                    let kind = child.kind();
                    if kind == "command_name"
                        || kind == "word"
                        || kind == "string"
                        || kind == "raw_string"
                        || kind == "concatenation"
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

            let fs_commands = [
                "cd", "rm", "cp", "mv", "mkdir", "touch", "chmod", "chown", "cat",
            ];
            if fs_commands.contains(&command_name.as_str()) {
                for arg in &command_parts[1..] {
                    if arg.starts_with('-') || (command_name == "chmod" && arg.starts_with('+')) {
                        continue;
                    }
                    directories.push(arg.clone());
                }
            }

            if command_name != "cd" {
                patterns.push(command_text.to_string());
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

#[cfg(test)]
mod tests {
    use super::*;

    fn strs<const N: usize>(arr: [&str; N]) -> Vec<String> {
        arr.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn test_arity1_single_token() {
        assert_eq!(extract_command_prefix(&strs(["ls", "-la"])), "ls");
        assert_eq!(extract_command_prefix(&strs(["touch", "foo.txt"])), "touch");
        assert_eq!(
            extract_command_prefix(&strs(["unknown", "cmd", "sub"])),
            "unknown"
        );
    }

    #[test]
    fn test_arity2_two_tokens() {
        assert_eq!(
            extract_command_prefix(&strs(["git", "checkout", "main"])),
            "git checkout"
        );
        assert_eq!(
            extract_command_prefix(&strs(["docker", "run", "nginx"])),
            "docker run"
        );
        assert_eq!(
            extract_command_prefix(&strs(["git", "checkout"])),
            "git checkout"
        );
    }

    #[test]
    fn test_arity3_three_tokens() {
        assert_eq!(
            extract_command_prefix(&strs(["aws", "s3", "ls", "bucket"])),
            "aws s3 ls"
        );
        assert_eq!(
            extract_command_prefix(&strs(["npm", "run", "dev", "extra"])),
            "npm run dev"
        );
        assert_eq!(
            extract_command_prefix(&strs(["npm", "run", "dev"])),
            "npm run dev"
        );
    }

    #[test]
    fn test_longest_prefix_wins() {
        assert_eq!(
            extract_command_prefix(&strs(["docker", "compose", "up", "svc"])),
            "docker compose up"
        );
        assert_eq!(
            extract_command_prefix(&strs(["consul", "kv", "get", "cfg"])),
            "consul kv get"
        );
    }

    #[test]
    fn test_empty_returns_empty() {
        assert_eq!(extract_command_prefix(&[]), "");
    }

    #[test]
    fn test_parse_always_uses_rule_engine_prefix() {
        let result = parse_bash_command("git checkout main", "/tmp").unwrap();
        assert!(result.always.iter().any(|a| a == "git checkout *"));
    }

    #[test]
    fn test_parse_npm_run() {
        let result = parse_bash_command("npm run dev", "/tmp").unwrap();
        assert!(result.always.iter().any(|a| a == "npm run dev *"));
    }

    #[test]
    fn test_parse_simple_command() {
        let r = parse_bash_command("ls -la", "/tmp").unwrap();
        assert_eq!(r.patterns[0], "ls -la");
        assert!(r.always[0].starts_with("ls"));
    }

    #[test]
    fn test_empty_command() {
        assert!(parse_bash_command("", "/tmp").is_ok());
    }
}
