//! Rig IDE Tools — Built-in file/shell/git tools for the Rig Agent runtime.
//!
//! Each tool implements the `RigTool` trait and operates within the workspace sandbox.
//! Tools are registered with the agent builder and called automatically during the
//! LLM tool_use loop.
//!
//! Security constraints:
//! - File operations restricted to workspace directory (path traversal protection)
//! - Shell commands have a 30s timeout and dangerous command blacklist
//! - Git operations are read-only (status, diff, log)

use serde::Serialize;
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// Tool argument parsing error.
#[derive(Debug)]
pub enum ToolError {
    /// Invalid or missing arguments.
    InvalidArgs(String),
    /// Execution error.
    ExecutionError(String),
    /// Security violation.
    AccessDenied(String),
}

impl std::fmt::Display for ToolError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ToolError::InvalidArgs(msg) => write!(f, "Invalid arguments: {}", msg),
            ToolError::ExecutionError(msg) => write!(f, "Execution error: {}", msg),
            ToolError::AccessDenied(msg) => write!(f, "Access denied: {}", msg),
        }
    }
}

/// Tool definition returned to the LLM for function calling.
#[derive(Debug, Serialize, Clone)]
pub struct ToolDefinition {
    /// Tool name (e.g. "file_read").
    pub name: String,
    /// Human-readable description.
    pub description: String,
    /// JSON Schema for the tool's input parameters.
    pub parameters: Value,
}

/// Result of a tool execution.
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct ToolResult {
    /// Whether execution succeeded.
    pub success: bool,
    /// Output text (file content, command output, etc.).
    pub output: String,
    /// Tool name that was executed.
    pub tool_name: String,
}

// ---------------------------------------------------------------------------
// Workspace sandbox
// ---------------------------------------------------------------------------

/// Validate that a path is within the workspace directory.
/// Returns the canonicalized full path if safe, or an error if not.
pub fn validate_workspace_path(path: &str, workspace: &Path) -> Result<PathBuf, ToolError> {
    if path.is_empty() {
        return Err(ToolError::InvalidArgs("path cannot be empty".to_string()));
    }

    // Reject obviously malicious paths
    if path.contains("..") {
        return Err(ToolError::AccessDenied(
            "Path traversal not allowed: '..' in path".to_string(),
        ));
    }

    let canonical_workspace = workspace
        .canonicalize()
        .map_err(|e| ToolError::ExecutionError(format!("Cannot resolve workspace: {}", e)))?;

    let full_path = workspace.join(path);

    // If the path exists, canonicalize and check prefix
    if full_path.exists() {
        let canonical = full_path
            .canonicalize()
            .map_err(|e| ToolError::ExecutionError(format!("Cannot resolve path: {}", e)))?;
        if !canonical.starts_with(&canonical_workspace) {
            return Err(ToolError::AccessDenied(
                "Path is outside the workspace directory".to_string(),
            ));
        }
        return Ok(canonical);
    }

    // For non-existent paths (e.g. write targets), check the parent chain
    let mut check_path = full_path.clone();
    let mut suffix_parts: Vec<std::ffi::OsString> = Vec::new();
    while !check_path.exists() {
        if let Some(name) = check_path.file_name() {
            suffix_parts.push(name.to_os_string());
        }
        match check_path.parent() {
            Some(p) => check_path = p.to_path_buf(),
            None => {
                return Err(ToolError::AccessDenied(
                    "Path is outside the workspace directory".to_string(),
                ))
            }
        }
    }
    match check_path.canonicalize() {
        Ok(cp) => {
            let mut full = cp;
            for part in suffix_parts.into_iter().rev() {
                full = full.join(part);
            }
            if full.starts_with(&canonical_workspace) {
                Ok(full)
            } else {
                Err(ToolError::AccessDenied(
                    "Path is outside the workspace directory".to_string(),
                ))
            }
        }
        Err(e) => Err(ToolError::ExecutionError(format!(
            "Cannot resolve path: {}",
            e
        ))),
    }
}

// ---------------------------------------------------------------------------
// Dangerous command blacklist
// ---------------------------------------------------------------------------

