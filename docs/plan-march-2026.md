# Neuro Syntax IDE — 三月份开发计划 (2026年3月)

## 项目概述

**项目名称**: Neuro Syntax IDE — AI 原生桌面端 IDE
**计划周期**: 2026年3月3日 — 3月28日（4周）
**技术栈**: Tauri V2 + React 19 + TypeScript 5.8 + Vite 6 + Tailwind CSS 4
**当前阶段**: Phase 1 — App 外壳与原型迁移

---

## 里程碑总览

| 里程碑 | 时间 | 主题 | Feature 数 |
|--------|------|------|-----------|
| M1 | 3/3 – 3/7 | 基础平台搭建 | 8 |
| M2 | 3/10 – 3/14 | UI/UX 框架与体验打磨 | 14 |
| M3 | 3/17 – 3/21 | Agent 服务层 & Git 集成 | 13 |
| M4 | 3/24 – 3/28 | Runtime 引擎 & 高级功能 | 16 |
| M5 | 3/31 – 4/4 | 多模态集成 & 最终交付 | 12 |

---

## M1: 基础平台搭建（3/3 – 3/7）

> 目标：完成 Tauri V2 项目初始化，搭建桌面应用骨架，集成核心编辑器与终端。

### Feature 清单

| # | Feature | 说明 | 优先级 |
|---|---------|------|--------|
| 1 | feat-tauri-v2-init | Tauri V2 项目初始化，React 19 原型装入桌面窗口 | P0 |
| 2 | feat-workspace-loader | 工作区目录选择与加载 | P0 |
| 3 | feat-native-terminal | xterm.js 真实终端集成 | P0 |
| 4 | feat-editor-monaco | Monaco 代码编辑器集成 | P0 |
| 5 | feat-fs-database-engine | FS-as-Database 引擎（YAML + Markdown） | P0 |
| 6 | feat-hardware-monitor | 系统硬件监控面板 | P1 |
| 7 | feat-ai-agent-service | AI Agent 服务框架（基础抽象层） | P0 |
| 8 | feat-native-titlebar | 系统原生窗口标题栏恢复 | P1 |

### 交付物
- [x] 桌面应用可通过 `cargo tauri dev` 启动
- [x] 支持选择本地目录作为工作区
- [x] 内置终端可执行 shell 命令
- [x] Monaco 编辑器可打开文件
- [x] YAML/Markdown 文件驱动数据层就绪

---

## M2: UI/UX 框架与体验打磨（3/10 – 3/14）

> 目标：完善全局 UI 框架，建立设计系统，打磨核心交互体验。

### Feature 清单

| # | Feature | 说明 | 优先级 |
|---|---------|------|--------|
| 1 | feat-ui-cleanup | 移除 mock 标签页，修复 logo 重叠，可折叠控制台 | P1 |
| 2 | feat-md-render-task-detail | Task 详情 Modal Markdown 富文本渲染 | P1 |
| 3 | feat-console-collapse-strip | 控制台折叠条（28px） | P1 |
| 4 | feat-detail-modal-interaction | Modal 拖拽/调整大小/归档 MD 回退 | P1 |
| 5 | feat-editor-theme-perf | Neuro Dark Monaco 主题，消除白屏闪烁 | P1 |
| 6 | feat-task-modal-improve | Task Modal 高度放宽/更宽布局/Markdown 描述 | P1 |
| 7 | feat-app-theme-system | 全局亮/暗主题系统（ThemeContext） | P0 |
| 8 | feat-console-icon-toggle | 控制台浮动图标按钮开关 | P2 |
| 9 | feat-logo-update | 全局 Logo 更新，替换所有旧图标 | P1 |
| 10 | feat-view-state-persistence | 视图状态持久化 | P1 |
| 11 | feat-dashboard-polish | Dashboard 名称修正 & Sparkline 修复 | P2 |
| 12 | feat-dark-theme-polish | 深色主题边框配色优化，编辑器主题跟随 | P1 |
| 13 | feat-terminal-theme-fix | 终端主题一致性修复 & 显隐按钮位置优化 | P1 |
| 14 | feat-terminal-polish | 终端主题同步 & 重新打开按钮 | P2 |

