# Feature: feat-bmad-workspace PM Workshop Tab 基础设施

## Basic Information
- **ID**: feat-bmad-workspace
- **Name**: PM Workshop Tab 基础设施
- **Priority**: 60
- **Size**: S
- **Dependencies**: null
- **Parent**: feat-bmad-workshop
- **Children**: null
- **Created**: 2026-05-29

## Description

创建 PM Workshop 独立 Tab 页面的基础设施，包括：
- 新增 ViewType 和导航项（SideNav index 1，Project 和 Tasks 之间）
- 子 Tab 切换框架（Brainstorm / Party Mode / Create PRD）
- 共享状态管理（BMADSessionState 跨 Skill 产出物传递）
- 共享聊天组件 WorkshopChatPanel（从 ProjectView 提取）
- PRD 文档管理工作区

这是所有子 Feature 的基础依赖。

## User Value Points
1. **统一入口** — 一个 Tab 页面集成所有 AI 产品工作流工具
2. **产出物流转** — 头脑风暴和 Party Mode 的产出无缝传递到 PRD 创建

## Technical Solution

### 1. 类型扩展（src/types.ts）

```typescript
export type ViewType = ... | 'pm-workshop';
export type PMWorkshopTab = 'brainstorm' | 'party-mode' | 'prd';

// Brainstorm 类型
export type BrainstormStep = 'setup' | 'technique' | 'execute' | 'organize';
export interface BrainMethod {
  id: string; name: string; category: string;
  duration: string; energyLevel: 'low' | 'medium' | 'high';
  description: string;
}
export interface BrainstormIdea {
  id: string; category: string; number: number;
  title: string; concept: string; novelty: string;
}

// Party Mode 类型
export interface PartyPersona {
  id: string; name: string; title: string;
  icon: string; accentColor: string;
  description: string; expertise: string[];
}

// PRD 类型
export type PRDIntent = 'create' | 'update' | 'verify';
export type PRDStakeLevel = 'hobby' | 'internal' | 'startup';
export type PRDMode = 'fast-path' | 'coaching-path';
export interface PRDSection {
  id: string; title: string;
  status: 'complete' | 'in-progress' | 'empty';
  content: string;
}
export interface Assumption { id: string; text: string; confirmed: boolean; }

// Workshop 产出物（跨 Skill 传递）
export interface BMADSessionState {
  brainstormOutput?: BrainstormOutput;
  partyInsights?: PartyInsight[];
  prdDocument?: PRDDocument;
}
```

### 2. ChatMessage 扩展（src/lib/useAgentStream.ts）

```typescript
export interface ChatMessage {
  // ... existing fields ...
  workshopType?: 'option-card' | 'idea-card' | 'persona-card' | 'action-menu'
    | 'energy-checkpoint' | 'orchestrator-note' | 'validation-report';
  workshopPayload?: any;
}
```

Agent 在流式文本中使用 HTML 注释标记传递结构化数据。渲染层在 MarkdownRenderer 之前拦截这些标记。

### 3. PMWorkshopView 主视图（src/components/views/PMWorkshopView.tsx）

```
PMWorkshopView (flex flex-col h-full)
├── header (h-14)
│   ├── 标题: "PM Workshop" text-xl font-headline font-bold
│   └── 产出物指示器 (badges)
├── WorkshopTabBar (flex border-b border-outline-variant/10)
│   ├── [Brainstorm] active: text-secondary border-secondary bg-surface-container-lowest
│   ├── [Party Mode]
│   └── [Create PRD]
├── BrainstormPanel (activeTab === 'brainstorm')
├── PartyModePanel (activeTab === 'party-mode')
└── PrdCreationPanel (activeTab === 'prd')
```

**Header 样式:** `h-14 bg-surface-container-low flex items-center justify-between px-6 border-b border-outline-variant/10`
**Tab 按钮样式:**
- Active: `text-secondary border-b-2 border-secondary bg-surface-container-lowest px-4 py-2 text-xs font-bold`
- Inactive: `text-on-surface-variant border-b-2 border-transparent px-4 py-2 text-xs hover:text-on-surface`

### 4. 共享聊天组件 WorkshopChatPanel（src/components/pm-workshop/WorkshopChatPanel.tsx）

从 `ProjectView.tsx:784-930` 提取核心聊天模式。