/// Commands that are never allowed to be executed.
const DANGEROUS_COMMANDS: &[&str] = &[
    "rm -rf /",
    "rm -rf /*",
    "rm -rf ~",
    "rm -rf ~/*",
    "mkfs",
    "dd if=",
    "sudo",
    "su ",
    "chmod -R 777 /",
    "chown -R",
    ":(){ :|:& };:",
    "fork bomb",
    "> /dev/sda",
    "mv / ",
    "shutdown",
    "reboot",
    "halt",
    "poweroff",
    "init 0",
    "init 6",
];

/// Check if a command contains dangerous patterns.
fn is_dangerous_command(cmd: &str) -> bool {
    let lower = cmd.to_lowercase();
    DANGEROUS_COMMANDS
        .iter()
        .any(|danger| lower.contains(&danger.to_lowercase()))
}

// ---------------------------------------------------------------------------
// Tool Trait
// ---------------------------------------------------------------------------

/// Trait for all IDE tools that the Rig agent can invoke.
pub trait RigTool: Send + Sync {
    /// Return the tool definition for the LLM.
    fn definition(&self) -> ToolDefinition;
    /// Execute the tool with the given arguments.
    fn execute(&self, args: &Value) -> ToolResult;
}

// ---------------------------------------------------------------------------
// FileReadTool
// ---------------------------------------------------------------------------

/// Read file content from the workspace.
pub struct FileReadTool {
    pub workspace: PathBuf,
}

impl RigTool for FileReadTool {
    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "file_read".to_string(),
            description: "Read the content of a file in the workspace. Returns the file content as a string.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Relative file path within the workspace"
                    }
                },
                "required": ["path"]
            }),
        }
    }

    fn execute(&self, args: &Value) -> ToolResult {
        let path = args
            .get("path")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let full_path = match validate_workspace_path(path, &self.workspace) {
            Ok(p) => p,
            Err(e) => {
                return ToolResult {
                    success: false,
                    output: e.to_string(),
                    tool_name: "file_read".to_string(),
                }
            }
        };

        if !full_path.is_file() {
            // It might be a directory or not exist
            if full_path.is_dir() {
                return ToolResult {
                    success: false,
                    output: format!("'{}' is a directory, not a file. Use list_dir to list directories.", path),
                    tool_name: "file_read".to_string(),
                };
            }
            return ToolResult {
                success: false,
                output: format!("File not found: {}", path),
                tool_name: "file_read".to_string(),
            };
        }

        match std::fs::read_to_string(&full_path) {
            Ok(content) => {
                // Truncate very large files
                let max_chars = 100_000;
                let output = if content.len() > max_chars {
                    format!(
                        "{}\n\n... (truncated, showing first {} of {} characters)",
                        &content[..max_chars],
                        max_chars,
                        content.len()
                    )
                } else {
                    content
                };
                ToolResult {
                    success: true,
                    output,
                    tool_name: "file_read".to_string(),
                }
            }
            Err(e) => ToolResult {
                success: false,
                output: format!("Failed to read file '{}': {}", path, e),
                tool_name: "file_read".to_string(),
            },
        }
    }
}

// ---------------------------------------------------------------------------
// FileWriteTool
// ---------------------------------------------------------------------------

/// Write content to a file in the workspace.
pub struct FileWriteTool {
    pub workspace: PathBuf,
}

impl RigTool for FileWriteTool {
    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "file_write".to_string(),
            description: "Write content to a file in the workspace. Creates parent directories if needed. Use this to create or update files.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Relative file path within the workspace"
                    },
                    "content": {
                        "type": "string",
                        "description": "Content to write to the file"
                    }
                },
                "required": ["path", "content"]
            }),
        }
    }

    fn execute(&self, args: &Value) -> ToolResult {
        let path = args
            .get("path")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let content = args
            .get("content")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let full_path = match validate_workspace_path(path, &self.workspace) {
            Ok(p) => p,
            Err(e) => {
                return ToolResult {
                    success: false,
                    output: e.to_string(),
                    tool_name: "file_write".to_string(),
                }
            }
        };

        // Create parent directories if needed
        if let Some(parent) = full_path.parent() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                return ToolResult {
                    success: false,
                    output: format!("Failed to create parent directories: {}", e),
                    tool_name: "file_write".to_string(),
                };
            }
        }

        match std::fs::write(&full_path, content) {
            Ok(()) => {
                let bytes = content.len();
                ToolResult {
                    success: true,
                    output: format!("File written successfully: {} ({} bytes)", path, bytes),
                    tool_name: "file_write".to_string(),
                }
            }
            Err(e) => ToolResult {
                success: false,
                output: format!("Failed to write file '{}': {}", path, e),
                tool_name: "file_write".to_string(),
            },
        }
    }
}

