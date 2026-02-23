/**
 * SWE-Agent-Node 进化学习示例
 * 
 * 演示如何使用 EvolutionStore 进行经验学习和模式挖掘
 */

import { EvolutionStore } from '../src';

function main() {
  console.log('=== SWE-Agent-Node 进化学习示例 ===\n');

  const store = new EvolutionStore('./evolution-store');

  // 1. 查看统计信息
  const stats = store.getStats();
  console.log('📊 当前统计:');
  console.log(`   轨迹总数: ${stats.totalTrajectories}`);
  console.log(`   成功: ${stats.successfulTrajectories}`);
  console.log(`   失败: ${stats.failedTrajectories}`);
  console.log(`   模式: ${stats.totalPatterns}`);
  console.log(`   知识: ${stats.totalKnowledge}\n`);

  // 2. 查找匹配的模式
  const keywords = ['TypeError', 'undefined'];
  console.log(`🔍 查找模式 (关键词: ${keywords.join(', ')}):`);
  
  const patterns = store.findMatchingPatterns(keywords);
  patterns.slice(0, 3).forEach((p, i) => {
    console.log(`\n   模式 ${i + 1}:`);
    console.log(`   类型: ${p.type}`);
    console.log(`   触发: ${p.trigger}`);
    console.log(`   行动: ${p.action}`);
    console.log(`   结果: ${p.outcome}`);
    console.log(`   置信度: ${(p.confidence * 100).toFixed(0)}%`);
    console.log(`   使用次数: ${p.usage}`);
  });

  // 3. 搜索知识库
  console.log('\n\n📚 搜索知识库:');
  
  const knowledge = store.searchKnowledge('undefined', 'bug-fix');
  knowledge.slice(0, 3).forEach((k, i) => {
    console.log(`\n   知识 ${i + 1}:`);
    console.log(`   问题: ${k.problem}`);
    console.log(`   解决: ${k.solution}`);
    console.log(`   评分: ${k.score}/10`);
    console.log(`   标签: ${k.tags.join(', ')}`);
  });

  // 4. 获取策略
  const strategy = store.getStrategy();
  console.log('\n\n⚙️ 当前策略:');
  console.log(`   搜索权重:`);
  Object.entries(strategy.searchWeights).forEach(([key, value]) => {
    console.log(`     ${key}: ${value}`);
  });
  console.log(`   首选工具: ${strategy.preferredTools.join(', ')}`);

  // 5. 模式挖掘建议
  if (stats.totalTrajectories >= 10) {
    console.log('\n\n💡 建议运行模式挖掘以发现新的模式');
    console.log('   运行: swe-node learn --mine');
  } else {
    console.log(`\n\n💡 还需要 ${10 - stats.totalTrajectories} 个轨迹才能进行模式挖掘`);
  }

  console.log('\n✅ 示例完成');
}

main();
