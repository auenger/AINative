# Tasks: feat-fs-database-engine

## Task Breakdown

### 1. Rust YAML 解析器 (子任务 A)
- [x] 定义 Rust 数据结构 (QueueState, FeatureNode, FeatureDetails)
- [x] Cargo.toml 添加 serde_yaml, tokio 依赖
- [x] 实现 queue.yaml 解析逻辑 (serde_yaml::from_str)
- [x] 实现 features/ 目录扫描 (读取子目录, 聚合 plan.md/.status)
- [x] 实现 `fetch_queue_state` Tauri command
- [x] 实现 `read_feature_detail` Tauri command
- [x] 错误处理: YAML 格式错误、目录不存在、权限不足

### 2. 看板双向绑定 (子任务 B)
- [x] TaskBoard 数据源替换: mock -> invoke('fetch_queue_state') via useQueueData hook
- [x] 实现拖拽逻辑: HTML5 drag-and-drop -> invoke('update_task_status')
- [x] 实现 `update_task_status` Rust command (修改 YAML, 原子写入)
- [x] 任务详情弹窗接真实数据 (read_feature_detail)
- [x] Board 视图: 4 列看板 (Active/Pending/Blocked/Completed)
- [x] List 视图: 表格模式
- [x] Feature 卡片显示 priority, size, dependencies, description

### 3. 文件变更监听 (子任务 C)
- [x] Cargo.toml 添加 notify 依赖
- [x] 实现 Rust 文件监听服务 (监听 feature-workflow/ + features/)
- [x] 变更事件广播 emit("fs://workspace-changed")
- [x] 前端 listen('fs://workspace-changed') -> 自动刷新看板
- [x] 工作区切换时正确启动/停止监听 (pick_workspace, get_stored_workspace)

### 4. 验证
- [ ] 手动编辑 queue.yaml -> 看板自动刷新
- [ ] 拖拽卡片 -> queue.yaml 实际变更 (git diff 验证)
- [ ] 新建 features/ 子目录 -> 看板出现新卡片
- [ ] 并发修改防冲突测试

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-01 | Created | Feature 规划完成，建议按 A->B->C 顺序开发 |
| 2026-04-01 | Sub-task A done | Rust YAML parser + fetch_queue_state + read_feature_detail |
| 2026-04-01 | Sub-task B done | TaskBoard rewrite with real data, HTML5 drag-and-drop, board/list views |
| 2026-04-01 | Sub-task C done | notify file watcher, fs://workspace-changed event, auto-refresh |
