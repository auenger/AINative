# Tasks: feat-claude-code-runtime-monitor

## Task Breakdown

### 1. Rust 后端 — 进程检测模块
- [x] 创建 `src-tauri/src/runtime_monitor.rs`
- [x] 实现 `scan_runtime_processes` command：用 `sysinfo` 扫描 claude 相关进程
- [x] 实现进程 CWD 匹配：检查进程工作目录是否在 workspace_path 下
- [x] 实现 `start_runtime_monitor` / `stop_runtime_monitor` commands
- [x] 添加定时轮询 + `runtime://status-changed` 事件广播
- [x] 在 `lib.rs` 中注册新 commands 和 events

### 2. Rust 后端 — 会话信息读取
- [x] 实现 `read_claude_session` command：读取 `~/.claude/` session 文件
- [x] 定义 `ClaudeSessionInfo` 序列化结构
- [x] 处理 session 文件不存在或格式错误的 edge case

### 3. 前端 — 类型定义
- [x] 在 `types.ts` 中添加 `RuntimeProcessInfo` 接口
- [x] 在 `types.ts` 中添加 `ClaudeSessionDetail` 接口

### 4. 前端 — useRuntimeMonitor Hook
- [x] 创建 `lib/useRuntimeMonitor.ts`
- [x] 调用 `start_runtime_monitor` 启动后端监听
- [x] `listen('runtime://status-changed')` 接收实时状态
- [x] dev mode fallback（mock 数据）
- [x] 提供 start/stop/getRuntime API

### 5. 前端 — StatusBar 增强
- [x] 修改 `StatusBar.tsx`：集成 `useRuntimeMonitor`
- [x] 运行中 runtime 显示脉冲动画 + "Running" 标签
- [x] 下拉面板显示进程详情（PID、CPU、内存、运行时长）

### 6. 前端 — MissionControl Runtime Monitor 面板
- [x] 创建 `RuntimeMonitorPanel` 组件
- [x] 活跃 runtime 进程列表卡片
- [x] Claude Code 会话详情区（token 统计、当前任务）
- [x] 集成到 MissionControl 视图布局

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-08 | Feature created | 需求分析完成，等待开发 |
| 2026-04-08 | All tasks implemented | Rust backend + Frontend hook + StatusBar + MissionControl panel |
