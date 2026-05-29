# Tasks: feat-bmad-party-mode

## Task Breakdown

### 1. 数据与 Prompt
- [x] `persona-definitions.ts` — 5 个角色定义 (Winston/Alex/Sally/Marcus/Jordan)
  - 含: id, name, title, icon(emoji), accentColor, description, expertise, prompt
- [x] `party-mode-prompts.ts` — PARTY_ORCHESTRATOR_PROMPT + buildPersonaPrompt()

### 2. 核心 Hook
- [x] `usePartyAgentPool.ts` — 多角色 session 管理
  - personaSessions state, executePersonas (顺序), executePersona (定向)
  - 顺序执行流程: 编排器选角色 → 角色1生成 → 角色2生成 → ... → 编排器备注

### 3. 核心组件
- [x] `PersonaCardMessage.tsx` — 角色回应卡片（最核心组件）
  - `bg-surface-container-low border-l-3 border-{accent} rounded-lg`
  - header: emoji (w-7 h-7 rounded-full) + name (font-bold) + title badge
  - body: MarkdownRenderer + streaming cursor
  - loading: header + skeleton body (animate-pulse)
  - 5 种 accent 色: blue/amber/emerald/red/purple
- [x] `OrchestratorNoteMessage.tsx` — 编排器备注
  - `bg-surface-container-high/50 italic text-on-surface-variant text-[10px]`
- [x] `PersonaReferencePicker.tsx` — 角色 @ 引用选择器
  - 复用 FileReferencePicker 模式，/@\w*$/ 触发，弹出角色列表

### 4. PartyModePanel 面板
- [x] 创建 `PartyModePanel.tsx`
- [x] 欢迎页: PersonaRoster 角色网格 (`grid grid-cols-2 gap-2`)
- [x] 讨论页: WorkshopChatPanel + 自定义消息渲染
- [x] 自定义消息渲染: persona-card / orchestrator-note
- [x] 输入区集成 PersonaReferencePicker (inputAddons)
- [x] 编排器 Agent 集成: useAgentStream + PARTY_ORCHESTRATOR_PROMPT

### 5. 产出物管理
- [x] 角色洞察序列化到 BMADSessionState.partyInsights
- [x] 对话摘要管理（<400 字，每 2-3 轮更新）

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-29 | Feature created | Party Mode 子 Feature |
