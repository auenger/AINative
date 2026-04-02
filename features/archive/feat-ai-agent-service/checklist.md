# Checklist: feat-ai-agent-service

## Completion Checklist

### Development
- [ ] 所有 task.md 中的任务项完成
- [ ] 子任务 A (SSE 流式通信) 完成
- [ ] 子任务 B (Keyring 凭证) 完成
- [ ] 子任务 C (自动创建 Feature) 完成

### Code Quality
- [ ] API Key 不出现在前端代码/网络请求/localStorage
- [ ] SSE 连接断开有重试机制
- [ ] 结构化输出有严格的 Schema 校验
- [ ] Agent 创建文件失败有回滚机制

### Testing
- [ ] PM Agent 对话打字效果流畅
- [ ] API Key 安全存储验证
- [ ] Agent 创建 Feature 文件结构正确
- [ ] queue.yaml 更新正确
- [ ] 看板自动刷新正常

### Security
- [ ] 前端无法读取 API Key 明文
- [ ] 网络请求不泄露凭证
- [ ] CSP 策略允许 SSE 连接

### Documentation
- [ ] spec.md Technical Solution 已填写
- [ ] task.md Progress Log 已更新
