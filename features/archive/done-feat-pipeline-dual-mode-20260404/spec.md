# Feature: feat-pipeline-dual-mode Pipeline 双模式切换与实时同步

## Basic Information
- **ID**: feat-pipeline-dual-mode
- **Name**: Pipeline 双模式切换与实时同步
- **Priority**: 65
- **Size**: S
- **Dependencies**: [feat-pipeline-visual-editor, feat-pipeline-yaml-editor]
- **Parent**: feat-pipeline-editor
- **Children**: []
- **Created**: 2026-04-04

## Description
将可视化编辑器和文本编辑器统一为一个 Pipeline 编辑体验，用户可以在两种模式间自由切换，编辑状态实时双向同步。

### 核心功能
- 模式切换器（Visual ↔ Text）在编辑器顶部
- Visual → Text：将 PipelineConfig 对象序列化为 YAML/JSON 文本
- Text → Visual：将 YAML/JSON 文本解析为 PipelineConfig 对象，更新画布节点
- 切换时保留未保存的修改（提示用户或自动同步）
- 统一的保存/取消/删除操作栏

## User Value Points
1. **无缝模式切换** — 在可视化与文本之间自由切换，适应不同编辑场景
2. **实时双向同步** — 任何模式的修改在切换时自动同步到另一模式，不丢失数据

## Context Analysis
### Reference Code
- `feat-pipeline-visual-editor` — 可视化编辑器组件
- `feat-pipeline-yaml-editor` — 文本编辑器组件
- `neuro-syntax-ide/src/lib/usePipelineEngine.ts` — Pipeline 状态管理

### Related Features
- `feat-pipeline-visual-editor` (前序依赖)
- `feat-pipeline-yaml-editor` (前序依赖)

## Technical Solution

### Architecture
- **`usePipelineDualMode` hook** (`src/lib/usePipelineDualMode.ts`): Central state management for dual-mode editing. Manages a single `PipelineConfig` as the source of truth for visual mode, and text state for YAML/JSON modes. Provides bidirectional sync on mode switches, with validation gates preventing invalid text from switching to visual mode.
- **`PipelineEditorContainer`** (`src/components/views/PipelineEditorContainer.tsx`): Unified container component with a top bar containing mode switcher (Visual / YAML / JSON), save/cancel/delete actions, and dirty indicator. Embeds `PipelineVisualEditor` or `PipelineTextEditor` based on current mode.
- **Modified `PipelineTextEditor`**: Added `externalFormat`, `externalText`, `onExternalTextChange`, and `hideTopBar` props for controlled-mode embedding.
- **Modified `AgentControlPanel`**: Replaced separate visual/text editor toggling with the unified `PipelineEditorContainer`. Simplified pipeline creation/editing UX.

### Key Design Decisions
1. Serialization functions (`toYaml`, `fromYaml`, `toJson`, `fromJson`, `validatePipelineConfig`) extracted to the hook for shared use.
2. Mode switch from text to visual is gated by validation -- prevents data loss from invalid text.
3. Mode switch from visual to text always succeeds (serialization cannot fail).
4. Text-to-text conversion (YAML <-> JSON) goes through the config object as intermediate.

## Acceptance Criteria (Gherkin)
### User Story
作为用户，我想在可视化编辑和文本编辑之间自由切换，且两种模式的编辑内容实时同步。

### Scenarios (Given/When/Then)

#### Scenario 1: Visual → Text 切换
- Given 用户在可视化模式中修改了 Stage 配置
- When 用户切换到 Text 模式
- Then YAML/JSON 文本自动更新为最新配置
- And 所有修改完整保留

#### Scenario 2: Text → Visual 切换
- Given 用户在 Text 模式中编辑了 YAML 文本且语法正确
- When 用户切换到 Visual 模式
- Then 画布节点和属性面板更新为文本中的配置
- And 节点布局自动重新排列

#### Scenario 3: Text 校验失败时切换
- Given 用户在 Text 模式中编辑了 YAML 但存在语法错误
- When 用户尝试切换到 Visual 模式
- Then 显示错误提示，阻止切换（或提供"放弃修改"选项）

### UI/Interaction Checkpoints
- [x] 模式切换按钮（Visual / YAML / JSON）
- [ ] 切换动画过渡
- [x] 未保存修改提示

### General Checklist
- [x] 共享同一个 PipelineConfig 状态对象
- [x] 切换逻辑封装为独立 hook

## Merge Record

- **Completed**: 2026-04-04T17:30:00Z
- **Merged Branch**: feature/feat-pipeline-dual-mode
- **Merge Commit**: 46de373b891c0077f5f6050a7916bbfcc8fe3b61
- **Archive Tag**: feat-pipeline-dual-mode-20260404
- **Conflicts**: None
- **Verification**: passed (3/3 Gherkin scenarios validated, build passes)
- **Stats**: 4 files changed, 805 insertions(+), 41 deletions(-), 2 new files
