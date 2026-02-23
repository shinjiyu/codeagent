# SWE-Agent-Node 架构设计

## 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI Entry (1)                        │
│                     swe-node <command>                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Agent Orchestrator (2)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Issue   │  │  Repo    │  │  Code    │  │  Modify  │   │
│  │  Parser  │  │  Manager │  │  Search  │  │  Engine  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Git Env    │ │  Shell Env   │ │  LLM Client  │
│     (3)      │ │     (4)      │ │     (5)      │
└──────────────┘ └──────────────┘ └──────────────┘
        │               │               │
        └───────────────┼───────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                 Execution History Store (6)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Trajectory  │  │   Pattern    │  │  Knowledge   │     │
│  │    Log       │  │   Library    │  │    Base      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. CLI Entry (命令行入口)
**职责**: 解析命令行参数，初始化 Agent

```typescript
// 命令示例
swe-node fix <issue-url> --repo <repo-path>
swe-node analyze <repo-path> --output <report.json>
swe-node learn --history <trajectory-log>
```

**关键类**: `CLI`
- 使用 `commander` 解析参数
- 配置管理和加载
- 日志输出配置

---

### 2. Agent Orchestrator (Agent 编排器)
**职责**: 协调各个子模块，管理执行流程

**核心流程**:
```
Issue Input
    ↓
[Issue Parser] → 提取问题描述、错误信息、预期行为
    ↓
[Repo Manager] → 克隆/拉取仓库，分析结构
    ↓
[Code Search] → 定位相关文件和代码片段
    ↓
[Modify Engine] → 生成修改方案，执行修改
    ↓
[Test Runner] → 验证修改，运行测试
    ↓
[Result] → Commit/PR 或 回滚重试
```

**关键类**: `Agent`

```typescript
class Agent {
  async solve(issue: Issue, repo: Repository): Promise<Solution>
  async learn(trajectory: Trajectory): Promise<void>
  async evolve(): Promise<void>
}
```

---

### 3. Git Environment (Git 环境)
**职责**: 管理代码仓库操作

**功能**:
- 克隆仓库
- 创建分支
- 提交修改
- 生成 PR

**关键类**: `GitEnv`

```typescript
class GitEnv {
  async clone(url: string): Promise<Repository>
  async createBranch(name: string): Promise<void>
  async commit(message: string): Promise<string>
  async createPR(title: string, body: string): Promise<PR>
}
```

---

### 4. Shell Environment (Shell 环境)
**职责**: 执行命令行工具

**设计理念** (来自 mini-SWE-agent):
- **独立执行**: 每个命令独立进程
- **无状态**: 不保持 shell session
- **沙箱友好**: 易于 Docker 化

**关键类**: `ShellEnv`

```typescript
class ShellEnv {
  async exec(command: string, cwd?: string): Promise<ExecResult>
  async runTests(testPattern?: string): Promise<TestResult>
  async installDeps(): Promise<void>
}
```

---

### 5. LLM Client (语言模型客户端)
**职责**: 与 LLM 交互，生成代码和推理

**设计**:
- **OpenClaw 集成**: 使用 OpenClaw 的统一接口
- **多模型支持**: GPT-4, Claude, 本地模型
- **上下文管理**: 智能压缩历史

**关键类**: `LLMClient`

```typescript
class LLMClient {
  async generate(prompt: string, context?: Context): Promise<string>
  async analyzeCode(code: string, question: string): Promise<string>
  async suggestFix(problem: string, code: string): Promise<Fix>
}
```

---

### 6. Execution History Store (执行历史存储)
**职责**: 记录经验，支持自进化

**三层数据结构**:

#### 6.1 Trajectory Log (轨迹日志)
每次执行的完整记录

```typescript
interface Trajectory {
  id: string
  timestamp: Date
  issue: Issue
  steps: Step[]
  result: Result
  metadata: Metadata
}
```

#### 6.2 Pattern Library (模式库)
从轨迹中提炼的模式

```typescript
interface Pattern {
  id: string
  type: 'success' | 'failure'
  trigger: string // 问题特征
  action: string // 采取的行动
  outcome: string // 结果
  confidence: number
  usage: number
}
```

#### 6.3 Knowledge Base (知识库)
结构化的解决方案

```typescript
interface Knowledge {
  id: string
  category: string // 'bug-fix', 'refactor', 'feature'
  problem: string
  solution: string
  code: CodeSnippet[]
  references: string[]
  score: number
}
```

---

## 数据流

### 修复 Issue 的完整流程

```
1. 输入 Issue
   ├─ 解析 Issue 描述
   ├─ 提取错误堆栈
   └─ 识别关键词

2. 分析仓库
   ├─ 克隆到临时目录
   ├─ 分析项目结构
   ├─ 识别技术栈
   └─ 检索相关文件

3. 定位代码
   ├─ 全文搜索关键词
   ├─ 分析文件依赖
   ├─ 找到目标文件
   └─ 提取上下文

4. 生成修复
   ├─ 构造 LLM Prompt
   │   ├─ Issue 描述
   │   ├─ 相关代码
   │   ├─ 相似模式 (从 Pattern Library)
   │   └─ 历史经验 (从 Knowledge Base)
   ├─ 调用 LLM 生成方案
   └─ 验证语法正确性

5. 执行修改
   ├─ 创建备份
   ├─ 应用修改
   ├─ 格式化代码
   └─ 检查冲突

6. 测试验证
   ├─ 运行相关测试
   ├─ 检查是否通过
   └─ 失败则回滚重试

7. 提交结果
   ├─ 生成 Commit Message
   ├─ 提交代码
   └─ (可选) 创建 PR

8. 学习进化
   ├─ 记录执行轨迹
   ├─ 提取成功/失败模式
   ├─ 更新 Pattern Library
   └─ 丰富 Knowledge Base
```

