# Feature: feat-syntax-highlight-lang 多语言语法配色渲染

## Basic Information
- **ID**: feat-syntax-highlight-lang
- **Name**: 多语言语法配色渲染增强
- **Priority**: 58
- **Size**: M
- **Dependencies**: feat-file-type-router
- **Parent**: feat-file-type-display
- **Children**: null
- **Created**: 2026-04-03

## Description
为编辑器中不同编程语言（JS/TS/Vue/Java/Python/Rust/Go/Kotlin/C++ 等）提供完善的语法高亮配色渲染。增强 Monaco 自定义主题的语言特有 token 规则，注册 Monaco 未内置的语言 grammar（如 Vue），确保每种语言都有清晰、准确的语法着色。

## User Value Points
1. **多语言语法高亮增强** — 为 JS/TS/Java/Python/Rust/Go 等语言增加 Monaco token 规则，让每种语言的关键语法元素有独特配色
2. **Vue/Svelte 等框架文件支持** — 通过注册 TextMate grammar 或自定义 tokenizer，使 Monaco 能正确解析和着色框架文件

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/lib/monaco-theme.ts` — 当前 neuro-dark/neuro-light 主题，rules 覆盖了通用 token 但缺少语言特有 token
- `neuro-syntax-ide/src/components/views/EditorView.tsx:getLanguageFromPath()` — 语言映射函数，缺少 Go/Kotlin/C++ 等
- `neuro-syntax-ide/package.json` — 已有 `@monaco-editor/react` v4.7.0

### Current Token Coverage Analysis
| 语言 | 关键缺失 token |
|------|--------------|
| Java | `@interface`, `extends`, `implements`, 泛型 `<T>` |
| Python | `self`, `__init__`, f-string `f"..."`, decorator `@` |
| Rust | 生命周期 `'a`, macro `println!`, attribute `#[derive]` |
| Go | `:=`, `chan`, `goroutine`, `defer` |
| Vue | 整个文件（Monaco 无内置 Vue grammar） |
| Kotlin | `suspend`, `companion`, `data class` |
| C/C++ | `#include`, `#define`, 指针 `*`, 引用 `&` |

### Related Documents

### Related Features
- feat-file-type-router — 路由系统确定文件语言，本功能增强对应语言的配色
- feat-editor-theme-perf (completed) — 编辑器主题基础

## Technical Solution
1. **Monaco Theme Token Rules** — Added ~50 language-specific token rules to both `neuro-dark` and `neuro-light` themes in `monaco-theme.ts`, covering Java annotations, Python decorators/f-strings, Rust attributes/macros, Go keywords, Kotlin annotations, C/C++ preprocessor directives, and Vue directives. Purple (`f0abfc` dark / `9333ea` light) used for decorators/annotations across all languages.
2. **Vue Monarch Tokenizer** — Created `vue-language.ts` with a Monarch tokenizer that handles `<template>/<script>/<style>` block detection, Vue directive highlighting (`v-if`, `v-for`, etc.), `{{ }}` interpolation expressions, and shorthand directives (`@`, `:`, `#`). Registered via `monaco.languages.register()` + `setMonarchTokensProvider()` in `beforeMount`.
3. **Language Mapping Update** — Changed `.vue` mapping from `'html'` to `'vue'` in `getLanguageFromPath()`. Added `vue` and `c`/`cpp` presets to `language-presets.ts`. File icons for all target languages already present from prior feature work.

## Acceptance Criteria (Gherkin)
### User Story
作为开发者，我希望打开不同语言的代码文件时，每种语言的关键语法元素都有独特、准确的语法着色，以便快速区分语言特有结构。

### Scenarios (Given/When/Then)
#### Scenario 1: Java 注解高亮
- Given 打开 `.java` 文件
- Then `@Override`, `@Autowired` 等注解以高亮色显示（区别于普通标识符）
- And `public class`, `interface`, `extends` 等关键字正确着色

#### Scenario 2: Python 装饰器和 f-string
- Given 打开 `.py` 文件
- Then `@dataclass`, `@property` 等装饰器以特殊色显示
- And f-string `f"Hello {name}"` 中变量部分正确高亮
- And `self`, `cls` 有特殊样式

#### Scenario 3: Rust 生命周期和宏
- Given 打开 `.rs` 文件
- Then 生命周期标注 `'a`, `'static` 正确着色
- And 宏调用 `println!`, `vec!` 正确着色
- And `#[derive(Debug)]` 属性正确着色

#### Scenario 4: Vue 单文件组件
- Given 打开 `.vue` 文件
- Then `<template>`, `<script>`, `<style>` 区域各自正确高亮
- And `v-if`, `v-for`, `v-model` 等 Vue 指令有特殊着色
- And 插值表达式 `{{ }}` 正确高亮

#### Scenario 5: Go 语言
- Given 打开 `.go` 文件
- Then `:=` 短变量声明正确高亮
- And `goroutine`, `chan`, `defer` 等关键字正确着色

#### Scenario 6: 深色/浅色主题兼容
- Given 所有语言的 token 规则
- Then 在 neuro-dark 和 neuro-light 两种主题下均清晰可读
- And 深色和浅色下同一 token 使用不同色值（对比度适配）

### UI/Interaction Checkpoints
- 切换文件类型时配色即时生效
- 不影响现有已支持语言（TS/JS/HTML/CSS/JSON/YAML）的高亮效果
- Minimap 中语法着色同步生效

### General Checklist
- [ ] 新增语言 token 规则不与现有规则冲突
- [ ] Vue grammar 注册应在 beforeMount 阶段完成
- [ ] 保持 cn() 样式合并模式
- [ ] 类型定义遵循 types.ts 集中管理

## Merge Record
- **Completed:** 2026-04-04
- **Merged branch:** feature/feat-syntax-highlight-lang
- **Merge commit:** fb1e990
- **Archive tag:** feat-syntax-highlight-lang-20260404
- **Conflicts:** 1 file (EditorView.tsx import conflict with feat-markdown-split-preview) -- resolved by keeping both imports
- **Verification:** 6/6 Gherkin scenarios passed
- **Stats:** started 2026-04-04T00:00:00Z, duration ~30min, 1 commit, 4 files changed
