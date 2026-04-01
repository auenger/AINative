# Tasks: feat-fs-database-engine

## Task Breakdown

### 1. Rust YAML 解析器 (子任务 A)
- [ ] 定义 Rust 数据结构 (QueueState, FeatureNode, FeatureDetails)
- [ ] Cargo.toml 添加 serde_yaml, tokio 依赖
- [ ] 实现 queue.yaml 解析逻辑 (serde_yaml::from_str)
- [ ] 实现 features/ 目录扫描 (读取子目录, 聚合 plan.md/.status)
- [ ] 实现 `fetch_queue_state` Tauri command
- [ ] 实现 `read_feature_detail` Tauri command
- [ ] 错误处理: YAML 格式错误、目录不存在、权限不足

### 2. 看板双向绑定 (子任务 B)
- [ ] 前端安装 @dnd-kit/core + @dnd-kit/sortable
- [ ] TaskBoard 数据源替换: mock → invoke('fetch_queue_state')
- [ ] 实现拖拽逻辑: drop 后调用 invoke('update_task_status')
- [ ] 实现 `update_task_status` Rust command (修改 YAML + 重命名目录)
- [ ] 任务详情弹窗接真实数据
- [ ] 甘特图时间线读取真实日期字段
- [ ] WorkflowEditor 接真实工作流数据

### 3. 文件变更监听 (子任务 C)
- [ ] Cargo.toml 添加 notify 依赖
- [ ] 实现 Rust 文件监听服务 (监听 feature-workflow/ + features/)
- [ ] 防抖逻辑 (50ms 延迟)
- [ ] 变更事件广播 emit("fs://workspace-changed")
- [ ] 前端 listen('fs://workspace-changed') → 自动刷新看板
- [ ] 工作区切换时正确启动/停止监听

### 4. 验证
- [ ] 手动编辑 queue.yaml → 看板自动刷新
- [ ] 拖拽卡片 → queue.yaml 实际变更 (git diff 验证)
- [ ] 新建 features/ 子目录 → 看板出现新卡片
- [ ] 并发修改防冲突测试

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-01 | Created | Feature 规划完成，建议按 A→B→C 顺序开发 |
