# Tasks: feat-req-agent-workflow

## Task Breakdown

### 1. System Prompt 设计
- [x] 编写需求分析 Agent 的 system prompt
- [x] 包含项目上下文（CLAUDE.md 内容摘要）
- [x] 包含 feature 文档格式规范
- [x] 包含 queue.yaml 更新指令

### 2. CLI 参数配置
- [x] 确定 `--allowedTools` 范围
- [x] 配置 `--append-system-prompt` 传递方式
- [x] 确保 `--add-dir` 指向正确的 workspace

### 3. 输出验证
- [x] 验证生成的 MD 文件格式与现有规范一致
- [x] 验证 queue.yaml 更新格式正确
- [x] 验证目录命名符合 pending-{id} 规范

### 4. 前端集成
- [x] FS watcher 检测新 feature 创建
- [x] 通知用户 feature 已创建
- [x] 提供"查看生成的 Feature"快捷操作

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-03 | Feature created | 待开发 |
| 2026-04-03 | All tasks completed | System prompt, CLI params, output validation, frontend notification |
