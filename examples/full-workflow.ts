/**
 * SWE-Agent-Node 完整修复流程示例
 * 
 * 演示从问题分析到代码修复的完整流程
 */

import { 
  Agent, 
  GitEnv, 
  CodeSearch, 
  CodeModifier,
  EvolutionStore,
  createModificationFromSnippet
} from '../src';
import type { Issue, CodeModification } from '../src/types';

async function demonstrateFullFixWorkflow() {
  console.log('=== SWE-Agent-Node 完整修复流程演示 ===\n');

  // 1. 初始化环境
  console.log('📦 步骤 1: 初始化环境');
  const gitEnv = new GitEnv();
  const repo = await gitEnv.open('./');
  console.log(`   仓库路径: ${repo.path}\n`);

  // 2. 定义问题
  console.log('🐛 步骤 2: 定义问题');
  const issue: Issue = {
    id: 'demo-issue-001',
    title: '示例：修复类型定义导出',
    body: `
      当前 src/types.ts 中的某些类型没有被正确导出，
      导致外部模块无法使用这些类型。
      
      错误信息：
      Error: Cannot find name 'Pattern'
    `,
    labels: ['bug', 'typescript'],
    keywords: ['export', 'types', 'Pattern', 'typescript'],
    errorTrace: 'Error: Cannot find name \'Pattern\'',
  };
  console.log(`   问题: ${issue.title}\n`);

  // 3. 代码搜索
  console.log('🔍 步骤 3: 搜索相关代码');
  const searcher = new CodeSearch(repo.path);
  
  // 搜索关键词
  const keywordResults = await searcher.searchByKeywords(issue.keywords || [], {
    maxResults: 10,
    contextLines: 5,
  });
  console.log(`   找到 ${keywordResults.length} 个相关位置\n`);

  // 4. 获取代码片段
  if (keywordResults.length > 0) {
    console.log('📄 步骤 4: 获取代码上下文');
    const firstResult = keywordResults[0];
    const snippet = await searcher.getSnippet(
      firstResult.file,
      Math.max(1, (firstResult.line || 1) - 5),
      (firstResult.line || 1) + 5
    );
    console.log(`   文件: ${snippet.file}`);
    console.log(`   语言: ${snippet.language}`);
    console.log(`   内容预览:\n${snippet.content.slice(0, 200)}...\n`);
  }

  // 5. 准备修改
  console.log('📝 步骤 5: 准备代码修改');
  const modifications: CodeModification[] = [
    {
      file: 'src/index.ts',
      type: 'modify',
      oldContent: "// 导出类型",
      newContent: "// 导出所有类型\nexport * from './types';",
      description: '添加类型导出',
    },
  ];
  console.log(`   准备了 ${modifications.length} 个修改\n`);

  // 6. 预览修改
  console.log('👀 步骤 6: 预览修改');
  const modifier = new CodeModifier(repo.path);
  const preview = modifier.preview(modifications);
  console.log(preview.slice(0, 500) + '...\n');

  // 7. 应用修改（示例中不实际应用）
  console.log('⚡ 步骤 7: 应用修改 (dry run)');
  console.log('   在实际场景中会调用:');
  console.log('   await modifier.applyModifications(modifications);\n');

  // 8. 查看进化统计
  console.log('📊 步骤 8: 查看进化统计');
  try {
    const store = new EvolutionStore('./evolution-store');
    const stats = store.getStats();
    
    console.log(`   总轨迹数: ${stats.totalTrajectories}`);
    console.log(`   成功轨迹: ${stats.successfulTrajectories}`);
    console.log(`   学习模式: ${stats.totalPatterns}`);
    console.log(`   知识条目: ${stats.totalKnowledge}`);
    console.log(`   平均置信度: ${(stats.averageConfidence * 100).toFixed(1)}%`);
  } catch {
    console.log('   (进化存储为空)');
  }

  console.log('\n✅ 演示完成!');
  
  console.log('\n📖 完整使用方式:');
  console.log(`
    // 使用 Agent 自动完成整个流程
    const agent = new Agent({
      maxSteps: 10,
      llm: { model: 'gpt-4' },
      evolution: { enabled: true },
    });

    const result = await agent.solve(issue, repo);
    
    if (result.success) {
      console.log('修复成功:', result.commitHash);
    }
  `);
}

// 运行演示
demonstrateFullFixWorkflow().catch(console.error);
