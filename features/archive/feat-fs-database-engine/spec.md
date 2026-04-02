# Feature: feat-fs-database-engine FS-as-Database 数据引擎 + 看板活数据

## Basic Information
- **ID**: feat-fs-database-engine
- **Name**: FS-as-Database 数据引擎 + 看板活数据
- **Priority**: 75
- **Size**: L
- **Dependencies**: feat-workspace-loader
- **Parent**: epic-neuro-syntax-ide-roadmap
- **Created**: 2026-04-01

## Description

这是整个应用的**业务核心**。用 Rust 解析工作区的 `feature-workflow/queue.yaml` 和 `features/` 实体目录，将真实数据注入 TaskBoard 和 WorkflowEditor，替换全部 mock 数据。实现看板拖拽 → 文件写回的双向绑定，以及文件变更的实时监听。

## User Value Points

### VP1: 看板显示真实数据
TaskBoard 和 WorkflowEditor 直接读取并展示工作区中真实的 Feature 数据，不再是模拟数据。

### VP2: 拖拽即写回
在看板上拖拽卡片到不同列，Rust 后端实际修改 `queue.yaml` 和 `features/` 目录，变更立即可通过文件系统验证。

### VP3: 文件变更实时刷新
当外部工具 (Git、编辑器、AI Agent) 修改了工作区文件，IDE 内的看板自动刷新，无需手动操作。

## Acceptance Criteria (Gherkin)

```gherkin
Scenario: 看板加载真实数据
  Given 工作区已加载且包含 feature-workflow/queue.yaml
  When 用户切换到 TaskBoard 视图
  Then 看板显示 queue.yaml 中定义的真实 Feature 数据
  And 各列 (Active/Pending/Completed) 数量与 YAML 一致

Scenario: 拖拽卡片改变状态
  Given 看板已加载
  When 用户将一张 Active 卡片拖拽到 Completed 列
  Then Rust 后端修改 queue.yaml 将该 Feature 移至 completed 队列
  And features/ 目录中对应文件夹被重命名/移动
  And Git 可追踪到该变更

Scenario: 外部文件变更自动刷新
  Given 看板已加载
  When 用户在终端中手动编辑 queue.yaml 添加一个新 Feature
  Then 看板在 1 秒内自动刷新并显示新卡片

Scenario: 甘特图显示真实时间线
  Given 看板已加载且 Features 包含日期信息
  When 用户切换到 Timeline 视图
  Then 甘特图根据真实日期渲染任务时间线
```

## Technical Solution

### Rust 数据结构
```rust
#[derive(Serialize, Deserialize)]
struct QueueState {
    parents: Vec<FeatureNode>,
    active: Vec<FeatureNode>,
    pending: Vec<FeatureNode>,
    blocked: Vec<FeatureNode>,
    completed: Vec<FeatureNode>,
}

#[derive(Serialize, Deserialize)]
struct FeatureNode {
    id: String,
    name: String,
    priority: i32,
    size: String,
    dependencies: Vec<String>,
    details: Option<FeatureDetails>, // 从 features/ 目录聚合
}
```

### Rust Commands
- `fetch_queue_state()` — 解析 queue.yaml + 扫描 features/ 目录
- `update_task_status(task_id, target_queue)` — 修改 queue.yaml + 重命名目录
- `read_feature_detail(feature_id)` — 读取单个 Feature 的 plan.md 等

### 文件监听 (notify)
- 监听 `feature-workflow/` 和 `features/` 目录
- 防抖 50ms
- `emit("fs://workspace-changed", payload)` 广播变更

### 前端改造
- TaskBoard: mock 数据 → `invoke('fetch_queue_state')`
- 拖拽: `@dnd-kit/core` → `invoke('update_task_status')`
- 监听: `listen('fs://workspace-changed')` → 刷新看板
- WorkflowEditor: 接真实工作流数据

### 建议拆分策略 (Size L)
- **子任务 A**: Rust YAML 解析器 + `fetch_queue_state` command
- **子任务 B**: 前端看板双向绑定 + 拖拽写回
- **子任务 C**: Rust notify 文件监听 + 前端自动刷新
