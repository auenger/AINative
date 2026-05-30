# Tasks: feat-agent-runtime-skills

## Task Breakdown

### 1. Skill Registry Abstraction
- [ ] 定义 `SkillRegistry` trait 和 `SkillInfo` 类型
- [ ] 实现 OpenClaw Skill Registry（基于 `openclaw skills` CLI）
- [ ] 实现 Hermes Skill Registry（基于 `hermes skills` CLI）

### 2. Tauri Backend
- [ ] 实现 `skills_list_installed` IPC Command
- [ ] 实现 `skills_search` IPC Command
- [ ] 实现 `skills_install` / `skills_uninstall` / `skills_update` IPC Commands

### 3. Frontend UI
- [ ] Agent Skills 面板组件
- [ ] Provider 标签切换（OpenClaw / Hermes）
- [ ] 已安装 Skills 列表与操作
- [ ] 可用 Skills 搜索与安装
- [ ] Skill 配置编辑弹窗

### 4. Frontend Hook
- [ ] `useAgentSkills` Hook（统一管理两个 Provider 的 Skills）

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-09 | 规划完成 | 依赖 feat-agent-provider-core |