```typescript
interface WorkshopChatPanelProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSendMessage: (text: string) => void;
  placeholder: string;
  renderWorkshopMessage?: (msg: ChatMessage, idx: number) => ReactNode | null;
  inputAddons?: ReactNode;
  rightPanel?: ReactNode;
}
```

**消息列表:**
```
flex-1 overflow-y-auto p-4 space-y-4 scroll-hide
```

**消息渲染优先级:**
1. `renderWorkshopMessage` 返回非 null → 使用自定义渲染
2. `msg.isToolCall` → ToolCallMessage
3. `msg.role === 'user'` → 右对齐蓝色气泡
4. `msg.role === 'assistant'` → 左对齐灰底气泡 + MarkdownRenderer

**用户消息气泡:**
```
ml-auto items-end
  bg-primary text-on-primary p-3 rounded-lg rounded-tr-none text-xs
```

**Agent 消息气泡:**
```
items-start
  bg-surface-container-high text-on-surface p-3 rounded-lg rounded-tl-none
  border border-outline-variant/10
  [&_p]:text-[10px] [&_pre]:text-[10px]
  流式光标: w-1.5 h-3 bg-primary/70 animate-pulse
```

**输入区:**
```
border-t border-outline-variant/10 bg-surface
  textarea: h-20 text-xs bg-surface-container-low rounded-lg
  底部: 发送按钮 / Loader2 spinner
  键盘: Enter 发送, Shift+Enter 换行
```

### 5. SideNav 注册（src/components/SideNav.tsx）

navItems 数组在 index 1 插入：
```typescript
{ id: 'pm-workshop', icon: FlaskConical, label: t('nav.pmWorkshop') }
```

### 6. App.tsx 视图挂载

```tsx
<div className={cn("absolute inset-0 overflow-hidden",
  activeView === 'pm-workshop' ? 'flex' : 'hidden')}>
  <PMWorkshopView workspacePath={workspace.workspacePath} />
</div>
```

### 7. 共享状态管理

```typescript
// PMWorkshopView.tsx
const [activeTab, setActiveTab] = useState<PMWorkshopTab>('brainstorm');
const [sessionState, setSessionState] = useState<BMADSessionState>({});

// 传递给各 Panel:
<BrainstormPanel sessionState={sessionState}
  onOutputChange={(output) => setSessionState(prev => ({ ...prev, brainstormOutput: output }))} />
```

## Acceptance Criteria (Gherkin)

```gherkin
Feature: PM Workshop Tab 基础设施

Scenario: Tab 导航
  Given 用户在 IDE 侧边栏
  When 用户点击 PM Workshop 图标（FlaskConical，Project 和 Tasks 之间）
  Then 显示 PM Workshop 视图
  And 三个子 Tab 可见: Brainstorm, Party Mode, Create PRD

Scenario: 子 Tab 切换
  Given 用户在 PM Workshop Tab
  When 用户点击不同子 Tab
  Then 对应面板显示，其他隐藏
  And 当前激活 Tab 有 border-bottom 高亮

Scenario: 产出物流转
  Given 用户在 Brainstorm 完成了头脑风暴
  When 用户切换到 Create PRD 子 Tab
  Then PRD Agent 可以引用头脑风暴的产出作为输入
```

## Checklist
- [ ] ViewType 新增 `pm-workshop`
- [ ] BMAD 相关类型定义（PMWorkshopTab, BrainMethod, PartyPersona, PRDSection 等）
- [ ] ChatMessage 扩展 workshopType/workshopPayload
- [ ] SideNav 新增导航项（FlaskConical 图标，index 1）
- [ ] App.tsx 注册新视图
- [ ] PMWorkshopView 组件（header + tab bar + 面板容器）
- [ ] WorkshopChatPanel 共享聊天组件（消息列表 + 输入区）
- [ ] WorkshopChatBubble 共享消息气泡组件
- [ ] WorkshopMessageRenderer 消息类型路由
- [ ] 三个子面板 placeholder 组件
- [ ] BMADSessionState 状态管理
- [ ] i18n 字符串（nav.pmWorkshop 等）

## Merge Record

- **Completed:** 2026-05-29T16:30:00Z
- **Merged Branch:** feature/feat-bmad-workspace
- **Merge Commit:** b6474e3
- **Archive Tag:** feat-bmad-workspace-20260529
- **Conflicts:** none
- **Verification:** PASS (3/3 Gherkin scenarios, 20/20 tasks, TypeScript clean)
- **Stats:** 12 files changed, 565 insertions, 1 deletion
- **Duration:** ~30 minutes