---

## 自进化机制

### 1. 经验记录 (Experience Recording)

每次执行自动记录：
- 输入（Issue + Repo）
- 过程（Steps + Decisions）
- 输出（Code + Tests）
- 结果（Success/Failure + Reasons）

### 2. 模式挖掘 (Pattern Mining)

定期分析历史轨迹：
```typescript
async function minePatterns(trajectories: Trajectory[]): Pattern[] {
  // 1. 聚类相似问题
  // 2. 识别成功策略
  // 3. 提取失败模式
  // 4. 计算置信度
  // 5. 更新模式库
}
```

### 3. 策略优化 (Strategy Optimization)

根据模式调整行为：
```typescript
async function optimizeStrategy(patterns: Pattern[]): Strategy {
  // 1. 识别高置信度模式
  // 2. 调整搜索优先级
  // 3. 优化 Prompt 模板
  // 4. 更新决策阈值
}
```

### 4. 知识积累 (Knowledge Accumulation)

结构化存储解决方案：
```typescript
async function accumulateKnowledge(solution: Solution): void {
  // 1. 提取关键步骤
  // 2. 泛化代码片段
  // 3. 关联相关问题
  // 4. 评分和排序
}
```

---

## 沙箱设计

### Docker 集成

```yaml
# docker-compose.yml
version: '3'
services:
  swe-agent:
    build: .
    volumes:
      - ./repos:/app/repos
      - ./history:/app/history
    environment:
      - OPENCLAW_API_KEY=${OPENCLAW_API_KEY}
    security_opt:
      - no-new-privileges:true
```

### 安全措施

1. **资源限制**: CPU, Memory, Disk quota
2. **网络隔离**: 只允许访问 GitHub API
3. **文件系统**: 只读挂载系统目录
4. **命令过滤**: 禁止危险命令 (rm -rf /, etc.)

---

## 性能优化

### 1. 上下文窗口管理

- **智能截断**: 保留关键代码，丢弃无关内容
- **分层摘要**: 不同粒度的代码摘要
- **动态加载**: 按需读取文件

### 2. 并行执行

- **并行搜索**: 多个文件同时搜索
- **并行测试**: 独立测试并行运行
- **流式处理**: LLM 响应流式解析

### 3. 缓存机制

- **代码分析缓存**: AST 解析结果
- **LLM 响应缓存**: 相似问题复用
- **测试结果缓存**: 未修改文件跳过测试

---

## 扩展性

### 插件系统

```typescript
interface Plugin {
  name: string
  hooks: {
    'before:search'?: (issue: Issue) => void
    'after:modify'?: (code: string) => string
    'on:error'?: (error: Error) => void
  }
}
```

### 自定义工具

```typescript
// 示例：添加数据库查询工具
agent.registerTool('query-db', {
  execute: async (sql: string) => {
    // 实现查询逻辑
  },
  description: 'Query database for related data'
})
```

---

## 监控和调试

### 日志系统

```typescript
const logger = new Logger({
  level: 'debug',
  format: 'json',
  outputs: ['console', 'file', 'remote']
})
```

### 轨迹查看器

Web UI 查看执行历史：
- 每一步的输入/输出
- LLM 的推理过程
- 代码 diff
- 测试结果

---

## 与 OpenClaw 集成

### 1. LLM 接口

```typescript
import { getLLM } from '@openclaw/llm'

const llm = getLLM('gpt-4') // 或配置中的默认模型
```

### 2. Skill 系统

```typescript
// 作为 OpenClaw Skill 使用
export default class SWESkill extends Skill {
  async execute(issue: string): Promise<void> {
    const agent = new Agent()
    await agent.solve(issue)
  }
}
```

### 3. Evolution Store

```typescript
// 将经验同步到 Evolution Store
import { EvolutionStore } from '@openclaw/evolution'

const store = new EvolutionStore()
await store.addPattern(pattern)
```

---

## 关键设计决策

| 决策 | 理由 |
|------|------|
| 线性历史 | 简单、易调试、易于 fine-tuning |
| 独立执行 | 稳定、可扩展、沙箱友好 |
| Bash 为主 | 通用、灵活、减少抽象层 |
| 自进化核心 | 区别于其他 agent，持续改进 |
| TypeScript | 类型安全、生态丰富、易于维护 |

---

## 参考资料

- [SWE-agent 论文](https://arxiv.org/abs/2405.15793)
- [mini-SWE-agent](https://github.com/SWE-agent/mini-swe-agent)
- [OpenClaw 文档](https://docs.openclaw.ai)
