use git2::{Repository, Status, StatusOptions};
use serde::Serialize;
use std::path::Path;

#[derive(Serialize)]
pub struct VcsInfo {
    pub branch: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub added: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modified: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted: Option<u32>,
}

#[derive(Debug)]
pub enum VcsError {
    NotGitRepo(String),
    GitError(String),
}

impl std::fmt::Display for VcsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            VcsError::NotGitRepo(msg) => write!(f, "Not a git repository: {}", msg),
            VcsError::GitError(msg) => write!(f, "Git error: {}", msg),
        }
    }
}

impl std::error::Error for VcsError {}

impl From<git2::Error> for VcsError {
    fn from(err: git2::Error) -> Self {
        VcsError::GitError(err.message().to_string())
    }
}

pub fn get_info(cwd: &str) -> Result<VcsInfo, VcsError> {
    let path = Path::new(cwd);

    // Open repository
    let repo =
        Repository::discover(path).map_err(|e| VcsError::NotGitRepo(e.message().to_string()))?;

    // Get current branch
    let branch = get_branch(&repo)?;

    // Get status counts
    let (added, modified, deleted) = get_status(&repo)?;

    Ok(VcsInfo {
        branch,
        added: if added > 0 { Some(added) } else { None },
        modified: if modified > 0 { Some(modified) } else { None },
        deleted: if deleted > 0 { Some(deleted) } else { None },
    })
}

fn get_branch(repo: &Repository) -> Result<String, VcsError> {
    let head = repo.head()?;

    if let Some(branch_name) = head.shorthand() {
        Ok(branch_name.to_string())
    } else {
        // Detached HEAD - return commit SHA
        if let Some(oid) = head.target() {
            Ok(format!("{:.7}", oid))
        } else {
            Err(VcsError::GitError("Unable to determine HEAD".to_string()))
        }
    }
}

fn get_status(repo: &Repository) -> Result<(u32, u32, u32), VcsError> {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    opts.include_ignored(false);
    opts.exclude_submodules(false);

    let statuses = repo.statuses(Some(&mut opts))?;

    let mut added = 0;
    let mut modified = 0;
    let mut deleted = 0;

    for entry in statuses.iter() {
        let status = entry.status();

        // Check for added/new files
        if status.contains(Status::WT_NEW) || status.contains(Status::INDEX_NEW) {
            added += 1;
        }
        // Check for modified files
        else if status.contains(Status::WT_MODIFIED)
            || status.contains(Status::INDEX_MODIFIED)
            || status.contains(Status::WT_RENAMED)
            || status.contains(Status::INDEX_RENAMED)
        {
            modified += 1;
        }
        // Check for deleted files
        else if status.contains(Status::WT_DELETED) || status.contains(Status::INDEX_DELETED) {
            deleted += 1;
        }
    }

    Ok((added, modified, deleted))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_info_current_repo() {
        // Test on the current repository (should be in a git repo during development)
        let result = get_info(".");

        // Should either succeed or fail with NotGitRepo error
        match result {
            Ok(info) => {
                // If we're in a git repo, branch should not be empty
                assert!(!info.branch.is_empty());
                println!("Branch: {}", info.branch);
                if let Some(a) = info.added {
                    println!("Added: {}", a);
                }
                if let Some(m) = info.modified {
                    println!("Modified: {}", m);
                }
                if let Some(d) = info.deleted {
                    println!("Deleted: {}", d);
                }
            }
            Err(VcsError::NotGitRepo(_)) => {
                // Expected if not in a git repo
                println!("Not in a git repository - this is ok for test");
            }
            Err(e) => panic!("Unexpected error: {}", e),
        }
    }
}
