# Feature: fix-analyze-all-state — Analyze All 按钮状态管理与防重复分析

## Basic Information
- **ID**: fix-analyze-all-state
- **Name**: Analyze All 按钮状态管理与防重复分析
- **Priority**: 60
- **Size**: S
- **Dependencies**: none
- **Parent**: null
- **Children**: none
- **Created**: 2026-04-08

## Description

当前 `Analyze All` 按钮存在两个问题：

1. **重复分析**: `analyzeAll()` 方法直接遍历所有传入文件，不跳过已分析过的文件。调用方 `ProjectView.tsx` 传入的是 `pmFileManager.files`（全部文件），导致点击 Analyze All 时已处理的文件会被重新分析，产生重复的 `-analysis.md` 文件。
2. **按钮状态缺失**: Analyze All 按钮在所有文件都已完成分析时仍然可点击，用户无法直观感知"无需操作"。

修复目标：
- `analyzeAll` 内部跳过 `analyzedFiles` Set 中已存在的文件
- UI 层增加 `hasUnanalyzedFiles` 计算属性，当无待分析文件时 Analyze All 按钮置灰（disabled）
- 分析计数（`analyzedCount/files.length`）准确反映当前状态

## User Value Points

1. **防止重复分析**: 用户点击 Analyze All 后，只处理未分析过的文件，节省时间和 API 调用开销
2. **按钮状态可视化**: 无待分析文件时按钮置灰，用户一目了然当前分析进度

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/lib/useMultimodalAnalyze.ts` — 核心逻辑 hook
  - `analyzeAll()` (L240-311): 遍历所有文件，无过滤
  - `analyzedFiles` (Set<string>): 已分析文件 stem 集合
  - `isAnalyzed()` (L326-332): 单文件检查方法
- `neuro-syntax-ide/src/components/views/ProjectView.tsx`
  - L1055: `onAnalyzeAll` 传入全部文件
  - L1409: REQ tab 同样传入全部文件
- `neuro-syntax-ide/src/components/common/FileUploadArea.tsx`
  - L213-239: Analyze All 按钮区域
  - L222: 按钮 disabled 仅判断 `isAnalyzing || disabled`，未判断是否有待分析文件

### Related Documents
- PMDM 目录结构：`{workspace}/.pmdm/` 下存放 `{stem}-analysis.md`

### Related Features
- `feat-agent-multimodal-analyze` (已完成) — 多模态文件分析基础功能

## Technical Solution

### 改动 1: `useMultimodalAnalyze.ts` — `analyzeAll` 跳过已分析文件

```ts
// analyzeAll 方法内，invoke 前增加跳过逻辑
const stem = file.name.split('.').slice(0, -1).join('.') || file.name;
if (analyzedFiles.has(stem)) {
  // 跳过已分析文件，仅更新进度
  setFileStates((prev) => {
    const next = new Map(prev);
    next.set(file.name, { name: file.name, status: 'done', progress: 100 });
    return next;
  });
  continue; // 或在 for 循环中跳过
}
```

同时新增导出计算属性：

```ts
const hasUnanalyzedFiles = useCallback((): boolean => {
  // 需要外部传入 files 列表或在此 hook 内维护
}, [analyzedFiles]);
```

**方案选择**: 在 `analyzeAll` 内部过滤更内聚，调用方无需改动。额外暴露 `getUnanalyzedCount(files)` 给 UI 层做按钮状态判断。

### 改动 2: `useMultimodalAnalyze.ts` — 新增 `getUnanalyzedCount` 方法

```ts
const getUnanalyzedCount = useCallback(
  (files: PMFileEntry[]): number => {
    return files.filter(f => !isAnalyzed(f.name)).length;
  },
  [isAnalyzed],
);
```

在 return 中导出。

### 改动 3: `FileUploadArea.tsx` — Analyze All 按钮 disabled 逻辑

```tsx
const unanalyzedCount = getUnanalyzedCount?.(files) ?? files.length;

// 按钮条件增加无待分析文件判断
disabled={isAnalyzing || disabled || unanalyzedCount === 0}
```

传入 `getUnanalyzedCount` prop 并在按钮区域使用。

### 改动 4: `ProjectView.tsx` — 传入新 prop

```tsx
<FileUploadArea
  ...
  getUnanalyzedCount={multimodalAnalyzer.getUnanalyzedCount}
/>
```

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望 Analyze All 按钮能智能地只分析未处理的文件，并在无需分析时显示为不可用状态，以避免重复处理和误操作。

### Scenarios

#### Scenario 1: Analyze All 跳过已分析文件
```gherkin
Given workspace 中有 3 个文件 A.png, B.pdf, C.md
And A.png 已经被分析过（存在 A-analysis.md）
When 用户点击 "Analyze All" 按钮
Then 只有 B.pdf 和 C.md 被发送到后端进行分析
And A.png 的状态直接显示为 done
And 分析完成后计数显示 "3/3 analyzed"
```

#### Scenario 2: 全部已分析时按钮置灰
```gherkin
Given workspace 中有 2 个文件
And 2 个文件都已经被分析过
Then "Analyze All" 按钮显示为置灰不可点击状态
And 按钮文字仍为 "Analyze All" 但带有 disabled 样式
```

#### Scenario 3: 部分已分析时按钮可用
```gherkin
Given workspace 中有 3 个文件
And 其中 1 个已经被分析过
Then "Analyze All" 按钮可点击
And 计数显示 "1/3 analyzed"
When 点击后只分析剩余 2 个文件
```

### UI/Interaction Checkpoints
- Analyze All 按钮: disabled 时 `text-outline-variant cursor-not-allowed` 样式
- 分析计数文本: 始终显示 `analyzedCount/files.length analyzed`
- 单文件 Sparkles 按钮: 保持现有逻辑（已分析时隐藏）

### General Checklist
- [x] 不影响单文件 analyze 行为
- [x] 不影响 analyzeAll 正在分析时的 loading 状态
- [x] analyzedFiles Set 准确反映后端实际状态

## Merge Record

- **Completed**: 2026-04-08
- **Branch**: feature/fix-analyze-all-state
- **Merge Commit**: 7f9bccf
- **Archive Tag**: fix-analyze-all-state-20260408
- **Conflicts**: none
- **Verification**: passed (3/3 Gherkin scenarios)
- **Stats**: 1 commit, 3 files changed, 34 insertions, 3 deletions