// ---------------------------------------------------------------------------
// ListDirTool
// ---------------------------------------------------------------------------

/// List directory contents in the workspace.
pub struct ListDirTool {
    pub workspace: PathBuf,
}

impl RigTool for ListDirTool {
    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "list_dir".to_string(),
            description: "List the contents of a directory in the workspace. Shows file and subdirectory names with type indicators (/ for directories).".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Relative directory path within the workspace. Use '.' for the workspace root."
                    }
                },
                "required": ["path"]
            }),
        }
    }

    fn execute(&self, args: &Value) -> ToolResult {
        let path = args
            .get("path")
            .and_then(|v| v.as_str())
            .unwrap_or(".");

        let full_path = match validate_workspace_path(path, &self.workspace) {
            Ok(p) => p,
            Err(e) => {
                return ToolResult {
                    success: false,
                    output: e.to_string(),
                    tool_name: "list_dir".to_string(),
                }
            }
        };

        if !full_path.is_dir() {
            return ToolResult {
                success: false,
                output: format!("'{}' is not a directory", path),
                tool_name: "list_dir".to_string(),
            };
        }

        match std::fs::read_dir(&full_path) {
            Ok(entries) => {
                let mut items: Vec<String> = Vec::new();
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    // Skip hidden files/dirs
                    if name.starts_with('.') {
                        continue;
                    }
                    let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
                    let size = entry.metadata().ok().map(|m| m.len()).unwrap_or(0);
                    if is_dir {
                        items.push(format!("{}/", name));
                    } else {
                        items.push(format!("{} ({} bytes)", name, size));
                    }
                }
                items.sort();
                let listing = if items.is_empty() {
                    "(empty directory)".to_string()
                } else {
                    format!("{} items:\n{}", items.len(), items.join("\n"))
                };
                ToolResult {
                    success: true,
                    output: listing,
                    tool_name: "list_dir".to_string(),
                }
            }
            Err(e) => ToolResult {
                success: false,
                output: format!("Failed to list directory '{}': {}", path, e),
                tool_name: "list_dir".to_string(),
            },
        }
    }
}

// ---------------------------------------------------------------------------
// ShellExecTool
// ---------------------------------------------------------------------------

/// Execute a shell command in the workspace directory.
pub struct ShellExecTool {
    pub workspace: PathBuf,
}

impl RigTool for ShellExecTool {
    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "shell_exec".to_string(),
            description: "Execute a shell command in the workspace directory. The command runs with a 30-second timeout. Dangerous commands (sudo, rm -rf /, etc.) are blocked.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The shell command to execute"
                    }
                },
                "required": ["command"]
            }),
        }
    }

    fn execute(&self, args: &Value) -> ToolResult {
        let command = args
            .get("command")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        if command.is_empty() {
            return ToolResult {
                success: false,
                output: "Command cannot be empty".to_string(),
                tool_name: "shell_exec".to_string(),
            };
        }

        // Check for dangerous commands
        if is_dangerous_command(command) {
            return ToolResult {
                success: false,
                output: format!(
                    "Command blocked for safety: '{}'. Dangerous operations like sudo, rm -rf, mkfs, etc. are not allowed.",
                    command
                ),
                tool_name: "shell_exec".to_string(),
            };
        }

        // Execute with timeout using synchronous std::process::Command
        // (cannot create tokio runtime here — we're already inside one)
        let workspace = self.workspace.clone();
        let cmd = command.to_string();

        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let result = std::process::Command::new("sh")
                .arg("-c")
                .arg(&cmd)
                .current_dir(&workspace)
                .output();
            let _ = tx.send(result);
        });

        match rx.recv_timeout(Duration::from_secs(30)) {
            Ok(Ok(output)) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();

                let mut parts = Vec::new();
                if !stdout.is_empty() {
                    parts.push(stdout);
                }
                if !stderr.is_empty() {
                    parts.push(format!("stderr:\n{}", stderr));
                }

                let combined = if parts.is_empty() {
                    "(no output)".to_string()
                } else {
                    parts.join("\n")
                };

                // UTF-8 safe truncation
                let max_chars = 50_000;
                let output_text = if combined.len() > max_chars {
                    let boundary = combined.char_indices().take_while(|(i, _)| *i < max_chars).last().map(|(i, c)| i + c.len_utf8()).unwrap_or(0);
                    format!(
                        "{}\n\n... (truncated at {} characters)",
                        &combined[..boundary],
                        max_chars
                    )
                } else {
                    combined
                };

                ToolResult {
                    success: output.status.success(),
                    output: if output.status.success() {
                        output_text
                    } else {
                        format!(
                            "Exit code: {}\n{}",
                            output.status.code().unwrap_or(-1),
                            output_text
                        )
                    },
                    tool_name: "shell_exec".to_string(),
                }
            }
            Ok(Err(e)) => ToolResult {
                success: false,
                output: format!("Failed to execute command: {}", e),
                tool_name: "shell_exec".to_string(),
            },
            Err(_) => ToolResult {
                success: false,
                output: "Command timed out after 30 seconds".to_string(),
                tool_name: "shell_exec".to_string(),
            },
        }
    }
}

