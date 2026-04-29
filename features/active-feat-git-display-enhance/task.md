# Tasks: feat-git-display-enhance
## Task Breakdown
### 1. Diff 预览面板
- [x] 新增 Tauri Command `git_file_diff`（返回文件的 diff 内容）
- [x] Changes 标签实现左右分栏（文件列表 | Diff 预览）
- [x] Diff 渲染组件（新增行绿色、删除行红色、行号显示）
- [x] 点击文件加载并显示 Diff
- [x] Diff 面板关闭/展开切换
- [x] 空状态提示（未选择文件时）

### 2. 变更统计可视化
- [x] Overview 标签添加变更统计卡片
  - Staged / Unstaged / Untracked 文件数量
  - 总 additions / deletions 行数
  - 颜色区分（绿/红）
- [x] 提交频率柱状图（最近 7 天）
- [x] 分支对比统计（ahead/behind 远程分支）

### 3. 提交详情展开
- [x] History 标签提交记录可点击展开
- [x] 新增 Tauri Command `git_commit_detail`（返回提交的文件变更列表）
- [x] 展开显示文件变更列表 + additions/deletions 统计
- [x] 文件名可点击跳转到 Diff 预览

### 4. 信息层次优化
- [x] Overview 卡片网格布局优化
- [x] History 时间线样式优化
- [x] Changes 分栏布局优化
- [x] 统一卡片间距和圆角
- [x] 颜色一致性（与设计系统对齐）

### 5. 响应式布局
- [x] 窗口宽度 < 768px 时 Diff 面板折叠到底部
- [x] 标签页横向滚动
- [x] 统计卡片自动换行

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-27 | Created | 任务拆解完成 |
| 2026-04-29 | Implemented | 所有 5 个任务模块已实现 |
