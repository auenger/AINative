# Tasks: feat-skill-init

## Task Breakdown

### 1. 内嵌资源准备
- [x] 创建 `neuro-syntax-ide/src-tauri/resources/skill-bundle/` 目录
- [x] 从 marketplace 和 .claude/skills/ 复制 16 个 skills + 2 commands + 1 agent + 8 templates + 2 hooks
- [x] 复制 `plugin.json` 作为元数据
- [x] 在 `tauri.conf.json` 配置 `bundle.resources` 包含 skill-bundle

### 2. 后端 - Skill 扫描与状态检测
- [x] `src-tauri/src/skill_init.rs` — 实现 `scan_installed_skills` command
- [x] `get_bundled_plugin_info` command — 读取内嵌 plugin.json
- [x] `check_skill_readiness` command — 对比已安装 vs 所需清单（硬编码 16+2+1）
- [x] 在 `lib.rs` 注册新 commands (mod skill_init + 4 commands)

### 3. 后端 - Skill 安装
- [x] `install_bundled_skills` command — 从内嵌资源复制到项目 .claude/
- [x] 增量安装逻辑：diff 文件内容，跳过相同、覆盖不同
- [x] 错误处理：collect errors, return InstallResult

### 3. 前端 - 类型定义
- [x] `types.ts` 新增 SkillReadinessLevel、SkillStatus、PluginInfo、ReadinessReport、InstallResult 类型

### 4. 前端 - Skill 状态指示器
- [x] `SkillStatusBar.tsx` — 状态栏 skill 状态指示器（绿/黄/红）
- [x] 集成到 StatusBar 组件

### 5. 前端 - Skill 安装提示与交互
- [x] `SkillInitPrompt.tsx` — 缺失 skill 提示卡片
- [x] 一键安装按钮 → 调用 Tauri install_bundled_skills command
- [x] 安装进度展示
- [x] 成功/失败反馈
- [x] 集成到 TaskBoard 视图

### 6. 前端 - Settings Skill 管理
- [x] Settings 页新增 Skill tab
- [x] 已安装 skill 列表展示（含 Readiness 状态）
- [x] 手动触发「重新安装」按钮
- [x] 显示内嵌插件版本 vs 已安装版本

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-06 | All tasks completed | Rust backend (skill_init.rs) + Frontend (SkillStatusBar, SkillInitPrompt, SkillPanel) |
