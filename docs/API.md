# SWE-Agent-Node API 文档

本文档详细介绍 SWE-Agent-Node 的核心 API。

## 目录

- [核心模块](#核心模块)
- [Agent](#agent)
- [GitEnv](#gitenv)
- [ShellEnv](#shellenv)
- [CodeSearch](#codesearch)
- [CodeModifier](#codemodifier)
- [EvolutionStore](#evolutionstore)
- [类型定义](#类型定义)

---

## 核心模块

### 快速导入

```typescript
// 导入所有
import * as SWENode from 'swe-agent-node';

// 按需导入
import { Agent, GitEnv, CodeSearch, EvolutionStore } from 'swe-agent-node';

// 导入类型
import type { Issue, Repository, Result, Pattern, Knowledge } from 'swe-agent-node';
```

---

## Agent

主要的 AI Agent 类，负责协调问题解决流程。

### 构造函数

```typescript
new Agent(config?: Partial<AgentConfig>)
```

### 配置选项

```typescript
interface AgentConfig {
  // 最大执行步骤数
  maxSteps: number;           // 默认: 20
  
  // 最大重试次数
  maxRetries: number;         // 默认: 3
  
  // LLM 配置
  llm: LLMConfig;
  
  // Git 配置
  git: GitConfig;
  
  // 测试配置
  test: TestConfig;
  
  // 进化配置
  evolution: EvolutionConfig;
}
```

### 方法

#### `solve(issue: Issue, repo: Repository): Promise<Result>`

解决指定的 Issue。

```typescript
const agent = new Agent();
const result = await agent.solve(
  {
    id: 'issue-1',
    title: '修复登录 Bug',
    body: '用户无法使用邮箱登录',
    keywords: ['login', 'email', 'auth']
  },
  {
    url: 'https://github.com/user/repo',
    path: '/path/to/repo'
  }
);

console.log(result.success);      // 是否成功
console.log(result.summary);      // 执行摘要
console.log(result.modifications); // 代码修改列表
console.log(result.commitHash);   // Git commit hash
```

#### `analyze(repo: Repository): Promise<AnalysisResult>`

分析仓库结构和技术栈。

```typescript
const analysis = await agent.analyze(repo);
console.log(analysis.techStack);  // 技术栈信息
console.log(analysis.structure);  // 项目结构
```

---

## GitEnv

Git 环境管理类，处理仓库克隆、分支管理、提交等操作。

### 构造函数

```typescript
new GitEnv(basePath?: string)
```

### 方法

#### `clone(url: string, options?: CloneOptions): Promise<Repository>`

克隆远程仓库。

```typescript
const gitEnv = new GitEnv('/tmp/repos');
const repo = await gitEnv.clone('https://github.com/user/repo.git', {
  branch: 'develop',
  depth: 1
});
```

#### `open(path: string): Promise<Repository>`

打开本地仓库。

```typescript
const repo = await gitEnv.open('./my-project');
```

#### `commit(repo: Repository, message: string): Promise<string>`

创建提交。

```typescript
const commitHash = await gitEnv.commit(repo, 'fix: 修复登录问题');
```

#### `push(repo: Repository): Promise<void>`

推送到远程。

```typescript
await gitEnv.push(repo);
```

#### `createBranch(repo: Repository, name: string): Promise<void>`

创建新分支。

```typescript
await gitEnv.createBranch(repo, 'fix/login-bug');
```

---

## ShellEnv

Shell 命令执行环境。

### 构造函数

```typescript
new ShellEnv(options?: ShellOptions)
```

### 方法

#### `execute(command: string, cwd?: string): Promise<ExecResult>`

执行 Shell 命令。

```typescript
const shell = new ShellEnv();
const result = await shell.execute('npm test', '/path/to/repo');

console.log(result.stdout);   // 标准输出
console.log(result.stderr);   // 标准错误
console.log(result.exitCode); // 退出码
console.log(result.success);  // 是否成功
console.log(result.duration); // 执行时长 (ms)
```

#### `executeScript(script: string, cwd?: string): Promise<ExecResult>`

执行多行脚本。

```typescript
const result = await shell.executeScript(`
  npm install
  npm run build
  npm test
`);
```

---

## CodeSearch

代码搜索引擎，支持关键词、函数、类、错误信息搜索。

### 构造函数

```typescript
new CodeSearch(repoPath: string)
```

### 方法

#### `searchByKeywords(keywords: string[], options?: SearchOptions): Promise<CodeLocation[]>`

按关键词搜索代码。

```typescript
const searcher = new CodeSearch('/path/to/repo');
const results = await searcher.searchByKeywords(
  ['TypeError', 'undefined'],
  {
    extensions: ['.ts', '.js'],
    maxResults: 20,
    contextLines: 5
  }
);

results.forEach(loc => {
  console.log(`${loc.file}:${loc.line}`);
  console.log(loc.context);
});
```

#### `searchFunction(functionName: string): Promise<CodeLocation[]>`

搜索函数定义。

```typescript
const results = await searcher.searchFunction('handleLogin');
```

#### `searchClass(className: string): Promise<CodeLocation[]>`

搜索类定义。

```typescript
const results = await searcher.searchClass('UserService');
```

#### `searchError(errorMessage: string): Promise<CodeLocation[]>`

搜索错误信息。

```typescript
const results = await searcher.searchError('Cannot read property');
```

#### `getSnippet(file: string, startLine: number, endLine: number): Promise<CodeSnippet>`

获取代码片段。

```typescript
const snippet = await searcher.getSnippet('src/auth.ts', 10, 20);
console.log(snippet.content);   // 代码内容
console.log(snippet.language);  // 语言类型
```

---

## CodeModifier

代码修改应用器，支持创建、修改、删除文件操作，并提供自动备份和回滚功能。

### 构造函数

```typescript
new CodeModifier(repoPath: string)
```

### 方法

#### `applyModifications(modifications: CodeModification[]): Promise<void>`

批量应用代码修改。

```typescript
const modifier = new CodeModifier('/path/to/repo');

await modifier.applyModifications([
  {
    file: 'src/utils.ts',
    type: 'modify',
    oldContent: 'const x = 1;',
    newContent: 'const x = 2;',
  },
  {
    file: 'src/new.ts',
    type: 'create',
    newContent: 'export const y = 1;',
  },
]);
```

#### `rollback(): Promise<void>`

回滚所有已应用的修改。

```typescript
// 如果出现问题，回滚所有更改
await modifier.rollback();
```

#### `preview(modifications: CodeModification[]): string`

预览修改内容（不实际应用）。

```typescript
const preview = modifier.preview(modifications);
console.log(preview);
// 输出:
// +++ CREATE: src/new.ts
// export const y = 1;
// --- MODIFY: src/utils.ts
// ...
```

#### `getModifiedFiles(): string[]`

获取已修改的文件列表。

```typescript
const files = modifier.getModifiedFiles();
console.log(files); // ['src/utils.ts', 'src/new.ts']
```

#### `cleanup(): Promise<void>`

清理备份文件（确认修改后调用）。

```typescript
await modifier.cleanup();
```

### 辅助函数

#### `createModificationFromSnippet(snippet: CodeSnippet, newContent: string, description?: string): CodeModification`

从代码片段创建修改。

```typescript
import { createModificationFromSnippet } from 'swe-agent-node';

const mod = createModificationFromSnippet(
  { file: 'src/app.ts', content: 'old code', startLine: 10, endLine: 20 },
  'new code',
  '修复 bug'
);
```

#### `createFileModification(filePath: string, content: string, description?: string): CodeModification`

创建新文件修改。

```typescript
import { createFileModification } from 'swe-agent-node';

const mod = createFileModification(
  'src/new-module.ts',
  'export class NewModule {}'
);
```

#### `deleteFileModification(filePath: string, currentContent?: string, description?: string): CodeModification`

创建删除文件修改。

```typescript
import { deleteFileModification } from 'swe-agent-node';

const mod = deleteFileModification('src/old-file.ts');
```

---

## EvolutionStore

自进化存储系统，管理轨迹、模式、知识和策略。

### 构造函数

```typescript
new EvolutionStore(storePath?: string)
```

### 轨迹管理

#### `saveTrajectory(trajectory: Trajectory): Promise<void>`

保存执行轨迹。

```typescript
await store.saveTrajectory({
  id: 'traj-001',
  issue: { id: 'issue-1', title: '...', body: '...' },
  repo: { url: '...', path: '...' },
  steps: [...],
  result: { success: true, modifications: [], summary: '...' },
  metadata: { model: 'gpt-4', duration: 5000 },
  createdAt: new Date()
});
```

#### `getTrajectory(id: string): Trajectory | undefined`

获取轨迹。

```typescript
const trajectory = store.getTrajectory('traj-001');
```

#### `getAllTrajectories(): Trajectory[]`

获取所有轨迹。

#### `getSuccessfulTrajectories(): Trajectory[]`

获取成功的轨迹。

#### `getFailedTrajectories(): Trajectory[]`

获取失败的轨迹。

### 模式管理

#### `savePattern(pattern: Pattern): Promise<void>`

保存模式。

```typescript
await store.savePattern({
  id: 'pattern-001',
  type: 'success',
  trigger: 'TypeError undefined',
  action: 'Add null check before access',
  outcome: 'Issue resolved',
  confidence: 0.85,
  usage: 1,
  trajectoryIds: ['traj-001'],
  createdAt: new Date(),
  updatedAt: new Date()
});
```

#### `findMatchingPatterns(keywords: string[]): Pattern[]`

查找匹配的模式。

```typescript
const patterns = store.findMatchingPatterns(['TypeError', 'null']);
// 按置信度排序返回
```

### 知识管理

#### `searchKnowledge(query: string, category?: KnowledgeCategory): Knowledge[]`

搜索知识库。

```typescript
const knowledge = store.searchKnowledge('文件上传超时', 'bug-fix');
knowledge.forEach(k => {
  console.log(`问题: ${k.problem}`);
  console.log(`解决方案: ${k.solution}`);
  console.log(`评分: ${k.score}/10`);
});
```

### 模式挖掘

#### `minePatterns(): Promise<Pattern[]>`

从轨迹中挖掘新模式。

```typescript
const newPatterns = await store.minePatterns();
console.log(`发现 ${newPatterns.length} 个新模式`);
```

#### `extractKnowledgeFromSuccess(): Promise<Knowledge[]>`

从成功轨迹中提取知识。

```typescript
const newKnowledge = await store.extractKnowledgeFromSuccess();
```

### 统计

#### `getStats(): EvolutionStats`

获取统计信息。

```typescript
const stats = store.getStats();
console.log(`成功率: ${stats.successfulTrajectories / stats.totalTrajectories}`);
console.log(`平均置信度: ${stats.averageConfidence}`);
```

---

## 类型定义

### Issue

```typescript
interface Issue {
  id: string;
  url?: string;
  title: string;
  body: string;
  labels?: string[];
  author?: string;
  createdAt?: Date;
  errorTrace?: string;
  keywords?: string[];
}
```

### Result

```typescript
interface Result {
  success: boolean;
  modifications: CodeModification[];
  testResults?: TestResult;
  commitHash?: string;
  prUrl?: string;
  summary: string;
  error?: string;
}
```

### Pattern

```typescript
interface Pattern {
  id: string;
  type: 'success' | 'failure';
  trigger: string;
  action: string;
  outcome: string;
  confidence: number;  // 0-1
  usage: number;
  lastUsed?: Date;
  trajectoryIds: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Knowledge

```typescript
interface Knowledge {
  id: string;
  category: 'bug-fix' | 'refactor' | 'feature' | 'optimization' | 'documentation' | 'test' | 'config';
  problem: string;
  solution: string;
  codeSnippets: CodeSnippet[];
  references: string[];
  score: number;  // 0-10
  usage: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

---

## CLI 命令

### `swe-node fix <issue>`

修复指定问题。

```bash
# 本地问题描述
swe-node fix "用户登录失败"

# GitHub Issue URL
swe-node fix https://github.com/user/repo/issues/123

# 指定仓库
swe-node fix "问题" --repo ./my-project
```

### `swe-node analyze <path>`

分析仓库。

```bash
swe-node analyze ./my-project
swe-node analyze ./my-project --output report.json
```

### `swe-node learn`

管理和查看学习数据。

```bash
# 查看统计
swe-node learn --stats

# 运行模式挖掘
swe-node learn --mine

# 查看模式
swe-node learn --patterns
```

---

## 错误处理

所有异步方法都可能抛出错误，建议使用 try-catch：

```typescript
try {
  const result = await agent.solve(issue, repo);
  if (!result.success) {
    console.error('修复失败:', result.error);
  }
} catch (error) {
  console.error('执行出错:', error.message);
}
```

---

## 更多资源

- [架构设计](../ARCHITECTURE.md)
- [开发指南](../DEVELOPMENT.md)
- [路线图](../ROADMAP.md)
