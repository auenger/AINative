# Module 1: Tauri 基建与工作区管理 (Core Foundation & Workspace)

## 1. 模块边界与目标
**责任范围**：承担整个桌面应用程序的基础生命周期管理、窗口原生 UI 的呈现、以及最核心的“工作区根目录选择与文件变动总线”能力的输出。该模块类似于 VS Code 的基础框架层。
**不包含逻辑**：不解析 YAML 业务数据，不编译子进程，不处理 AI 逻辑。

## 2. 核心技术栈
*   **前端框架**：React 18 + Vite + Tailwind CSS + Framer Motion (原生级跟手动画)。
*   **Tauri 核心插件**：
    *   `@tauri-apps/api/window` (自定义窗口拖拽与控件)
    *   `@tauri-apps/plugin-dialog` (系统级文件/目录选择器)
    *   `@tauri-apps/plugin-fs` (安全范围内的前端基础 FS 交互)
*   **Rust 后端引擎**：`std::fs`，[`notify`](https://crates.io/crates/notify) (高性能跨平台文件监听系统)。

## 3. 实现细节与步骤规划

### Step 1: 原生级自定义透明窗口 (UI)
*   在 `tauri.conf.json` 中配置 `"decorations": false` 和 `"transparent": true`（视主题需要）。
*   在前端的 Header / Sidebar 注入 `data-tauri-drag-region` 属性，实现原生级窗口拖拽响应。
*   将原型中固化的假数据剥离，提炼统一的 React 通用 Layout（`TopNav`, `SideNav`, `StatusBar`）。

### Step 2: 工作区加载器 (Workspace Loader)
*   **IPC Command (`PickWorkspace`)**: 
    1. 前端调用 Tauri Dialog 弹窗，请求用户选定一个有效的工作区（包含 `feature-workflow` 的目录）。
    2. 后端接收授权后，将选定的路径持久化写入 AppData config 以便下次自动启动。
    3. 后端向前端返回类似 `WorkspaceLoaded { path: "/", valid: true }` 的结果。

### Step 3: 全局文件监听总线 (Event Bus)
这是整个应用响应式的基石。因为我们的数据库其实是文件(FS-as-Database)。
*   **Rust 侧的 Watcher**：在选定工作区后，Rust 启动 `notify` 监听库，递归监听工作区指定子目录。
*   **事件过滤与防抖**：当监听到 `fs::EventKind::Modify` 或 `Create/Remove` 时，不立刻打向前端（防止 I/O 风暴），而在内部延迟/防抖 50ms。
*   **IPC 同步**：打包变动的路径和类型，使用 `app_handle.emit("fs://workspace-changed", payload)` 广播给前端所有监听该事件的 Hook。

## 4. 并行开发与 API 契约
*   **依赖项**：无（处于调用链最底层）。
*   **前/端契约开发接口**：
    ```typescript
    // 前端直接调用的封装 Hook
    const { workspace, selectWorkspace } = useWorkspace();
    useListen('fs://workspace-changed', (event) => {
        // 通知其他业务组件刷新数据
    });
    ```
