# Tasks: feat-syntax-highlight-lang

## Task Breakdown

### 1. 增强 Monaco 主题 Token 规则
- [x] 在 `monaco-theme.ts` 两个主题中增加语言特有 token 规则
- [x] Java: `annotation.java`, `keyword.declaration.java`, 泛型 bracket
- [x] Python: `decorator.python`, `variable.language.python` (self/cls), f-string
- [x] Rust: `lifetime.rust`, `macro.rust`, `attribute.rust`
- [x] Go: `keyword.assignment.go` (:=), `keyword.go` (chan, defer, go)
- [x] Kotlin: `keyword.kotlin` (suspend, companion, data), annotation
- [x] C/C++: `keyword.directive.cpp` (#include, #define), 指针/引用
- [x] 确保 neuro-dark 和 neuro-light 两套主题规则同步

### 2. 注册 Vue 语言 Grammar
- [x] 调研 Monaco 注册自定义语言 grammar 的方式（TextMate JSON 或 monarch tokenizer）
- [x] 为 Vue 单文件组件编写或引入 Monarch tokenizer 定义
- [x] 在 `beforeMount` 阶段注册 Vue 语言（`monaco.languages.register` + `setMonarchTokensProvider`）
- [x] 处理 Vue 文件中 template/script/style 区域切换

### 3. 扩展语言映射
- [x] 在 `getLanguageFromPath()` 中增加: `.go` → `go`, `.kt` → `kotlin`, `.kts` → `kotlin`, `.c` → `c`, `.h` → `c`, `.cpp` → `cpp`, `.hpp` → `cpp`, `.vue` → `vue`
- [x] 在 `getFileIcon()` 中增加对应文件图标和颜色
- [x] `.vue` 映射从 `'html'` 改为 `'vue'` 以启用自定义 Vue grammar
- [x] 添加 `vue`、`c`、`cpp` 的 language preset 到 `language-presets.ts`

### 4. Svelte 支持（可选）
- [ ] 调研 Monaco Svelte 语法支持方案
- [ ] 如可行，注册 Svelte 语言 grammar

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-03 | Created | Feature initialized |
| 2026-04-04 | Task 1-3 done | Token rules, Vue grammar, language mapping complete |
