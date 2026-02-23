/**
 * Autonomy Manager 测试
 */

import { 
  AutonomyManager, 
  AutonomyLevel, 
  createDefaultAutonomyConfig 
} from '../src/autonomy';

describe('AutonomyManager', () => {
  describe('构造函数', () => {
    it('应该使用默认配置创建管理器', () => {
      const manager = new AutonomyManager(createDefaultAutonomyConfig());
      const config = manager.getConfig();
      
      expect(config.level).toBe(AutonomyLevel.ASSIST);
      expect(config.enableSafetyBoundaries).toBe(true);
      expect(config.maxAutoSteps).toBe(20);
    });

    it('应该接受自定义配置', () => {
      const manager = new AutonomyManager({
        level: AutonomyLevel.AUTO,
        maxAutoSteps: 50,
        enableSafetyBoundaries: false,
      });
      
      const config = manager.getConfig();
      expect(config.level).toBe(AutonomyLevel.AUTO);
      expect(config.maxAutoSteps).toBe(50);
      expect(config.enableSafetyBoundaries).toBe(false);
    });
  });

  describe('自主性级别', () => {
    it('Level 0 (SUGGEST) 应该需要确认所有操作', () => {
      const manager = new AutonomyManager({
        level: AutonomyLevel.SUGGEST,
      });
      
      const decision = manager.canExecute('apply-modification', 0);
      expect(decision.requiresConfirmation).toBe(true);
    });

    it('Level 1 (ASSIST) 应该需要确认危险操作', () => {
      const manager = new AutonomyManager({
        level: AutonomyLevel.ASSIST,
      });
      
      // 危险操作需要确认
      expect(manager.canExecute('apply-modification', 0).requiresConfirmation).toBe(true);
      expect(manager.canExecute('commit-changes', 0).requiresConfirmation).toBe(true);
      
      // 安全操作不需要确认
      expect(manager.canExecute('search-code', 0).requiresConfirmation).toBe(false);
    });

    it('Level 2 (AUTO) 应该只确认 push', () => {
      const manager = new AutonomyManager({
        level: AutonomyLevel.AUTO,
      });
      
      expect(manager.canExecute('apply-modification', 0).requiresConfirmation).toBe(false);
      expect(manager.canExecute('commit-changes', 0).requiresConfirmation).toBe(false);
      expect(manager.canExecute('push-changes', 0).requiresConfirmation).toBe(true);
    });

    it('Level 3 (AUTONOMOUS) 不需要确认', () => {
      const manager = new AutonomyManager({
        level: AutonomyLevel.AUTONOMOUS,
      });
      
      expect(manager.canExecute('apply-modification', 0).requiresConfirmation).toBe(false);
      expect(manager.canExecute('commit-changes', 0).requiresConfirmation).toBe(false);
      expect(manager.canExecute('push-changes', 0).requiresConfirmation).toBe(false);
    });
  });

  describe('canExecute', () => {
    it('应该在步数超限时拒绝执行', () => {
      const manager = new AutonomyManager({
        level: AutonomyLevel.AUTO,
        maxAutoSteps: 10,
      });
      
      const decision = manager.canExecute('apply-modification', 10);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('最大步数限制');
    });

    it('应该在禁止操作时拒绝执行', () => {
      const manager = new AutonomyManager({
        level: AutonomyLevel.AUTONOMOUS,
        forbiddenActions: ['dangerous-operation'],
      });
      
      const decision = manager.canExecute('dangerous-operation' as any, 0);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('禁止');
    });

    it('应该在无备份时提供警告', () => {
      const manager = new AutonomyManager({
        level: AutonomyLevel.AUTO,
        enableSafetyBoundaries: true,
      });
      
      const decision = manager.canExecute('apply-modification', 0, {
        hasBackup: false,
      });
      
      expect(decision.warnings).toBeDefined();
      expect(decision.warnings).toContain('建议在修改前创建备份');
    });

    it('应该在测试未通过时提供警告', () => {
      const manager = new AutonomyManager({
        level: AutonomyLevel.AUTO,
        enableSafetyBoundaries: true,
      });
      
      const decision = manager.canExecute('commit-changes', 0, {
        testPassing: false,
      });
      
      expect(decision.warnings).toBeDefined();
      expect(decision.warnings).toContain('测试未通过，提交可能包含错误');
    });

    it('应该正确设置 canRollback', () => {
      const manager = new AutonomyManager({
        level: AutonomyLevel.AUTO,
      });
      
      // 可以回滚的操作
      expect(manager.canExecute('apply-modification', 0).canRollback).toBe(true);
      expect(manager.canExecute('commit-changes', 0).canRollback).toBe(true);
      
      // 不能回滚的操作
      expect(manager.canExecute('search-code', 0).canRollback).toBe(false);
    });
  });

  describe('setLevel', () => {
    it('应该更新自主性级别', () => {
      const manager = new AutonomyManager({
        level: AutonomyLevel.ASSIST,
      });
      
      manager.setLevel(AutonomyLevel.AUTO);
      
      expect(manager.getConfig().level).toBe(AutonomyLevel.AUTO);
    });

    it('应该更新需要确认的步骤', () => {
      const manager = new AutonomyManager({
        level: AutonomyLevel.SUGGEST,
      });
      
      // Level 0: 需要确认
      expect(manager.canExecute('apply-modification', 0).requiresConfirmation).toBe(true);
      
      manager.setLevel(AutonomyLevel.AUTONOMOUS);
      
      // Level 3: 不需要确认
      expect(manager.canExecute('apply-modification', 0).requiresConfirmation).toBe(false);
    });
  });

  describe('addConfirmationStep / removeConfirmationStep', () => {
    it('应该添加需要确认的步骤', () => {
      const manager = new AutonomyManager({
        level: AutonomyLevel.AUTONOMOUS,
      });
      
      // 初始不需要确认
      expect(manager.canExecute('search-code', 0).requiresConfirmation).toBe(false);
      
      manager.addConfirmationStep('search-code');
      
      // 添加后需要确认
      expect(manager.canExecute('search-code', 0).requiresConfirmation).toBe(true);
    });

    it('应该移除需要确认的步骤', () => {
      const manager = new AutonomyManager({
        level: AutonomyLevel.ASSIST,
      });
      
      // 初始需要确认
      expect(manager.canExecute('apply-modification', 0).requiresConfirmation).toBe(true);
      
      manager.removeConfirmationStep('apply-modification');
      
      // 移除后不需要确认
      expect(manager.canExecute('apply-modification', 0).requiresConfirmation).toBe(false);
    });
  });

  describe('静态方法', () => {
    it('应该返回级别描述', () => {
      expect(AutonomyManager.getLevelDescription(AutonomyLevel.SUGGEST))
        .toContain('仅建议');
      
      expect(AutonomyManager.getLevelDescription(AutonomyLevel.ASSIST))
        .toContain('辅助编辑');
      
      expect(AutonomyManager.getLevelDescription(AutonomyLevel.AUTO))
        .toContain('自动执行');
      
      expect(AutonomyManager.getLevelDescription(AutonomyLevel.AUTONOMOUS))
        .toContain('完全自主');
    });

    it('应该返回级别名称', () => {
      expect(AutonomyManager.getLevelName(AutonomyLevel.SUGGEST)).toBe('SUGGEST');
      expect(AutonomyManager.getLevelName(AutonomyLevel.ASSIST)).toBe('ASSIST');
      expect(AutonomyManager.getLevelName(AutonomyLevel.AUTO)).toBe('AUTO');
      expect(AutonomyManager.getLevelName(AutonomyLevel.AUTONOMOUS)).toBe('AUTONOMOUS');
    });
  });
});

describe('createDefaultAutonomyConfig', () => {
  it('应该创建默认配置（ASSIST 级别）', () => {
    const config = createDefaultAutonomyConfig();
    
    expect(config.level).toBe(AutonomyLevel.ASSIST);
    expect(config.enableSafetyBoundaries).toBe(true);
    expect(config.maxAutoSteps).toBe(20);
  });

  it('应该接受自定义级别', () => {
    const config = createDefaultAutonomyConfig(AutonomyLevel.AUTO);
    
    expect(config.level).toBe(AutonomyLevel.AUTO);
  });
});

describe('AutonomyLevel 枚举', () => {
  it('应该有正确的级别值', () => {
    expect(AutonomyLevel.SUGGEST).toBe(0);
    expect(AutonomyLevel.ASSIST).toBe(1);
    expect(AutonomyLevel.AUTO).toBe(2);
    expect(AutonomyLevel.AUTONOMOUS).toBe(3);
  });
});
