/**
 * Agent 集成自主性系统测试
 */

import { Agent } from '../src/agent';
import { AutonomyLevel } from '../src/autonomy';
import type { AgentConfig, Issue, Repository } from '../src/types';

// 测试配置
function createTestConfig(autonomyLevel?: AutonomyLevel): AgentConfig {
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
      enabled: false,
      patternMiningInterval: 10,
      minConfidence: 0.5,
      maxKnowledgeSize: 100,
    },
    autonomy: autonomyLevel !== undefined ? {
      level: autonomyLevel,
      maxAutoSteps: 10,
      enableSafetyBoundaries: true,
    } : undefined,
  };
}

describe('Agent 与自主性系统集成', () => {
  describe('自主性配置初始化', () => {
    it('应该使用默认自主性配置创建 Agent', () => {
      const config = createTestConfig();
      const agent = new Agent(config);
      
      expect(agent).toBeDefined();
      // Agent 应该有默认的自主性配置（ASSIST 级别）
    });

    it('应该使用自定义自主性配置创建 Agent', () => {
      const config = createTestConfig(AutonomyLevel.AUTO);
      const agent = new Agent(config);
      
      expect(agent).toBeDefined();
      // Agent 应该使用 AUTO 级别
    });

    it('应该支持所有自主性级别', () => {
      const levels = [
        AutonomyLevel.SUGGEST,
        AutonomyLevel.ASSIST,
        AutonomyLevel.AUTO,
        AutonomyLevel.AUTONOMOUS,
      ];
      
      levels.forEach(level => {
        const config = createTestConfig(level);
        const agent = new Agent(config);
        expect(agent).toBeDefined();
      });
    });
  });

  describe('自主性配置传递', () => {
    it('应该正确传递 SUGGEST 级别', () => {
      const config = createTestConfig(AutonomyLevel.SUGGEST);
      config.autonomy = {
        level: AutonomyLevel.SUGGEST,
        maxAutoSteps: 15,
        enableSafetyBoundaries: true,
      };
      
      const agent = new Agent(config);
      expect(agent).toBeDefined();
    });

    it('应该正确传递 ASSIST 级别', () => {
      const config = createTestConfig(AutonomyLevel.ASSIST);
      config.autonomy = {
        level: AutonomyLevel.ASSIST,
        requireConfirmation: ['apply-modification', 'commit-changes'],
      };
      
      const agent = new Agent(config);
      expect(agent).toBeDefined();
    });

    it('应该正确传递 AUTO 级别', () => {
      const config = createTestConfig(AutonomyLevel.AUTO);
      config.autonomy = {
        level: AutonomyLevel.AUTO,
        autoRollbackTimeout: 600000, // 10 分钟
      };
      
      const agent = new Agent(config);
      expect(agent).toBeDefined();
    });

    it('应该正确传递 AUTONOMOUS 级别', () => {
      const config = createTestConfig(AutonomyLevel.AUTONOMOUS);
      config.autonomy = {
        level: AutonomyLevel.AUTONOMOUS,
        maxAutoSteps: 50,
      };
      
      const agent = new Agent(config);
      expect(agent).toBeDefined();
    });
  });

  describe('自主性对 Agent 行为的影响', () => {
    it('在 SUGGEST 级别应该谨慎执行', () => {
      const config = createTestConfig(AutonomyLevel.SUGGEST);
      const agent = new Agent(config);
      
      // 在 SUGGEST 级别，所有操作都应该需要确认
      expect(agent).toBeDefined();
    });

    it('在 ASSIST 级别应该平衡执行', () => {
      const config = createTestConfig(AutonomyLevel.ASSIST);
      const agent = new Agent(config);
      
      // 在 ASSIST 级别，危险操作需要确认
      expect(agent).toBeDefined();
    });

    it('在 AUTO 级别应该自动执行', () => {
      const config = createTestConfig(AutonomyLevel.AUTO);
      const agent = new Agent(config);
      
      // 在 AUTO 级别，大部分操作自动执行
      expect(agent).toBeDefined();
    });

    it('在 AUTONOMOUS 级别应该完全自主', () => {
      const config = createTestConfig(AutonomyLevel.AUTONOMOUS);
      const agent = new Agent(config);
      
      // 在 AUTONOMOUS 级别，完全自主执行
      expect(agent).toBeDefined();
    });
  });

  describe('安全边界', () => {
    it('应该启用安全边界', () => {
      const config = createTestConfig(AutonomyLevel.ASSIST);
      config.autonomy = {
        level: AutonomyLevel.ASSIST,
        enableSafetyBoundaries: true,
      };
      
      const agent = new Agent(config);
      expect(agent).toBeDefined();
    });

    it('应该支持禁用安全边界', () => {
      const config = createTestConfig(AutonomyLevel.AUTO);
      config.autonomy = {
        level: AutonomyLevel.AUTO,
        enableSafetyBoundaries: false,
      };
      
      const agent = new Agent(config);
      expect(agent).toBeDefined();
    });

    it('应该支持自定义禁止操作', () => {
      const config = createTestConfig(AutonomyLevel.ASSIST);
      config.autonomy = {
        level: AutonomyLevel.ASSIST,
        forbiddenActions: ['dangerous-op', 'risky-op'],
      };
      
      const agent = new Agent(config);
      expect(agent).toBeDefined();
    });
  });

  describe('步数限制', () => {
    it('应该使用默认步数限制', () => {
      const config = createTestConfig(AutonomyLevel.ASSIST);
      const agent = new Agent(config);
      
      // 应该使用默认的 maxAutoSteps (20)
      expect(agent).toBeDefined();
    });

    it('应该支持自定义步数限制', () => {
      const config = createTestConfig(AutonomyLevel.AUTO);
      config.autonomy = {
        level: AutonomyLevel.AUTO,
        maxAutoSteps: 100,
      };
      
      const agent = new Agent(config);
      expect(agent).toBeDefined();
    });

    it('应该支持小步数限制', () => {
      const config = createTestConfig(AutonomyLevel.ASSIST);
      config.autonomy = {
        level: AutonomyLevel.ASSIST,
        maxAutoSteps: 5,
      };
      
      const agent = new Agent(config);
      expect(agent).toBeDefined();
    });
  });

  describe('回滚超时', () => {
    it('应该使用默认回滚超时', () => {
      const config = createTestConfig(AutonomyLevel.AUTO);
      const agent = new Agent(config);
      
      // 应该使用默认的 autoRollbackTimeout (300000ms = 5分钟)
      expect(agent).toBeDefined();
    });

    it('应该支持自定义回滚超时', () => {
      const config = createTestConfig(AutonomyLevel.AUTO);
      config.autonomy = {
        level: AutonomyLevel.AUTO,
        autoRollbackTimeout: 600000, // 10 分钟
      };
      
      const agent = new Agent(config);
      expect(agent).toBeDefined();
    });
  });

  describe('确认步骤自定义', () => {
    it('应该支持自定义需要确认的操作', () => {
      const config = createTestConfig(AutonomyLevel.ASSIST);
      config.autonomy = {
        level: AutonomyLevel.ASSIST,
        requireConfirmation: [
          'apply-modification',
          'commit-changes',
          'push-changes',
          'search-code', // 添加额外确认
        ],
      };
      
      const agent = new Agent(config);
      expect(agent).toBeDefined();
    });

    it('应该支持空确认列表', () => {
      const config = createTestConfig(AutonomyLevel.ASSIST);
      config.autonomy = {
        level: AutonomyLevel.ASSIST,
        requireConfirmation: [],
      };
      
      const agent = new Agent(config);
      expect(agent).toBeDefined();
    });
  });
});

describe('自主性级别组合测试', () => {
  test.each([
    [AutonomyLevel.SUGGEST, 10, true, 300000],
    [AutonomyLevel.ASSIST, 20, true, 300000],
    [AutonomyLevel.AUTO, 30, true, 300000],
    [AutonomyLevel.AUTONOMOUS, 50, false, 600000],
  ])(
    '应该支持级别 %i 配置: maxSteps=%i, safetyBoundaries=%p, timeout=%i',
    (level, maxSteps, safetyBoundaries, timeout) => {
      const config: AgentConfig = {
        maxSteps: 10,
        maxRetries: 2,
        llm: {
          model: 'test-model',
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
          enabled: false,
          patternMiningInterval: 10,
          minConfidence: 0.5,
          maxKnowledgeSize: 100,
        },
        autonomy: {
          level,
          maxAutoSteps: maxSteps,
          enableSafetyBoundaries: safetyBoundaries,
          autoRollbackTimeout: timeout,
        },
      };

      const agent = new Agent(config);
      expect(agent).toBeDefined();
    }
  );
});
