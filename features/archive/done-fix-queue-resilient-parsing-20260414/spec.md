# Feature: fix-queue-resilient-parsing Task Board YAML 解析容错

## Basic Information
- **ID**: fix-queue-resilient-parsing
- **Name**: Task Board YAML 解析容错与字段兼容
- **Priority**: 70
- **Size**: S
- **Dependencies**: none
- **Parent**: null
- **Children**: none
- **Created**: 2026-04-13

## Description

当前 TaskBoard 的 Rust 后端解析 `queue.yaml` 使用 `serde_yaml::from_str` 对整体做严格反序列化，一旦遇到非预期字段（如 `parent`、`depends_on`、`description`、`status`、`defer_reason`、`value_points`）或单个条目格式异常（类型不匹配、缩进错误），整个解析就失败，前端 TaskBoard 完全无法渲染。

参考 ~/mycode/anyclaw/feature-workflow/queue.yaml 的情况，不同项目的 queue.yaml 有不同的额外字段。应改为「尽力而为」模式：只取渲染所需的最小字段集，跳过无法解析的条目，保证 TaskBoard 始终能渲染出有效数据。

## User Value Points

1. **容错解析** — 单个条目解析失败不阻塞整体渲染，跳过异常条目，其余正常展示
2. **字段兼容** — 支持 `depends_on`/`dependencies`、`children`/`features` 等字段别名，以及 `parent`、`description`、`status` 等额外字段静默忽略
3. **降级展示** — 即使只有 `id` 字段也能渲染卡片，其他字段用合理默认值

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src-tauri/src/lib.rs` — Rust 数据结构 (FeatureNode, ParentEntry, QueueYaml) 及 `fetch_queue_state` 函数
- `neuro-syntax-ide/src/lib/useQueueData.ts` — 前端 hook，接收 QueueState

### Related Documents
- ~/mycode/anyclaw/feature-workflow/queue.yaml — 字段更丰富的参考 YAML

### Related Features
- 无前置依赖

## Technical Solution

### 方案：两阶段解析 + 逐条容错

**阶段 1 — 宽松顶层结构解析：**
- 先用 `serde_yaml::Value` 解析顶层 YAML，获取 `meta`/`parents`/`active`/`pending`/`blocked`/`completed` 各 section
- 顶层解析失败才返回错误；各 section 为空则用默认空数组

**阶段 2 — 逐条 FeatureNode 解析：**
- 对每个 section 的条目逐一用 `serde_yaml::from_value::<FeatureNode>()` 解析
- 单条失败时 log warning 并 skip，不中断其余条目
- 对 `ParentEntry` 同理逐条解析

**字段别名支持：**
- `FeatureNode`: `depends_on` → `dependencies`，增加 `parent`、`description` 等字段（反序列化时静默忽略）
- `ParentEntry`: `children` → `features`

**最小字段保证：**
- `FeatureNode.id` 是唯一必须字段，缺失则 skip 该条目
- 其余字段全部有合理默认值

## Acceptance Criteria (Gherkin)

### User Story
作为 IDE 用户，我希望 TaskBoard 能在任何 queue.yaml 格式下正常显示有效数据，即使 YAML 有额外字段或个别条目格式异常。

### Scenarios (Given/When/Then)

```gherkin
Scenario: 正常 queue.yaml 渲染
  Given 一个格式规范的 queue.yaml
  When 用户打开 Task Tab
  Then 所有 feature 卡片正常渲染在对应列中

Scenario: 包含额外字段的 queue.yaml 渲染
  Given queue.yaml 中 feature 条目包含 parent、description、status、defer_reason、value_points 等额外字段
  When 用户打开 Task Tab
  Then TaskBoard 正常渲染，额外字段被静默忽略

Scenario: depends_on 字段兼容
  Given queue.yaml 使用 depends_on 而非 dependencies 字段
  When 用户打开 Task Tab
  Then 依赖关系正确显示

Scenario: ParentEntry children 字段兼容
  Given queue.yaml 的 parents 条目使用 children 而非 features 字段
  When 用户打开 Task Tab
  Then 父子关系正确显示

Scenario: 单个条目格式异常不影响整体
  Given queue.yaml 中某个 feature 条目有类型不匹配（如 priority 为字符串）
  When 用户打开 Task Tab
  Then 异常条目被跳过（日志 warning）
  And 其余正常条目正常渲染

Scenario: 只有 id 的条目可渲染
  Given queue.yaml 中某个 feature 条目只有 id 字段
  When 用户打开 Task Tab
  Then 该条目以默认值渲染（name=空, priority=0, size="", dependencies=[]）

Scenario: 完全无法解析的 YAML
  Given queue.yaml 内容完全不是合法 YAML
  When 用户打开 Task Tab
  Then 显示错误提示
```

### General Checklist
- [x] Rust 数据结构兼容额外字段
- [x] 逐条解析容错
- [x] 字段别名映射
- [x] 日志 warning 记录跳过的条目

## Merge Record

- **completed_at**: 2026-04-14T10:30:00Z
- **merged_branch**: feature/fix-queue-resilient-parsing
- **merge_commit**: 01fbe5e
- **archive_tag**: fix-queue-resilient-parsing-20260414
- **conflicts**: none
- **verification**: passed (7/7 scenarios)
- **stats**: 2 commits, 1 file changed, 189 insertions, 3 deletions
