# Feature: feat-git-branch-graph Branch & Feature 连线图

## Basic Information
- **ID**: feat-git-branch-graph
- **Name**: Branch & Feature 连线图（拓扑可视化）
- **Priority**: 60
- **Size**: S
- **Dependencies**: feat-git-tag-expand
- **Parent**: feat-git-tag-detail-graph
- **Children**: []
- **Created**: 2026-04-06

## Description

在 Git 弹窗中新增一个 Tab（Graph），以可视化连线图的方式展示：
- 所有本地 branch 及其分叉/合并关系
- Feature（来自 feature-workflow/queue.yaml）与 branch 的对应关系
- 节点可以交互：hover 显示详情，点击跳转

## User Value Points
1. **分支拓扑可视化** — 以图形化方式直观展示 branch 的分叉与合并关系，以及 feature 与 branch 的对应关系，帮助开发者理解项目演进脉络

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/ProjectView.tsx` — Git 弹窗主组件，已有 6 个 Tab
- `neuro-syntax-ide/src/lib/useGitDetail.ts` — Git 详情 Hook
- `neuro-syntax-ide/src-tauri/src/lib.rs` — Rust 后端 Git Commands
- `neuro-syntax-ide/src/types.ts` — GitModalTab 等类型定义
- `feature-workflow/queue.yaml` — Feature 队列数据源

### Related Documents
- 当前 GitModalTab 类型: `'overview' | 'branches' | 'tags' | 'history' | 'changes' | 'features'`
- 需要新增: `'graph'`

### Related Features
- feat-git-tag-expand (前置依赖) — Tag 详情展开
- feat-git-modal-enhance (已完成) — Git 弹窗内容增强

## Technical Solution

### 前端
1. 在 GitModalTab 类型中新增 `'graph'` 选项
2. 在 Git 弹窗 sidebar 中新增 Graph Tab 入口（GitBranch 图标）
3. Graph Tab 内容区：
   - 使用 SVG 或 Canvas 渲染 branch 拓扑图
   - 节点 = branch（圆形），连线 = 分叉/合并关系
   - Feature 标签 = 从 queue.yaml 匹配已完成的 feature tag 与 branch
4. 交互：
   - Hover 节点显示 branch 名称、最新 commit、feature 关联信息
   - 点击节点高亮该 branch 的相关 commit 路径

### 后端 (Rust)
1. 新增 Tauri Command: `fetch_branch_graph` → 返回 branch 拓扑数据
   - 每个 branch 的分叉点（fork_from commit）
   - 合并点（merge commit）
   - 拓扑排序关系
2. 使用 `git2-rs` 的 commit graph 遍历功能

### 类型定义
```typescript
interface BranchGraphNode {
  id: string;           // branch name
  type: 'branch' | 'merge' | 'fork';
  latest_commit: string;
  latest_message: string;
  feature_id?: string;  // 关联的 feature ID
  x?: number;           // 布局坐标（前端计算）
  y?: number;
}

interface BranchGraphEdge {
  from: string;         // source branch/commit
  to: string;           // target branch/commit
  type: 'fork' | 'merge' | 'linear';
}
```

### 布局算法
- 简单的自上而下分层布局
- main 在最左侧，feature branch 向右展开
- 使用前端 JS 计算布局坐标（不引入额外图形库）

## Acceptance Criteria (Gherkin)

### User Story
作为开发者，我希望在 Git 弹窗中看到 branch 和 feature 的拓扑连线图，以便直观理解项目的分支演进和 feature 开发进度。

### Scenarios (Given/When/Then)

**Scenario 1: 查看 Branch 拓扑图**
```gherkin
Given Git 弹窗已打开
When 用户切换到 Graph Tab
Then 以连线图展示所有本地 branch 的分叉和合并关系
and main branch 在最左侧，feature branch 向右展开
```

**Scenario 2: Feature 关联展示**
```gherkin
Given Graph Tab 中显示了 branch 拓扑图
When 某个 branch 对应一个已完成的 feature（通过 tag 匹配）
Then 该 branch 节点显示 feature 名称标签
```

**Scenario 3: 节点 Hover 交互**
```gherkin
Given Graph Tab 中显示了 branch 拓扑图
When 用户 hover 到某个 branch 节点
Then 显示 tooltip 包含 branch 名称、最新 commit message、关联 feature 信息
```

### UI/Interaction Checkpoints
- 使用 SVG 渲染连线图（与 Tailwind 风格一致）
- 节点颜色：当前 branch 高亮，feature branch 使用 tertiary 色
- 连线使用曲线（SVG path bezier）
- 整体配色遵循项目深色科幻风（glass-panel 背景）

### General Checklist
- [ ] 不影响现有 Tab 的功能
- [ ] 图形渲染性能良好（branch 数量 < 50 时流畅）
- [ ] 响应式布局适配弹窗 resize
