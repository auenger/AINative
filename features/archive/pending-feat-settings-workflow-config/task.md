# Tasks: feat-settings-workflow-config

## Task Breakdown

### 1. 类型定义
- [ ] 在 `types.ts` 中新增 `WorkflowConfig` 接口及相关子类型

### 2. Workflow 配置 Hook
- [ ] 创建 `useWorkflowConfig.ts` Hook
  - [ ] 读取 `feature-workflow/config.yaml` 并解析为 WorkflowConfig
  - [ ] dirty state 跟踪
  - [ ] 保存（YAML 序列化写回文件）
  - [ ] 重置功能
  - [ ] Tauri FS API + localStorage dev fallback

### 3. SettingsView — Workflow Tab UI
- [ ] 在 SettingsView 中新增第四个 Tab "Workflow"
- [ ] 实现 Group 1: 并行与自动化（max_concurrent 数字输入 + auto_start / auto_start_next Toggle）
- [ ] 实现 Group 2: Git 行为（auto_push / push_tags Toggle）
- [ ] 实现 Group 3: 归档与清理（create_tag / delete_worktree / delete_branch Toggle）
- [ ] 保存/重置按钮逻辑
- [ ] dirty state 切换提示

### 4. 样式与主题
- [ ] Toggle 开关样式与现有 General Tab 保持一致
- [ ] 暗色/亮色主题适配
- [ ] 响应式布局验证

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-27 | Feature created | 待开发 |
