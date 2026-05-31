# Checklist: feat-rig-builtin-agent-core

## Completion Checklist

### Development
- [x] 所有 tasks 完成（除需 API Key 的运行时测试）
- [x] 代码自测通过（cargo check 编译通过）

### Code Quality
- [x] 代码风格遵循项目约定（match 周围代码风格）
- [x] `rig_runtime.rs` 模块结构与 `agent_sdk_runtime.rs` 一致
- [x] 错误处理使用 `Result<_, String>` 统一格式
- [x] 无 unused imports 警告（auto-fix: 移除 ProviderConfig）

### Testing
- [x] 编译无错误无警告（rig_runtime 相关）
- [x] 现有 Runtime 功能不受影响（ClaudeCodeRuntime / AgentSdkRuntime / HttpRuntime / CodexRuntime）
- [ ] Rig Runtime 扫描正确返回 Available（需 API Key）
- [ ] 流式聊天正常工作（需 API Key）
- [ ] API Key 未配置时状态正确（需运行时测试）

### Documentation
- [x] spec.md 技术方案已填写
- [ ] CLAUDE.md 更新 Tech Stack（添加 Rig）— 待 complete-feature 阶段更新

### Verification Record
| Timestamp | Status | Details |
|-----------|--------|---------|
| 2026-05-31T14:30:00Z | PASS (warnings) | cargo check 0 errors; 3 Gherkin scenarios verified at code level; 3 runtime tests deferred |

### Evidence
- `features/active-feat-rig-builtin-agent-core/evidence/verification-report.md`

### Implementation Notes
- **架构决策**: 未引入 `rig-core` crate 依赖。原因：
  - rig-core 0.34 (最新) 依赖 reqwest ^0.13，与项目 reqwest 0.12 冲突
  - spec 中提到的 rig-core 0.37 版本不存在
  - 直接用 reqwest 0.12 + futures bytes_stream 实现相同效果
  - HttpRuntime 已证明此模式的可行性
- **API Key 解析**: 优先查找 Anthropic 协议的 Provider，其次 fallback 到 ANTHROPIC_API_KEY 环境变量
