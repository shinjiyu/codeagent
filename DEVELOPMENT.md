# SWE-Agent-Node 开发指南

## 项目结构

```
swe-agent-node/
├── src/                    # 源代码
│   ├── index.ts           # 主入口，导出公共 API
│   ├── cli.ts             # CLI 工具
│   ├── agent.ts           # Agent 核心类
│   ├── git-env.ts         # Git 环境管理
│   ├── shell-env.ts       # Shell 执行环境
│   ├── code-search.ts     # 代码搜索引擎
│   ├── llm-client.ts      # LLM 客户端
│   ├── evolution-store.ts # 进化存储系统
│   └── types.ts           # TypeScript 类型定义
├── dist/                   # 编译输出
├── package.json            # 项目配置
├── tsconfig.json           # TypeScript 配置
├── PROJECT.md              # 项目目标
├── ARCHITECTURE.md         # 架构设计
├── ROADMAP.md              # 开发路线图
├── PROGRESS.md             # 进度追踪
├── README.md               # 项目说明
└── examples.js             # 使用示例
```

## 开发环境设置

```bash
# 1. 克隆仓库
git clone <repo-url>
cd swe-agent-node

# 2. 安装依赖
npm install

# 3. 开发模式（自动编译）
npm run dev

# 4. 构建
npm run build

# 5. 运行 CLI
node dist/cli.js --help
```

## 核心概念

### 1. Agent (智能体)
主要的编排器，协调各个子模块完成问题解决。

```typescript
const agent = new Agent(config)
const result = await agent.solve(issue, repo)
```

### 2. GitEnv (Git 环境)
管理代码仓库操作：克隆、分支、提交、推送。

```typescript
const gitEnv = new GitEnv()
const repo = await gitEnv.clone(url)
await gitEnv.createBranch('fix-issue-123')
await gitEnv.commit('fix: login bug')
```

### 3. ShellEnv (Shell 环境)
执行命令行操作：测试、构建、lint。

```typescript
const shell = new ShellEnv(repoPath)
const result = await shell.runTests()
await shell.build()
```

### 4. CodeSearch (代码搜索)
在代码库中查找相关代码。

```typescript
const search = new CodeSearch(repoPath)
const locations = await search.searchByKeywords(['error', 'login'])
const functions = await search.searchFunction('login')
```

### 5. LLMClient (LLM 客户端)
与语言模型交互，生成代码和推理。

```typescript
const llm = new LLMClient(config)
const analysis = await llm.analyzeCode(code, question)
const fix = await llm.suggestFix(problem, code)
```

### 6. EvolutionStore (进化存储)
自进化系统：记录经验、挖掘模式、积累知识。

```typescript
const store = new EvolutionStore(path)
await store.saveTrajectory(trajectory)
const patterns = await store.minePatterns()
```

## 工作流程

1. **Issue 解析**: 提取关键词、错误信息
2. **仓库分析**: 检测结构、技术栈
3. **代码搜索**: 定位相关文件
4. **修复生成**: LLM 生成方案
5. **应用修改**: 修改代码文件
6. **测试验证**: 运行测试
7. **提交结果**: Git commit
8. **学习进化**: 提取模式、更新知识

## 扩展指南

### 添加新的工具

```typescript
// src/custom-tool.ts
import { Tool } from './types'

export const myTool: Tool = {
  name: 'my-tool',
  description: 'My custom tool',
  execute: async (params) => {
    // 实现逻辑
    return result
  }
}

// 在 agent 中使用
agent.registerTool(myTool)
```

### 自定义 LLM 提示词

```typescript
const agent = new Agent({
  llm: {
    model: 'gpt-4',
    customPrompts: {
      'bug-fix': '你是专家级的 Bug 修复工程师...',
      'code-analysis': '请深入分析代码...'
    }
  }
})
```

### 扩展进化策略

```typescript
// 自定义模式挖掘
class CustomEvolutionStore extends EvolutionStore {
  async minePatterns(): Promise<Pattern[]> {
    const patterns = await super.minePatterns()
    // 自定义处理
    return this.filterPatterns(patterns)
  }
}
```

## 测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- --grep "CodeSearch"

# 生成覆盖率报告
npm test -- --coverage
```

## 调试技巧

### 1. 启用详细日志

```bash
swe-node fix <issue> --verbose
```

### 2. 查看执行轨迹

```typescript
const store = new EvolutionStore()
const trajectory = store.getTrajectory(id)
console.log(JSON.stringify(trajectory, null, 2))
```

### 3. 事件监听

```typescript
agent.on('step:start', console.log)
agent.on('step:end', console.log)
agent.on('step:error', console.error)
```

## 性能优化

### 1. 上下文窗口管理
- 智能截断无关代码
- 使用代码摘要
- 分层加载

### 2. 并行执行
- 并行文件搜索
- 并行测试运行
- 流式 LLM 响应

### 3. 缓存
- LLM 响应缓存
- 代码分析缓存
- 测试结果缓存

## 常见问题

### Q: 如何处理大型代码库？
A: 使用 CodeSearch 的过滤选项，限制搜索范围。

### Q: 如何提高修复成功率？
A: 启用自进化，让 Agent 从历史中学习。

### Q: 如何支持新的编程语言？
A: 扩展 CodeSearch 和 ShellEnv，添加语言特定的检测和命令。

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing`)
5. 创建 Pull Request

### 代码规范
- 使用 TypeScript
- 遵循 ESLint 规则
- 编写单元测试
- 更新文档

## 发布流程

```bash
# 1. 更新版本号
npm version patch|minor|major

# 2. 构建
npm run build

# 3. 发布到 npm
npm publish

# 4. 推送 tags
git push --tags
```

## 相关资源

- [SWE-agent 论文](https://arxiv.org/abs/2405.15793)
- [OpenClaw 文档](https://docs.openclaw.ai)
- [TypeScript 文档](https://www.typescriptlang.org/docs/)
- [simple-git 文档](https://github.com/steveukx/git-js)
