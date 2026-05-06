use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const REQUIRED_SKILLS: &[&str] = &[
    "block-feature",
    "cleanup-features",
    "complete-feature",
    "enrich-feature",
    "feature-config",
    "implement-feature",
    "init-project",
    "list-features",
    "new-feature",
    "pm-agent",
    "query-archive",
    "review-spec",
    "split-feature",
    "start-feature",
    "unblock-feature",
    "verify-feature",
];

const REQUIRED_COMMANDS: &[&str] = &["dev-agent", "run-feature"];

const REQUIRED_AGENTS: &[&str] = &["dev-subagent"];

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SkillEntry {
    pub name: String,
    pub kind: String, // "skill" | "command" | "agent"
}

#[derive(Debug, Serialize, Clone)]
pub struct PluginInfo {
    pub name: String,
    pub version: String,
    pub description: String,
    pub skill_count: usize,
    pub command_count: usize,
    pub agent_count: usize,
}

#[derive(Debug, Serialize, Clone)]
pub struct SkillStatus {
    pub installed_skills: Vec<String>,
    pub installed_commands: Vec<String>,
    pub installed_agents: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ReadinessReport {
    pub ready: bool,
    pub installed: Vec<String>,
    pub missing: Vec<String>,
    pub total_required: usize,
}

#[derive(Debug, Serialize, Clone)]
pub struct InstallResult {
    pub success: bool,
    pub installed: usize,
    pub skipped: usize,
    pub updated: usize,
    pub errors: Vec<String>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn resolve_bundle_path(app: &AppHandle) -> Result<PathBuf, String> {
    // Production: use Tauri resource resolver
    if let Ok(p) = app.path().resource_dir() {
        let bundle = p.join("skill-bundle");
        if bundle.exists() {
            return Ok(bundle);
        }
    }

    // Dev fallback: resolve relative to CARGO_MANIFEST_DIR (src-tauri/)
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let dev_path = PathBuf::from(manifest_dir).join("resources").join("skill-bundle");
    if dev_path.exists() {
        return Ok(dev_path);
    }

    Err("skill-bundle directory not found (tried resource dir and manifest dir)".into())
}

fn list_md_files(dir: &PathBuf) -> Vec<String> {
    fs::read_dir(dir)
        .ok()
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| e.path().extension().is_some_and(|ext| ext == "md"))
                .filter_map(|e| {
                    e.file_name()
                        .to_str()
                        .map(|s| s.trim_end_matches(".md").to_string())
                })
                .collect()
        })
        .unwrap_or_default()
}

fn list_skill_dirs(dir: &PathBuf) -> Vec<String> {
    fs::read_dir(dir)
        .ok()
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| e.path().is_dir())
                .filter_map(|e| e.file_name().to_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default()
}

fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> std::io::Result<u64> {
    let mut count: u64 = 0;
    if src.is_dir() {
        fs::create_dir_all(dst)?;
        for entry in fs::read_dir(src)? {
            let entry = entry?;
            let src_path = entry.path();
            let dst_path = dst.join(entry.file_name());
            if src_path.is_dir() {
                count += copy_dir_recursive(&src_path, &dst_path)?;
            } else {
                // Incremental: skip if content is identical
                if dst_path.exists() {
                    let src_content = fs::read(&src_path)?;
                    let dst_content = fs::read(&dst_path)?;
                    if src_content == dst_content {
                        continue; // skip identical
                    }
                }
                fs::copy(&src_path, &dst_path)?;
                count += 1;
            }
        }
    }
    Ok(count)
}

// ---------------------------------------------------------------------------
// Tauri Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn scan_installed_skills(project_path: String) -> SkillStatus {
    let base = PathBuf::from(&project_path).join(".claude");

    let skills_dir = base.join("skills");
    let installed_skills = if skills_dir.exists() {
        list_skill_dirs(&skills_dir)
    } else {
        vec![]
    };

    let commands_dir = base.join("commands");
    let installed_commands = if commands_dir.exists() {
        list_md_files(&commands_dir)
    } else {
        vec![]
    };

    let agents_dir = base.join("agents");
    let installed_agents = if agents_dir.exists() {
        list_md_files(&agents_dir)
    } else {
        vec![]
    };

    SkillStatus {
        installed_skills,
        installed_commands,
        installed_agents,
    }
}

#[tauri::command]
pub fn get_bundled_plugin_info(app: AppHandle) -> Result<PluginInfo, String> {
    let bundle_dir = resolve_bundle_path(&app)?;
    let plugin_json_path = bundle_dir.join("plugin.json");

    if !plugin_json_path.exists() {
        return Err("plugin.json not found in skill-bundle".into());
    }

    let content = fs::read_to_string(&plugin_json_path)
        .map_err(|e| format!("Failed to read plugin.json: {}", e))?;

    #[derive(Deserialize)]
    struct PluginJson {
        name: String,
        version: String,
        description: String,
    }

    let plugin: PluginJson =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse plugin.json: {}", e))?;

    let skill_count = list_skill_dirs(&bundle_dir.join("skills")).len();
    let command_count = list_md_files(&bundle_dir.join("commands")).len();
    let agent_count = list_md_files(&bundle_dir.join("agents")).len();

    Ok(PluginInfo {
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
        skill_count,
        command_count,
        agent_count,
    })
}

