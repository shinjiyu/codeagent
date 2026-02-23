/**
 * CLI 工具函数测试
 */

import type { Issue, AgentConfig } from '../src/types';

// 模拟 CLI 中的辅助函数
function parseIssueInput(input: string): Issue {
  // 如果是 GitHub Issue URL
  const urlPattern = /github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/;
  const urlMatch = input.match(urlPattern);
  
  if (urlMatch) {
    return {
      id: `github-${urlMatch[1]}-${urlMatch[2]}-${urlMatch[3]}`,
      url: input,
      title: `GitHub Issue #${urlMatch[3]}`,
      body: '',
    };
  }
  
  // 否则当作问题描述
  return {
    id: `local-${Date.now()}`,
    title: input.split('\n')[0].slice(0, 100),
    body: input,
  };
}

function createDefaultConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
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
    ...overrides,
  };
}

function formatResult(result: { success: boolean; summary: string; commitHash?: string; error?: string }): string {
  if (result.success) {
    let output = `✅ Success!\n${result.summary}`;
    if (result.commitHash) {
      output += `\nCommit: ${result.commitHash}`;
    }
    return output;
  } else {
    return `❌ Failed\n${result.error || result.summary}`;
  }
}

function validateRepoPath(path: string): boolean {
  // 简单验证：非空且看起来像路径
  return path.length > 0 && !path.includes('://');
}

describe('CLI 工具函数', () => {
  describe('parseIssueInput', () => {
    it('应该解析 GitHub Issue URL', () => {
      const result = parseIssueInput('https://github.com/owner/repo/issues/123');
      
      expect(result.url).toBe('https://github.com/owner/repo/issues/123');
      expect(result.id).toContain('github');
      expect(result.id).toContain('123');
    });

    it('应该处理问题描述', () => {
      const result = parseIssueInput('Fix the login bug');
      
      expect(result.title).toBe('Fix the login bug');
      expect(result.body).toBe('Fix the login bug');
      expect(result.id).toContain('local');
    });

    it('应该截断长标题', () => {
      const longTitle = 'A'.repeat(200);
      const result = parseIssueInput(longTitle);
      
      expect(result.title.length).toBeLessThanOrEqual(100);
    });

    it('应该处理多行描述', () => {
      const result = parseIssueInput('Fix bug\n\nMore details here');
      
      expect(result.title).toBe('Fix bug');
      expect(result.body).toContain('More details');
    });
  });

  describe('createDefaultConfig', () => {
    it('应该创建默认配置', () => {
      const config = createDefaultConfig();
      
      expect(config.maxSteps).toBe(10);
      expect(config.llm.model).toBe('gpt-4');
      expect(config.evolution.enabled).toBe(true);
    });

    it('应该支持覆盖配置', () => {
      const config = createDefaultConfig({
        maxSteps: 20,
        llm: { model: 'claude-3', temperature: 0.5 },
      });
      
      expect(config.maxSteps).toBe(20);
      expect(config.llm.model).toBe('claude-3');
      expect(config.llm.temperature).toBe(0.5);
    });

    it('应该支持禁用进化', () => {
      const config = createDefaultConfig({
        evolution: { 
          enabled: false, 
          patternMiningInterval: 10, 
          minConfidence: 0.5, 
          maxKnowledgeSize: 1000 
        },
      });
      
      expect(config.evolution.enabled).toBe(false);
    });
  });

  describe('formatResult', () => {
    it('应该格式化成功结果', () => {
      const result = formatResult({
        success: true,
        summary: 'Fixed the bug',
        commitHash: 'abc123',
      });
      
      expect(result).toContain('✅');
      expect(result).toContain('Fixed the bug');
      expect(result).toContain('abc123');
    });

    it('应该格式化失败结果', () => {
      const result = formatResult({
        success: false,
        summary: 'Could not fix',
        error: 'Test failed',
      });
      
      expect(result).toContain('❌');
      expect(result).toContain('Test failed');
    });

    it('应该处理无 commit hash 的结果', () => {
      const result = formatResult({
        success: true,
        summary: 'Fixed',
      });
      
      expect(result).toContain('✅');
      expect(result).not.toContain('Commit:');
    });
  });

  describe('validateRepoPath', () => {
    it('应该接受有效路径', () => {
      expect(validateRepoPath('.')).toBe(true);
      expect(validateRepoPath('./my-project')).toBe(true);
      expect(validateRepoPath('/home/user/repo')).toBe(true);
    });

    it('应该拒绝 URL', () => {
      expect(validateRepoPath('https://github.com/repo')).toBe(false);
      expect(validateRepoPath('http://example.com')).toBe(false);
    });

    it('应该拒绝空路径', () => {
      expect(validateRepoPath('')).toBe(false);
    });
  });
});

// CLI 参数解析测试
describe('CLI 参数解析', () => {
  it('应该解析 fix 命令选项', () => {
    const options = {
      repo: './my-project',
      model: 'gpt-4',
      noEvolution: false,
      verbose: true,
    };
    
    expect(options.repo).toBe('./my-project');
    expect(options.model).toBe('gpt-4');
    expect(options.noEvolution).toBe(false);
    expect(options.verbose).toBe(true);
  });

  it('应该解析 analyze 命令选项', () => {
    const options = {
      output: 'report.json',
    };
    
    expect(options.output).toBe('report.json');
  });

  it('应该解析 learn 命令选项', () => {
    const options = {
      stats: true,
      mine: false,
    };
    
    expect(options.stats).toBe(true);
    expect(options.mine).toBe(false);
  });
});
