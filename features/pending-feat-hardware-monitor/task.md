# Tasks: feat-hardware-monitor

## Task Breakdown

### 1. Rust 硬件监控服务
- [ ] Cargo.toml 添加 sysinfo 依赖
- [ ] 实现 HardwareStats 数据结构
- [ ] 实现异步轮询线程 (每 1s 刷新一次)
- [ ] 实现 emit("sys-hardware-tick") 广播
- [ ] 工作区加载时启动监控，卸载时停止

### 2. Rust Git 统计服务
- [ ] Cargo.toml 添加 git2 依赖
- [ ] 实现近 7 天 commit 数量统计
- [ ] 实现当前分支变动文件数统计
- [ ] 实现贡献者活跃度分析
- [ ] 实现 `fetch_git_stats` Tauri command

### 3. 前端 MissionControl 改造
- [ ] mock 数据 → listen('sys-hardware-tick') 实时数据
- [ ] CPU/RAM 实时折线图 (存储最近 60 数据点)
- [ ] 系统健康状态指示器 (正常/警告/危险)
- [ ] Git 统计卡片接真实数据
- [ ] AI Activity Log 接全局 Logger

### 4. 验证
- [ ] CPU 使用率与 Activity Monitor / 任务管理器一致
- [ ] 内存数据准确
- [ ] 数据每秒刷新无卡顿
- [ ] Git 统计数据与 git log 结果一致

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-01 | Created | Feature 规划完成，等待开发 |
