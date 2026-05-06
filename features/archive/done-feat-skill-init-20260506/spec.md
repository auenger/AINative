# Feature: feat-skill-init IDE Skill 初始化能力

## Basic Information
- **ID**: feat-skill-init
- **Name**: IDE Skill 初始化能力（自动检测 + 一键安装）
- **Priority**: 80
- **Size**: M
- **Dependencies**: none
- **Parent**: null
- **Children**: []
- **Created**: 2026-05-06

## Description

IDE 需要内置 Skill 初始化能力，使得 Task Board 和 Feature Workflow 等功能能自动获得对应的 skill 支持。

当前痛点：skill 安装只能通过外部 shell 脚本（`install-plugin.sh`）或 `claude plugin` CLI 完成，IDE 内无感知能力。当用户在 IDE 中操作 Task Board 时，可能缺少必要的 skill（如 `new-feature`、`start-feature`、`implement-feature` 等），导致工作流断裂。

解决方案：
1. **自动检测**：IDE 打开项目或访问 Task Board 时，检测 `.claude/skills/` 是否包含必要 skill
2. **状态提示**：缺失 skill 时在 UI 中显示提示，引导用户安装
3. **一键安装**：从 IDE 内嵌资源（Tauri bundled resources）复制 skills + commands + agents + templates 到项目 `.claude/`

**安装策略：内嵌资源**
- 构建时将 feature-workflow 插件完整打包进 App（~200KB，对包体积无感）
- 安装时从内嵌资源读取并复制到目标项目
- 零外部依赖，无需 clone marketplace，真正一键
- 未来可扩展 marketplace 远程更新能力

## User Value Points

### VP1: Skill 状态自动检测
IDE 打开项目或进入 Task Board 时，自动扫描已安装的 skill，与 feature-workflow 所需 skill 列表对比，生成缺失报告。用户无需手动检查。

### VP2: 一键安装缺失 Skill
用户确认后，IDE 从内嵌的 bundled resources 一键复制所有缺失的 skills、commands、agents、templates。支持增量安装（跳过已有、更新不同）。无需外部 marketplace 或网络。

## Context Analysis

### Reference Code
- `company-ai-marketplace/scripts/install-plugin.sh` — 现有 shell 安装脚本逻辑
- `company-ai-marketplace/plugins/feature-workflow/.claude-plugin/plugin.json` — 插件元数据
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx` — Task Board 视图
- `neuro-syntax-ide/src/types.ts` — 类型定义

### Related Documents
- `company-ai-marketplace/README.md` — Marketplace 架构文档
- `feature-workflow/config.yaml` — 工作流配置（skill 依赖清单）

### Related Features
- 无直接依赖，但为 Task Board、Feature Workflow 等所有 skill 驱动功能提供基础设施

## Technical Solution

### 所需 Skill 清单（feature-workflow 插件）

**Skills (16):**
block-feature, cleanup-features, complete-feature, enrich-feature, feature-config,
implement-feature, init-project, list-features, new-feature, pm-agent, query-archive,
review-spec, split-feature, start-feature, unblock-feature, verify-feature

**Commands (2):**
run-feature, dev-agent

**Agents (1):**
dev-subagent

**Templates (7):**
config.yaml, queue.yaml, archive-log.yaml, spec.md, task.md, checklist.md, project-context.md

### 架构方案

#### 内嵌资源打包

构建时将 feature-workflow 插件资源打入 Tauri bundle：

```
src-tauri/
  resources/
    skill-bundle/
      plugin.json          # 插件元数据
      skills/              # 16 个 skill（每个 {name}/skill.md）
      commands/            # 2 个 command .md
      agents/              # 1 个 agent .md
      templates/           # 7 个模板文件
```

`tauri.conf.json` 配置 `bundle.resources = ["resources/skill-bundle"]`，
运行时通过 `app.path_resolver().resolve_resource("skill-bundle")` 读取。

#### 后端 (Rust / Tauri Commands)

```rust
// 1. 扫描已安装 skill
#[tauri::command]
fn scan_installed_skills(project_path: String) -> SkillStatus {
    // 扫描 .claude/skills/、.claude/commands/、.claude/agents/
    // 返回已安装列表
}

