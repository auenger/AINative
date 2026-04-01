# Module 2: FS数据层引擎与看板视图 (Data Layer & TaskBoard)

## 1. 模块边界与目标
**责任范围**：这部分取代了所有的传统数据库设计。模块的目的是将本地硬盘中结构化的 YAML 和文件夹，直接在内存中构建出反映“真实物理状态”的 Task List 并输出给前端的 Kanban 板块。
**不包含逻辑**：不负责窗口创建，不处理大模型 Prompt。

## 2. 核心技术栈
*   **前台视图**：`react-beautiful-dnd` 或 `@dnd-kit/core` (拖拽库实现看板)、D3.js / 纯手工 CSS Grid 实现 Timeline 甘特图。
*   **后端引擎 (Rust)**：
    *   `serde`, `serde_yaml` (YAML 格式极速反序列化工具)。
    *   `tokio::fs` (异步非阻塞 File I/O)。

## 3. 实现细节与步骤规划

### Step 1: `queue.yaml` 解析器 (Rust Parser)
*   建立与 `queue.yaml` 完全对应的 Rust 数据结构 (Structs)。例如 `FeatureNode`, `ParentFeature`, `ActiveQueue`, `PendingQueue`。
*   **IPC Command (`FetchQueueState`)**:
    *   前端一打开看板，触发此命令。Rust 后端使用 `serde_yaml::from_reader` 瞬间解析 `feature-workflow/queue.yaml` 文件，返回完整且带层级关系的 JSON 对象。

### Step 2: 实体文件夹属性聚合 (Feature Attributes)
*   真正的 Feature 还要看实体的 Markdown（例如 `features/active-feat-xxx/plan.md` 等附件）。
*   后端聚合逻辑：遍历 `queue.yaml` 解析出的 ID 后，Rust 后台再并发读取对应的 `features/` 子目录，看看有没有 `.status` 等补充日志。把补充信息挂载到主节点的 `details` 属性上，一并返回前端。

### Step 3: 前后台写回操作 (CRUD over FS)
*   **拖拽响应逻辑**：当用户在前端 Kanban 上把任务从 `In Progress` 拖到 `Completed` (例如对应 YAML 里的 `active` 拖到 `completed`)。
*   **IPC Command (`UpdateTaskStatus`)**:
    *   前端发送状态变更后，Rust 端接管。
    *   修改内存中的 YAML 树对象，并原样写回 `feature-workflow/queue.yaml` 文件。
    *   对应重命名 `features/` 中的物理目录 (如把 `active-feat-xxx` `rename` 为 `done-feat-xxx/archive`)。

## 4. 并行开发与 API 契约
*   **依赖项**：依赖 Module 1 提供的 `Workspace path` 和 `文件被外部改变时的刷新指令`。
*   **前/端契约开发接口**：
    ```typescript
    // TS Type Definition
    interface SyncPayload {
      parents: Array<ParentFeature>;
      active: Array<ChildFeature>;
      pending: Array<ChildFeature>;
      completed: Array<ChildFeature>;
    }
    const updateTaskStatus = async (taskId: string, targetQueue: 'active' | 'completed') => { ... }
    ```
