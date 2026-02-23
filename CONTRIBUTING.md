# 贡献指南

感谢你对 SWE-Agent-Node 的兴趣！本文档将帮助你参与项目开发。

## 🚀 快速开始

### 1. Fork 并克隆仓库

```bash
git clone https://github.com/YOUR_USERNAME/swe-agent-node.git
cd swe-agent-node
```

### 2. 安装依赖

```bash
npm install
```

### 3. 运行测试

```bash
npm test
```

### 4. 构建

```bash
npm run build
```

## 📋 开发流程

### 创建分支

```bash
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/your-bug-fix
```

### 编写代码

- 遵循现有的代码风格
- 为新功能添加测试
- 更新相关文档

### 提交代码

使用约定式提交格式：

```
feat: 添加新功能
fix: 修复 bug
docs: 文档更新
test: 测试相关
refactor: 代码重构
chore: 构建/工具相关
```

示例：
```
feat: 添加 Python 代码搜索支持
fix: 修复 GitEnv 分支检测问题
docs: 更新 API 文档
```

### 推送并创建 PR

```bash
git push origin feature/your-feature-name
```

然后在 GitHub 上创建 Pull Request。

## 🎯 贡献方向

### 高优先级

1. **LLM 集成** - 完善 OpenClaw LLM 接口
2. **测试覆盖** - 提高测试覆盖率
3. **错误处理** - 改进错误处理和日志

### 中优先级

4. **多语言支持** - Python、Go、Rust 等
5. **性能优化** - 提升搜索和执行效率
6. **文档完善** - 更多示例和教程

### 低优先级（但欢迎）

7. **可视化界面** - Web Dashboard
8. **团队协作** - 多用户支持
9. **插件系统** - 可扩展架构

## 📝 代码规范

### TypeScript

- 使用严格的 TypeScript 配置
- 为所有公开 API 添加类型注释
- 避免使用 `any`，使用 `unknown` 替代

```typescript
// ✅ 好的
function parseIssue(content: string): Issue {
  // ...
}

// ❌ 避免
function parseIssue(content: any): any {
  // ...
}
```

### 命名规范

- 类名：PascalCase（如 `CodeSearch`）
- 函数/方法：camelCase（如 `searchByKeywords`）
- 常量：UPPER_SNAKE_CASE（如 `MAX_RETRIES`）
- 文件：kebab-case（如 `code-search.ts`）

### 注释

- 为复杂逻辑添加注释
- 使用 JSDoc 为公开 API 添加文档

```typescript
/**
 * 搜索包含关键词的代码
 * @param keywords 搜索关键词列表
 * @param options 搜索选项
 * @returns 匹配的代码位置列表
 */
async searchByKeywords(
  keywords: string[],
  options?: SearchOptions
): Promise<CodeLocation[]>
```

## 🧪 测试规范

### 单元测试

- 每个模块应有对应的测试文件
- 测试文件放在 `tests/` 目录
- 使用 Jest 测试框架

```typescript
describe('CodeSearch', () => {
  it('应该搜索到包含关键词的文件', async () => {
    const searcher = new CodeSearch('/path/to/repo');
    const results = await searcher.searchByKeywords(['function']);
    expect(results.length).toBeGreaterThan(0);
  });
});
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- code-search.test.ts

# 生成覆盖率报告
npm test -- --coverage
```

## 📚 文档规范

### API 文档

- 更新 `docs/API.md` 记录新 API
- 包含参数类型和返回值
- 提供使用示例

### README 更新

- 新功能需更新 README 特性列表
- 保持安装和使用说明最新

## 🔍 代码审查

PR 会被审查以下方面：

- [ ] 代码风格一致性
- [ ] 测试覆盖
- [ ] 文档完整性
- [ ] 性能影响
- [ ] 向后兼容性

## 💬 获取帮助

- **GitHub Issues**: 提交 bug 报告或功能请求
- **Pull Requests**: 代码贡献和讨论
- **文档**: 查看 `docs/` 目录

## 📄 许可证

贡献的代码将采用 MIT 许可证。

---

再次感谢你的贡献！🙏
