/**
 * Types 类型测试
 * 主要测试类型定义的正确性和类型守卫
 */

import type {
  Issue,
  Repository,
  CodeLocation,
  CodeSnippet,
  CodeModification,
  Step,
  Trajectory,
  Result,
  TestResult,
  Pattern,
  Knowledge,
  Strategy,
  AgentConfig,
  LLMConfig,
  ExecResult,
} from '../src/types';

describe('Types', () => {
  describe('Issue', () => {
    it('应该创建有效的 Issue 对象', () => {
      const issue: Issue = {
        id: 'issue-1',
        url: 'https://github.com/test/repo/issues/1',
        title: 'Bug in code',
        body: 'Description of the bug',
        labels: ['bug', 'priority'],
        author: 'user1',
        createdAt: new Date(),
        errorTrace: 'Error at line 10',
        keywords: ['bug', 'error'],
      };

      expect(issue.id).toBe('issue-1');
      expect(issue.labels).toHaveLength(2);
    });

    it('应该允许可选字段为空', () => {
      const issue: Issue = {
        id: 'issue-2',
        title: 'Minimal issue',
        body: 'Body',
      };

      expect(issue.url).toBeUndefined();
      expect(issue.labels).toBeUndefined();
    });
  });

  describe('Repository', () => {
    it('应该创建有效的 Repository 对象', () => {
      const repo: Repository = {
        url: 'https://github.com/test/repo',
        path: '/local/path/to/repo',
        branch: 'main',
        structure: {
          root: '/local/path/to/repo',
          srcDir: '/local/path/to/repo/src',
          testDir: '/local/path/to/repo/tests',
          directories: ['src', 'tests'],
          files: ['package.json', 'README.md'],
        },
        techStack: {
          language: 'TypeScript',
          framework: 'Node.js',
          testFramework: 'Jest',
          packageManager: 'npm',
        },
      };

      expect(repo.url).toBeDefined();
      expect(repo.structure?.srcDir).toContain('src');
      expect(repo.techStack?.language).toBe('TypeScript');
    });
  });

  describe('CodeLocation', () => {
    it('应该创建有效的 CodeLocation 对象', () => {
      const location: CodeLocation = {
        file: 'src/index.ts',
        line: 42,
        column: 10,
        context: 'const x = foo()',
      };

      expect(location.file).toBe('src/index.ts');
      expect(location.line).toBe(42);
    });
  });

  describe('CodeSnippet', () => {
    it('应该创建有效的 CodeSnippet 对象', () => {
      const snippet: CodeSnippet = {
        file: 'src/utils.ts',
        content: 'export function helper() { return 1; }',
        startLine: 1,
        endLine: 1,
        language: 'typescript',
      };

      expect(snippet.startLine).toBe(1);
      expect(snippet.language).toBe('typescript');
    });
  });

  describe('CodeModification', () => {
    it('应该创建有效的 create 类型修改', () => {
      const mod: CodeModification = {
        file: 'src/new.ts',
        type: 'create',
        newContent: 'export const x = 1;',
        description: 'Create new file',
      };

      expect(mod.type).toBe('create');
      expect(mod.oldContent).toBeUndefined();
    });

    it('应该创建有效的 modify 类型修改', () => {
      const mod: CodeModification = {
        file: 'src/existing.ts',
        type: 'modify',
        oldContent: 'const x = 1;',
        newContent: 'const x = 2;',
        description: 'Update value',
      };

      expect(mod.type).toBe('modify');
      expect(mod.oldContent).toBe('const x = 1;');
    });

    it('应该创建有效的 delete 类型修改', () => {
      const mod: CodeModification = {
        file: 'src/old.ts',
        type: 'delete',
        oldContent: 'old content',
        newContent: '',
      };

      expect(mod.type).toBe('delete');
    });
  });

  describe('Step', () => {
    it('应该创建有效的 Step 对象', () => {
      const step: Step = {
        id: 'step-1',
        type: 'search-code',
        input: { query: 'function foo' },
        output: { results: [] },
        reasoning: 'Need to find the function definition',
        timestamp: new Date(),
        duration: 100,
        success: true,
      };

      expect(step.type).toBe('search-code');
      expect(step.success).toBe(true);
    });

    it('应该支持所有 StepType', () => {
      const stepTypes: Step['type'][] = [
        'parse-issue',
        'analyze-repo',
        'search-code',
        'generate-fix',
        'apply-modification',
        'run-tests',
        'commit-changes',
      ];

      stepTypes.forEach((type) => {
        const step: Step = {
          id: `step-${type}`,
          type,
          input: {},
          output: {},
          timestamp: new Date(),
          success: true,
        };
        expect(step.type).toBe(type);
      });
    });
  });

  describe('Trajectory', () => {
    it('应该创建有效的 Trajectory 对象', () => {
      const trajectory: Trajectory = {
        id: 'trajectory-1',
        issue: {
          id: 'issue-1',
          title: 'Bug',
          body: 'Description',
        },
        repo: {
          url: 'https://github.com/test/repo',
          path: '/path/to/repo',
        },
        steps: [],
        result: {
          success: true,
          modifications: [],
          summary: 'Fixed successfully',
        },
        metadata: {
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 4000,
          totalTokens: 1000,
          duration: 30000,
        },
        createdAt: new Date(),
      };

      expect(trajectory.steps).toHaveLength(0);
      expect(trajectory.result.success).toBe(true);
    });
  });

  describe('TestResult', () => {
    it('应该创建有效的 TestResult 对象', () => {
      const testResult: TestResult = {
        passed: 10,
        failed: 2,
        skipped: 1,
        total: 13,
        output: 'Test output...',
        failures: [
          {
            test: 'should work',
            file: 'tests/test.ts',
            message: 'Expected 1 but got 2',
            stack: 'at test.ts:10',
          },
        ],
      };

      expect(testResult.passed).toBe(10);
      expect(testResult.failures).toHaveLength(1);
    });
  });

  describe('Pattern', () => {
    it('应该创建有效的 success Pattern', () => {
      const pattern: Pattern = {
        id: 'pattern-1',
        type: 'success',
        trigger: 'TypeError undefined',
        action: 'Check variable initialization',
        outcome: 'Issue resolved',
        confidence: 0.85,
        usage: 5,
        lastUsed: new Date(),
        trajectoryIds: ['t1', 't2'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(pattern.type).toBe('success');
      expect(pattern.confidence).toBeGreaterThan(0.5);
    });

    it('应该创建有效的 failure Pattern', () => {
      const pattern: Pattern = {
        id: 'pattern-2',
        type: 'failure',
        trigger: 'Network error',
        action: 'Retry with backoff',
        outcome: 'Connection failed',
        confidence: 0.6,
        usage: 3,
        trajectoryIds: ['t3'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(pattern.type).toBe('failure');
    });
  });

  describe('Knowledge', () => {
    it('应该创建有效的 Knowledge 对象', () => {
      const knowledge: Knowledge = {
        id: 'knowledge-1',
        category: 'bug-fix',
        problem: 'Memory leak in event handler',
        solution: 'Remove event listener on unmount',
        codeSnippets: [
          {
            file: 'src/component.ts',
            content: 'useEffect(() => { ... }, [])',
            startLine: 10,
            endLine: 20,
          },
        ],
        references: ['https://example.com/solution'],
        score: 9,
        usage: 10,
        tags: ['react', 'memory-leak', 'useEffect'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(knowledge.category).toBe('bug-fix');
      expect(knowledge.score).toBe(9);
    });

    it('应该支持所有 KnowledgeCategory', () => {
      const categories: Knowledge['category'][] = [
        'bug-fix',
        'refactor',
        'feature',
        'optimization',
        'documentation',
        'test',
        'config',
      ];

      categories.forEach((category) => {
        const knowledge: Knowledge = {
          id: `knowledge-${category}`,
          category,
          problem: 'Test problem',
          solution: 'Test solution',
          codeSnippets: [],
          references: [],
          score: 5,
          usage: 0,
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        expect(knowledge.category).toBe(category);
      });
    });
  });

  describe('Strategy', () => {
    it('应该创建有效的 Strategy 对象', () => {
      const strategy: Strategy = {
        searchWeights: {
          'function-name': 0.3,
          'error-message': 0.25,
        },
        promptTemplates: {
          'fix-prompt': 'Fix the bug...',
        },
        thresholds: {
          'min-confidence': 0.5,
        },
        preferredTools: ['grep', 'find'],
        updatedAt: new Date(),
      };

      expect(strategy.searchWeights['function-name']).toBe(0.3);
      expect(strategy.preferredTools).toContain('grep');
    });
  });

  describe('AgentConfig', () => {
    it('应该创建有效的 AgentConfig 对象', () => {
      const config: AgentConfig = {
        maxSteps: 50,
        maxRetries: 3,
        llm: {
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 4000,
        },
        git: {
          defaultBranch: 'main',
          commitTemplate: 'fix: {message}',
          autoPush: true,
        },
        test: {
          command: 'npm test',
          pattern: '**/*.test.ts',
          timeout: 60000,
        },
        evolution: {
          enabled: true,
          patternMiningInterval: 100,
          minConfidence: 0.5,
          maxKnowledgeSize: 1000,
        },
      };

      expect(config.maxSteps).toBe(50);
      expect(config.evolution.enabled).toBe(true);
    });
  });

  describe('ExecResult', () => {
    it('应该创建有效的 ExecResult 对象', () => {
      const result: ExecResult = {
        stdout: 'output',
        stderr: '',
        exitCode: 0,
        success: true,
        duration: 100,
      };

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it('应该正确表示失败结果', () => {
      const result: ExecResult = {
        stdout: '',
        stderr: 'Error: command failed',
        exitCode: 1,
        success: false,
        duration: 50,
      };

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });
  });
});
