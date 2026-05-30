# Feature: feat-agent-runtime-skills Agent Skill 生态管理

## Basic Information
- **ID**: feat-agent-runtime-skills
- **Name**: Agent Skill 生态管理 — ClawHub + Skills Hub 浏览与安装
- **Priority**: 40
- **Size**: S
- **Dependencies**: feat-agent-provider-core
- **Parent**: feat-agent-provider
- **Children**: none
- **Created**: 2026-05-09

## Description

为 IDE 提供 Agent Skill 生态的浏览、搜索、安装和管理能力。同时支持 OpenClaw 的 ClawHub 和 Hermes 的 Skills Hub 两个技能市场。

**核心工作：**
1. Skill Registry 抽象 — 统一两个不同 Skill 市场的接口
2. ClawHub 集成 — 通过 `openclaw skills` CLI 命令桥接
3. Skills Hub 集成 — 通过 `hermes skills` CLI 命令桥接
4. Skill 管理 UI — 浏览、搜索、安装、卸载、配置

## User Value Points

1. **统一 Skill 浏览** — 一个面板浏览两个生态的 Skills
2. **一键安装** — 从 ClawHub 或 Skills Hub 直接安装 Skill 到本地

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/lib/useAgentConfigs.ts` — Agent 配置管理
- `neuro-syntax-ide/src-tauri/src/agent_sdk_runtime.rs` — 侧边车进程管理模式

### External Resources
- ClawHub (https://clawhub.ai) — OpenClaw 技能市场，公开 API
- Skills Hub — Hermes Agent 内置技能市场，`hermes skills` CLI

## Technical Solution

### Skill Registry 抽象

```typescript
interface SkillRegistry {
  provider: 'openclaw' | 'hermes';
  listInstalled(): Promise<SkillInfo[]>;
  search(query: string): Promise<SkillInfo[]>;
  install(name: string): Promise<void>;
  uninstall(name: string): Promise<void>;
  update(name: string): Promise<void>;
  getConfig(name: string): Promise<SkillConfig>;
  setConfig(name: string, config: SkillConfig): Promise<void>;
}

interface SkillInfo {
  name: string;
  description: string;
  version: string;
  author: string;
  provider: 'openclaw' | 'hermes';
  status: 'installed' | 'available' | 'update-available';
  trust: 'builtin' | 'official' | 'trusted' | 'community';
  metadata: Record<string, unknown>;
}
```

### IPC Commands

```rust
#[tauri::command]
async fn skills_list_installed(provider: String) -> Result<Vec<SkillInfo>, String>;

#[tauri::command]
async fn skills_search(provider: String, query: String) -> Result<Vec<SkillInfo>, String>;

#[tauri::command]
async fn skills_install(provider: String, name: String) -> Result<(), String>;

#[tauri::command]
async fn skills_uninstall(provider: String, name: String) -> Result<(), String>;

#[tauri::command]
async fn skills_update(provider: String, name: String) -> Result<(), String>;
```

### UI Layout

```
┌─ Agent Skills ──────────────────────────────────┐
│ [🔍 Search skills...]    [OpenClaw] [Hermes]    │
│                                                   │
│ ┌─ Installed ──────────────────────────────────┐ │
│ │ 📦 web-search          v1.2.0  [Update]      │ │
│ │    Web search and fetch capabilities          │ │
│ │ 📦 code-review          v2.0.1  [Configure]  │ │
│ │    Automated code review with best practices  │ │
│ └──────────────────────────────────────────────┘ │
│                                                   │
│ ┌─ Available ──────────────────────────────────┐ │
│ │ 📦 arxiv-research       v1.0.0  [Install]    │ │
│ │    Search and summarize arXiv papers          │ │
│ │ 📦 image-lab            v3.1.0  [Install]    │ │
│ │    Generate and edit images                   │ │
│ └──────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

## Acceptance Criteria (Gherkin)

### Scenarios

#### Scenario 1: 浏览已安装 Skills
```gherkin
Given 用户已安装 OpenClaw 和 Hermes
When 用户打开 Agent Skills 面板
Then 显示两个 Provider 的已安装 Skills 列表
And 每个 Skill 显示名称、版本、描述
```

#### Scenario 2: 搜索并安装 Skill
```gherkin
Given 用户在 Agent Skills 面板
When 用户搜索 "image" 并选择 OpenClaw 标签
Then 显示 ClawHub 中匹配的 Skills
When 用户点击 "Install"
Then IDE 通过 CLI 命令安装 Skill
And 安装完成后列表自动刷新
```

#### Scenario 3: Skill 更新
```gherkin
Given 有已安装的 Skill 存在新版本
When 用户点击 "Update"
Then IDE 执行更新命令
And 版本号更新为最新版本
```

### General Checklist
- 支持 ClawHub 和 Skills Hub 双源 Skill 浏览
- 安装/卸载/更新操作通过 CLI 命令桥接
- 错误处理：网络不可达、Skill 不存在、权限不足
