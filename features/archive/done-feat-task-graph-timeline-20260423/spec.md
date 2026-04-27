# Feature: feat-task-graph-timeline Task Graph Timeline View

## Basic Information
- **ID**: feat-task-graph-timeline
- **Name**: Task Graph Timeline View（时间轴依赖图谱视图）
- **Priority**: 50
- **Size**: M
- **Dependencies**: none
- **Parent**: null
- **Children**: none
- **Created**: 2026-04-23

## Description

在 TaskBoard 现有的 Board（看板）和 List（列表）视图之外，新增第三种 "Graph" 视图模式：
以时间轴为 X 轴，任务节点按创建时间排列，节点之间通过连线展示依赖关系。
用户可以直观看到项目任务的时间演进脉络和依赖拓扑。

### 核心特点
- **时间轴布局**：X 轴按创建时间排列任务节点
- **依赖连线**：节点间用曲线/直线连接表示依赖关系，带方向箭头
- **状态映射**：节点颜色映射任务状态（active/pending/blocked/completed）
- **优先级映射**：节点大小或边框粗细映射优先级
- **交互能力**：缩放、平移、点击节点查看详情、hover 高亮依赖链

## User Value Points

### VP1: 时间维度任务全景
用户可以在一张图上看到所有任务的时间分布和依赖关系，快速理解项目进展脉络和关键路径。

### VP2: 依赖链交互探索
用户可以通过缩放/平移/点击/悬停等交互方式探索任务的依赖链路，定位阻塞源头和影响范围。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx` — 主看板组件，包含 Board/List 视图切换逻辑
- `neuro-syntax-ide/src/lib/useQueueData.ts` — 队列数据 hook，提供 FeatureNode[] 和操作方法
- `neuro-syntax-ide/src/types.ts` — Task 类型定义
- `neuro-syntax-ide/src/components/views/WorkflowEditor.tsx` — 现有节点画布参考

### Data Model
```typescript
interface FeatureNode {
  id: string;
  name: string;
  priority: number;
  size: string;           // S/M/L/XL
  dependencies: string[];  // 依赖的 task ID 列表
  completed_at?: string;   // 完成时间戳
  details?: {
    status: string;
    description?: string;
  };
}
```

### Related Documents
- project-context.md — 项目架构和技术栈

### Related Features
- feat-git-branch-graph — 已完成的分支拓扑可视化，可参考其画布实现方式

## Technical Solution

- **渲染**: SVG + 自定义渲染，无外部依赖
- **布局**: 基于时间的 X 轴排列（completed_at / priority 排序），Y 轴自动避让
- **依赖连线**: SVG cubic bezier 曲线 + marker 箭头
- **交互**: 滚轮缩放、拖拽平移、hover 依赖链高亮（BFS 上下游遍历）
- **组件**: TaskGraphView.tsx (~300 行)，集成到 TaskBoard viewMode 切换

### Merge Record
- **Completed**: 2026-04-23
- **Branch**: feature/feat-task-graph-timeline → main
- **Merge commit**: (fast-forward after rebase)
- **Archive tag**: feat-task-graph-timeline-20260423
- **Conflicts**: none
- **Verification**: passed (5/5 scenarios)
- **Stats**: 2 files changed, 519 insertions(+), 4 deletions(-)

### 推荐技术方案
- **布局引擎**: 使用 dagre 或 elkjs 计算 DAG 布局，X 轴约束为时间顺序
- **渲染**: 可选方案：
  1. **SVG + 自定义渲染** — 轻量，完全可控，与项目 Tailwind 风格一致
  2. **reactflow** — 功能丰富，自带缩放/平移/节点交互，但增加依赖体积
- **交互**: 缩放（滚轮）、平移（拖拽背景）、节点点击（打开详情）、hover 高亮依赖链
- **动画**: 节点进入/退出动画，连线绘制动画，依赖链高亮过渡

## Acceptance Criteria (Gherkin)

### User Story
作为项目管理者，我希望以时间轴图谱的方式查看所有任务及其依赖关系，以便快速理解项目进展脉络和识别关键路径。

### Scenarios (Given/When/Then)

#### Scenario 1: 切换到 Graph 视图
```gherkin
Given 用户在 TaskBoard 页面
And 存在多个任务且部分任务有依赖关系
When 用户点击视图切换按钮选择 "Graph" 模式
Then 页面展示时间轴图谱视图
And 任务节点按创建时间沿 X 轴排列
And 有依赖关系的节点之间显示带方向的连线
And 节点颜色反映任务状态
```

#### Scenario 2: 节点交互 — 查看任务详情
```gherkin
Given 用户在 Graph 视图中
When 用户点击某个任务节点
Then 弹出该任务的详情 Modal
And Modal 内容与 Board/List 视图的详情一致
```

#### Scenario 3: 依赖链高亮
```gherkin
Given 用户在 Graph 视图中
And 任务 B 依赖任务 A，任务 C 依赖任务 B
When 用户将鼠标悬停在任务 B 上
Then 任务 B 的所有上游依赖（A）和下游依赖（C）被高亮显示
And 对应的连线也被高亮
And 非相关节点和连线变为半透明
```

#### Scenario 4: 缩放和平移
```gherkin
Given 用户在 Graph 视图中
When 用户使用鼠标滚轮
Then 图谱进行缩放
When 用户拖拽背景区域
Then 图谱进行平移
And 用户可以通过双击或重置按钮恢复初始视图
```

#### Scenario 5: 空状态
```gherkin
Given 任务队列为空
When 用户切换到 Graph 视图
Then 显示友好的空状态提示
And 提示用户创建新任务
```

### UI/Interaction Checkpoints
- [ ] 视图切换按钮区域增加 "Graph" 选项（Network/Mind Map 图标）
- [ ] 图谱画布占满 TaskBoard 主内容区
- [ ] 节点样式：圆角卡片，内含任务名、状态标识、优先级指示
- [ ] 连线样式：平滑曲线，带箭头，颜色跟随依赖方向
- [ ] 底部/顶部时间轴刻度（按天或按周）
- [ ] 图例区域说明颜色/大小映射关系

### General Checklist
- [ ] 与 Board/List 视图共享同一数据源（useQueueData）
- [ ] 性能：50+ 任务节点下保持流畅
- [ ] 响应式：窗口缩放时图谱自动适配
