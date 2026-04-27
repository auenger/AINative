# Tasks: feat-git-display-enhance
## Task Breakdown
### 1. Diff 预览面板
- [ ] 新增 Tauri Command `git_file_diff`（返回文件的 diff 内容）
- [ ] Changes 标签实现左右分栏（文件列表 | Diff 预览）
- [ ] Diff 渲染组件（新增行绿色、删除行红色、行号显示）
- [ ] 点击文件加载并显示 Diff
- [ ] Diff 面板关闭/展开切换
- [ ] 空状态提示（未选择文件时）

### 2. 变更统计可视化
- [ ] Overview 标签添加变更统计卡片
  - Staged / Unstaged / Untracked 文件数量
  - 总 additions / deletions 行数
  - 颜色区分（绿/红）
- [ ] 提交频率柱状图（最近 7 天）
- [ ] 分支对比统计（ahead/behind 远程分支）

### 3. 提交详情展开
- [ ] History 标签提交记录可点击展开
- [ ] 新增 Tauri Command `git_commit_detail`（返回提交的文件变更列表）
- [ ] 展开显示文件变更列表 + additions/deletions 统计
- [ ] 文件名可点击跳转到 Diff 预览

### 4. 信息层次优化
- [ ] Overview 卡片网格布局优化
- [ ] History 时间线样式优化
- [ ] Changes 分栏布局优化
- [ ] 统一卡片间距和圆角
- [ ] 颜色一致性（与设计系统对齐）

### 5. 响应式布局
- [ ] 窗口宽度 < 768px 时 Diff 面板折叠到底部
- [ ] 标签页横向滚动
- [ ] 统计卡片自动换行

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-27 | Created | 任务拆解完成 |
