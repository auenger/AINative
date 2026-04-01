# Feature: feat-hardware-monitor 硬件监控探针 + 仪表盘

## Basic Information
- **ID**: feat-hardware-monitor
- **Name**: 硬件监控探针 + 仪表盘
- **Priority**: 40
- **Size**: M
- **Dependencies**: feat-workspace-loader
- **Parent**: epic-neuro-syntax-ide-roadmap
- **Created**: 2026-04-01

## Description

让 MissionControl 面板显示真实的系统硬件数据和 Git 活跃度。Rust 后端通过 `sysinfo` 轮询 CPU/RAM，通过 `git2-rs` 分析 Git 统计，实时广播给前端渲染。

## User Value Points

### VP1: 真实硬件监控
MissionControl 面板展示当前系统真实的 CPU 和内存使用率，数据每秒刷新，渲染为实时波浪图。

### VP2: Git 活跃度统计
自动分析工作区 Git 仓库，展示近 7 天的 commits、变动文件数等统计数据。

## Acceptance Criteria (Gherkin)

```gherkin
Scenario: 硬件数据实时刷新
  Given 工作区已加载
  When 用户切换到 MissionControl 视图
  Then 面板显示当前真实的 CPU 使用率百分比
  And 数据每秒刷新一次
  And 波浪图/折线图实时更新

Scenario: Git 统计展示
  Given 工作区已加载且包含 .git 目录
  Then 面板显示近 7 天的 commit 数量
  And 显示当前分支的变动文件统计
  And 显示贡献者活跃度

Scenario: 系统健康状态
  Given 硬件监控运行中
  When CPU 使用率超过 80%
  Then 系统健康指标变为"警告"状态
  And 面板用黄色/红色标识高负载
```

## Technical Solution

### Rust 后端
- `sysinfo` crate: 每 1s 刷新 CPU/RAM 数据
- 异步线程: `tokio::spawn` 轮询循环
- 广播: `app_handle.emit("sys-hardware-tick", HardwareStats)`
- `git2` crate: 读取 Git 日志和 diff 统计

### 数据结构
```rust
struct HardwareStats {
    cpu_usage: f32,
    memory_total: u64,
    memory_used: u64,
    memory_percent: f32,
    uptime: u64,
}
```

### 前端改造
- MissionControl: mock → `listen('sys-hardware-tick')`
- 数据存储: 最近 60 个数据点用于折线图
- 阈值判断: CPU > 80% 警告, > 95% 危险