// ---------------------------------------------------------------------------
// GitStatusTool
// ---------------------------------------------------------------------------

/// Query git status in the workspace.
pub struct GitStatusTool {
    pub workspace: PathBuf,
}

impl RigTool for GitStatusTool {
    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "git_status".to_string(),
            description: "Show the git status of the workspace. Returns current branch, staged/unstaged/untracked files. Read-only operation.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {},
                "required": []
            }),
        }
    }

    fn execute(&self, _args: &Value) -> ToolResult {
        let repo_path = &self.workspace;

        let repo = match git2::Repository::discover(repo_path) {
            Ok(r) => r,
            Err(e) => {
                return ToolResult {
                    success: false,
                    output: format!("Not a git repository: {}", e),
                    tool_name: "git_status".to_string(),
                };
            }
        };

        // Current branch
        let head = match repo.head() {
            Ok(h) => h,
            Err(e) => {
                return ToolResult {
                    success: false,
                    output: format!("Failed to read HEAD: {}", e),
                    tool_name: "git_status".to_string(),
                };
            }
        };

        let branch = head.shorthand().unwrap_or("unknown").to_string();

        // Remote URL
        let remote_url = repo
            .find_remote("origin")
            .ok()
            .and_then(|r| r.url().map(|u| u.to_string()))
            .unwrap_or_else(|| "no remote".to_string());

        // Status entries
        let mut staged: Vec<String> = Vec::new();
        let mut unstaged: Vec<String> = Vec::new();
        let mut untracked: Vec<String> = Vec::new();

        let statuses = match repo.statuses(None) {
            Ok(s) => s,
            Err(e) => {
                return ToolResult {
                    success: false,
                    output: format!("Failed to get git status: {}", e),
                    tool_name: "git_status".to_string(),
                };
            }
        };

        for entry in statuses.iter() {
            let path = entry.path().unwrap_or("(unknown)").to_string();
            let status = entry.status();

            if status.is_wt_new() {
                untracked.push(format!("?? {}", path));
            } else {
                if status.intersects(
                    git2::Status::INDEX_NEW
                        | git2::Status::INDEX_MODIFIED
                        | git2::Status::INDEX_DELETED
                        | git2::Status::INDEX_RENAMED
                        | git2::Status::INDEX_TYPECHANGE,
                ) {
                    let indicator = if status.contains(git2::Status::INDEX_NEW) {
                        "A"
                    } else if status.contains(git2::Status::INDEX_MODIFIED) {
                        "M"
                    } else if status.contains(git2::Status::INDEX_DELETED) {
                        "D"
                    } else if status.contains(git2::Status::INDEX_RENAMED) {
                        "R"
                    } else {
                        "T"
                    };
                    staged.push(format!("{}  {}", indicator, path));
                }
                if status.intersects(
                    git2::Status::WT_MODIFIED
                        | git2::Status::WT_DELETED
                        | git2::Status::WT_RENAMED
                        | git2::Status::WT_TYPECHANGE,
                ) {
                    let indicator = if status.contains(git2::Status::WT_MODIFIED) {
                        "M"
                    } else if status.contains(git2::Status::WT_DELETED) {
                        "D"
                    } else if status.contains(git2::Status::WT_RENAMED) {
                        "R"
                    } else {
                        "T"
                    };
                    unstaged.push(format!("{}  {}", indicator, path));
                }
            }
        }

        let mut output = format!("On branch: {}\nRemote: {}\n", branch, remote_url);

        if !staged.is_empty() {
            output.push_str(&format!("\nStaged ({}):\n{}\n", staged.len(), staged.join("\n")));
        }
        if !unstaged.is_empty() {
            output.push_str(&format!("\nUnstaged ({}):\n{}\n", unstaged.len(), unstaged.join("\n")));
        }
        if !untracked.is_empty() {
            output.push_str(&format!("\nUntracked ({}):\n{}\n", untracked.len(), untracked.join("\n")));
        }

        if staged.is_empty() && unstaged.is_empty() && untracked.is_empty() {
            output.push_str("\nWorking tree clean");
        }

        ToolResult {
            success: true,
            output,
            tool_name: "git_status".to_string(),
        }
    }
}

