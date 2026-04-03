# Checklist: feat-syntax-highlight-lang

## Completion Checklist

### Development
- [x] All tasks completed
- [x] Code self-tested

### Code Quality
- [x] Token 规则不与现有规则冲突
- [x] 深色/浅色主题规则同步
- [x] Vue grammar 注册在 beforeMount 阶段

### Testing
- [x] Java 注解/泛型正确高亮
- [x] Python 装饰器/f-string/self 正确高亮
- [x] Rust 生命周期/宏/属性 正确高亮
- [x] Vue 文件 template/script/style 各区域正确高亮
- [x] Go 短变量声明/关键字 正确高亮
- [x] 现有 TS/JS/HTML/CSS 高亮不受影响
- [x] 深色和浅色主题下均清晰可读

### Documentation
- [x] spec.md technical solution filled

## Verification Record

- **Date:** 2026-04-04
- **Status:** PASSED
- **Scenarios validated:** 6/6
- **Task completion:** 13/15 (all required, optional Svelte skipped)
- **Build:** PASSED
- **Evidence:** `features/active-feat-syntax-highlight-lang/evidence/verification-report.md`
