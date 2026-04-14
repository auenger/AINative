# Feature: feat-user-profile User Profile Management

## Basic Information
- **ID**: feat-user-profile
- **Name**: 用户资料管理（名称/邮箱/头像/Git 信息）
- **Priority**: 45
- **Size**: M
- **Dependencies**: none
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-13

## Description

在 Settings 页面新增 **Profile** tab，支持用户设置名称、邮箱、头像。头像支持选择图片后裁切，裁切结果直接以 Base64 存入 `settings.yaml`。同时自动读取当前 git 用户配置（`user.name` / `user.email`）进行展示。所有头像渲染位置（TopNav 等）切换为使用真实头像。

## User Value Points

1. **个人资料编辑** — 用户可以在 Settings 中设置自己的名称和邮箱
2. **头像裁切与持久化** — 选择本地图片后可裁切，裁切结果 Base64 存入 settings.yaml，全应用共享
3. **Git 信息自动读取** — 自动从 `git config` 抓取 user.name / user.email，作为资料预填和展示
4. **头像全局渲染** — TopNav 等所有头像位置从 mock 图片切换为真实用户头像

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/SettingsView.tsx` — 当前 Settings 页面，有 `general` / `llm` 两个 tab
- `neuro-syntax-ide/src/lib/useSettings.ts` — useSettings hook，管理 AppSettings 的读写
- `neuro-syntax-ide/src/components/TopNav.tsx` — 头像渲染位置，当前使用 picsum.photos mock
- `neuro-syntax-ide/src/types.ts` — AppSettings 类型定义，需扩展 user profile 字段
- `neuro-syntax-ide/src-tauri/src/lib.rs` — Rust 后端 settings 读写，需扩展 user profile + git info 读取

### Related Documents
- `project-context.md` — 项目架构和 FS-as-Database 策略
- `CLAUDE.md` — 技术栈和规则

### Related Features
- `feat-settings-style-unify` (completed) — Settings 页面样式已统一

## Technical Solution

### 前端改动

1. **types.ts** — 扩展 AppSettings：
   ```typescript
   interface UserProfile {
     name: string;
     email: string;
     avatar_base64: string; // data:image/xxx;base64,xxx
   }

   interface AppSettings {
     // ...existing fields
     user: UserProfile;
   }
   ```

2. **SettingsView.tsx** — 新增 `profile` tab：
   - ProfilePanel 组件：名称输入、邮箱输入、头像上传/裁切
   - 头像裁切使用纯前端 Canvas API（不引入第三方库），支持圆形裁切框
   - 裁切后生成 Base64 字符串，存入 settings.user.avatar_base64

3. **TopNav.tsx** — 头像渲染改为读取 settings 中的 avatar_base64

4. **useSettings.ts** — DEFAULT_SETTINGS 增加 user 默认值，update merge 逻辑增加 user 字段

5. **Git 信息展示** — 调用 Tauri 命令 `read_git_user_info` 获取 git user.name / user.email，在 Profile tab 中只读展示

### 后端改动 (Rust)

1. **lib.rs** — settings 类型扩展增加 UserProfile struct
2. **lib.rs** — 新增 `read_git_user_info` command：
   - 从当前 workspace 执行 `git config user.name` 和 `git config user.email`
   - 返回 `{ name: string, email: string }`

### 头像裁切方案

- 使用 HTML5 Canvas API 实现前端裁切
- 流程：选择文件 → FileReader 读取为 data URL → Canvas 绘制 + 裁切框 → 导出 Base64
- 裁切框：圆形，支持缩放和拖拽
- 输出：`data:image/png;base64,...` 格式，限制最大 256x256 以控制 settings.yaml 大小

## Acceptance Criteria (Gherkin)

### User Story
作为一个用户，我希望在 Settings 中管理我的个人资料（名称、邮箱、头像），并看到我的 Git 信息，这样 IDE 可以展示我的真实身份。

### Scenarios (Given/When/Then)

#### Scenario 1: 编辑用户名称和邮箱
```gherkin
Given 用户打开 Settings 页面
When 用户切换到 Profile tab
Then 用户可以看到名称输入框和邮箱输入框
And 可以看到当前 git user.name 和 user.email 作为参考信息展示
When 用户修改名称为 "Ryan" 并点击 Save
Then settings.yaml 中 user.name 更新为 "Ryan"
And 保存成功提示出现
```

#### Scenario 2: 上传并裁切头像
```gherkin
Given 用户在 Profile tab 中
When 用户点击头像区域选择一张图片
Then 弹出裁切界面，显示圆形裁切框
When 用户调整裁切区域并确认
Then 裁切后的图片以 Base64 格式存入 settings.user.avatar_base64
And 头像预览更新为裁切后的图片
When 用户点击 Save
Then settings.yaml 中 user.avatar_base64 更新
```

#### Scenario 3: Git 信息自动读取展示
```gherkin
Given 用户的 workspace 有 git 仓库
When 用户打开 Profile tab
Then 页面展示从 git config 读取的 user.name 和 user.email
And Git 信息为只读展示，标注 "来自 Git 配置"
```

#### Scenario 4: 头像全局渲染
```gherkin
Given 用户已设置头像 Base64
Then TopNav 右上角显示用户真实头像
When 用户尚未设置头像时
Then TopNav 显示默认占位头像（User icon）
```

### UI/Interaction Checkpoints
- Profile tab 位于 Settings 页面的第三个 tab（general | llm | profile）
- 头像区域为圆形，点击触发文件选择
- 裁切界面覆盖在当前内容上方（模态）
- Git 信息区域有独立的视觉边界和 "from Git" 标签
- 保存按钮行为与现有 tab 一致（dirty 检测 + save 提示）

### General Checklist
- Base64 头像大小控制在合理范围（压缩后 < 100KB）
- 不引入新的第三方依赖（裁切使用 Canvas API）
- 头像渲染兼容无头像场景（降级为 icon）
- Git 信息读取失败时优雅降级（不阻塞 UI）

## Merge Record

- **Completed**: 2026-04-14
- **Merged Branch**: feature/feat-user-profile
- **Merge Commit**: 3fb44e7
- **Archive Tag**: feat-user-profile-20260414
- **Conflicts**: None (clean rebase)
- **Verification**: All 4 Gherkin scenarios passed (code analysis)
- **Stats**: 8 files changed, 565 insertions(+), 8 deletions(-), 2 new components
