# Tasks: feat-workshop-ux-enhance

## Task Breakdown

### 1. 可拖拽分栏
- [x] WorkshopChatPanel 添加 splitRatio state + 鼠标拖拽事件
- [x] 拖拽手柄 UI（w-2 + hover/active 视觉反馈）
- [x] 左右面板宽度随 splitRatio 动态调整（20%~80% 范围限制）

### 2. 工具调用美化
- [x] utils.ts 实现 parseContentSegments（支持 [tool: X] 和 <tool_use> 两种格式）
- [x] ToolCallChip 组件（图标映射 + 参数提取 + 紧凑样式）
- [x] WorkshopChatBubble 应用 segment 渲染
- [x] PersonaCardMessage 应用 segment 渲染

### 3. Party Mode 自动汇总
- [x] 多角色讨论结束后构建汇总消息
- [x] filterToolCallText 过滤角色内容中的工具调用噪音
- [x] 汇总消息发送到左侧 Agent 生成综合总结

### 4. PRD 文件系统
- [x] 自动检测 PRODUCT.md / docs/*-prd.md
- [x] parseMarkdownToPrdSections 解析 markdown
- [x] fs://workspace-changed 监听文件变更自动刷新
- [x] 文件选择下拉框（.md 文件列表 + PRD 优先排序）

### 5. Bug 修复
- [x] useAgentStream capture 模式 session_id 覆盖修复

## Progress Log

| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-30 | 全部完成 | 5 项任务均实现并验证 |
