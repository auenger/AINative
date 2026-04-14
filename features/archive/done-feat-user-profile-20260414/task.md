# Tasks: feat-user-profile

## Task Breakdown

### 1. 类型定义扩展
- [x] 在 `types.ts` 中新增 `UserProfile` 接口（name, email, avatar_base64）
- [x] 在 `AppSettings` 中增加 `user: UserProfile` 字段

### 2. 后端 Rust 改动
- [x] `lib.rs` 中 Settings 相关 struct 增加 `UserProfile` 字段
- [x] 新增 `read_git_user_info` Tauri command（读取 git config user.name / user.email）
- [x] 确保 `read_settings` / `write_settings` 正确处理新字段

### 3. useSettings Hook 更新
- [x] `DEFAULT_SETTINGS` 增加 `user` 默认值
- [x] `update` 方法 merge 逻辑增加 `user` 字段

### 4. 头像裁切组件
- [x] 实现 `AvatarCropper` 纯前端组件（Canvas API）
- [x] 支持圆形裁切框、缩放、拖拽
- [x] 导出 Base64（max 256x256, PNG）

### 5. ProfilePanel 组件
- [x] 实现 `ProfilePanel` 作为 Settings 的新 tab 内容
- [x] 名称、邮箱输入框
- [x] 头像预览 + 点击上传触发裁切
- [x] Git 信息只读展示区域
- [x] 调用 `read_git_user_info` 获取数据

### 6. SettingsView 集成
- [x] tabs 增加 `profile` tab
- [x] 引入 ProfilePanel 组件

### 7. TopNav 头像渲染更新
- [x] TopNav 头像改为读取 settings.user.avatar_base64
- [x] 无头像时降级为 User icon

### 8. i18n 翻译
- [x] 增加 profile 相关的中英文翻译 key

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-13 | Feature created | 待开始实现 |
| 2026-04-14 | All 8 tasks implemented | types, Rust backend, useSettings, AvatarCropper, ProfilePanel, SettingsView, TopNav, i18n |
