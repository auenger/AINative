# Tasks: feat-agent-multimodal-chat
## Task Breakdown
### 1. 前端 Hook — useMultimodalChat
- [x] `useMultimodalChat(workspacePath)` Hook: 封装文件引用与上下文注入
- [x] 文件引用列表管理（@ 引用哪些文件）
- [x] 上下文注入逻辑（将 PMDM 内容附加到 Agent system prompt 或 user message）

### 2. UI — @ 文件引用交互
- [x] 聊天输入区 @ 弹窗：输入 @ 时弹出 PMFile/PMDM 文件选择列表
- [x] 引用标签显示（类似 @filename 缩略标签）
- [x] 消息气泡中显示引用的文件附件卡片

### 3. Agent 对话集成
- [x] PM Agent sendMessage 扩展：支持附加文件上下文
- [x] REQ Agent sendMessage 扩展：支持附加文件上下文
- [x] System Prompt 增强：注入 PMDM 分析摘要作为背景知识
- [x] Token 限制处理策略：多文件时自动截断/优先级排序

### 4. 综合报告生成
- [x] "基于所有文件生成综合分析" 操作入口
- [x] 跨文件综合分析 Prompt 设计
- [x] 综合报告 MD 输出到 {workspace}/PMDM/综合分析-{timestamp}.md

### 5. 集成与测试
- [x] PM Agent @ 引用端到端测试
- [x] REQ Agent 自动上下文感知测试
- [x] 多文件综合分析测试
- [x] Token 限制边界测试

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-07 | All tasks completed | useMultimodalChat hook + FileReferencePicker UI + ProjectView integration + comprehensive report generation |
