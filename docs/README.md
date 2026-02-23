# SWE-Agent-Node 文档索引

欢迎查阅 SWE-Agent-Node 文档！本文档帮助你快速找到所需信息。

---

## 📚 核心文档

### 快速开始

| 文档 | 描述 | 状态 |
|------|------|------|
| [README.md](../README.md) | 项目概述和快速开始 | ✅ 最新 |
| [QUICKSTART.md](../QUICKSTART.md) | 快速上手指南 | ✅ 最新 |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | 贡献指南 | ✅ 已更新 |
| [DEVELOPMENT.md](../DEVELOPMENT.md) | 开发指南 | ✅ 最新 |

### API 和架构

| 文档 | 描述 | 状态 |
|------|------|------|
| [API.md](./API.md) | 完整的 API 参考 | ✅ 最新 |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | 系统架构设计 | ✅ 最新 |
| [ENHANCED_ARCHITECTURE.md](./ENHANCED_ARCHITECTURE.md) | 2.0 增强架构 | ✅ 最新 |
| [types.ts](../src/types.ts) | 类型定义源码 | ✅ 最新 |

### 研究和设计

| 文档 | 描述 | 状态 |
|------|------|------|
| [RESEARCH_REPORT.md](./RESEARCH_REPORT.md) | 四个方向的深度分析 | ✅ 最新 |
| [COMPETITOR_RESEARCH.md](./COMPETITOR_RESEARCH.md) | SWE-Agent 等竞品分析 | ✅ 最新 |
| [ROADMAP.md](../ROADMAP.md) | 版本路线图 | ✅ 最新 |
| [PROGRESS.md](../PROGRESS.md) | 开发进度追踪 | ✅ 最新 |

---

## 🎯 功能模块文档

### 自进化功能

| 文档 | 描述 | 实现状态 | 优先级 |
|------|------|---------|--------|
| [CONTEXT_ENGINEER.md](./CONTEXT_ENGINEER.md) | ACE - Prompt 演化系统 | 🔄 设计完成 | P0 |
| [TOOL_FACTORY.md](./TOOL_FACTORY.md) | Live-SWE - 运行时工具合成 | 🔄 设计完成 | P1 |
| [CODE_EVOLVER.md](./CODE_EVOLVER.md) | SICA - 源码自我修改 | 🔄 设计完成 | P3 |
| [RL_LOOP.md](./RL_LOOP.md) | AgentEvolver - 强化学习闭环 | 🔄 设计完成 | P2 |

### 每个模块包含

- ✅ 核心概念和原理
- ✅ 技术实现细节
- ✅ 代码示例
- ✅ PoC 演示
- ✅ 安全考虑

---

## 📊 迭代和报告

### 迭代报告

| 文档 | 描述 | 日期 |
|------|------|------|
| [ITERATION_REPORT_2026-02-24.md](../ITERATION_REPORT_2026-02-24.md) | 迭代 #23 - 测试覆盖率提升 | 2026-02-24 |
| [ITERATION_SUMMARY.md](./ITERATION_SUMMARY.md) | 迭代过程总结 | 2026-02-24 |

### 里程碑

| 文档 | 描述 | 状态 |
|------|------|------|
| [MILESTONE_20.md](./MILESTONE_20.md) | 2.0 里程碑计划 | 🔄 进行中 |

---

## 💡 示例代码

位于 `examples/` 目录：

| 文件 | 描述 | 难度 |
|------|------|------|
| [basic-usage.ts](../examples/basic-usage.ts) | 基础使用示例 | ⭐ 初级 |
| [full-workflow.ts](../examples/full-workflow.ts) | 完整工作流示例 | ⭐⭐ 中级 |
| [evolution-learning.ts](../examples/evolution-learning.ts) | 进化学习示例 | ⭐⭐ 中级 |
| [issue-parsing.ts](../examples/issue-parsing.ts) | Issue 解析示例 | ⭐ 初级 |
| [tool-calling.ts](../examples/tool-calling.ts) | 工具调用示例 | ⭐⭐ 中级 |
| [testing-guide.ts](../examples/testing-guide.ts) | 测试编写指南 | ⭐⭐⭐ 高级 |

运行示例：
```bash
npx ts-node examples/basic-usage.ts
```

---

## 🧪 测试文档

### 测试统计

- **测试套件**: 13 个
- **测试用例**: 231 个
- **覆盖率**: 70%+
- **通过率**: 100%

### 测试文件

位于 `tests/` 目录：

| 文件 | 描述 | 用例数 |
|------|------|--------|
| agent.test.ts | Agent 核心测试 | 8 |
| agent-coverage.test.ts | Agent 覆盖率测试 | 23 |
| code-search.test.ts | 代码搜索测试 | 15 |
| code-modifier.test.ts | 代码修改测试 | 20 |
| git-env.test.ts | Git 环境测试 | 18 |
| shell-env.test.ts | Shell 环境测试 | 19 |
| llm-client.test.ts | LLM 客户端测试 | 10 |
| issue-parser.test.ts | Issue 解析测试 | 20 |
| execution-planner.test.ts | 执行计划测试 | 10 |
| evolution-store.test.ts | 进化存储测试 | 20 |
| cli.test.ts | CLI 测试 | 13 |
| types.test.ts | 类型测试 | 30 |
| retry.test.ts | 重试工具测试 | 25 |

运行测试：
```bash
npm test
npm test -- --coverage
```

---

## 🔗 外部资源

### 相关项目

- [SWE-agent](https://github.com/princeton-nlp/SWE-agent) - 原始灵感来源
- [OpenClaw](https://openclaw.ai) - AI Agent 平台

### 技术参考

- [TypeScript 文档](https://www.typescriptlang.org/docs/)
- [Jest 测试框架](https://jestjs.io/docs/getting-started)
- [Node.js 文档](https://nodejs.org/docs/)

---

## 📝 文档贡献

### 如何贡献文档

1. 发现文档错误或不清晰的地方
2. Fork 仓库并创建分支
3. 更新相关文档
4. 提交 Pull Request

### 文档编写规范

- 使用 Markdown 格式
- 保持简洁明了
- 包含代码示例
- 更新索引和目录
- 检查链接有效性

---

## 🔍 快速查找

### 我想了解...

- **如何安装使用** → [README.md](../README.md) → 快速开始
- **API 使用方法** → [API.md](./API.md)
- **如何编写测试** → [examples/testing-guide.ts](../examples/testing-guide.ts)
- **项目架构** → [ARCHITECTURE.md](../ARCHITECTURE.md)
- **如何贡献代码** → [CONTRIBUTING.md](../CONTRIBUTING.md)
- **自进化原理** → [RESEARCH_REPORT.md](./RESEARCH_REPORT.md)
- **竞品分析** → [COMPETITOR_RESEARCH.md](./COMPETITOR_RESEARCH.md)
- **版本计划** → [ROADMAP.md](../ROADMAP.md)

---

## 📧 获取帮助

- **GitHub Issues**: 提交 bug 报告或功能请求
- **GitHub Discussions**: 提问和讨论
- **文档 Issue**: 文档相关问题

---

**文档持续更新中** | 最后更新: 2026-02-24