### 交付物
- [x] 完整的亮/暗主题切换系统
- [x] Monaco 编辑器主题跟随全局主题
- [x] 终端样式与全局主题一致
- [x] Task Modal 支持 Markdown 渲染
- [x] 控制台可折叠/展开
- [x] 视图切换状态持久化

---

## M3: Agent 服务层 & Git 集成（3/17 – 3/21）

> 目标：搭建 Agent 服务核心架构，实现 REQ Agent（Claude Code CLI 桥接），完成 Git 全流程集成。

### Feature 清单

| # | Feature | 说明 | 优先级 |
|---|---------|------|--------|
| 1 | feat-req-agent-bridge | Claude Code CLI 桥接服务 | P0 |
| 2 | feat-req-agent-chat | REQ Agent 对话 UI | P0 |
| 3 | feat-req-agent-workflow | REQ Agent 工作流编排 | P0 |
| 4 | feat-settings-llm-config | Settings 页面 LLM 提供商配置 | P1 |
| 5 | feat-terminal-enhance | 终端增强功能 | P2 |
| 6 | feat-file-type-router | 文件类型路由分发 | P1 |
| 7 | feat-dock-icon | 应用 Dock 图标设置 | P2 |
| 8 | feat-git-status-read | 真实 Git 状态展示（替换 mock 数据） | P0 |
| 9 | feat-git-stage-commit | Git 暂存与提交 | P0 |
| 10 | feat-git-push-pull | Git 远程同步（Push/Pull） | P0 |
| 11 | feat-agent-runtime-core | Agent Runtime 抽象核心 | P0 |
| 12 | feat-agent-runtime-router | Agent Runtime 智能路由引擎 | P0 |
| 13 | fix-reqagent-connection | REQ Agent 连接问题修复 | P1 |

### 交付物
- [x] REQ Agent 可通过 CLI 桥接与 Claude Code 对话
- [x] Agent Runtime 核心抽象层就绪
- [x] Agent Runtime 智能路由可用
- [x] Git 状态/暂存/提交/推送/拉取全流程可用
- [x] LLM 提供商可在 Settings 中配置

---

## M4: Runtime 引擎 & 高级功能（3/24 – 3/28）

> 目标：完善 Runtime 执行引擎，实现 Pipeline 可视化编辑器，增强编辑器与 Task Board。

### Feature 清单

| # | Feature | 说明 | 优先级 |
|---|---------|------|--------|
| 1 | feat-agent-runtime-execute | AgentRuntime execute() + ClaudeCodeRuntime 实现 | P0 |
| 2 | feat-agent-runtime-pipeline | Pipeline 编排引擎 | P0 |
| 3 | feat-agent-runtime-ui | Runtime 控制面板 UI | P1 |
| 4 | feat-agent-runtime-system | Runtime 系统集成 | P1 |
| 5 | feat-agent-unified-stream | 统一事件格式 + 前端 Hook 合并 | P0 |
| 6 | feat-pipeline-visual-editor | Pipeline 可视化拖拽编辑器 | P1 |
| 7 | feat-pipeline-yaml-editor | Pipeline YAML/JSON 直接编辑模式 | P1 |
| 8 | feat-pipeline-dual-mode | Pipeline 双模式切换与实时同步 | P1 |
| 9 | feat-file-type-display | 文件类型显示优化 | P2 |
| 10 | feat-image-config-preview | 图片预览支持 | P2 |
| 11 | feat-markdown-split-preview | Markdown 分屏预览 | P1 |
| 12 | feat-syntax-highlight-lang | 语法高亮语言支持扩展 | P1 |
| 13 | feat-task-board-updated-time | Task Board 时间显示优化 | P2 |
| 14 | feat-git-modal-enhance | Git Modal 增强功能 | P2 |
| 15 | feat-git-modal-compact | Git Modal 紧凑布局优化 | P2 |
| 16 | feat-git-integration | Git 集成完善 | P1 |

