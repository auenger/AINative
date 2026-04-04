# Feature: feat-pipeline-yaml-editor Pipeline YAML/JSON 直接编辑模式

## Basic Information
- **ID**: feat-pipeline-yaml-editor
- **Name**: Pipeline YAML/JSON 直接编辑模式
- **Priority**: 70
- **Size**: S
- **Dependencies**: [feat-pipeline-visual-editor]
- **Parent**: feat-pipeline-editor
- **Children**: []
- **Created**: 2026-04-04

## Description
在 Pipeline 编辑器中添加 YAML/JSON 代码编辑模式，用户可以直接编辑 PipelineConfig 的原始配置文本。

### 核心功能
- YAML 模式：直接编辑 PipelineConfig 的 YAML 文本
- JSON 模式：直接编辑 PipelineConfig 的 JSON 文本
- 格式切换：YAML ↔ JSON 互转
- 实时校验：语法错误高亮 + 类型校验
- 保存：校验通过后解析为 PipelineConfig 对象并持久化

### 参考组件
- EditorView 中的代码编辑区域
- Monaco Editor（Phase 3 集成，当前用 textarea + 语法高亮）

## User Value Points
1. **直接文本编辑 Pipeline 配置** — 高级用户可以直接编辑 YAML/JSON，效率更高
2. **YAML ↔ JSON 格式互转** — 方便不同偏好用户之间的配置共享

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/types.ts` — PipelineConfig 类型定义
- `neuro-syntax-ide/src/lib/usePipelineEngine.ts` — savePipeline()

### Related Features
- `feat-pipeline-visual-editor` (前序依赖) — 可视化编辑器

## Technical Solution

### Approach
Created a standalone `PipelineTextEditor` component at `neuro-syntax-ide/src/components/views/PipelineTextEditor.tsx` that provides:

1. **YAML/JSON Text Editing** — A textarea-based code editor with monospace font, line numbers, and syntax-aware cursor styling
2. **Format Toggle** — YAML/JSON mode switch with automatic content conversion between formats
3. **Lightweight YAML Parser** — Custom YAML serializer/deserializer (no external dependency) that handles PipelineConfig's flat structure (top-level key-values, arrays of stage objects, simple variable maps)
4. **Real-time Validation** — Two-layer validation:
   - Parse validation: YAML/JSON syntax correctness
   - Schema validation: Required PipelineConfig fields (id, name, stages), per-stage required fields (id, name, runtime_id, prompt_template), kebab-case id format
5. **Save Integration** — Parses text to PipelineConfig object, validates, then calls `onSave()` which delegates to `usePipelineEngine.savePipeline()`
6. **Keyboard Shortcut** — Ctrl/Cmd+S to save
7. **UI Layout** — Three areas: top bar (metadata + format toggle + actions), main editor with line numbers, validation sidebar with error display and parsed preview

### Integration
- Added `PipelineTextEditor` import to `AgentControlPanel.tsx`
- Added `pipelineEditorMode` state ('visual' | 'text') to switch between editors
- Added "Edit (Text)" button on each pipeline list item
- Added "New Pipeline (Text)" button next to existing "New Pipeline" buttons
- Both editors share the same save/delete handlers and call `usePipelineEngine.savePipeline()`

### Files Changed
- `neuro-syntax-ide/src/components/views/PipelineTextEditor.tsx` (NEW) — Text editor component
- `neuro-syntax-ide/src/components/views/AgentControlPanel.tsx` (MODIFIED) — Integration

## Acceptance Criteria (Gherkin)
### User Story
作为高级用户，我想直接编辑 PipelineConfig 的 YAML/JSON 文本，而不是通过可视化界面。

### Scenarios (Given/When/Then)

#### Scenario 1: 切换到 YAML 编辑模式
- Given 用户在 Pipeline 编辑器中
- When 用户切换到 "YAML" 编辑模式
- Then 显示当前 PipelineConfig 的 YAML 文本
- And 用户可以编辑文本

#### Scenario 2: YAML 语法校验
- Given 用户在 YAML 编辑模式中
- When 用户输入了无效 YAML
- Then 编辑器显示语法错误提示
- And 保存按钮被禁用

#### Scenario 3: YAML ↔ JSON 互转
- Given 用户在 YAML 编辑模式中
- When 用户切换到 JSON 模式
- Then 文本自动转换为等效 JSON 格式

#### Scenario 4: 保存文本编辑结果
- Given 用户完成文本编辑且校验通过
- When 用户点击保存
- Then 文本被解析为 PipelineConfig 对象并通过 savePipeline() 持久化

### UI/Interaction Checkpoints
- [ ] YAML/JSON 格式切换按钮
- [ ] 代码编辑区域（monospace 字体）
- [ ] 语法错误提示区域
- [ ] 保存按钮（校验失败时禁用）

### General Checklist
- [ ] 使用 PipelineConfig 类型做校验
- [ ] YAML 解析可用轻量库（如 js-yaml）或自行实现简单解析
