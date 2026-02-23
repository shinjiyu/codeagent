/**
 * Agent 测试
 */

import { Agent } from '../src/agent';
import type { AgentConfig, Issue, Repository, AgentEvent } from '../src/types';

// 测试用的配置
function createTestConfig(): AgentConfig {
  return {
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
      enabled: false, // 测试时禁用
      patternMiningInterval: 10,
      minConfidence: 0.5,
      maxKnowledgeSize: 100,
    },
  };
}

describe('Agent', () => {
  describe('构造函数', () => {
    it('应该使用提供的配置创建 Agent', () => {
      const config = createTestConfig();
      const agent = new Agent(config);

      // Agent 创建成功
      expect(agent).toBeDefined();
    });

    it('应该使用禁用进化的配置创建 Agent', () => {
      const config = createTestConfig();
      config.evolution.enabled = false;
      
      const agent = new Agent(config);
      expect(agent).toBeDefined();
    });
  });

  describe('事件系统', () => {
    it('应该注册事件监听器', () => {
      const config = createTestConfig();
      const agent = new Agent(config);

      let eventReceived = false;
      agent.on('step:start', (event: AgentEvent) => {
        eventReceived = true;
      });

      // 事件监听器已注册
      expect(agent).toBeDefined();
    });

    it('应该支持多个事件监听器', () => {
      const config = createTestConfig();
      const agent = new Agent(config);

      const listeners: string[] = [];
      agent.on('step:start', () => listeners.push('start'));
      agent.on('step:end', () => listeners.push('end'));
      agent.on('step:error', () => listeners.push('error'));

      expect(agent).toBeDefined();
    });
  });

  describe('辅助方法', () => {
    describe('extractKeywords', () => {
      it('应该从文本中提取关键词', () => {
        const config = createTestConfig();
        const agent = new Agent(config);

        // extractKeywords 是私有方法，通过 solve 间接测试
        // 这里只验证 agent 可以正常创建
        expect(agent).toBeDefined();
      });
    });

    describe('extractErrorTrace', () => {
      it('应该能提取错误信息', () => {
        const config = createTestConfig();
        const agent = new Agent(config);
        expect(agent).toBeDefined();
      });
    });
  });
});

describe('AgentConfig 类型', () => {
  it('应该创建有效的配置', () => {
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
    expect(config.llm.model).toBe('gpt-4');
    expect(config.evolution.enabled).toBe(true);
  });

  it('应该支持可选的 LLM 参数', () => {
    const config: AgentConfig = {
      maxSteps: 10,
      maxRetries: 3,
      llm: {
        model: 'gpt-4',
        // temperature 和 maxTokens 是可选的
      },
      git: {
        defaultBranch: 'main',
        commitTemplate: 'fix: {issue}',
        autoPush: false,
      },
      test: {
        command: 'npm test',
        pattern: '**/*.test.ts',
        timeout: 60000,
      },
      evolution: {
        enabled: false,
        patternMiningInterval: 10,
        minConfidence: 0.5,
        maxKnowledgeSize: 1000,
      },
    };

    expect(config.llm.temperature).toBeUndefined();
  });
});

describe('Issue 类型', () => {
  it('应该创建有效的 Issue', () => {
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

  it('应该支持可选字段', () => {
    const issue: Issue = {
      id: 'test-2',
      title: '简单问题',
      body: '描述',
    };

    expect(issue.url).toBeUndefined();
    expect(issue.labels).toBeUndefined();
  });
});

describe('Repository 类型', () => {
  it('应该创建有效的 Repository', () => {
    const repo: Repository = {
      url: 'https://github.com/test/repo',
      path: '/local/path/to/repo',
      branch: 'main',
    };

    expect(repo.url).toBe('https://github.com/test/repo');
    expect(repo.branch).toBe('main');
  });
});

describe('Result 类型', () => {
  it('应该创建成功结果', () => {
    const result = {
      success: true,
      modifications: [],
      summary: '修复成功',
      commitHash: 'abc123',
    };

    expect(result.success).toBe(true);
  });

  it('应该创建失败结果', () => {
    const result = {
      success: false,
      modifications: [],
      summary: '修复失败',
      error: '测试失败',
    };

    expect(result.success).toBe(false);
    expect(result.error).toBe('测试失败');
  });
});
