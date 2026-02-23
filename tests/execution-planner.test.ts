/**
 * ExecutionPlanner 测试
 */

import { ExecutionPlanner } from '../src/execution-planner';
import type { ParsedIssue } from '../src/issue-parser';

// 创建测试用的 ParsedIssue
function createTestIssue(overrides: Partial<ParsedIssue> = {}): ParsedIssue {
  return {
    id: 'test-issue-1',
    title: 'Test Issue',
    body: 'Test body',
    parsed: {
      type: 'bug',
      severity: 'medium',
      errorStack: [],
      mentionedFiles: [],
      mentionedFunctions: [],
      mentionedClasses: [],
      codeSnippets: [],
      suspectedAreas: [],
      confidence: 0.8,
    },
    ...overrides,
  };
}

describe('ExecutionPlanner', () => {
  let planner: ExecutionPlanner;

  beforeEach(() => {
    planner = new ExecutionPlanner();
  });

  describe('createPlan', () => {
    describe('Bug 修复计划', () => {
      it('应该创建 Bug 修复计划', () => {
        const issue = createTestIssue({
          parsed: {
            type: 'bug',
            severity: 'medium',
            errorStack: [{ file: 'src/auth.ts', line: 42 }],
            mentionedFiles: ['src/auth.ts'],
            mentionedFunctions: ['login'],
            mentionedClasses: [],
            codeSnippets: [],
            suspectedAreas: ['auth'],
            confidence: 0.8,
          },
        });

        const plan = planner.createPlan({ issue });

        expect(plan.steps.length).toBeGreaterThan(0);
        expect(plan.steps[0].type).toBe('analyze');
        expect(plan.issueId).toBe('test-issue-1');
      });

      it('Bug 计划应该包含测试步骤', () => {
        const issue = createTestIssue({
          parsed: {
            type: 'bug',
            severity: 'high',
            errorStack: [],
            mentionedFiles: [],
            mentionedFunctions: [],
            mentionedClasses: [],
            codeSnippets: [],
            suspectedAreas: [],
            confidence: 0.5,
          },
        });

        const plan = planner.createPlan({ issue });

        const testStep = plan.steps.find(s => s.type === 'test');
        expect(testStep).toBeDefined();
        expect(testStep?.priority).toBe('high');
      });

      it('Critical Bug 应该有高优先级', () => {
        const issue = createTestIssue({
          parsed: {
            type: 'bug',
            severity: 'critical',
            errorStack: [],
            mentionedFiles: [],
            mentionedFunctions: [],
            mentionedClasses: [],
            codeSnippets: [],
            suspectedAreas: [],
            confidence: 0.9,
          },
        });

        const plan = planner.createPlan({ issue });

        const modifyStep = plan.steps.find(s => s.type === 'modify');
        expect(modifyStep?.priority).toBe('high');
      });
    });

    describe('功能开发计划', () => {
      it('应该创建功能开发计划', () => {
        const issue = createTestIssue({
          parsed: {
            type: 'feature',
            severity: 'low',
            errorStack: [],
            mentionedFiles: [],
            mentionedFunctions: [],
            mentionedClasses: [],
            codeSnippets: [],
            suspectedAreas: [],
            confidence: 0.6,
          },
        });

        const plan = planner.createPlan({ issue });

        expect(plan.steps.length).toBeGreaterThan(0);
        const createStep = plan.steps.find(s => s.type === 'create');
        expect(createStep).toBeDefined();
      });
    });

    describe('增强计划', () => {
      it('应该创建增强计划', () => {
        const issue = createTestIssue({
          parsed: {
            type: 'enhancement',
            severity: 'low',
            errorStack: [],
            mentionedFiles: [],
            mentionedFunctions: [],
            mentionedClasses: [],
            codeSnippets: [],
            suspectedAreas: [],
            confidence: 0.7,
          },
        });

        const plan = planner.createPlan({ issue });

        expect(plan.steps.every(s => s.priority !== 'high' || s.type === 'test')).toBe(true);
      });
    });

    describe('文档计划', () => {
      it('应该创建文档计划', () => {
        const issue = createTestIssue({
          parsed: {
            type: 'documentation',
            severity: 'low',
            errorStack: [],
            mentionedFiles: [],
            mentionedFunctions: [],
            mentionedClasses: [],
            codeSnippets: [],
            suspectedAreas: [],
            confidence: 0.5,
          },
        });

        const plan = planner.createPlan({ issue });

        expect(plan.steps.length).toBeLessThanOrEqual(4);
      });
    });

    describe('通用计划', () => {
      it('应该为未知类型创建通用计划', () => {
        const issue = createTestIssue({
          parsed: {
            type: 'unknown',
            severity: 'unknown',
            errorStack: [],
            mentionedFiles: [],
            mentionedFunctions: [],
            mentionedClasses: [],
            codeSnippets: [],
            suspectedAreas: [],
            confidence: 0.3,
          },
        });

        const plan = planner.createPlan({ issue });

        expect(plan.steps.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getNextStep', () => {
    it('应该返回第一个无依赖的待执行步骤', () => {
      const issue = createTestIssue();
      const plan = planner.createPlan({ issue });

      const nextStep = planner.getNextStep(plan);

      expect(nextStep).toBeDefined();
      expect(nextStep?.id).toBe('step-1');
      expect(nextStep?.status).toBe('pending');
    });

    it('应该返回 null 当所有步骤都完成时', () => {
      const issue = createTestIssue();
      const plan = planner.createPlan({ issue });

      // 完成所有步骤
      plan.steps.forEach(step => {
        step.status = 'completed';
      });

      const nextStep = planner.getNextStep(plan);
      expect(nextStep).toBeNull();
    });

    it('应该等待依赖完成', () => {
      const issue = createTestIssue();
      const plan = planner.createPlan({ issue });

      // 只完成第一个步骤
      plan.steps[0].status = 'completed';

      const nextStep = planner.getNextStep(plan);
      expect(nextStep?.id).toBe('step-2');
    });
  });

  describe('updateStepStatus', () => {
    it('应该更新步骤状态', () => {
      const issue = createTestIssue();
      const plan = planner.createPlan({ issue });

      planner.updateStepStatus(plan, 'step-1', 'running');

      expect(plan.steps[0].status).toBe('running');
    });

    it('应该更新为完成状态', () => {
      const issue = createTestIssue();
      const plan = planner.createPlan({ issue });

      planner.updateStepStatus(plan, 'step-1', 'completed');

      expect(plan.steps[0].status).toBe('completed');
    });
  });

  describe('isPlanCompleted', () => {
    it('应该在所有步骤完成时返回 true', () => {
      const issue = createTestIssue();
      const plan = planner.createPlan({ issue });

      plan.steps.forEach(step => {
        step.status = 'completed';
      });

      expect(planner.isPlanCompleted(plan)).toBe(true);
    });

    it('应该将跳过的步骤视为完成', () => {
      const issue = createTestIssue();
      const plan = planner.createPlan({ issue });

      plan.steps.forEach((step, index) => {
        step.status = index % 2 === 0 ? 'completed' : 'skipped';
      });

      expect(planner.isPlanCompleted(plan)).toBe(true);
    });

    it('应该在有待处理步骤时返回 false', () => {
      const issue = createTestIssue();
      const plan = planner.createPlan({ issue });

      expect(planner.isPlanCompleted(plan)).toBe(false);
    });
  });

  describe('getProgress', () => {
    it('应该返回正确的进度', () => {
      const issue = createTestIssue();
      const plan = planner.createPlan({ issue });

      // 完成一半步骤
      const half = Math.floor(plan.steps.length / 2);
      for (let i = 0; i < half; i++) {
        plan.steps[i].status = 'completed';
      }

      const progress = planner.getProgress(plan);

      expect(progress.completed).toBe(half);
      expect(progress.total).toBe(plan.steps.length);
      expect(progress.percentage).toBe(Math.round((half / plan.steps.length) * 100));
    });

    it('应该计算失败步骤', () => {
      const issue = createTestIssue();
      const plan = planner.createPlan({ issue });

      plan.steps[0].status = 'completed';
      plan.steps[1].status = 'failed';

      const progress = planner.getProgress(plan);

      expect(progress.completed).toBe(1);
      expect(progress.failed).toBe(1);
    });
  });

  describe('summarizePlan', () => {
    it('应该生成计划摘要', () => {
      const issue = createTestIssue({
        id: 'issue-123',
        title: 'Test Bug',
      });
      const plan = planner.createPlan({ issue });

      const summary = planner.summarizePlan(plan);

      expect(summary).toContain('执行计划');
      expect(summary).toContain('issue-123');
      expect(summary).toContain('进度:');
    });

    it('应该显示步骤状态图标', () => {
      const issue = createTestIssue();
      const plan = planner.createPlan({ issue });
      
      planner.updateStepStatus(plan, 'step-1', 'completed');

      const summary = planner.summarizePlan(plan);

      expect(summary).toContain('✅');
    });
  });
});
