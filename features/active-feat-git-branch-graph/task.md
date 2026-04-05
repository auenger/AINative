# Tasks: feat-git-branch-graph

## Task Breakdown

### 1. 类型定义
- [ ] 在 types.ts 中新增 BranchGraphNode、BranchGraphEdge 接口
- [ ] GitModalTab 类型新增 'graph' 选项

### 2. Rust 后端
- [ ] 新增 `fetch_branch_graph` Tauri Command（获取 branch 拓扑数据）
- [ ] 使用 git2-rs 实现 branch 分叉/合并点检测

### 3. 前端 Hook
- [ ] 在 useGitDetail.ts 中新增 branch graph 数据获取逻辑
- [ ] 实现 feature 与 branch 的匹配逻辑（读取 queue.yaml completed tags）

### 4. UI 渲染
- [ ] Git 弹窗 sidebar 新增 Graph Tab 入口
- [ ] 实现 SVG 拓扑图渲染（节点 + 连线）
- [ ] 实现节点 hover tooltip 交互
- [ ] 实现布局算法（自上而下分层）
- [ ] Feature 标签展示

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-06 | Feature created | 等待开发，依赖 feat-git-tag-expand |
