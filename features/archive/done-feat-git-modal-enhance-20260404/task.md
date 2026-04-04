# Tasks: feat-git-modal-enhance

## Task Breakdown

### 1. Tauri 后端 — 新增 Git Commands
- [x] `fetch_git_tags` command：返回所有 tags（名称、日期、commit hash）
- [x] `fetch_git_log` command：返回最近 N 条 commit（hash、消息、作者、时间）
- [x] `fetch_git_branches` command：返回本地分支列表（名称、是否当前、最新 commit）

### 2. 类型定义
- [x] 在 types.ts 中新增 GitTag、GitCommit、GitBranch 类型
- [x] 新增 GitModalTab 枚举类型（overview/branches/tags/history/changes/features）

### 3. 前端 Hook — 数据获取
- [x] 创建 `useGitDetail` hook 或扩展 `useGitStatus`
- [x] 封装 tags/branches/log 数据获取逻辑
- [x] 添加 feature-workflow queue.yaml 解析逻辑（通过 tags 推断）

### 4. 弹窗布局重构
- [x] 将弹窗宽度从 max-w-lg 改为可拖拽调整（默认 900x560）
- [x] 实现左侧 Tab 导航 + 右侧内容区的双栏布局
- [x] 各分区内容组件化（概览、分支、Tags、历史、变更、Feature）

### 5. 拖拽移动
- [x] 参考现有 TaskBoard Modal 拖拽实现
- [x] 添加标题栏 mousedown/mousemove/mouseup 拖拽逻辑
- [x] 添加视口边界限制

### 6. 拖拽调整大小
- [x] 实现右下角 resize 手柄
- [x] 添加最小/最大尺寸限制（min 600x400）
- [x] 实时跟随调整

### 7. 内容分区实现
- [x] 概览分区：当前分支 + 最近 commit + 文件变更摘要 + tags 数量
- [x] 分支分区：所有本地分支列表 + 当前分支高亮 + 最新 commit
- [x] Tags 分区：所有 tags 列表 + Feature tag 标记 + 日期排序
- [x] 历史分区：commit 列表 + 滚动加载 + hash/消息/作者/时间
- [x] 变更分区：保留现有 stage/unstage 功能 + diff 摘要增强
- [x] Feature 分区：已完成 feature 列表 + 关联 tag + 完成时间

### 8. 集成与收尾
- [x] 确保现有 stage/commit/push/pull 功能正常
- [x] 动画和过渡效果
- [x] 响应式适配

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-03 | Feature created | 初始任务分解 |
| 2026-04-05 | Implementation complete | Tauri commands + types + hook + full modal refactor |
