# Feature: feat-workshop-ux-enhance

## Basic Information
- **ID**: feat-workshop-ux-enhance
- **Name**: PM Workshop UX 增强（可拖拽分栏 + 工具调用美化 + PRD 文件选择）
- **Priority**: 60
- **Size**: M
- **Dependencies**: feat-workshop-chat-ux-polish
- **Parent**: feat-bmad-workshop
- **Created**: 2026-05-30
- **Completed**: 2026-05-30

## Description

在 feat-workshop-chat-ux-polish 基础上，进一步优化 PM Workshop 的用户体验：

1. **Party Mode 可拖拽分栏**: 左侧 Agent 对话和右侧角色卡片面板默认 50/50 宽度，支持鼠标拖拽分割线调整（20%~80% 范围）
2. **Party Mode 自动汇总**: 多角色讨论结束后，自动将每个角色的视角内容（过滤工具调用噪音）汇总到左侧 Agent 生成综合总结
3. **工具调用美化渲染**: 将 `[tool: X] {json}` 和 `<tool_use>XML</tool_use>` 提取为带图标的 Chip 组件（FileText/Pencil/Terminal/Search/Cpu 等），替换原始字符串显示，适用于所有 Workshop Tab
4. **PRD 文件自动检测与渲染**: 进入 PRD Tab 自动检测 `PRODUCT.md` / `docs/*-prd.md` 并渲染为 Document Outline，监听文件系统变更自动刷新
5. **PRD 文件选择下拉框**: Header 文件选择按钮变为下拉列表，PRD/Product 文件优先排序，支持点击切换渲染
6. **Session ID 捕获修复**: capture 模式下防止角色执行 Session 覆盖 Orchestrator 的 session_id

## Technical Solution

### 新增工具函数 (`lib/utils.ts`)
- `parseContentSegments(content)`: 将内容解析为 `ContentSegment[]`（text / tool-call）
- `filterToolCallText(content)`: 移除所有工具调用文本（用于汇总消息构建）
- `cleanNoiseText(text)`: 清理 task_progress、INIT、OPTIONS 等噪音
- `extractParam(jsonStr)`: 从 JSON 提取关键参数（file_path/command/pattern 等）

### ToolCallChip 组件
- 工具名映射图标: Read→FileText, Write/Edit→Pencil, Bash→Terminal, Grep→Search, Agent→Cpu, Glob→FolderSearch
- 紧凑内联布局: 图标 + 工具名 + 参数截断显示

### Resizable Split Layout
- `splitRatio` state 控制（默认 0.5，范围 0.2~0.8）
- mousemove/mouseup 全局事件监听，拖拽手柄 `w-2` + 扩展点击区域

### PRD 文件系统
- `read_file_tree` 扫描工作区 .md 文件
- `fs://workspace-changed` 事件监听文件变更
- `parseMarkdownToPrdSections()` 按 `##` 标题拆分为 PRDSection[]

## Acceptance Criteria

### Scenario 1: 可拖拽分栏
- Given Party Mode 有左右面板
- When 用户拖拽中间分割线
- Then 两侧面板宽度跟随鼠标变化（20%~80% 范围）

### Scenario 2: 工具调用 Chip 渲染
- Given Agent 返回包含 `[tool: Read] {"file_path": "..."}` 的内容
- When 内容渲染到聊天气泡
- Then 显示为带 FileText 图标的 "Read /path/to/file" Chip

### Scenario 3: PRD 文件自动加载
- Given 工作区存在 PRODUCT.md
- When 用户进入 PRD Tab
- Then 右侧 Document Outline 自动渲染 PRODUCT.md 内容

### Scenario 4: 文件选择下拉
- Given 工作区有多个 .md 文件
- When 用户点击文件选择按钮
- Then 下拉列表显示，PRD/Product 文件排在顶部

## Files Changed

- `neuro-syntax-ide/src/lib/utils.ts` — 新增 parseContentSegments/filterToolCallText/cleanNoiseText
- `neuro-syntax-ide/src/components/pm-workshop/WorkshopChatBubble.tsx` — ToolCallChip + segment 渲染
- `neuro-syntax-ide/src/components/pm-workshop/PersonaCardMessage.tsx` — ToolCallChip + segment 渲染
- `neuro-syntax-ide/src/components/pm-workshop/WorkshopChatPanel.tsx` — 可拖拽分栏布局
- `neuro-syntax-ide/src/components/pm-workshop/PartyModePanel.tsx` — 自动汇总 + filterToolCallText
- `neuro-syntax-ide/src/components/pm-workshop/PrdCreationPanel.tsx` — 文件检测/渲染/选择下拉
- `neuro-syntax-ide/src/lib/useAgentStream.ts` — session_id capture 修复
- `neuro-syntax-ide/src/components/views/PMWorkshopView.tsx` — minor