### 交付物
- [x] Agent Runtime 完整执行链路：启动 → 路由 → 执行 → 事件流
- [x] Pipeline 可视化编辑器（拖拽 + YAML 双模式）
- [x] 统一事件流格式，前端 Hook 合并
- [x] 编辑器支持图片预览、Markdown 分屏、语法高亮
- [x] Git Modal 功能增强

---

## M5: 多模态集成 & 最终交付（3/31 – 4/4）

> 目标：完成多模态 Agent 集成、PM Agent 增强及项目整体收尾。

### Feature 清单

| # | Feature | 说明 | 优先级 |
|---|---------|------|--------|
| 1 | feat-agent-gemini-bridge | GeminiHttpRuntime + PM Agent 迁移到统一执行层 | P0 |
| 2 | feat-pm-agent-provider-switch | PM Agent LLM 提供商切换 | P1 |
| 3 | feat-load-project-context | Project Context 动态加载（替换硬编码） | P1 |
| 4 | feat-new-task-agent-dispatch | New Task 弹窗 Agent 分发 | P1 |
| 5 | feat-agent-layout-optim | Agent Tab 布局优化（flex 自适应） | P2 |
| 6 | feat-settings-style-unify | Settings 页面样式统一 | P2 |
| 7 | feat-editor-save-status | 编辑器保存状态可视化 + 快捷键 | P1 |
| 8 | feat-git-branch-graph | Branch & Feature 连线图（拓扑可视化） | P1 |
| 9 | feat-git-tag-expand | Tag 详情展开（动态加载提交历史） | P2 |
| 10 | feat-project-md-explorer | Project MD Explorer（Markdown 文件浏览器） | P1 |
| 11 | feat-modal-drag-resize | NewTaskModal 拖拽移动与调整大小 | P2 |
| 12 | feat-agent-conversation | Feature Detail Modal Agent 对话区 | P1 |

### 交付物
- [x] Gemini 多模态 Agent 桥接就绪
- [x] PM Agent 支持 LLM 提供商切换
- [x] 项目上下文动态加载
- [x] Git 分支拓扑可视化
- [x] Feature 详情 Modal 支持 Agent 对话

---

## 技术风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| Tauri V2 API 稳定性 | 桌面端核心功能 | 关注 Tauri 官方更新，及时适配 |
| Monaco 编辑器性能 | 大文件编辑体验 | 虚拟化渲染 + 延迟加载 |
| Agent CLI 桥接兼容性 | Agent 功能可用性 | 统一事件格式 + 优雅降级 |
| FS-as-Database 可靠性 | 数据持久化 | 文件锁 + 原子写入 |

---

## 资源需求

| 角色 | 人数 | 职责 |
|------|------|------|
| 前端开发 | 1 | React 组件开发、UI/UX 实现 |
| Rust 后端开发 | 1 | Tauri Command/Event、IPC 桥接 |
| AI Agent 集成 | 1 | Agent Runtime、Pipeline 引擎 |

---

## 总结

本计划覆盖 **5 个里程碑**，共 **63 个 Feature**，核心交付：

1. **完整的桌面 IDE 外壳** — Tauri V2 + React 19，支持窗口管理、主题切换
2. **编辑器与终端** — Monaco 代码编辑器 + xterm.js 终端，支持多语言语法高亮
3. **AI Agent 服务层** — REQ Agent (Claude Code CLI) + PM Agent + Runtime 引擎 + Pipeline 编排
4. **Git 全流程集成** — 状态展示、暂存提交、远程同步、分支拓扑可视化
5. **多模态能力** — 图片分析、文件上传、Gemini 桥接
6. **数据与存储** — FS-as-Database (YAML + Markdown)，无 SQLite 依赖
