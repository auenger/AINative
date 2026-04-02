# Feature: feat-md-render-task-detail

## Basic Information
- **ID**: feat-md-render-task-detail
- **Name**: Task 详情弹窗 Markdown 富渲染
- **Priority**: 75
- **Size**: S
- **Dependencies**: []
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-02

## Description
强化 TaskBoard 任务详情弹窗中的 Markdown 内容渲染能力。当前 spec.md、task.md、checklist.md 的内容以原始文本字符串形式展示（或未展示），需要使用 react-markdown 实现富文本渲染，支持标题、列表（含复选框）、代码块、表格、链接等 Markdown 语法。

## User Value Points
1. **Markdown 富渲染**: 在任务详情弹窗中，将 spec.md、task.md、checklist.md 的 Markdown 内容正确渲染为格式化的富文本，包括标题层级、有序/无序列表、GFM 复选框、代码块语法高亮、表格、粗体/斜体等。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx` — 弹窗渲染逻辑（第500-633行）
  - 当前 spec.md 用 `<pre>` 标签渲染原始文本（第613行）
  - task.md 和 checklist.md 未在弹窗中展示
- `neuro-syntax-ide/src/lib/useQueueData.ts` — `readDetail()` 返回 `Record<string, string>`
  - 包含 `spec.md`、`task.md`、`checklist.md` 的原始 Markdown 文本
- `neuro-syntax-ide/package.json` — 已安装 `react-markdown@^10.1.0`

### Related Documents
- 项目使用 Tailwind CSS 4.x，Markdown 渲染样式需适配深色科幻主题
- 设计系统：背景 `#020617`，主色 `#a2c9ff`，代码字体 JetBrains Mono

### Related Features
- feat-fs-database-engine (已完成) — 提供队列数据
- feat-ui-cleanup (pending) — UI 清理优化

## Technical Solution

### 核心方案
1. 创建独立的 `MarkdownRenderer` 组件，封装 `react-markdown` 并添加自定义样式
2. 在 TaskBoard 弹窗中替换 `<pre>` 标签为 `MarkdownRenderer`
3. 新增 task.md 和 checklist.md 的 Tab 切换展示
4. 使用 Tailwind CSS 的 `@tailwindcss/typography` 插件或手写 prose 样式实现 Markdown 排版

### 实现细节
- **MarkdownRenderer 组件**: 封装 react-markdown，配置自定义组件映射（h1-h6、ul/ol/li、code/pre、table、a、input[checkbox]）
- **弹窗改造**: 将单块 spec 预览改为 Tab 切换（Spec / Tasks / Checklist），每个 Tab 用 MarkdownRenderer 渲染对应文件内容
- **样式适配**: 深色主题下的 prose 样式，与项目设计系统保持一致

## Acceptance Criteria (Gherkin)

### User Story
作为开发者，我希望在点击任务卡片时，弹窗中能以格式化的方式查看 spec.md、task.md、checklist.md 的内容，而不是看到原始的 Markdown 字符串。

### Scenarios (Given/When/Then)

#### Scenario 1: Spec Markdown 富渲染
- Given 任务详情弹窗已打开
- And 该任务有 spec.md 内容
- When 用户查看 Spec 区域
- Then Markdown 内容应正确渲染为格式化文本
- And 标题（# ~ ######）应显示为不同大小的层级标题
- And 列表（- / 1.）应渲染为对应的 HTML 列表
- And 代码块（```）应渲染为带等宽字体的代码区域
- And 表格应渲染为带边框的 HTML 表格

#### Scenario 2: Task 和 Checklist 文件渲染
- Given 任务详情弹窗已打开
- And 该任务有 task.md 和/或 checklist.md 内容
- When 用户切换到 Tasks 或 Checklist Tab
- Then 对应的 Markdown 内容应正确渲染
- And GFM 复选框（- [ ] / - [x]）应渲染为可识别的复选框样式

#### Scenario 3: 无详情文件时的降级处理
- Given 任务详情弹窗已打开
- And 该任务没有 spec.md / task.md / checklist.md 内容
- When 用户查看详情区域
- Then 应显示友好的空状态提示（如 "No spec available"）
- And 不应显示报错信息

### UI/Interaction Checkpoints
- 弹窗宽度可适当增大（max-w-xl -> max-w-2xl）以容纳更多内容
- Tab 切换：Spec | Tasks | Checklist
- Markdown 渲染区域应有最大高度限制和滚动条
- 深色主题下文字对比度良好

### General Checklist
- [x] 复用项目已有的 react-markdown 依赖
- [x] 样式与项目深色科幻主题一致
- [x] 不引入新的重型依赖

## Merge Record
- **Completed**: 2026-04-02T20:30:00Z
- **Merged Branch**: feature/feat-md-render-task-detail
- **Merge Commit**: 46a536f
- **Merged To**: main
- **Archive Tag**: feat-md-render-task-detail-20260402
- **Conflicts**: None
- **Verification Status**: passed (3/3 scenarios passed)
- **Stats**:
  - Started: 2026-04-02T20:00:00Z
  - Duration: ~30m
  - Commits: 1
  - Files Changed: 2
