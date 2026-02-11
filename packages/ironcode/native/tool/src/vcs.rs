use git2::{BranchType, IndexAddOption, ObjectType, Repository, Signature, Status, StatusOptions};
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

#[derive(Serialize, Clone)]
pub struct FileStatus {
    pub path: String,
    pub status: String, // "added", "modified", "deleted", "untracked", "staged"
    pub staged: bool,
}

#[derive(Serialize)]
pub struct GitStatus {
    pub branch: String,
    pub files: Vec<FileStatus>,
}

#[derive(Serialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_head: bool,
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

/// Get detailed Git status with individual file information
pub fn get_status_detailed(cwd: &str) -> Result<GitStatus, VcsError> {
    let path = Path::new(cwd);
    let repo =
        Repository::discover(path).map_err(|e| VcsError::NotGitRepo(e.message().to_string()))?;

    let branch = get_branch(&repo)?;
    let mut files = Vec::new();

    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    opts.include_ignored(false);
    opts.exclude_submodules(false);

    let statuses = repo.statuses(Some(&mut opts))?;

    for entry in statuses.iter() {
        let status_flags = entry.status();
        let path_str = entry.path().unwrap_or("").to_string();

        // Determine status and staged state
        let (status, staged) = if status_flags.contains(Status::INDEX_NEW) {
            ("added".to_string(), true)
        } else if status_flags.contains(Status::INDEX_MODIFIED) {
            ("modified".to_string(), true)
        } else if status_flags.contains(Status::INDEX_DELETED) {
            ("deleted".to_string(), true)
        } else if status_flags.contains(Status::WT_NEW) {
            ("untracked".to_string(), false)
        } else if status_flags.contains(Status::WT_MODIFIED)
            || status_flags.contains(Status::WT_RENAMED)
        {
            ("modified".to_string(), false)
        } else if status_flags.contains(Status::WT_DELETED) {
            ("deleted".to_string(), false)
        } else {
            continue;
        };

        files.push(FileStatus {
            path: path_str,
            status,
            staged,
        });
    }

    Ok(GitStatus { branch, files })
}

/// Stage files (git add)
pub fn stage_files(cwd: &str, paths: Vec<String>) -> Result<(), VcsError> {
    let path = Path::new(cwd);
    let repo =
        Repository::discover(path).map_err(|e| VcsError::NotGitRepo(e.message().to_string()))?;

    let mut index = repo.index()?;

    if paths.is_empty() {
        // Stage all changes
        index.add_all(["*"].iter(), IndexAddOption::DEFAULT, None)?;
    } else {
        // Stage specific files
        for file_path in paths {
            index.add_path(Path::new(&file_path))?;
        }
    }

    index.write()?;
    Ok(())
}

/// Unstage files (git reset)
pub fn unstage_files(cwd: &str, paths: Vec<String>) -> Result<(), VcsError> {
    let path = Path::new(cwd);
    let repo =
        Repository::discover(path).map_err(|e| VcsError::NotGitRepo(e.message().to_string()))?;

    let head = repo.head()?;
    let obj = head.peel(ObjectType::Commit)?;

    if paths.is_empty() {
        // Unstage all
        repo.reset(&obj, git2::ResetType::Mixed, None)?;
    } else {
        // Unstage specific files
        for file_path in paths {
            repo.reset_default(Some(&obj), [file_path.as_str()])?;
        }
    }

    Ok(())
}

/// Commit staged changes
pub fn commit(cwd: &str, message: &str) -> Result<String, VcsError> {
    let path = Path::new(cwd);
    let repo =
        Repository::discover(path).map_err(|e| VcsError::NotGitRepo(e.message().to_string()))?;

    // Get signature from config or use default
    let signature = match repo.signature() {
        Ok(sig) => sig,
        Err(_) => Signature::now("IronCode", "ironcode@local")?,
    };

    // Get tree from index
    let mut index = repo.index()?;
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;

    // Get parent commit
    let head = repo.head()?;
    let parent_commit = head.peel_to_commit()?;

    // Create commit
    let commit_id = repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        message,
        &tree,
        &[&parent_commit],
    )?;

    Ok(format!("{:.7}", commit_id))
}

