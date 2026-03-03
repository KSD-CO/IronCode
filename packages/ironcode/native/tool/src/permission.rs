use crate::wildcard::wildcard_match;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PermissionRule {
    pub permission: String,
    pub pattern: String,
    pub action: String,
}

/// Mirrors `PermissionNext.evaluate()` from TypeScript.
///
/// Iterates rules in reverse (findLast semantics) and returns the last rule
/// where both permission and pattern match via wildcard. Falls back to
/// `{ action: "ask", permission, pattern: "*" }` if no rule matches.
pub fn evaluate_permission(
    permission: &str,
    pattern: &str,
    rules: &[PermissionRule],
) -> PermissionRule {
    rules
        .iter()
        .rev()
        .find(|r| {
            wildcard_match(permission, &r.permission) && wildcard_match(pattern, &r.pattern)
        })
        .cloned()
        .unwrap_or(PermissionRule {
            action: "ask".to_string(),
            permission: permission.to_string(),
            pattern: "*".to_string(),
        })
}

/// Mirrors `PermissionNext.disabled()` from TypeScript.
///
/// Returns the subset of `tools` that are denied by the ruleset —
/// i.e. the last matching rule for a tool has pattern `"*"` and action `"deny"`.
pub fn disabled_tools(tools: &[String], ruleset: &[PermissionRule]) -> Vec<String> {
    const EDIT_TOOLS: &[&str] = &["edit", "write", "patch", "multiedit"];
    tools
        .iter()
        .filter(|tool| {
            let perm = if EDIT_TOOLS.contains(&tool.as_str()) {
                "edit"
            } else {
                tool.as_str()
            };
            ruleset
                .iter()
                .rev()
                .find(|r| wildcard_match(perm, &r.permission))
                .is_some_and(|r| r.pattern == "*" && r.action == "deny")
        })
        .cloned()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rule(permission: &str, pattern: &str, action: &str) -> PermissionRule {
        PermissionRule {
            permission: permission.to_string(),
            pattern: pattern.to_string(),
            action: action.to_string(),
        }
    }

    #[test]
    fn test_evaluate_no_rules_returns_ask() {
        let r = evaluate_permission("bash", "ls -la", &[]);
        assert_eq!(r.action, "ask");
        assert_eq!(r.permission, "bash");
        assert_eq!(r.pattern, "*");
    }

    #[test]
    fn test_evaluate_exact_allow() {
        let rules = vec![rule("bash", "*", "allow")];
        let r = evaluate_permission("bash", "ls -la", &rules);
        assert_eq!(r.action, "allow");
    }

    #[test]
    fn test_evaluate_deny_overrides_allow() {
        let rules = vec![
            rule("bash", "*", "allow"),
            rule("bash", "rm *", "deny"),
        ];
        let r = evaluate_permission("bash", "rm /tmp/foo", &rules);
        assert_eq!(r.action, "deny");
    }

    #[test]
    fn test_evaluate_last_rule_wins() {
        // findLast: last matching rule takes priority
        let rules = vec![
            rule("bash", "*", "deny"),
            rule("bash", "ls *", "allow"),
        ];
        let r = evaluate_permission("bash", "ls -la", &rules);
        assert_eq!(r.action, "allow");
    }

    #[test]
    fn test_evaluate_wildcard_permission() {
        let rules = vec![rule("*", "*", "allow")];
        let r = evaluate_permission("edit", "/home/user/foo.ts", &rules);
        assert_eq!(r.action, "allow");
    }

    #[test]
    fn test_evaluate_no_match_specific_pattern() {
        let rules = vec![rule("bash", "git *", "allow")];
        let r = evaluate_permission("bash", "rm /tmp/foo", &rules);
        // "rm /tmp/foo" does not match "git *"
        assert_eq!(r.action, "ask");
    }

    #[test]
    fn test_disabled_tools_empty_ruleset() {
        let tools = vec!["bash".to_string(), "edit".to_string()];
        let disabled = disabled_tools(&tools, &[]);
        assert!(disabled.is_empty());
    }

    #[test]
    fn test_disabled_tools_deny_bash() {
        let rules = vec![rule("bash", "*", "deny")];
        let tools = vec!["bash".to_string(), "edit".to_string()];
        let disabled = disabled_tools(&tools, &rules);
        assert_eq!(disabled, vec!["bash".to_string()]);
    }

    #[test]
    fn test_disabled_tools_edit_group() {
        // "write" maps to "edit" permission
        let rules = vec![rule("edit", "*", "deny")];
        let tools = vec!["write".to_string(), "patch".to_string(), "bash".to_string()];
        let disabled = disabled_tools(&tools, &rules);
        assert!(disabled.contains(&"write".to_string()));
        assert!(disabled.contains(&"patch".to_string()));
        assert!(!disabled.contains(&"bash".to_string()));
    }

    #[test]
    fn test_disabled_tools_deny_non_wildcard_pattern_not_disabled() {
        // disabled() only disables if pattern is exactly "*"
        let rules = vec![rule("bash", "rm *", "deny")];
        let tools = vec!["bash".to_string()];
        let disabled = disabled_tools(&tools, &rules);
        assert!(disabled.is_empty());
    }
}