// 2. 读取内嵌插件元数据
#[tauri::command]
fn get_bundled_plugin_info(app: AppHandle) -> PluginInfo {
    // 读取 skill-bundle/plugin.json
    // 返回版本号、skill 清单、描述
}

// 3. 从内嵌资源安装
#[tauri::command]
async fn install_bundled_skills(app: AppHandle, project_path: String) -> InstallResult {
    // 1. resolve_resource("skill-bundle")
    // 2. 复制 skills/ → {project}/.claude/skills/ (增量：跳过相同)
    // 3. 复制 commands/ → {project}/.claude/commands/
    // 4. 复制 agents/ → {project}/.claude/agents/
    // 5. 复制 templates/ → {project}/feature-workflow/templates/
    // 返回 { installed, skipped, updated } 统计
}

// 4. 检查 skill 完整性
#[tauri::command]
fn check_skill_readiness(project_path: String) -> ReadinessReport {
    // 硬编码 REQUIRED_SKILLS 清单
    // 对比 .claude/skills/ 中已有的
    // 返回 { missing: [...], installed: [...], ready: bool }
}
```

#### 前端 (React)

- **SkillStatusBar**：状态栏区域显示 skill 状态指示器（绿/黄/红）
- **SkillInitPrompt**：检测到缺失时弹出提示卡片，含「一键安装」按钮
- **Settings Skill Tab**：Settings 页新增 Skill 管理 tab，展示已安装 skill + 版本

## Acceptance Criteria (Gherkin)

### User Story
作为 IDE 用户，我希望 IDE 能自动检测并安装所需的 skill，这样我就可以直接使用 Task Board 和 Feature Workflow 而不需要手动配置。

### Scenarios

#### VP1: Skill 状态自动检测

```gherkin
Scenario: 项目已安装所有必要 skill
  Given 项目 .claude/skills/ 包含全部 16 个 feature-workflow skill
  And .claude/commands/ 包含 run-feature 和 dev-agent
  When 用户打开 Task Board
  Then 状态栏显示 skill 状态为绿色（就绪）
  And 不弹出安装提示

Scenario: 项目缺少部分 skill
  Given 项目 .claude/skills/ 只有 5 个 skill
  When 用户打开 Task Board
  Then 状态栏显示 skill 状态为黄色（部分缺失）
  And 显示提示卡片：「检测到缺少 11 个 skill，点击一键安装」
  And 提示卡片包含「一键安装」和「忽略」按钮

Scenario: 项目完全没有 skill
  Given 项目 .claude/skills/ 目录为空或不存在
  When 用户打开 Task Board
  Then 状态栏显示 skill 状态为红色（未初始化）
  And 显示提示卡片：「项目未初始化 Skill，点击一键安装」
```

#### VP2: 一键安装

```gherkin
Scenario: 从内嵌资源一键安装全部缺失 skill
  Given 项目缺少 11 个 skill
  When 用户点击「一键安装」按钮
  Then 系统从 IDE 内嵌资源复制缺失的 skills、commands、agents、templates
  And 显示安装进度（已安装 X/Y）
  And 安装完成后状态变为绿色（就绪）
  And 提示卡片消失

Scenario: 增量安装（跳过已有 skill）
  Given 项目已有 10 个 skill，缺少 6 个
  When 用户点击「一键安装」
  Then 只安装缺失的 6 个 skill
  And 已有的 10 个 skill 显示「跳过（已安装）」

Scenario: 安装失败（项目目录无写权限）
  Given 项目目录无写权限
  When 用户点击「一键安装」
  Then 显示错误提示：「安装失败：无写入权限」
  And 提供「重试」按钮
```

### UI/Interaction Checkpoints
- [ ] Skill 状态指示器在状态栏中的位置和样式
- [ ] 提示卡片的动画效果（滑入/淡出）
- [ ] 安装进度条或 spinner
- [ ] Settings 中 Skill 配置区域的表单

### General Checklist
- [ ] 不影响无 skill 时的基本 IDE 功能
- [ ] 支持重新安装（更新已有 skill）
- [ ] 安装过程不阻塞 UI（异步 Tauri command）
