# SWE-Agent-Node 2.0 🤖

> 自进化的 Node.js 软件开发 AI Agent

[![GitHub](https://img.shields.io/badge/GitHub-shinjiyu/codeagent-blue)](https://github.com/shinjiyu/codeagent)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Test Coverage](https://img.shields.io/badge/Coverage-70%25-brightgreen.svg)](./ITERATION_REPORT_2026-02-24.md)
[![Tests](https://img.shields.io/badge/Tests-231%20passed-success.svg)](./tests/)
[![Build Status](https://img.shields.io/badge/Build-Passing-success.svg)](https://github.com/shinjiyu/codeagent)

**SWE-Agent-Node 2.0** 融合四个前沿智能体方向，实现真正的自我进化能力。

## ✨ 核心特性

### 来自 SWE-agent (基础能力)
- 🎯 **自主修复**: 自动分析问题、定位代码、生成修复
- 🔍 **智能搜索**: 多维度代码搜索（关键词、函数、类、错误信息）
- 🔄 **安全回滚**: 自动备份和回滚机制

### 2.0 增强特性 (自我进化)

#### 📖 ACE - 剧本演化
- 通过增量更新系统提示词沉淀经验
- A/B 测试验证效果
- 自动压缩防止膨胀

#### 🛠️ Live-SWE-agent - 现场造轮子
- 运行时合成新工具
- 动态修改执行流
- 安全沙箱隔离

#### 🧬 SICA - 递归修改源码
- 直接编辑自己的源码
- 逻辑自我进化
- 多层安全保证

#### 🎯 AgentEvolver - 强化学习闭环
- 自我提问机制
- 细粒度归因
- 自主训练循环

## 📖 文档

### 核心文档

| 文档 | 描述 |
|------|------|
| [API 文档](./docs/API.md) | 完整的 API 参考 |
| [研究报告](./docs/RESEARCH_REPORT.md) | 四个方向的深度分析 |
| [增强架构](./docs/ENHANCED_ARCHITECTURE.md) | 整体架构设计 |
| [竞品研究](./docs/COMPETITOR_RESEARCH.md) | SWE-Agent 等竞品分析 |

### 功能模块

| 文档 | 描述 |
|------|------|
| [Tool Factory](./docs/TOOL_FACTORY.md) | 运行时工具合成 |
| [Context Engineer](./docs/CONTEXT_ENGINEER.md) | Prompt 演化系统 |
| [Code Evolver](./docs/CODE_EVOLVER.md) | 源码自我修改 |
| [RL Loop](./docs/RL_LOOP.md) | 强化学习闭环 |

### 迭代报告

| 文档 | 描述 |
|------|------|
| [迭代 #23](./ITERATION_REPORT_2026-02-24.md) | 测试覆盖率提升 |
| [迭代总结](./docs/ITERATION_SUMMARY.md) | 迭代过程记录 |
| [里程碑](./docs/MILESTONE_20.md) | 2.0 里程碑计划 |

## 🚀 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/shinjiyu/codeagent.git
cd codeagent

# 安装依赖
npm install

# 构建
npm run build
```

### 基础用法

```typescript
import { Agent, GitEnv } from 'swe-agent-node'

const agent = new Agent({
  maxSteps: 10,
  llm: { model: 'gpt-4' },
  evolution: { enabled: true }
})

// 修复 Issue
const result = await agent.solve({
  id: 'bug-001',
  title: '用户无法上传大于 5MB 的文件',
  body: '上传大文件时接口超时'
}, repo)

console.log(result.success ? '✅ 修复成功' : '❌ 修复失败')
```

### 2.0 新功能示例

#### ACE - Prompt 演化

```typescript
import { PromptEvolver } from './poc/ace-poc'

const evolver = new PromptEvolver('./ace-storage')

// 记录经验
await evolver.evolveFromExperience({
  taskId: 'task-001',
  taskDescription: 'Fix timeout in upload handler',
  actions: ['analyze', 'add retry'],
  outcome: 'success',
  lessons: ['For timeouts, use exponential backoff']
})

// 获取演化后的 Prompt
const prompt = evolver.getCurrentPrompt()
```

#### Tool Factory - 运行时工具创建

```typescript
import { ToolFactory } from './poc/live-tool-poc'

const factory = new ToolFactory()

// 动态创建工具
const tool = await factory.synthesize({
  name: 'json_validator',
  description: 'Validate JSON structure',
  inputSchema: {
    type: 'object',
    properties: {
      json: { type: 'string' },
      schema: { type: 'object' }
    }
  },
  expectedOutput: '{ valid: boolean }'
})

// 使用工具
const result = await tool.execute({ json: '{"a":1}', schema: {} })
```

#### Code Evolver - 自我修改

```typescript
import { CodeEvolver } from './poc/sica-poc'

const evolver = new CodeEvolver(projectRoot)

// 安全修改代码
await evolver.applyModification({
  targetFile: 'src/utils.ts',
  modificationType: 'modify',
  oldCode: 'export function helper() {',
  newCode: `/**
 * Helper function
 */
export function helper() {`,
  reason: 'Add documentation',
  riskLevel: 'low',
  author: 'agent'
})
```

#### RL Loop - 强化学习

```typescript
import { AgentTrainer } from './poc/rl-loop-poc'

const trainer = new AgentTrainer('./rl-storage')

// 训练
for (let i = 0; i < 100; i++) {
  await trainer.trainEpisode('Fix a bug')
}

// 查看统计
const stats = trainer.getStats()
console.log(`Success rate: ${stats.successRate * 100}%`)
```

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    SWE-Agent-Node 2.0                        │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐    │
│  │              Context Layer (ACE)                    │    │
│  │  Prompt Manager | Template Engine | Evaluator      │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                  │
│  ┌───────────────────────▼───────────────────────────┐    │
│  │              Capability Layer                      │    │
│  │  Tool Factory (Live-SWE) | Code Evolver (SICA)    │    │
│  └───────────────────────────────────────────────────┘    │
│                          │                                  │
│  ┌───────────────────────▼───────────────────────────┐    │
│  │              Learning Layer (RL Loop)              │    │
│  │  Self Questioner | Attribution | Policy Optimizer │    │
│  └───────────────────────────────────────────────────┘    │
│                          │                                  │
│  ┌───────────────────────▼───────────────────────────┐    │
│  │              Evolution Store                       │    │
│  │  Trajectories | Patterns | Knowledge | Prompts    │    │
│  └───────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 📋 实现状态

| 模块 | 优先级 | 状态 | PoC |
|------|--------|------|-----|
| ACE | P0 | 🔄 设计完成 | ✅ |
| Tool Factory | P1 | 🔄 设计完成 | ✅ |
| RL Loop | P2 | 🔄 设计完成 | ✅ |
| Code Evolver | P3 | 🔄 设计完成 | ✅ |

## 🧪 PoC 示例

```bash
# ACE PoC
npx ts-node poc/ace-poc.ts

# Tool Factory PoC
npx ts-node poc/live-tool-poc.ts

# Code Evolver PoC
npx ts-node poc/sica-poc.ts

# RL Loop PoC
npx ts-node poc/rl-loop-poc.ts
```

## 🛠️ 开发

### 开发命令

```bash
# 开发模式
npm run dev

# 运行测试
npm test

# 运行测试并生成覆盖率报告
npm test -- --coverage

# 代码检查
npm run lint

# 构建
npm run build
```

### 测试统计

- **测试套件**: 13 个
- **测试用例**: 231 个
- **覆盖率**: 70%+
- **详情**: [测试报告](./ITERATION_REPORT_2026-02-24.md)

### 示例代码

项目包含多个示例，帮助快速上手：

```bash
# 基础用法
npx ts-node examples/basic-usage.ts

# 完整工作流
npx ts-node examples/full-workflow.ts

# 进化学习
npx ts-node examples/evolution-learning.ts

# Issue 解析
npx ts-node examples/issue-parsing.ts

# 工具调用
npx ts-node examples/tool-calling.ts
```

## 📊 与 SWE-agent 的区别

| 特性 | SWE-agent | SWE-agent-node 2.0 |
|------|-----------|-------------------|
| 语言 | Python | TypeScript |
| 核心代码 | ~5000 行 | ~500 行 |
| **Prompt 演化** | ❌ | ✅ ACE |
| **动态工具** | ❌ | ✅ Tool Factory |
| **自我修改** | ❌ | ✅ Code Evolver |
| **强化学习** | ❌ | ✅ RL Loop |
| **OpenClaw 集成** | ❌ | ✅ |

## 🗓️ 路线图

- [x] v0.1.0 - MVP (基础框架)
- [x] v1.0.0 - 基础 SWE 能力
- [ ] v2.0.0 - 自我进化能力
  - [ ] ACE 实现
  - [ ] Tool Factory 实现
  - [ ] RL Loop 实现
  - [ ] Code Evolver 实现

## 📄 许可证

MIT License - 详见 [LICENSE](./LICENSE)

## 🙏 致谢

- [SWE-agent](https://github.com/SWE-agent/SWE-agent) - 原始灵感和参考
- [OpenClaw](https://openclaw.ai) - AI Agent 平台
- [Live-SWE-agent](https://github.com/) - 运行时工具合成
- [SICA](https://github.com/) - 自我改进代码 Agent
- [ACE](https://github.com/) - Agentic Context Engineering
- [AgentEvolver](https://github.com/) - 强化学习闭环

---

*"Evolve or die." - SWE-Agent-Node 2.0*