/// List branches
pub fn list_branches(cwd: &str) -> Result<Vec<BranchInfo>, VcsError> {
    let path = Path::new(cwd);
    let repo =
        Repository::discover(path).map_err(|e| VcsError::NotGitRepo(e.message().to_string()))?;

    let mut branches = Vec::new();
    let branch_iter = repo.branches(Some(BranchType::Local))?;

    for branch_result in branch_iter {
        let (branch, _) = branch_result?;
        if let Some(name) = branch.name()? {
            branches.push(BranchInfo {
                name: name.to_string(),
                is_head: branch.is_head(),
            });
        }
    }

    Ok(branches)
}

/// Checkout branch
pub fn checkout_branch(cwd: &str, branch_name: &str) -> Result<(), VcsError> {
    let path = Path::new(cwd);
    let repo =
        Repository::discover(path).map_err(|e| VcsError::NotGitRepo(e.message().to_string()))?;

    // Find the branch reference
    let branch_ref = format!("refs/heads/{}", branch_name);
    let reference = repo
        .find_reference(&branch_ref)
        .map_err(|_| VcsError::GitError(format!("Branch '{}' not found", branch_name)))?;

    // Get the commit that the branch points to
    let commit = reference.peel_to_commit()?;

    // Checkout the commit
    repo.checkout_tree(commit.as_object(), None)?;

    // Set HEAD to point to the branch
    repo.set_head(&branch_ref)?;

    Ok(())
}

/// Get diff for a file
pub fn get_file_diff(cwd: &str, file_path: &str, staged: bool) -> Result<String, VcsError> {
    let path = Path::new(cwd);
    let repo =
        Repository::discover(path).map_err(|e| VcsError::NotGitRepo(e.message().to_string()))?;

    let mut diff_opts = git2::DiffOptions::new();
    diff_opts.pathspec(file_path);

    let diff = if staged {
        // Staged changes: compare index with HEAD
        let head = repo.head()?;
        let tree = head.peel_to_tree()?;
        let index = repo.index()?;
        repo.diff_tree_to_index(Some(&tree), Some(&index), Some(&mut diff_opts))?
    } else {
        // Unstaged changes: compare working directory with index
        repo.diff_index_to_workdir(None, Some(&mut diff_opts))?
    };

    let mut diff_text = String::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        let origin = line.origin();
        let content = std::str::from_utf8(line.content()).unwrap_or("");

        match origin {
            '+' => diff_text.push_str(&format!("+{}", content)),
            '-' => diff_text.push_str(&format!("-{}", content)),
            ' ' => diff_text.push_str(&format!(" {}", content)),
            _ => diff_text.push_str(content),
        }

        true
    })?;

    Ok(diff_text)
}

/// Push commits to remote
pub fn push_to_remote(cwd: &str) -> Result<String, VcsError> {
    let path = Path::new(cwd);
    let repo =
        Repository::discover(path).map_err(|e| VcsError::NotGitRepo(e.message().to_string()))?;

    // Get current branch
    let head = repo
        .head()
        .map_err(|e| VcsError::GitError(e.message().to_string()))?;
    let branch_name = head
        .shorthand()
        .ok_or_else(|| VcsError::GitError("Could not get branch name".to_string()))?;

    // Get remote
    let remote_name = "origin"; // Default to origin
    let mut remote = repo
        .find_remote(remote_name)
        .map_err(|e| VcsError::GitError(format!("Remote '{}' not found: {}", remote_name, e)))?;

    // Push current branch to remote
    let refspec = format!("refs/heads/{}:refs/heads/{}", branch_name, branch_name);

    // Set up callbacks for credentials (will use SSH agent or credential helper)
    let mut callbacks = git2::RemoteCallbacks::new();
    callbacks.credentials(|_url, username_from_url, _allowed_types| {
        git2::Cred::ssh_key_from_agent(username_from_url.unwrap_or("git"))
    });

    let mut push_options = git2::PushOptions::new();
    push_options.remote_callbacks(callbacks);

    remote
        .push(&[refspec.as_str()], Some(&mut push_options))
        .map_err(|e| VcsError::GitError(format!("Failed to push: {}", e)))?;

    Ok(format!("Pushed {} to {}", branch_name, remote_name))
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
