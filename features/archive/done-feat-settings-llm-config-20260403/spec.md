# Feature: feat-settings-llm-config Settings 页面 & LLM Provider 配置

## Basic Information
- **ID**: feat-settings-llm-config
- **Name**: Settings 页面 & LLM Provider 配置
- **Priority**: 70
- **Size**: M
- **Dependencies**: feat-fs-database-engine (YAML 配置读写)
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-03

## Description

构建 IDE 的全局设置页面，提供 LLM Provider 配置和 Task Board 自动刷新设置。

### 核心需求
1. **Settings 页面 UI** — 在 SideNav settings 入口下渲染完整设置视图
2. **LLM Provider 管理** — 支持配置多个 OpenAI 兼容的 LLM Provider（url / model / api_key）
3. **自动刷新配置** — Task Board 可配置定时刷新间隔，替代当前的静态/mock 时间戳
4. **配置持久化** — 使用 YAML 文件存储配置（FS-as-Database），前端通过 Tauri IPC 读写

### 配置格式（settings.yaml）
```yaml
# LLM Provider 配置（OpenAI 兼容协议）
providers:
  zai:
    api_key: "your-api-key"
    api_base: "https://open.bigmodel.cn/api/coding/paas/v4"

llm:
  provider: "zai"
  model: "glm-4.7"
  max_tokens: 2000
  temperature: 0.7
  context_window_tokens: 128000

# 应用设置
app:
  auto_refresh_interval: 30    # Task Board 刷新间隔（秒），0 = 禁用
```

## User Value Points

### VP1: Settings 页面 — 统一配置入口
用户可以在 IDE 内直接管理所有应用配置，无需手动编辑配置文件。

### VP2: LLM Provider 配置 — 启用 AI 功能
用户可以配置 LLM API 连接参数（URL/Model/Key），使 IDE 的 AI Agent 功能可用。支持多个 Provider 配置和切换。

### VP3: 自动刷新 — Task Board 实时更新
Task Board 的 "Updated" 时间戳实时反映最新状态，而非静态/mock 值。用户可控制刷新频率。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/types.ts` — ViewType 已包含 'settings'
- `neuro-syntax-ide/src/components/views/` — 现有视图组件参考
- `neuro-syntax-ide/src/lib/useQueueData.ts` — Queue 数据 hook，需增加定时刷新
- `neuro-syntax-ide/src/components/common/SideNav.tsx` — settings 入口已存在
- `neuro-syntax-ide/src/components/App.tsx` — 视图路由注册
- `neuro-syntax-ide/src/i18n.ts` — settings 翻译 key 已存在

### Related Documents
- CLAUDE.md — Tech Stack: React 19 + Tauri V2, FS-as-Database
- project-context.md — 项目阶段与架构

### Related Features
- feat-fs-database-engine — YAML 文件读写基础设施
- feat-ai-agent-service — AI 服务层，消费 LLM 配置

## Technical Solution

### 前端架构

#### 1. SettingsView 组件 (`components/views/SettingsView.tsx`)
- 分区 Tab 布局：General / LLM Providers
- 表单控件：input / select / slider / toggle
- 实时保存（debounce）或手动 Save 按钮
- 遵循现有设计系统（Tailwind + Material Design 色彩）

#### 2. LLM Provider 配置区
- Provider 列表（可增删）
- 每个 Provider 三个字段：api_base (URL) / api_key / default model
- 当前活跃 Provider 高亮 + 一键切换
- 连接测试按钮（调用 /models 端点验证）

#### 3. 自动刷新配置
- Slider 控件：5s ~ 300s
- Toggle 开关：启用/禁用
- 修改后立即生效，更新 useQueueData 的刷新间隔

#### 4. 配置持久化
- 前端通过 `invoke('read_settings')` / `invoke('write_settings')` 调用 Rust Command
- 配置文件路径：`{workspace}/.neuro/settings.yaml`
- Rust 侧新增 Command: `read_settings`, `write_settings`, `test_llm_connection`

### Rust 后端

#### 新增 Commands
```rust
#[tauri::command]
async fn read_settings(app: AppHandle) -> Result<AppSettings, String>

#[tauri::command]
async fn write_settings(app: AppHandle, settings: AppSettings) -> Result<(), String>

#[tauri::command]
async fn test_llm_connection(provider: LlmProviderConfig) -> Result<Vec<String>, String>
// 调用 {api_base}/models 验证连接，返回可用模型列表
```

#### 数据结构
```rust
struct AppSettings {
    providers: HashMap<String, ProviderConfig>,
    llm: LlmConfig,
    app: AppConfig,
}

struct ProviderConfig {
    api_key: String,
    api_base: String,
}

struct LlmConfig {
    provider: String,
    model: String,
    max_tokens: u32,
    temperature: f32,
    context_window_tokens: u32,
}

struct AppConfig {
    auto_refresh_interval: u32,
}
```

### useQueueData 增强
- 新增 `setRefreshInterval(seconds: number)` 方法
- `useEffect` 中启动 `setInterval` 定时器
- 间隔变更时重置定时器
- dev fallback 也支持定时刷新

## Acceptance Criteria (Gherkin)

### User Story
作为 IDE 用户，我希望通过 Settings 页面配置 LLM Provider 和应用行为，以便 AI 功能正常工作并按我的偏好运行。

### Scenarios (Given/When/Then)

#### Scenario 1: 打开 Settings 页面
```gherkin
Given 用户已打开 IDE
When 用户点击侧边栏 Settings 图标
Then Settings 视图渲染成功
And 显示 General 和 LLM Providers 两个配置区域
And 从 settings.yaml 加载已有配置并填充表单
```

#### Scenario 2: 配置 LLM Provider
```gherkin
Given 用户在 Settings 页面 LLM Providers 区域
When 用户填写 api_base、api_key 并选择 model
And 点击 Save
Then 配置持久化到 settings.yaml
And 当前活跃 Provider 更新为新配置
```

#### Scenario 3: 测试 LLM 连接
```gherkin
Given 用户已填写 Provider 的 api_base 和 api_key
When 用户点击 Test Connection 按钮
Then IDE 调用 {api_base}/models 验证连接
And 成功时显示可用模型列表
And 失败时显示错误信息
```

#### Scenario 4: 自动刷新配置
```gherkin
Given 用户在 Settings 页面 General 区域
When 用户调整自动刷新间隔为 30 秒
And 点击 Save
Then Task Board 每 30 秒自动刷新一次
And "Updated" 时间戳实时更新
```

#### Scenario 5: 禁用自动刷新
```gherkin
Given 用户在 Settings 页面 General 区域
When 用户关闭自动刷新开关
Then Task Board 停止定时刷新
And 仅保留手动刷新和 FS watcher 触发
```

#### Scenario 6: 多 Provider 管理
```gherkin
Given 用户已配置至少一个 LLM Provider
When 用户添加新 Provider 并保存
Then Provider 列表中显示新条目
And 用户可在 Provider 间切换活跃 Provider
```

### UI/Interaction Checkpoints
- Settings 视图与现有 IDE 主题一致（深色/浅色）
- 表单输入有验证反馈（URL 格式、必填字段）
- API Key 字段默认隐藏，点击显示
- 连接测试有 loading 状态和结果反馈
- 自动刷新 Slider 有当前值实时显示

### General Checklist
- [ ] Settings 页面路由注册到 App.tsx
- [ ] SideNav settings 入口连接到 SettingsView
- [ ] useQueueData 支持可配置刷新间隔
- [ ] Rust Command 实现配置读写
- [ ] dev fallback 支持配置功能
- [ ] API Key 不在前端明文暴露（显示时掩码）