#[tauri::command]
pub fn check_skill_readiness(project_path: String) -> ReadinessReport {
    let status = scan_installed_skills(project_path);

    let mut installed: Vec<String> = vec![];
    let mut missing: Vec<String> = vec![];

    // Check skills
    for skill in REQUIRED_SKILLS {
        if status.installed_skills.contains(&skill.to_string()) {
            installed.push(format!("skill:{}", skill));
        } else {
            missing.push(format!("skill:{}", skill));
        }
    }

    // Check commands
    for cmd in REQUIRED_COMMANDS {
        if status.installed_commands.contains(&cmd.to_string()) {
            installed.push(format!("command:{}", cmd));
        } else {
            missing.push(format!("command:{}", cmd));
        }
    }

    // Check agents
    for agent in REQUIRED_AGENTS {
        if status.installed_agents.contains(&agent.to_string()) {
            installed.push(format!("agent:{}", agent));
        } else {
            missing.push(format!("agent:{}", agent));
        }
    }

    let total_required = REQUIRED_SKILLS.len() + REQUIRED_COMMANDS.len() + REQUIRED_AGENTS.len();
    let ready = missing.is_empty();

    ReadinessReport {
        ready,
        installed,
        missing,
        total_required,
    }
}

#[tauri::command]
pub async fn install_bundled_skills(
    app: AppHandle,
    project_path: String,
) -> Result<InstallResult, String> {
    let bundle_dir = resolve_bundle_path(&app)?;
    if !bundle_dir.exists() {
        return Err("skill-bundle directory not found".into());
    }

    let claude_dir = PathBuf::from(&project_path).join(".claude");
    let templates_dir = PathBuf::from(&project_path).join("feature-workflow").join("templates");

    let mut installed: usize = 0;
    let mut skipped: usize = 0;
    let mut updated: usize = 0;
    let mut errors: Vec<String> = vec![];

    // Helper: copy a bundle subdirectory incrementally
    let copy_bundle_subdir = |src_sub: &str, dst_dir: &PathBuf| -> Result<(usize, usize, usize), String> {
        let src = bundle_dir.join(src_sub);
        if !src.exists() {
            return Ok((0, 0, 0));
        }

        let mut inst = 0usize;
        let mut skip = 0usize;
        let mut upd = 0usize;

        let entries = fs::read_dir(&src).map_err(|e| format!("Failed to read {}: {}", src_sub, e))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
            let src_path = entry.path();
            let file_name = entry.file_name();
            let dst_path = dst_dir.join(&file_name);

            if src_path.is_dir() {
                // For skills: src is skill-name/skill.md, dst is skill-name/skill.md
                fs::create_dir_all(&dst_path)
                    .map_err(|e| format!("Failed to create dir {:?}: {}", dst_path, e))?;

                for child in fs::read_dir(&src_path)
                    .map_err(|e| format!("Failed to read skill dir: {}", e))?
                {
                    let child = child.map_err(|e| format!("Failed to read: {}", e))?;
                    let child_src = child.path();
                    let child_dst = dst_dir.join(child.file_name());

                    if child_dst.exists() {
                        let src_bytes = fs::read(&child_src).unwrap_or_default();
                        let dst_bytes = fs::read(&child_dst).unwrap_or_default();
                        if src_bytes == dst_bytes {
                            skip += 1;
                        } else {
                            fs::copy(&child_src, &child_dst)
                                .map_err(|e| format!("Failed to update {:?}: {}", child_dst, e))?;
                            upd += 1;
                        }
                    } else {
                        fs::copy(&child_src, &child_dst)
                            .map_err(|e| format!("Failed to copy {:?}: {}", child_dst, e))?;
                        inst += 1;
                    }
                }
            } else {
                // Flat file (commands, agents)
                fs::create_dir_all(dst_dir)
                    .map_err(|e| format!("Failed to create dir {:?}: {}", dst_dir, e))?;

                if dst_path.exists() {
                    let src_bytes = fs::read(&src_path).unwrap_or_default();
                    let dst_bytes = fs::read(&dst_path).unwrap_or_default();
                    if src_bytes == dst_bytes {
                        skip += 1;
                    } else {
                        fs::copy(&src_path, &dst_path)
                            .map_err(|e| format!("Failed to update {:?}: {}", dst_path, e))?;
                        upd += 1;
                    }
                } else {
                    fs::copy(&src_path, &dst_path)
                        .map_err(|e| format!("Failed to copy {:?}: {}", dst_path, e))?;
                    inst += 1;
                }
            }
        }

        Ok((inst, skip, upd))
    };

    // Install skills → .claude/skills/
    match copy_bundle_subdir("skills", &claude_dir.join("skills")) {
        Ok((i, s, u)) => {
            installed += i;
            skipped += s;
            updated += u;
        }
        Err(e) => errors.push(e),
    }

    // Install commands → .claude/commands/
    match copy_bundle_subdir("commands", &claude_dir.join("commands")) {
        Ok((i, s, u)) => {
            installed += i;
            skipped += s;
            updated += u;
        }
        Err(e) => errors.push(e),
    }

    // Install agents → .claude/agents/
    match copy_bundle_subdir("agents", &claude_dir.join("agents")) {
        Ok((i, s, u)) => {
            installed += i;
            skipped += s;
            updated += u;
        }
        Err(e) => errors.push(e),
    }

    // Install templates → feature-workflow/templates/
    match copy_bundle_subdir("templates", &templates_dir) {
        Ok((i, s, u)) => {
            installed += i;
            skipped += s;
            updated += u;
        }
        Err(e) => errors.push(e),
    }

    // Install hooks → .claude/hooks/
    match copy_bundle_subdir("hooks", &claude_dir.join("hooks")) {
        Ok((i, s, u)) => {
            installed += i;
            skipped += s;
            updated += u;
        }
        Err(e) => errors.push(e),
    }

    Ok(InstallResult {
        success: errors.is_empty(),
        installed,
        skipped,
        updated,
        errors,
    })
}