// ---------------------------------------------------------------------------
// GitDiffTool
// ---------------------------------------------------------------------------

/// Show git diff in the workspace.
pub struct GitDiffTool {
    pub workspace: PathBuf,
}

impl RigTool for GitDiffTool {
    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "git_diff".to_string(),
            description: "Show the git diff of the workspace. Returns staged and/or unstaged changes. Read-only operation.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "staged": {
                        "type": "boolean",
                        "description": "If true, show staged changes (--cached). If false or omitted, show unstaged changes."
                    }
                },
                "required": []
            }),
        }
    }

    fn execute(&self, args: &Value) -> ToolResult {
        let staged = args
            .get("staged")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let repo = match git2::Repository::discover(&self.workspace) {
            Ok(r) => r,
            Err(e) => {
                return ToolResult {
                    success: false,
                    output: format!("Not a git repository: {}", e),
                    tool_name: "git_diff".to_string(),
                };
            }
        };

        let diff = if staged {
            // Diff staged changes (index vs HEAD)
            let head_tree = repo
                .head()
                .ok()
                .and_then(|r| r.target())
                .and_then(|oid| repo.find_commit(oid).ok())
                .and_then(|c| c.tree().ok());

            let index = match repo.index() {
                Ok(idx) => idx,
                Err(e) => {
                    return ToolResult {
                        success: false,
                        output: format!("Failed to get index: {}", e),
                        tool_name: "git_diff".to_string(),
                    };
                }
            };

            match head_tree {
                Some(tree) => repo.diff_tree_to_index(Some(&tree), Some(&index), None),
                None => repo.diff_tree_to_index(None, Some(&index), None),
            }
        } else {
            // Diff unstaged changes (workdir vs index)
            repo.diff_index_to_workdir(None, None)
        };

        match diff {
            Ok(diff_obj) => {
                // Collect diff text
                let mut diff_text = String::new();
                let mut file_count = 0u32;
                let mut adds = 0u32;
                let mut dels = 0u32;

                let _ = diff_obj.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
                    let origin = line.origin();
                    match origin {
                        '+' => adds += 1,
                        '-' => dels += 1,
                        _ => {}
                    }
                    if origin == 'F' {
                        file_count += 1;
                    }
                    let line_str = format!(
                        "{}{}",
                        origin,
                        String::from_utf8_lossy(line.content())
                    );
                    diff_text.push_str(&line_str);
                    true
                });

                if diff_text.is_empty() {
                    ToolResult {
                        success: true,
                        output: if staged {
                            "No staged changes".to_string()
                        } else {
                            "No unstaged changes".to_string()
                        },
                        tool_name: "git_diff".to_string(),
                    }
                } else {
                    // Truncate if too long
                    let max_chars = 80_000;
                    let output = if diff_text.len() > max_chars {
                        format!(
                            "Summary: {} files changed, +{} -{}\n\n{}\n... (truncated at {} characters)",
                            file_count, adds, dels,
                            &diff_text[..max_chars],
                            max_chars
                        )
                    } else {
                        format!(
                            "Summary: {} files changed, +{} -{}\n\n{}",
                            file_count, adds, dels, diff_text
                        )
                    };

                    ToolResult {
                        success: true,
                        output,
                        tool_name: "git_diff".to_string(),
                    }
                }
            }
            Err(e) => ToolResult {
                success: false,
                output: format!("Failed to get diff: {}", e),
                tool_name: "git_diff".to_string(),
            },
        }
    }
}

