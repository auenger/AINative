# Tasks: feat-git-tag-expand

## Task Breakdown

### 1. 类型定义
- [x] 在 types.ts 中新增 TagDetail 和 TagFileChange 接口

### 2. Rust 后端
- [x] 新增 `fetch_tag_commits` Tauri Command（获取 Tag 之间的 commit 列表）
- [x] 新增 `fetch_tag_diff` Tauri Command（获取 Tag 的 diff stat）
- [x] 使用 git2-rs 实现上述逻辑

### 3. 前端 Hook
- [x] 在 useGitDetail.ts 中新增 tag 详情获取逻辑（invoke Tauri Command）
- [x] 实现 expandedTags state 管理和数据缓存

### 4. UI 渲染
- [x] Tags Tab 中每个 Tag 条目增加展开/折叠箭头
- [x] 展开区域渲染 commit 列表
- [x] 展开区域渲染文件变动列表（颜色区分 + 行数统计）
- [x] 加载中显示 shimmer skeleton 动画

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-06 | Feature created | 等待开发 |
| 2026-04-06 | All tasks implemented | Types + Rust backend + Hook + UI |
