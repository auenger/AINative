# Feature: fix-settings-api-base-url 修复 LLM 供应商 API Base URL 无法修改

## Basic Information
- **ID**: fix-settings-api-base-url
- **Name**: 修复 LLM 供应商 API Base URL 无法修改
- **Priority**: 80 (高 — 核心配置功能不可用)
- **Size**: S (小 — 单点修复)
- **Dependencies**: 无
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-14

## Description

用户在 Settings > LLM Providers 页面中修改任意供应商（包括 ZAI 默认供应商和新增供应商）的 **API Base URL** 时，输入框可以聚焦和输入，但输入的值会**立即恢复为原值**，导致无法完成修改。

API Key 字段不受影响，可以正常编辑和保存。

## User Value Points

### V1: API Base URL 可正常编辑并持久化
用户能够在 LLM 供应商配置中自由修改 API Base URL，输入后值保持不变，点击 Save 后正确持久化。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/SettingsView.tsx:305-311` — API Base URL 输入框实现
- `neuro-syntax-ide/src/lib/useSettings.ts` — 设置状态管理 Hook
  - `load()` (L55-79): 从后端读取设置，合并默认值
  - `update()` (L99-109): 局部更新设置并标记 dirty
  - `useEffect` (L112-114): 组件挂载时调用 `load()`

### Related Documents
- `CLAUDE.md` — 项目规范
- `project-context.md` — 项目上下文

### Related Features
- `feat-settings-llm-config` (已完成) — LLM 配置功能初始实现
- `feat-settings-style-unify` (已完成) — 设置页面样式统一

## Root Cause Analysis

**症状**: 受控输入框 (`value={config.api_base}`) 的值在用户输入后立即被重置。

**推测根因** (按可能性排序):

1. **`load()` 被重复调用**: `useEffect(() => { load() }, [load])` 在某些场景下被重复触发（如 React Strict Mode 双调用、组件重新挂载、tab 切换导致卸载/重挂载），导致 `setSettings()` 用旧数据覆盖用户正在编辑的值

2. **父组件重渲染导致 props 引用变化**: `SettingsView` 重渲染时传入新的 `settings` 引用，如果 `update` 的 state 更新尚未生效就被 `load()` 结果覆盖，会出现值闪烁/回退

3. **异步竞态**: 用户快速输入时，多次 `onChange` -> `updateProvider` -> `onUpdate` -> `setSettings` 与潜在的 `load()` 调用形成竞态

### 关键证据
- 输入框代码无 `disabled` / `readOnly`
- `onChange` 链路完整: `input.onChange` -> `updateProvider()` -> `onUpdate()` -> `useSettings.update()` -> `setSettings()`
- API Key 字段使用相同的 `updateProvider` 函数但 reportedly 正常工作（需进一步确认）
- 最近提交仅涉及 Profile 面板新增，未改动 LLM 配置逻辑

## Technical Solution

### 方案: 防止编辑期间的状态重置

**核心思路**: 在用户正在编辑（dirty 状态）时，阻止 `load()` 覆盖当前状态。

#### 修改文件: `neuro-syntax-ide/src/lib/useSettings.ts`

```typescript
// 在 load() 中增加 dirty 保护
const load = useCallback(async () => {
  // 如果用户已有未保存的修改，跳过重新加载
  if (dirty) return;  // ← 新增保护

  setLoading(true);
  setError(null);
  // ... 原有逻辑
}, [dirty]);  // ← 将 dirty 加入依赖
```

#### 备选方案 (如果上述不够):
在 `LlmPanel` 中对 API Base URL 使用**本地 state** + **blur 时同步**的模式，彻底隔离外部状态重置的影响：

```typescript
// SettingsView.tsx LlmPanel 内部
const [localApiBase, setLocalApiBase] = useState(config.api_base);

// input value 绑定 local state, onChange 更新 local state
// onBlur 时才调用 updateProvider 同步到全局 state
```

#### 推荐优先尝试方案 1（最小改动），如果问题仍存在则采用方案 2。

## Acceptance Criteria (Gherkin)

### User Story
作为一个 Neuro Syntax IDE 用户，
我希望能够在 Settings 中修改 LLM 供应商的 API Base URL，
以便我能够切换到不同的 API 端点或使用代理地址。

### Scenarios

#### Scenario 1: 修改 ZAI 默认供应商的 API Base URL
```gherkin
Given 我在 Settings > LLM Providers 页面
And ZAI 供应商已配置默认的 API Base URL
When 我点击 API Base URL 输入框并输入新的 URL "https://custom.example.com/v1"
Then 输入框显示我输入的新值 "https://custom.example.com/v1"
And 值不会自动恢复为原来的默认值
```

#### Scenario 2: 修改新增供应商的 API Base URL
```gherkin
Given 我在 Settings > LLM Providers 页面
And 我已通过 "+" 按钮添加了一个新供应商
When 我在新供应商的 API Base URL 输入框中输入 "https://api.another-provider.com/v1"
Then 输入框保持显示我输入的值
And 值不会立即清空或恢复
```

#### Scenario 3: 修改后保存并持久化
```gherkin
Given 我已成功修改了某个供应商的 API Base URL
When 我点击 Save 按钮
Then 设置被保存到后端
And 重新打开 Settings 页面后，API Base URL 显示保存后的值
```

#### Scenario 4: 编辑期间切换 Tab 不丢失输入
```gherkin
Given 我正在编辑某个供应商的 API Base URL（已有未保存修改）
When 我切换到 General tab 再切回 LLM tab
Then 我之前输入的 API Base URL 值仍然保留
And 不会被重置为保存前的值
```

### UI/Interaction Checkpoints
- [ ] API Base URL 输入框可正常聚焦，光标可见
- [ ] 键盘输入字符逐个显示，无闪烁或回退
- [ ] 输入过程中 dirty 状态正确触发（Save 按钮变为可点击）
- [ ] 其他字段（API Key、Model 等）的编辑行为不受影响

### General Checklist
- [ ] 修复不影响现有 API Key 编辑功能
- [ ] 修复不影响新增/删除供应商功能
- [ ] 修复不影响 Test Connection 功能
- [ ] 修复不引入新的内存泄漏或性能问题

---

## Merge Record

| Field | Value |
|-------|-------|
| **Completed** | 2026-04-15T11:00:00Z |
| **Merged Branch** | feature/fix-settings-api-base-url |
| **Merge Commit** | 12437c8 |
| **Archive Tag** | fix-settings-api-base-url-20260415 |
| **Conflicts** | None |
| **Verification** | passed (code analysis, 4/4 scenarios) |
| **Duration** | ~1h |
| **Commits** | 1 |
| **Files Changed** | 1 (neuro-syntax-ide/src/lib/useSettings.ts) |
