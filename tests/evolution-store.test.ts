/**
 * EvolutionStore 测试
 */

import * as fs from 'fs';
import * as path from 'path';
import { EvolutionStore } from '../src/evolution-store';
import type { Trajectory, Pattern, Knowledge, Issue, Repository, Result } from '../src/types';

// 测试用的临时目录
const TEST_STORE_PATH = './test-evolution-store';

// 辅助函数：创建测试轨迹
function createTestTrajectory(overrides: Partial<Trajectory> = {}): Trajectory {
  const issue: Issue = {
    id: 'test-issue-1',
    title: 'Test Issue',
    body: 'Test body',
    keywords: ['test', 'bug'],
  };

  const repo: Repository = {
    url: 'https://github.com/test/repo',
    path: '/tmp/test-repo',
  };

  const result: Result = {
    success: true,
    modifications: [],
    summary: 'Test completed',
  };

  return {
    id: `trajectory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    issue,
    repo,
    steps: [],
    result,
    metadata: {
      model: 'test-model',
      duration: 1000,
    },
    createdAt: new Date(),
    ...overrides,
  };
}

// 辅助函数：创建测试模式
function createTestPattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
    id: `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'success',
    trigger: 'test trigger',
    action: 'test action',
    outcome: 'test outcome',
    confidence: 0.8,
    usage: 1,
    trajectoryIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// 辅助函数：创建测试知识
function createTestKnowledge(overrides: Partial<Knowledge> = {}): Knowledge {
  return {
    id: `knowledge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    category: 'bug-fix',
    problem: 'Test problem',
    solution: 'Test solution',
    codeSnippets: [],
    references: [],
    score: 8,
    usage: 1,
    tags: ['test'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// 每个测试前后清理
beforeEach(() => {
  // 清理测试目录
  if (fs.existsSync(TEST_STORE_PATH)) {
    fs.rmSync(TEST_STORE_PATH, { recursive: true, force: true });
  }
});

afterEach(() => {
  // 清理测试目录
  if (fs.existsSync(TEST_STORE_PATH)) {
    fs.rmSync(TEST_STORE_PATH, { recursive: true, force: true });
  }
});

describe('EvolutionStore', () => {
  describe('初始化', () => {
    it('应该创建空的 EvolutionStore', () => {
      const store = new EvolutionStore(TEST_STORE_PATH);
      const stats = store.getStats();
      
      expect(stats.totalTrajectories).toBe(0);
      expect(stats.totalPatterns).toBe(0);
      expect(stats.totalKnowledge).toBe(0);
    });

    it('应该加载已存在的数据', async () => {
      // 创建并保存一些数据
      const store1 = new EvolutionStore(TEST_STORE_PATH);
      const trajectory = createTestTrajectory();
      await store1.saveTrajectory(trajectory);
      
      // 重新加载
      const store2 = new EvolutionStore(TEST_STORE_PATH);
      expect(store2.getTrajectory(trajectory.id)).toBeDefined();
    });
  });

  describe('轨迹管理', () => {
    it('应该保存和获取轨迹', async () => {
      const store = new EvolutionStore(TEST_STORE_PATH);
      const trajectory = createTestTrajectory();
      
      await store.saveTrajectory(trajectory);
      
      const retrieved = store.getTrajectory(trajectory.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(trajectory.id);
      expect(retrieved?.issue.title).toBe('Test Issue');
    });

    it('应该获取所有轨迹', async () => {
      const store = new EvolutionStore(TEST_STORE_PATH);
      
      const t1 = createTestTrajectory();
      const t2 = createTestTrajectory();
      
      await store.saveTrajectory(t1);
      await store.saveTrajectory(t2);
      
      const all = store.getAllTrajectories();
      expect(all).toHaveLength(2);
    });

    it('应该正确区分成功和失败的轨迹', async () => {
      const store = new EvolutionStore(TEST_STORE_PATH);
      
      const successT = createTestTrajectory({ result: { success: true, modifications: [], summary: 'OK' } });
      const failedT = createTestTrajectory({ result: { success: false, modifications: [], summary: 'Failed', error: 'Error' } });
      
      await store.saveTrajectory(successT);
      await store.saveTrajectory(failedT);
      
      expect(store.getSuccessfulTrajectories()).toHaveLength(1);
      expect(store.getFailedTrajectories()).toHaveLength(1);
    });
  });

  describe('模式管理', () => {
    it('应该保存和获取模式', async () => {
      const store = new EvolutionStore(TEST_STORE_PATH);
      const pattern = createTestPattern();
      
      await store.savePattern(pattern);
      
      const retrieved = store.getPattern(pattern.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.type).toBe('success');
    });

    it('应该根据关键词匹配模式', async () => {
      const store = new EvolutionStore(TEST_STORE_PATH);
      
      const pattern1 = createTestPattern({ trigger: 'TypeError undefined variable' });
      const pattern2 = createTestPattern({ trigger: 'SyntaxError missing bracket' });
      
      await store.savePattern(pattern1);
      await store.savePattern(pattern2);
      
      const matches = store.findMatchingPatterns(['TypeError']);
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe(pattern1.id);
    });

    it('应该按置信度排序匹配的模式', async () => {
      const store = new EvolutionStore(TEST_STORE_PATH);
      
      const p1 = createTestPattern({ trigger: 'error test', confidence: 0.5 });
      const p2 = createTestPattern({ trigger: 'error test', confidence: 0.9 });
      
      await store.savePattern(p1);
      await store.savePattern(p2);
      
      const matches = store.findMatchingPatterns(['error']);
      expect(matches).toHaveLength(2);
      expect(matches[0].confidence).toBe(0.9);
      expect(matches[1].confidence).toBe(0.5);
    });

    it('应该更新模式使用统计', async () => {
      const store = new EvolutionStore(TEST_STORE_PATH);
      const pattern = createTestPattern({ usage: 0 });
      
      await store.savePattern(pattern);
      await store.updatePatternUsage(pattern.id, 'test-trajectory');
      
      const updated = store.getPattern(pattern.id);
      expect(updated?.usage).toBe(1);
      expect(updated?.lastUsed).toBeDefined();
      expect(updated?.trajectoryIds).toContain('test-trajectory');
    });
  });

  describe('知识管理', () => {
    it('应该保存和获取知识', async () => {
      const store = new EvolutionStore(TEST_STORE_PATH);
      const knowledge = createTestKnowledge();
      
      await store.saveKnowledge(knowledge);
      
      const retrieved = store.getKnowledge(knowledge.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.category).toBe('bug-fix');
    });

    it('应该搜索知识', async () => {
      const store = new EvolutionStore(TEST_STORE_PATH);
      
      const k1 = createTestKnowledge({ problem: '如何修复内存泄漏', tags: ['memory', 'leak'] });
      const k2 = createTestKnowledge({ problem: '如何优化性能', tags: ['performance'] });
      
      await store.saveKnowledge(k1);
      await store.saveKnowledge(k2);
      
      const results = store.searchKnowledge('内存');
      expect(results).toHaveLength(1);
      expect(results[0].problem).toContain('内存');
    });

    it('应该按类别过滤知识', async () => {
      const store = new EvolutionStore(TEST_STORE_PATH);
      
      const k1 = createTestKnowledge({ category: 'bug-fix' });
      const k2 = createTestKnowledge({ category: 'feature' });
      
      await store.saveKnowledge(k1);
      await store.saveKnowledge(k2);
      
      const results = store.searchKnowledge('', 'bug-fix');
      expect(results).toHaveLength(1);
    });

    it('应该更新知识使用统计', async () => {
      const store = new EvolutionStore(TEST_STORE_PATH);
      const knowledge = createTestKnowledge({ usage: 0 });
      
      await store.saveKnowledge(knowledge);
      await store.updateKnowledgeUsage(knowledge.id);
      
      const updated = store.getKnowledge(knowledge.id);
      expect(updated?.usage).toBe(1);
    });
  });

  describe('策略管理', () => {
    it('应该返回默认策略', () => {
      const store = new EvolutionStore(TEST_STORE_PATH);
      const strategy = store.getStrategy();
      
      expect(strategy.searchWeights).toBeDefined();
      expect(strategy.thresholds).toBeDefined();
      expect(strategy.preferredTools).toContain('grep');
    });

    it('应该更新策略', async () => {
      const store = new EvolutionStore(TEST_STORE_PATH);
      
      await store.updateStrategy({
        searchWeights: { 'test-weight': 1.0 },
      });
      
      const strategy = store.getStrategy();
      expect(strategy.searchWeights['test-weight']).toBe(1.0);
    });
  });

  describe('模式挖掘', () => {
    it('应该从成功轨迹中挖掘模式', async () => {
      const store = new EvolutionStore(TEST_STORE_PATH);
      
      const trajectory = createTestTrajectory({
        steps: [{ id: 'step1', type: 'search-code', input: {}, output: {}, timestamp: new Date(), success: true }],
        result: { success: true, modifications: [], summary: 'Fixed!' },
      });
      
      await store.saveTrajectory(trajectory);
      
      const newPatterns = await store.minePatterns();
      expect(newPatterns.length).toBeGreaterThan(0);
      expect(newPatterns[0].type).toBe('success');
    });

    it('应该从失败轨迹中挖掘模式', async () => {
      const store = new EvolutionStore(TEST_STORE_PATH);
      
      const trajectory = createTestTrajectory({
        steps: [{ id: 'step1', type: 'search-code', input: {}, output: {}, timestamp: new Date(), success: false, error: 'Not found' }],
        result: { success: false, modifications: [], summary: 'Failed', error: 'Error' },
      });
      
      await store.saveTrajectory(trajectory);
      
      const newPatterns = await store.minePatterns();
      expect(newPatterns.some(p => p.type === 'failure')).toBe(true);
    });

    it('不应该创建重复模式', async () => {
      const store = new EvolutionStore(TEST_STORE_PATH);
      
      const trajectory = createTestTrajectory({
        issue: { id: 'i1', title: 'Same issue', body: '', keywords: ['same'] },
        result: { success: true, modifications: [], summary: 'Same fix' },
      });
      
      await store.saveTrajectory(trajectory);
      await store.minePatterns();
      
      // 再次挖掘相同的轨迹
      await store.minePatterns();
      
      const patterns = store.getAllPatterns();
      // 相同 trigger 和 action 的模式应该只有一个
      const uniqueTriggers = new Set(patterns.map(p => p.trigger));
      expect(uniqueTriggers.size).toBe(patterns.length);
    });
  });

  describe('统计', () => {
    it('应该正确计算统计信息', async () => {
      const store = new EvolutionStore(TEST_STORE_PATH);
      
      // 添加轨迹
      await store.saveTrajectory(createTestTrajectory({ result: { success: true, modifications: [], summary: 'OK' } }));
      await store.saveTrajectory(createTestTrajectory({ result: { success: false, modifications: [], summary: 'Fail', error: 'E' } }));
      
      // 添加模式
      await store.savePattern(createTestPattern({ type: 'success', confidence: 0.8 }));
      await store.savePattern(createTestPattern({ type: 'failure', confidence: 0.6 }));
      
      // 添加知识
      await store.saveKnowledge(createTestKnowledge());
      
      const stats = store.getStats();
      
      expect(stats.totalTrajectories).toBe(2);
      expect(stats.successfulTrajectories).toBe(1);
      expect(stats.failedTrajectories).toBe(1);
      expect(stats.totalPatterns).toBe(2);
      expect(stats.successPatterns).toBe(1);
      expect(stats.failurePatterns).toBe(1);
      expect(stats.totalKnowledge).toBe(1);
      expect(stats.averageConfidence).toBeCloseTo(0.7);
    });
  });
});
