# Feature: feat-workspace-loader 工作区加载器 + 真实文件树

## Basic Information
- **ID**: feat-workspace-loader
- **Name**: 工作区加载器 + 真实文件树
- **Priority**: 80
- **Size**: M
- **Dependencies**: feat-tauri-v2-init
- **Parent**: epic-neuro-syntax-ide-roadmap
- **Created**: 2026-04-01

## Description

让用户通过系统原生文件夹选择器打开本地项目目录，Rust 后端递归扫描文件树返回给前端，替换 ProjectView 和 EditorView 中的 mock 文件数据。工作区路径持久化，下次启动自动加载。

## User Value Points

### VP1: 工作区选择与持久化
用户点击"打开项目"后弹出系统原生文件夹选择器，选择后路径被记住，下次启动自动打开。

### VP2: 真实文件树渲染
EditorView 左侧文件树展示用户真实的项目目录结构，支持展开/折叠/搜索。

## Acceptance Criteria (Gherkin)

```gherkin
Scenario: 首次选择工作区
  Given 应用已启动，尚未选择工作区
  When 用户点击 "Open Project" 或使用快捷键
  Then 弹出系统原生文件夹选择对话框
  When 用户选择一个包含 feature-workflow/ 的目录
  Then 文件树加载并展示真实目录结构
  And 状态栏显示工作区路径

Scenario: 自动加载上次工作区
  Given 用户上次已选择过工作区路径
  When 应用重新启动
  Then 自动加载上次的工作区目录
  And 文件树直接展示内容，无需再次选择

Scenario: 文件树浏览
  Given 工作区已加载
  When 用户在文件树中点击目录节点
  Then 该目录展开显示子目录和文件
  When 用户在搜索框输入文件名
  Then 文件树过滤显示匹配结果
```

## Technical Solution

### Rust Commands
- `pick_workspace()` — 调用 dialog 插件选择目录，验证有效性，持久化路径
- `read_file_tree(path)` — 递归扫描目录，返回 `FileNode[]` JSON
- `get_stored_workspace()` — 读取上次保存的工作区路径

### 前端改造
- ProjectView: 添加"Open Project"按钮，替换 mock 项目数据
- EditorView: 文件树数据来源从 mock 改为 `invoke('read_file_tree')`
- 持久化使用 `tauri-plugin-store` 或 Rust 侧写配置文件

### 关键数据结构
```typescript
interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[];
  expanded?: boolean;
}
```