// ---------------------------------------------------------------------------
// Tool Registry
// ---------------------------------------------------------------------------

/// Registry that holds all available tools for a workspace.
pub struct ToolRegistry {
    tools: Vec<Box<dyn RigTool>>,
}

impl ToolRegistry {
    /// Create a new registry with all built-in tools for the given workspace.
    pub fn new(workspace: PathBuf) -> Self {
        let tools: Vec<Box<dyn RigTool>> = vec![
            Box::new(FileReadTool {
                workspace: workspace.clone(),
            }),
            Box::new(FileWriteTool {
                workspace: workspace.clone(),
            }),
            Box::new(ListDirTool {
                workspace: workspace.clone(),
            }),
            Box::new(ShellExecTool {
                workspace: workspace.clone(),
            }),
            Box::new(GitStatusTool {
                workspace: workspace.clone(),
            }),
            Box::new(GitDiffTool {
                workspace: workspace.clone(),
            }),
        ];
        Self { tools }
    }

    /// Get all tool definitions (for sending to the LLM).
    pub fn definitions(&self) -> Vec<ToolDefinition> {
        self.tools.iter().map(|t| t.definition()).collect()
    }

    /// Execute a tool by name with the given arguments.
    pub fn execute(&self, tool_name: &str, args: &Value) -> ToolResult {
        for tool in &self.tools {
            if tool.definition().name == tool_name {
                return tool.execute(args);
            }
        }
        ToolResult {
            success: false,
            output: format!("Unknown tool: {}", tool_name),
            tool_name: tool_name.to_string(),
        }
    }

