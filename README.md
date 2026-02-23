# SWE-Agent-Node 🤖

> 自进化的 Node.js 软件开发 AI Agent

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-165%20passed-brightgreen.svg)](./tests)

**SWE-Agent-Node** 是一个受 [SWE-agent](https://github.com/SWE-agent/SWE-agent) 启发的 AI 编程助手，能够自主修复 GitHub Issues、改进代码质量，并从经验中持续学习。

## ✨ 核心特性

- 🎯 **自主修复**: 自动分析问题、定位代码、生成修复
- 🧠 **自进化**: 从成功和失败中学习，持续优化策略
- 🔧 **简洁设计**: 遵循 mini-SWE-agent 哲学，简单而强大
- 🔍 **智能搜索**: 多维度代码搜索（关键词、函数、类、错误信息）
- 🔄 **安全回滚**: 自动备份和回滚机制
- 🔗 **OpenClaw 集成**: 与 OpenClaw 生态系统深度集成
- 📦 **即插即用**: 作为 Skill 或独立 CLI 使用

## 🚀 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/openclaw/swe-agent-node.git
cd swe-agent-node

# 安装依赖
npm install

# 构建
npm run build

# 全局安装（可选）
npm link
```

### 基础用法

#### 1. 修复 GitHub Issue

```bash
# 修复本地问题
swe-node fix "登录功能在用户名包含特殊字符时会崩溃"

# 修复 GitHub Issue
swe-node fix https://github.com/user/repo/issues/123 --repo ./my-project
```

#### 2. 分析仓库

```bash
# 分析项目结构和技术栈
swe-node analyze ./my-project

# 生成分析报告
swe-node analyze ./my-project --output report.json
```

#### 3. 学习和进化

```bash
# 查看进化统计
swe-node learn --stats

# 运行模式挖掘
swe-node learn --mine
```

### 编程接口

```typescript
import { fixIssue, createAgent, GitEnv } from 'swe-agent-node'

// 快速修复
const result = await fixIssue(
  '修复用户注册时的邮箱验证问题',
  '/path/to/repo'
)

// 完整控制
const agent = createAgent({
  llm: { model: 'gpt-4' },
  evolution: { enabled: true }
})

const gitEnv = new GitEnv()
const repo = await gitEnv.clone('https://github.com/user/repo.git')
const solution = await agent.solve(issue, repo)

console.log(solution.summary)
```

## 📖 文档

- [项目目标](./PROJECT.md) - 愿景和设计原则
- [架构设计](./ARCHITECTURE.md) - 详细的架构说明
- [API 文档](./docs/API.md) - 完整的 API 参考
- [路线图](./ROADMAP.md) - 开发计划和里程碑
- [进度追踪](./PROGRESS.md) - 当前状态和进展

## 🧪 示例

- [基础使用](./examples/basic-usage.ts) - 快速上手示例
- [进化学习](./examples/evolution-learning.ts) - 自进化功能示例
- [Tool Calling](./examples/tool-calling.ts) - 工具调用功能示例
- [Issue 解析](./examples/issue-parsing.ts) - 问题解析功能示例
- [完整工作流](./examples/full-workflow.ts) - 从问题到修复的完整流程

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────┐
│             CLI / API Entry                 │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│           Agent Orchestrator                │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │Issue │ │Repo  │ │Code  │ │Modify│      │
│  │Parser│ │Mgr   │ │Search│ │Engine│      │
│  └──────┘ └──────┘ └──────┘ └──────┘      │
└────────────────┬────────────────────────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌───────┐  ┌─────────┐  ┌──────────┐
│Git Env│  │Shell Env│  │LLM Client│
└───────┘  └─────────┘  └──────────┘
    │            │            │
    └────────────┼────────────┘
                 ▼
┌─────────────────────────────────────────────┐
│        Evolution Store (自进化)             │
│  • 轨迹记录  • 模式挖掘  • 知识积累         │
└─────────────────────────────────────────────┘
```

## 🧪 示例

### 示例 1: 修复 Bug

```typescript
import { Agent, GitEnv } from 'swe-agent-node'

const gitEnv = new GitEnv()
const repo = await gitEnv.open('./my-project')

const agent = new Agent({
  maxSteps: 10,
  llm: { model: 'gpt-4' },
  evolution: { enabled: true }
})

const result = await agent.solve({
  id: 'bug-001',
  title: '用户无法上传大于 5MB 的文件',
  body: '上传大文件时接口超时，错误信息：Request timeout'
}, repo)

if (result.success) {
  console.log('✅ 修复成功!')
  console.log('Commit:', result.commitHash)
} else {
  console.log('❌ 修复失败:', result.error)
}
```

### 示例 2: 持续学习

```typescript
import { EvolutionStore } from 'swe-agent-node'

const store = new EvolutionStore('./evolution-store')

// 查看统计
const stats = store.getStats()
console.log(`成功率: ${(stats.successfulTrajectories / stats.totalTrajectories * 100).toFixed(1)}%`)
console.log(`学到的模式: ${stats.totalPatterns}`)

// 查找相关模式
const patterns = store.findMatchingPatterns(['timeout', 'upload', 'file'])
patterns.forEach(p => {
  console.log(`- ${p.type}: ${p.trigger} -> ${p.outcome}`)
})

// 搜索知识库
const knowledge = store.searchKnowledge('文件上传超时')
knowledge.forEach(k => {
  console.log(`[${k.category}] ${k.problem}`)
  console.log(`  解决方案: ${k.solution}`)
})
```

## 🔬 与 SWE-agent 的区别

| 特性 | SWE-agent (Python) | SWE-agent-node |
|------|-------------------|----------------|
| 语言 | Python | TypeScript/Node.js |
| 核心代码量 | ~5000 行 | ~500 行 (目标) |
| 工具系统 | 复杂 YAML 配置 | 简单 Bash 为主 |
| 历史处理 | HistoryProcessor | 线性历史 |
| 执行方式 | 状态ful Shell | 独立进程 |
| **自进化** | ❌ | ✅ 核心特性 |
| **OpenClaw 集成** | ❌ | ✅ 深度集成 |

## 🛠️ 开发

```bash
# 开发模式
npm run dev

# 运行测试 (100 个用例)
npm test

# 代码检查
npm run lint

# 格式化代码
npm run format

# 构建
npm run build
```

## 📊 测试覆盖

| 模块 | 测试用例 |
|------|---------|
| 类型定义 | 22 |
| 进化存储 | 20 |
| Issue 解析器 | 23 |
| 代码搜索 | 17 |
| Shell 环境 | 18 |
| LLM 客户端 | 13 |
| Git 环境 | 13 |
| Agent | 13 |
| CLI 工具 | 16 |
| 代码修改 | 10 |
| **总计** | **165** |

## 📋 路线图

- [x] v0.1.0 - MVP (基础框架)
- [ ] v0.2.0 - 智能增强 (多步骤推理)
- [ ] v0.3.0 - 自进化 (模式挖掘)
- [ ] v0.4.0 - 生态集成 (OpenClaw Skill)
- [ ] v1.0.0 - 生产就绪 (多语言支持)

详见 [ROADMAP.md](./ROADMAP.md)

## 🤝 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](./CONTRIBUTING.md)

## 📄 许可证

MIT License - 详见 [LICENSE](./LICENSE)

## 🙏 致谢

- [SWE-agent](https://github.com/SWE-agent/SWE-agent) - 原始灵感和参考
- [mini-SWE-agent](https://github.com/SWE-agent/mini-swe-agent) - 简洁设计的哲学
- [OpenClaw](https://openclaw.ai) - AI Agent 平台

---

*"Make the agent so simple that the LM shines"*
