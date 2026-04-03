# Neuro Syntax IDE — [CLAUDE.md](https://CLAUDE.md)

## ⚠️ Agent 工作流规则（最高优先级）

> **所有 Agent（主会话 & SubAgent）必须严格遵守：**\
> 执行 sub-devagent（如 `/dev-agent`、`/implement-feature` 等）相关任务时，**必须通过 Skill tool 调用对应的 skill**，**绝对不要**跳过 skill 直接实现逻辑。\
> 这是强制流程，违反此规则会导致工作流状态不一致。

***

## 项目定位

Neuro Syntax IDE — AI 原生桌面端 IDE。

* `neuro-syntax-ide/` = React Web 原型（UI 参考已完成）

* `src-tauri/` = Tauri V2 Rust 后端（将原型装入桌面窗口）

* 当前阶段: **Phase 1 — App 外壳与原型迁移**

核心策略: 复用原型组件，不重写 UI；先把 App 跑起来。

***

## Tech Stack

| Layer         | Technology                                          |
| ------------- | --------------------------------------------------- |
| Frontend      | React 19 + TypeScript 5.8 + Vite 6 + Tailwind CSS 4 |
| Desktop Shell | Tauri V2 (`@tauri-apps/api` v2 语法)                  |
| Backend       | Rust                                                |
| IPC           | `invoke()` 调用 Command / `listen()` 接收 Event         |
| State         | `useState` + switch 视图切换（不用 React Router）           |
| Data          | FS-as-Database: YAML + Markdown（不用 SQLite）          |

***

## Must Follow

* 使用 `@tauri-apps/api` **v2** 语法（非 v1）

* `cn()` 合并样式（clsx + tailwind-merge）

* 类型定义集中在 `types.ts`

* 复用原型设计系统（颜色/字体/动画），不修改

## Must Avoid

* 不在前端硬编码 API Keys

* 不引入 React Router

* 不使用 SQLite

* 不在前端 mock 终端 I/O

⠀