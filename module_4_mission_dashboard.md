# Module 4: 仪表盘与系统态探针 (Mission Dashboard)

## 1. 模块边界与目标
**责任范围**：承担原型里的整个 `MissionControl` 面板。为用户呈现“目前 IDE 工具系统是否处于健康状态”，统计所有 Agents 的并发消耗以及提供基于 Git Commit 流转的项目活跃度打分。

## 2. 核心技术栈
*   **前台视图**：前端原型的雷达图与波纹流。
*   **Rust 探针底层库**：
    *   [`sysinfo`](https://crates.io/crates/sysinfo) (纯 Rust 编写的硬件、CPU、进程、Memory 综合爬虫)。
    *   [`git2`](https://crates.io/crates/git2) (Rust 专有的高性能底层 Git 通信包，替代不安全的 `shell` 直接调 git)。

## 3. 实现细节与步骤规划

### Step 1: 硬件监控脱水服务 (Hardware Monitor Task)
*   在 Rust 程序的 `setup` 钩子里，开启一个独立的异步轮询循环 (tokio `spawn` 或 `Interval`)。
*   设定每 1000ms 执行一次：
    1.  `sys.refresh_cpu()`, `sys.refresh_memory()`
    2.  提取 IDE 自身进程的消耗、OS 总全局消耗 CPU 占用率 (%), 剩余物理内存数。
    3.  利用全局对象 `app_handle.emit("sys-hardware-tick", payload)` 广播出去。
*   前端订阅 `sys-hardware-tick`，使用数组存储最近 30 秒的数据推入波浪图库即可导致前端 UI 实时扭动。

### Step 2: Native Git 数据分析引擎 (Git Stats)
*   在用户选择 Workspace 目录后 (也就是确定了具备 `.git` 文件夹)。
*   Rust 侧利用 `git2-rs` 读取内部 Git 对象数据库。
*   扫描主分支的 HEAD，统计前 7 天产生的 Commit 对象与 Pull Request reference 变动数量。汇总给前台的指标统计卡片。

### Step 3: 系统内部调试终端拦截 (AI Logger Hook)
*   此模块界面包含了一个 "AI Activity Log" (红绿灯界面的小终端)。
*   它的实现方式应当是在整个 Tauri 环境下注入一个全局 Logger。监听例如 `App::Log::Info`, `App::Log::AgentCommand` 消息。所有 Module 在关键行为时写入统一个管道，Mission 面板从这处全局管道只读信息并呈递滚动列表。

## 4. 并行实施逻辑
*   **独立性**：该模块不与核心数据产生写入冲突，完全是一个 Read-Only 观察者模块。前端随时可以开启 `MockDataGenerator` 去制造假数据波段完善 CSS 动效。
*   Rust 工程师可以在完成繁锁的 Module 2/3 前独立花半天时间将简单的硬件探针调通并联调。
