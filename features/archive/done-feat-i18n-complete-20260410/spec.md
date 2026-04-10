# Feature: feat-i18n-complete 中英文国际化完善

## Basic Information
- **ID**: feat-i18n-complete
- **Name**: 中英文国际化完善
- **Priority**: 60
- **Size**: M
- **Dependencies**: None
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-10

## Description
检查所有现有组件，将遗漏的硬编码字符串补充到 i18n 翻译系统，确保全部 UI 文本支持中英文切换。项目已有 i18next + react-i18next 基础设施，大部分核心组件已接入，但仍有部分组件未使用 i18n 或存在硬编码字符串。

## User Value Points

### VP1: 已有组件硬编码修复
修复已有 i18n 组件中残留的硬编码字符串，使用户切换语言时所有文本都能正确响应。

- TaskBoard.tsx: `formatUpdatedTime()` 函数中的中文 (刚刚/分钟前/今天/昨天) + "队列更新于"
- ProjectView.tsx: reqAgent greetingMessage 硬编码中文
- EditorView.tsx: t() 的 inline fallback 值未注册到 i18n.ts

### VP2: 未接入 i18n 的组件补全
为尚未使用 useTranslation 的组件接入 i18n，翻译所有用户可见文本。

未接入组件清单:
- RuntimeOutputModal.tsx: "Clear output and close", "Close"
- FileUploadArea.tsx: "Analyze all files", "Analyzing...", "Analyze All", "Delete file", "Attach files"
- AgentControlPanel.tsx: "Copy install command", "My Agent", empty state hints
- PipelineVisualEditor.tsx: "Pipeline Name", "Auto Layout", "Delete Stage"
- PipelineEditorContainer.tsx: "Visual" label
- StagePropertyPanel.tsx: "Analysis Stage" placeholder

### VP3: i18n.ts 翻译 key 完善
将所有散落在 t() inline fallback 中的翻译 key 正式注册到 i18n.ts，确保翻译集中管理。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/i18n.ts` — 翻译资源配置（en + zh）
- 已接入 i18n 的 7 个组件: TopNav, SideNav, ProjectView, EditorView, TaskBoard, SettingsView, MissionControl
- 未接入的 6 个组件: RuntimeOutputModal, FileUploadArea, AgentControlPanel, PipelineVisualEditor, PipelineEditorContainer, StagePropertyPanel

### Related Documents
- CLAUDE.md — 项目技术栈说明

### Related Features
- 无直接依赖

## Technical Solution

### 方案概述
1. **新增 i18n 翻译 namespace** — 为 Pipeline/Agent/Upload/Output 等模块新增翻译分组
2. **修复 TaskBoard 时间格式化** — 将硬编码中文替换为 i18n key，使用 interpolation 传参
3. **逐组件接入 i18n** — 为 6 个未接入组件添加 useTranslation hook，替换硬编码文本
4. **集中管理翻译 key** — 所有 key 注册到 i18n.ts，移除 inline fallback

### i18n.ts 新增 key 规划

```typescript
// 新增分组
time: {
  justNow: 'Just now' / '刚刚',
  minutesAgo: '{{min}} minutes ago' / '{{min}} 分钟前',
  today: 'Today {{time}}' / '今天 {{time}}',
  yesterday: 'Yesterday {{time}}' / '昨天 {{time}}',
  queueUpdatedAt: 'Queue updated at {{time}}' / '队列更新于 {{time}}'
},
agent: {
  greetReqAgent: '...' / '你好！我是需求分析 Agent...',
  copyCommand: 'Copy install command' / '复制安装命令',
  myAgent: 'My Agent' / '我的 Agent',
  newAgentHint: 'Click "New Agent" to create your first agent' / '点击"新建 Agent"创建第一个代理',
  newPipelineHint: 'Click "New Pipeline" to create your first pipeline' / '点击"新建 Pipeline"创建第一个流水线'
},
upload: {
  analyzeAll: 'Analyze All' / '分析全部',
  analyzing: 'Analyzing...' / '分析中...',
  analyzeFiles: 'Analyze all files' / '分析所有文件',
  analyzeFile: 'Analyze this file' / '分析此文件',
  deleteFile: 'Delete file' / '删除文件',
  confirmDelete: 'Click again to confirm delete' / '再次点击确认删除',
  attachFiles: 'Attach files' / '添加文件'
},
output: {
  clearClose: 'Clear output and close' / '清除输出并关闭',
  close: 'Close' / '关闭'
},
pipeline: {
  name: 'Pipeline Name' / '流水线名称',
  autoLayout: 'Auto Layout' / '自动布局',
  deleteStage: 'Delete Stage' / '删除阶段',
  addStageHint: 'Click "Add Stage" in the left panel to get started' / '点击左侧面板的"添加阶段"开始',
  visual: 'Visual' / '可视化',
  analysisStage: 'Analysis Stage' / '分析阶段'
}
```

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望所有 UI 文本都能根据语言设置正确显示中英文，以便我用熟悉的语言使用 IDE。

### Scenarios (Given/When/Then)

#### Scenario 1: 语言切换 - 已有组件无硬编码
```gherkin
Given 用户已打开 IDE
When 用户将语言从中文切换为英文
Then 所有导航栏、侧边栏、项目视图、编辑器、任务板、设置的文本都应为英文
And 不应出现任何中文硬编码文本（如"刚刚"、"分钟前"、"队列更新于"）
```

#### Scenario 2: 语言切换 - 新接入组件
```gherkin
Given 用户使用 Agent 控制面板
When 用户将语言切换为中文
Then Agent 控制面板中所有文本应为中文
And 文件上传区域所有按钮和提示应为中文
And Runtime Output 弹窗中所有文本应为中文
```

#### Scenario 3: Pipeline 编辑器国际化
```gherkin
Given 用户打开 Pipeline 可视化编辑器
When 用户将语言切换为中文
Then "Pipeline Name" 应显示为 "流水线名称"
And "Auto Layout" 应显示为 "自动布局"
And 空状态提示应为中文
```

#### Scenario 4: TaskBoard 时间格式化多语言
```gherkin
Given 任务板显示队列更新时间
When 语言为中文时，应显示 "刚刚" / "3 分钟前" / "今天 14:30" / "昨天 10:00"
When 语言为英文时，应显示 "Just now" / "3 minutes ago" / "Today 14:30" / "Yesterday 10:00"
```

### UI/Interaction Checkpoints
- [ ] TopNav 语言切换按钮正常工作
- [ ] 切换后所有可见文本即时更新
- [ ] 不需要刷新页面

### General Checklist
- [ ] 无硬编码中文字符串在组件 JSX 中
- [ ] 无硬编码英文字符串在组件 JSX 中（除技术术语外）
- [ ] 所有 t() key 在 i18n.ts 中有对应注册
- [ ] en 和 zh 翻译一一对应，无遗漏
