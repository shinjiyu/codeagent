/**
 * SWE-Agent-Node 测试指南
 * 
 * 演示如何为 SWE-Agent-Node 编写测试
 */

import { Agent, GitEnv, CodeSearch, CodeModifier } from '../src';
import type { AgentConfig, Issue, Repository } from '../src/types';

// ========================================
// 1. Agent 测试示例
// ========================================

describe('Agent 测试', () => {
  let agent: Agent;
  let config: AgentConfig;

  beforeEach(() => {
    // 创建测试配置
    config = {
      maxSteps: 5,
      maxRetries: 2,
      llm: {
        model: 'test-model',
        temperature: 0.7,
        maxTokens: 1000,
      },
      git: {
        defaultBranch: 'main',
        commitTemplate: 'fix: {message}',
        autoPush: false,
      },
      test: {
        command: 'npm test',
        pattern: '**/*.test.ts',
        timeout: 30000,
      },
      evolution: {
        enabled: false, // 测试时禁用进化
        patternMiningInterval: 10,
        minConfidence: 0.5,
        maxKnowledgeSize: 100,
      },
    };

    agent = new Agent(config);
  });

  test('应该创建 Agent 实例', () => {
    expect(agent).toBeDefined();
  });

  test('应该注册事件监听器', () => {
    const listener = jest.fn();
    agent.on('step:start', listener);
    expect(agent).toBeDefined();
  });

  test('应该接受有效配置', () => {
    expect(config.maxSteps).toBe(5);
    expect(config.llm.model).toBe('test-model');
    expect(config.evolution.enabled).toBe(false);
  });
});

// ========================================
// 2. GitEnv 测试示例
// ========================================

describe('GitEnv 测试', () => {
  let gitEnv: GitEnv;

  beforeEach(() => {
    gitEnv = new GitEnv();
  });

  test('应该打开已存在的仓库', async () => {
    const repo = await gitEnv.open('./');
    expect(repo.path).toBeDefined();
    expect(repo.branch).toBeDefined();
  });

  test('应该获取仓库状态', async () => {
    const repo = await gitEnv.open('./');
    const status = await gitEnv.getStatus();
    expect(status).toBeDefined();
  });

  test('应该检测技术栈', async () => {
    const repo = await gitEnv.open('./');
    const techStack = await gitEnv.detectTechStack();
    expect(techStack.language).toBe('typescript');
  });
});

// ========================================
// 3. CodeSearch 测试示例
// ========================================

describe('CodeSearch 测试', () => {
  let searcher: CodeSearch;

  beforeEach(() => {
    searcher = new CodeSearch('./');
  });

  test('应该根据关键词搜索', async () => {
    const results = await searcher.searchByKeywords(['Agent'], {
      maxResults: 10,
      contextLines: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].file).toBeDefined();
    expect(results[0].line).toBeDefined();
    expect(results[0].content).toBeDefined();
  });

  test('应该搜索函数定义', async () => {
    const results = await searcher.searchFunctions('solve');
    expect(results.length).toBeGreaterThan(0);
  });

  test('应该搜索类定义', async () => {
    const results = await searcher.searchClasses('Agent');
    expect(results.length).toBeGreaterThan(0);
  });
});

// ========================================
// 4. CodeModifier 测试示例
// ========================================

describe('CodeModifier 测试', () => {
  let modifier: CodeModifier;

  beforeEach(() => {
    modifier = new CodeModifier('./');
  });

  test('应该创建文件修改', () => {
    const modification = {
      type: 'create' as const,
      file: 'test-file.ts',
      content: 'export const test = true;',
    };

    const preview = modifier.preview([modification]);
    expect(preview).toContain('test-file.ts');
  });

  test('应该修改文件内容', () => {
    const modification = {
      type: 'modify' as const,
      file: 'src/test.ts',
      oldContent: 'old code',
      newContent: 'new code',
    };

    expect(modification.type).toBe('modify');
  });

  test('应该支持回滚', () => {
    const canRollback = modifier.canRollback();
    expect(typeof canRollback).toBe('boolean');
  });
});

// ========================================
// 5. 类型系统测试示例
// ========================================

describe('类型系统测试', () => {
  test('应该创建有效的 Issue', () => {
    const issue: Issue = {
      id: 'test-1',
      title: '测试问题',
      body: '这是一个测试问题的描述',
      labels: ['bug', 'priority'],
      keywords: ['error', 'crash'],
    };

    expect(issue.id).toBe('test-1');
    expect(issue.labels).toHaveLength(2);
  });

  test('应该创建有效的 Repository', () => {
    const repo: Repository = {
      url: 'https://github.com/test/repo',
      path: '/local/path/to/repo',
      branch: 'main',
    };

    expect(repo.url).toBe('https://github.com/test/repo');
    expect(repo.branch).toBe('main');
  });

  test('应该创建有效的配置', () => {
    const config: AgentConfig = {
      maxSteps: 10,
      maxRetries: 3,
      llm: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 4000,
      },
      git: {
        defaultBranch: 'main',
        commitTemplate: 'fix: {issue}',
        autoPush: false,
      },
      test: {
        command: 'npm test',
        pattern: '**/*.test.{ts,js}',
        timeout: 60000,
      },
      evolution: {
        enabled: true,
        patternMiningInterval: 10,
        minConfidence: 0.5,
        maxKnowledgeSize: 1000,
      },
    };

    expect(config.maxSteps).toBe(10);
    expect(config.evolution.enabled).toBe(true);
  });
});

// ========================================
// 6. 边缘情况测试示例
// ========================================

describe('边缘情况测试', () => {
  test('应该处理空 Issue body', () => {
    const issue: Issue = {
      id: 'empty-1',
      title: 'Empty issue',
      body: '',
    };

    expect(issue.body).toBe('');
  });

  test('应该处理超长标题', () => {
    const longTitle = 'A'.repeat(500);
    const issue: Issue = {
      id: 'long-1',
      title: longTitle,
      body: 'Description',
    };

    expect(issue.title.length).toBe(500);
  });

  test('应该处理特殊字符', () => {
    const specialChars = '特殊字符 <script>alert("xss")</script>';
    const issue: Issue = {
      id: 'special-1',
      title: 'Special characters',
      body: specialChars,
    };

    expect(issue.body).toContain('<script>');
  });
});

// ========================================
// 运行测试
// ========================================

console.log(`
📝 测试编写最佳实践：

1. 使用 describe() 组织相关测试
2. 使用 beforeEach() 初始化测试环境
3. 测试正常情况和边缘情况
4. 使用有意义的测试名称
5. 保持测试独立和可重复

运行测试：
  npm test
  npm test -- --coverage

参考：
  - tests/ 目录中的实际测试用例
  - docs/API.md 中的 API 文档
`);
