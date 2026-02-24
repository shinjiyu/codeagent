/**
 * 自主性系统使用示例
 * 
 * 演示如何使用 SWE-Agent-Node 的 4 级自主性系统
 */

import { Agent } from '../src/agent';
import { AutonomyLevel, AutonomyManager, createDefaultAutonomyConfig } from '../src/autonomy';
import type { AgentConfig } from '../src/types';

// ========================================
// 示例 1: 基础使用 - 默认自主性级别
// ========================================

console.log('=== 示例 1: 默认自主性级别 ===\n');

const defaultAgent = new Agent({
  maxSteps: 10,
  maxRetries: 3,
  llm: {
    model: 'gpt-4',
    temperature: 0.7,
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
    enabled: true,
    patternMiningInterval: 10,
    minConfidence: 0.5,
    maxKnowledgeSize: 100,
  },
  // 不指定 autonomy，使用默认值（ASSIST 级别）
});

console.log('✓ 创建了使用默认自主性级别的 Agent');
console.log('  默认级别: ASSIST (辅助编辑)\n');

// ========================================
// 示例 2: 指定自主性级别
// ========================================

console.log('=== 示例 2: 指定自主性级别 ===\n');

// Level 0 - 仅建议
const suggestAgent = new Agent({
  maxSteps: 10,
  maxRetries: 3,
  llm: { model: 'gpt-4' },
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
    level: AutonomyLevel.SUGGEST,
  },
});

console.log('✓ Level 0 (SUGGEST): Agent 只提供建议，所有决策由人类做出');

// Level 1 - 辅助编辑
const assistAgent = new Agent({
  maxSteps: 10,
  maxRetries: 3,
  llm: { model: 'gpt-4' },
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
    level: AutonomyLevel.ASSIST,
  },
});

console.log('✓ Level 1 (ASSIST): Agent 可以执行操作，危险操作需要确认');

// Level 2 - 自动执行
const autoAgent = new Agent({
  maxSteps: 10,
  maxRetries: 3,
  llm: { model: 'gpt-4' },
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
    level: AutonomyLevel.AUTO,
  },
});

console.log('✓ Level 2 (AUTO): Agent 自动执行，支持回滚');

// Level 3 - 完全自主
const autonomousAgent = new Agent({
  maxSteps: 10,
  maxRetries: 3,
  llm: { model: 'gpt-4' },
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
    level: AutonomyLevel.AUTONOMOUS,
  },
});

console.log('✓ Level 3 (AUTONOMOUS): Agent 完全自主执行\n');

// ========================================
// 示例 3: 自主性管理器独立使用
// ========================================

console.log('=== 示例 3: 自主性管理器独立使用 ===\n');

const manager = new AutonomyManager({
  level: AutonomyLevel.AUTO,
  maxAutoSteps: 50,
  autoRollbackTimeout: 600000, // 10 分钟
  enableSafetyBoundaries: true,
});

// 检查是否可以执行某个操作
const decision1 = manager.canExecute('apply-modification', 0, {
  hasBackup: true,
  testPassing: true,
});

console.log('操作: apply-modification (有备份，测试通过)');
console.log('  允许执行:', decision1.allowed);
console.log('  需要确认:', decision1.requiresConfirmation);
console.log('  可以回滚:', decision1.canRollback);
if (decision1.warnings) {
  console.log('  警告:', decision1.warnings);
}
console.log();

const decision2 = manager.canExecute('apply-modification', 0, {
  hasBackup: false,
  testPassing: false,
});

console.log('操作: apply-modification (无备份，测试失败)');
console.log('  允许执行:', decision2.allowed);
console.log('  需要确认:', decision2.requiresConfirmation);
console.log('  可以回滚:', decision2.canRollback);
if (decision2.warnings) {
  console.log('  警告:', decision2.warnings);
}
console.log();

// ========================================
// 示例 4: 动态调整自主性级别
// ========================================

console.log('=== 示例 4: 动态调整自主性级别 ===\n');

const dynamicManager = new AutonomyManager({
  level: AutonomyLevel.ASSIST,
});

console.log('初始级别:', AutonomyManager.getLevelName(dynamicManager.getConfig().level));
console.log('描述:', AutonomyManager.getLevelDescription(dynamicManager.getConfig().level));
console.log();

// 切换到 AUTO 级别
dynamicManager.setLevel(AutonomyLevel.AUTO);
console.log('切换到:', AutonomyManager.getLevelName(dynamicManager.getConfig().level));
console.log('描述:', AutonomyManager.getLevelDescription(dynamicManager.getConfig().level));
console.log();

// 添加需要确认的操作
dynamicManager.addConfirmationStep('search-code');
console.log('添加确认步骤: search-code');
console.log('当前需要确认的操作:', dynamicManager.getConfig().requireConfirmation);
console.log();

// 移除确认操作
dynamicManager.removeConfirmationStep('search-code');
console.log('移除确认步骤: search-code');
console.log('当前需要确认的操作:', dynamicManager.getConfig().requireConfirmation);
console.log();

