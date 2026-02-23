/**
 * SWE-Agent-Node 基础使用示例
 * 
 * 演示如何使用 SWE-Agent-Node 修复代码问题
 */

import { Agent, GitEnv, EvolutionStore } from '../src';

async function main() {
  console.log('=== SWE-Agent-Node 基础示例 ===\n');

  // 1. 初始化 Git 环境
  const gitEnv = new GitEnv();
  const repo = await gitEnv.open('./');
  
  console.log('📁 仓库信息:');
  console.log(`   路径: ${repo.path}`);
  console.log(`   分支: ${repo.branch || 'main'}\n`);

  // 2. 创建 Agent
  const agent = new Agent({
    maxSteps: 10,
    maxRetries: 3,
    llm: {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 4000,
    },
    git: {
      defaultBranch: 'main',
      commitTemplate: 'fix: {message}',
      autoPush: false,
    },
    evolution: {
      enabled: true,
      patternMiningInterval: 10,
      minConfidence: 0.5,
    },
  });

  // 3. 定义问题
  const issue = {
    id: 'example-issue-001',
    title: '示例：添加类型导出',
    body: `
      当前 src/index.ts 没有导出所有类型定义。
      需要导出 types.ts 中的所有类型供外部使用。
    `,
    labels: ['enhancement', 'typescript'],
    keywords: ['export', 'types', 'typescript'],
  };

  console.log('🐛 Issue:');
  console.log(`   ${issue.title}\n`);

  // 4. 执行修复
  console.log('⏳ 开始修复...\n');
  
  const result = await agent.solve(issue, repo);

  // 5. 输出结果
  console.log('\n=== 执行结果 ===\n');
  
  if (result.success) {
    console.log('✅ 修复成功!');
    console.log(`📝 摘要: ${result.summary}`);
    
    if (result.commitHash) {
      console.log(`🔗 Commit: ${result.commitHash}`);
    }
    
    console.log('\n📦 修改的文件:');
    result.modifications.forEach((mod, i) => {
      console.log(`   ${i + 1}. [${mod.type}] ${mod.file}`);
    });
  } else {
    console.log('❌ 修复失败');
    console.log(`📝 原因: ${result.error}`);
  }

  // 6. 查看进化统计
  const store = new EvolutionStore('./evolution-store');
  const stats = store.getStats();
  
  console.log('\n📊 进化统计:');
  console.log(`   总轨迹数: ${stats.totalTrajectories}`);
  console.log(`   成功轨迹: ${stats.successfulTrajectories}`);
  console.log(`   学习模式: ${stats.totalPatterns}`);
  console.log(`   知识条目: ${stats.totalKnowledge}`);
  console.log(`   平均置信度: ${(stats.averageConfidence * 100).toFixed(1)}%`);
}

main().catch(console.error);
