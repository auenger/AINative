# Feature: feat-agent-multimodal-chat Agent 对话多模态集成

## Basic Information
- **ID**: feat-agent-multimodal-chat
- **Name**: Agent 对话多模态集成
- **Priority**: 60
- **Size**: M
- **Dependencies**: feat-agent-multimodal-upload, feat-agent-multimodal-analyze
- **Parent**: feat-agent-multimodal
- **Children**: []
- **Created**: 2026-04-06T24:00:00Z

## Description
将多模态文件分析能力深度集成到 PM Agent 和 REQ Agent 的聊天界面中。用户可以在对话中直接引用已上传和分析的文件，Agent 会基于 PMDM 中的分析结果进行上下文感知回复。支持在聊天中发送文件附件、查看关联分析报告、以及基于多个文件进行综合需求分析。

## User Value Points
1. **对话中引用文件** — 在 Agent 聊天中直接 @引用 PMFile 文件或 PMDM 分析结果，Agent 自动读取相关上下文
2. **智能上下文注入** — Agent 自动感知工作空间中的 PMFile/PMDM 内容，在回复时主动引用相关信息
3. **综合需求分析** — 基于多个文件的分析结果，Agent 生成跨文件的综合需求文档或 Feature 计划

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/ProjectView.tsx` — PM/REQ Agent 聊天 UI
- `neuro-syntax-ide/src/lib/useAgentStream.ts` — Agent 流式通信
- `neuro-syntax-ide/src/lib/useReqAgentChat.ts` — REQ Agent 聊天 Hook
### Related Documents
### Related Features
- feat-agent-multimodal-upload — 文件上传基础
- feat-agent-multimodal-analyze — 文件分析基础

## Technical Solution
- Created `useMultimodalChat` hook for file reference management, @ mention parsing, PMDM context injection, and comprehensive report generation
- Created `FileReferencePicker` component with search/filter UI, `FileReferenceTag` inline tags, and `FileAttachmentCard` for message bubbles
- Modified `ProjectView.tsx` to integrate @ file reference into both PM Agent and REQ Agent chat inputs
- Added `FileReference` type to `types.ts`
- Token limit handling via `MAX_CONTEXT_CHARS = 12000` with auto-truncation
- Message enrichment via `enrichMessage()` resolves @mentions and loads PMDM analysis context before sending to Agent

## Merge Record
- **Completed**: 2026-04-07T06:00:00Z
- **Branch**: feature/feat-agent-multimodal-chat
- **Merge Commit**: 83401eb
- **Archive Tag**: feat-agent-multimodal-chat-20260407
- **Conflicts**: none
- **Verification**: passed (4/4 scenarios)
- **Commits**: 2 (implementation + verification)
- **Files Changed**: 8 (2 new, 6 modified)
- **Insertions**: 1054
- **Deletions**: 8
- **Duration**: ~1h

## Acceptance Criteria (Gherkin)
### User Story
作为项目管理者，我希望在与 PM Agent / REQ Agent 对话时能直接引用上传的文件和分析结果，让 Agent 基于这些资料进行更准确的需求分析和 Feature 规划。

### Scenarios (Given/When/Then)

#### Scenario 1: 在对话中引用文件
```gherkin
Given PMFile 中有 2 个已分析的文件
When 用户在聊天输入区输入 "基于 @wireframe.png 和 @requirements.pdf 帮我生成功能计划"
Then Agent 应读取这两个文件对应的 PMDM 分析结果
And 基于分析内容生成综合的功能计划回复
```

#### Scenario 2: 自动感知文件上下文
```gherkin
Given PMFile 中有 3 个已分析文件且 PMDM 中有对应分析报告
When 用户在 REQ Agent 中发送 "分析当前项目需求"
Then Agent 应自动读取所有 PMDM 分析报告作为上下文
And 基于全部文件分析生成综合需求分析
```

#### Scenario 3: 文件附件发送到对话
```gherkin
Given 用户上传了一张架构图到 PMFile
When 用户在聊天中直接发送该图片作为消息附件
Then Agent 应通过多模态能力直接分析图片内容
And 在回复中引用图片中的信息
```

#### Scenario 4: 生成跨文件综合报告
```gherkin
Given PMDM 中有 3 份不同文件的分析报告
When 用户请求 "基于所有参考资料生成需求规格说明书"
Then Agent 应综合所有 PMDM 报告内容
And 生成一份统一的 {workspace}/PMDM/综合需求分析.md 文档
```

### UI/Interaction Checkpoints
- 聊天输入区增加 @ 文件引用弹窗
- 消息气泡中显示文件附件卡片（缩略图 + 文件名）
- Agent 回复中可点击引用文件链接
- PMDM 分析结果面板（侧边或弹窗查看）

### General Checklist
- [ ] @ 引用交互体验流畅
- [ ] 多文件上下文不超出 LLM token 限制（自动截断/摘要策略）
- [ ] 文件引用状态同步（新增/删除文件时更新引用列表）
- [ ] 综合报告 MD 格式完整