// ========================================
// 示例 5: 安全机制配置
// ========================================

console.log('=== 示例 5: 安全机制配置 ===\n');

const safeAgent = new Agent({
  maxSteps: 10,
  maxRetries: 3,
  llm: { model: 'gpt-4' },
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
    level: AutonomyLevel.AUTO,
    maxAutoSteps: 30, // 最多 30 步
    autoRollbackTimeout: 600000, // 10 分钟后自动回滚
    enableSafetyBoundaries: true,
    forbiddenActions: [
      'delete-repository',
      'force-push',
      'reset-hard',
      'delete-branch',
      'custom-dangerous-op', // 添加自定义禁止操作
    ],
    requireConfirmation: [
      'apply-modification',
      'commit-changes',
      'push-changes',
    ],
  },
});

console.log('✓ 创建了具有完整安全配置的 Agent');
console.log('  最大步数: 30');
console.log('  回滚超时: 10 分钟');
console.log('  安全边界: 启用');
console.log('  禁止操作: 5 个');
console.log('  需确认操作: 3 个\n');

// ========================================
// 示例 6: 不同场景的推荐配置
// ========================================

console.log('=== 示例 6: 不同场景的推荐配置 ===\n');

// 场景 1: 首次使用
const firstTimeConfig: AgentConfig = {
  maxSteps: 5,
  maxRetries: 2,
  llm: { model: 'gpt-4' },
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
    level: AutonomyLevel.SUGGEST, // 最低级别，完全控制
  },
};

console.log('场景 1: 首次使用');
console.log('  推荐: Level 0 (SUGGEST)');
console.log('  原因: 完全控制，学习 Agent 行为\n');

// 场景 2: 日常开发
const dailyDevConfig: AgentConfig = {
  maxSteps: 10,
  maxRetries: 3,
  llm: { model: 'gpt-4' },
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
    enabled: true,
    patternMiningInterval: 10,
    minConfidence: 0.5,
    maxKnowledgeSize: 100,
  },
  autonomy: {
    level: AutonomyLevel.ASSIST, // 默认级别，平衡效率和安全
  },
};

console.log('场景 2: 日常开发');
console.log('  推荐: Level 1 (ASSIST)');
console.log('  原因: 平衡效率和安全性\n');

// 场景 3: 熟悉的项目
const familiarProjectConfig: AgentConfig = {
  maxSteps: 20,
  maxRetries: 5,
  llm: { model: 'gpt-4' },
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
    enabled: true,
    patternMiningInterval: 10,
    minConfidence: 0.5,
    maxKnowledgeSize: 100,
  },
  autonomy: {
    level: AutonomyLevel.AUTO, // 高级别，提高效率
    maxAutoSteps: 50,
  },
};

console.log('场景 3: 熟悉的项目');
console.log('  推荐: Level 2 (AUTO)');
console.log('  原因: 信任 Agent，提高效率\n');

// 场景 4: 批量处理
const batchProcessConfig: AgentConfig = {
  maxSteps: 50,
  maxRetries: 10,
  llm: { model: 'gpt-4' },
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
    enabled: true,
    patternMiningInterval: 10,
    minConfidence: 0.5,
    maxKnowledgeSize: 100,
  },
  autonomy: {
    level: AutonomyLevel.AUTONOMOUS, // 最高级别，完全自主
    maxAutoSteps: 100,
    enableSafetyBoundaries: false, // 禁用安全边界以提高速度
  },
};

console.log('场景 4: 批量处理');
console.log('  推荐: Level 3 (AUTONOMOUS)');
console.log('  原因: 完全自主，快速处理\n');

// ========================================
// 示例 7: 级别对比表
// ========================================

console.log('=== 示例 7: 级别对比表 ===\n');

const levels = [
  AutonomyLevel.SUGGEST,
  AutonomyLevel.ASSIST,
  AutonomyLevel.AUTO,
  AutonomyLevel.AUTONOMOUS,
];

levels.forEach(level => {
  const tempManager = new AutonomyManager({ level });
  const config = tempManager.getConfig();
  
  console.log(`Level ${level} - ${AutonomyManager.getLevelName(level)}`);
  console.log(`  描述: ${AutonomyManager.getLevelDescription(level)}`);
  console.log(`  需确认操作: ${config.requireConfirmation?.length ?? 0} 个`);
  console.log(`  禁止操作: ${config.forbiddenActions?.length ?? 0} 个`);
  console.log(`  安全边界: ${config.enableSafetyBoundaries ? '启用' : '禁用'}`);
  console.log();
});

console.log('=== 示例演示完成 ===\n');

console.log('💡 使用建议:\n');
console.log('1. 首次使用从 Level 0 (SUGGEST) 开始');
console.log('2. 逐步提升级别，建立对 Agent 的信任');
console.log('3. 根据项目熟悉度和任务重要性选择级别');
console.log('4. 关键代码使用低级别，批量任务使用高级别');
console.log('5. 启用安全边界以防止意外操作');
console.log('6. 定期检查和调整自主性配置');
console.log();