    /// Check if a tool exists by name.
    #[allow(dead_code)]
    pub fn has_tool(&self, name: &str) -> bool {
        self.tools.iter().any(|t| t.definition().name == name)
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn setup_test_workspace() -> tempfile::TempDir {
        tempfile::tempdir().unwrap()
    }

    #[test]
    fn test_file_read_tool() {
        let dir = setup_test_workspace();
        let test_file = dir.path().join("test.txt");
        fs::write(&test_file, "hello world").unwrap();

        let tool = FileReadTool {
            workspace: dir.path().to_path_buf(),
        };
        let args = serde_json::json!({ "path": "test.txt" });
        let result = tool.execute(&args);
        assert!(result.success);
        assert_eq!(result.output, "hello world");
        assert_eq!(result.tool_name, "file_read");
    }

    #[test]
    fn test_file_read_not_found() {
        let dir = setup_test_workspace();
        let tool = FileReadTool {
            workspace: dir.path().to_path_buf(),
        };
        let args = serde_json::json!({ "path": "nonexistent.txt" });
        let result = tool.execute(&args);
        assert!(!result.success);
        assert!(result.output.contains("not found") || result.output.contains("does not exist"));
    }

    #[test]
    fn test_file_read_traversal_attack() {
        let dir = setup_test_workspace();
        let tool = FileReadTool {
            workspace: dir.path().to_path_buf(),
        };
        let args = serde_json::json!({ "path": "../../etc/passwd" });
        let result = tool.execute(&args);
        assert!(!result.success);
        assert!(result.output.contains("Access denied") || result.output.contains("traversal"));
    }

    #[test]
    fn test_file_write_tool() {
        let dir = setup_test_workspace();
        let tool = FileWriteTool {
            workspace: dir.path().to_path_buf(),
        };
        let args = serde_json::json!({ "path": "new_file.txt", "content": "test content" });
        let result = tool.execute(&args);
        assert!(result.success);

        // Verify file was written
        let written = fs::read_to_string(dir.path().join("new_file.txt")).unwrap();
        assert_eq!(written, "test content");
    }

    #[test]
    fn test_file_write_creates_parent_dirs() {
        let dir = setup_test_workspace();
        let tool = FileWriteTool {
            workspace: dir.path().to_path_buf(),
        };
        let args = serde_json::json!({ "path": "sub/dir/file.txt", "content": "nested" });
        let result = tool.execute(&args);
        assert!(result.success);
        let written = fs::read_to_string(dir.path().join("sub/dir/file.txt")).unwrap();
        assert_eq!(written, "nested");
    }

    #[test]
    fn test_file_write_traversal_attack() {
        let dir = setup_test_workspace();
        let tool = FileWriteTool {
            workspace: dir.path().to_path_buf(),
        };
        let args = serde_json::json!({ "path": "/tmp/evil.txt", "content": "bad" });
        let result = tool.execute(&args);
        assert!(!result.success);
    }

    #[test]
    fn test_list_dir_tool() {
        let dir = setup_test_workspace();
        fs::write(dir.path().join("file1.txt"), "a").unwrap();
        fs::write(dir.path().join("file2.rs"), "b").unwrap();
        fs::create_dir(dir.path().join("subdir")).unwrap();

        let tool = ListDirTool {
            workspace: dir.path().to_path_buf(),
        };
        let args = serde_json::json!({ "path": "." });
        let result = tool.execute(&args);
        assert!(result.success);
        assert!(result.output.contains("file1.txt"));
        assert!(result.output.contains("file2.rs"));
        assert!(result.output.contains("subdir/"));
    }

    #[test]
    fn test_validate_workspace_path_rejects_dotdot() {
        let dir = setup_test_workspace();
        let result = validate_workspace_path("../../etc/passwd", dir.path());
        assert!(result.is_err());
        if let Err(ToolError::AccessDenied(_)) = result {
            // Expected
        } else {
            panic!("Expected AccessDenied error");
        }
    }

    #[test]
    fn test_validate_workspace_path_empty() {
        let dir = setup_test_workspace();
        let result = validate_workspace_path("", dir.path());
        assert!(result.is_err());
    }

    #[test]
    fn test_dangerous_command_detection() {
        assert!(is_dangerous_command("sudo rm -rf /"));
        assert!(is_dangerous_command("mkfs.ext4 /dev/sda1"));
        assert!(is_dangerous_command("shutdown -h now"));
        assert!(!is_dangerous_command("cargo build"));
        assert!(!is_dangerous_command("ls -la"));
        assert!(!is_dangerous_command("git status"));
    }

    #[test]
    fn test_shell_exec_blocks_dangerous() {
        let dir = setup_test_workspace();
        let tool = ShellExecTool {
            workspace: dir.path().to_path_buf(),
        };
        let args = serde_json::json!({ "command": "sudo rm -rf /" });
        let result = tool.execute(&args);
        assert!(!result.success);
        assert!(result.output.contains("blocked"));
    }

    #[test]
    fn test_shell_exec_basic() {
        let dir = setup_test_workspace();
        let tool = ShellExecTool {
            workspace: dir.path().to_path_buf(),
        };
        let args = serde_json::json!({ "command": "echo hello" });
        let result = tool.execute(&args);
        assert!(result.success);
        assert!(result.output.contains("hello"));
    }

    #[test]
    fn test_tool_registry() {
        let dir = setup_test_workspace();
        let registry = ToolRegistry::new(dir.path().to_path_buf());

        // Should have 6 tools
        assert_eq!(registry.definitions().len(), 6);

        // Check all tool names
        let names: Vec<String> = registry
            .definitions()
            .iter()
            .map(|d| d.name.clone())
            .collect();
        assert!(names.contains(&"file_read".to_string()));
        assert!(names.contains(&"file_write".to_string()));
        assert!(names.contains(&"list_dir".to_string()));
        assert!(names.contains(&"shell_exec".to_string()));
        assert!(names.contains(&"git_status".to_string()));
        assert!(names.contains(&"git_diff".to_string()));

        // Check has_tool
        assert!(registry.has_tool("file_read"));
        assert!(!registry.has_tool("unknown_tool"));

        // Execute via registry
        let args = serde_json::json!({ "path": "test.txt" });
        // Write first
        let write_args = serde_json::json!({ "path": "test.txt", "content": "hello" });
        let write_result = registry.execute("file_write", &write_args);
        assert!(write_result.success);

        let read_result = registry.execute("file_read", &args);
        assert!(read_result.success);
        assert_eq!(read_result.output, "hello");

        // Unknown tool
        let unknown_result = registry.execute("nonexistent", &args);
        assert!(!unknown_result.success);
        assert!(unknown_result.output.contains("Unknown tool"));
    }

    #[test]
    fn test_git_status_not_repo() {
        let dir = setup_test_workspace();
        let tool = GitStatusTool {
            workspace: dir.path().to_path_buf(),
        };
        let args = serde_json::json!({});
        let result = tool.execute(&args);
        assert!(!result.success);
        assert!(result.output.contains("Not a git repository"));
    }
}
