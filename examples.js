/**
 * 使用示例
 */

const { Agent, GitEnv, ShellEnv, CodeSearch, LLMClient, EvolutionStore, fixIssue } = require('./dist')

// ==================== 示例 1: 快速修复 ====================

async function example1_QuickFix() {
  console.log('=== 示例 1: 快速修复 Issue ===\n')

  const result = await fixIssue(
    '用户登录时如果密码包含特殊字符会报错',
    './test-repo',
    { model: 'gpt-4', enableEvolution: true }
  )

  console.log('结果:', result.success ? '✅ 成功' : '❌ 失败')
  console.log('摘要:', result.summary)
  if (result.commitHash) {
    console.log('Commit:', result.commitHash)
  }
}

// ==================== 示例 2: 完整流程 ====================

async function example2_FullProcess() {
  console.log('=== 示例 2: 完整修复流程 ===\n')

  // 1. 初始化 Git 环境
  const gitEnv = new GitEnv()
  const repo = await gitEnv.clone('https://github.com/user/test-repo.git')
  console.log('✅ 仓库已克隆:', repo.path)

  // 2. 分析项目
  const structure = await gitEnv.analyzeStructure()
  console.log('✅ 项目结构分析完成')
  console.log('  - 源代码目录:', structure.srcDir)
  console.log('  - 测试目录:', structure.testDir)

  const techStack = await gitEnv.detectTechStack()
  console.log('✅ 技术栈检测完成')
  console.log('  - 语言:', techStack.language)
  console.log('  - 框架:', techStack.framework)

  // 3. 配置 Agent
  const agent = new Agent({
    maxSteps: 10,
    maxRetries: 3,
    llm: { model: 'gpt-4', temperature: 0.7 },
    evolution: { enabled: true },
  })

  // 4. 监听事件
  agent.on('step:start', (event) => {
    console.log(`\n▶ ${event.data.type}`)
  })

  agent.on('step:end', (event) => {
    console.log(`  ✅ 完成 (${event.data.duration}ms)`)
  })

  agent.on('step:error', (event) => {
    console.log(`  ❌ 错误: ${event.data.error}`)
  })

  // 5. 解决 Issue
  const issue = {
    id: 'issue-001',
    title: '修复文件上传功能',
    body: `
      问题描述：
      - 上传文件时如果文件名包含中文会失败
      - 错误信息: Invalid filename
      - 影响版本: v1.2.0
    `,
  }

  const result = await agent.solve(issue, repo)
  console.log('\n=== 最终结果 ===')
  console.log('成功:', result.success ? '✅' : '❌')
  console.log('摘要:', result.summary)
}

// ==================== 示例 3: 代码搜索 ====================

async function example3_CodeSearch() {
  console.log('=== 示例 3: 代码搜索 ===\n')

  const search = new CodeSearch('./test-repo')

  // 按关键词搜索
  const locations = await search.searchByKeywords(['upload', 'file', 'error'], {
    maxResults: 10,
    contextLines: 5,
  })

  console.log(`找到 ${locations.length} 个匹配位置:`)
  locations.forEach((loc, i) => {
    console.log(`\n${i + 1}. ${loc.file}:${loc.line}`)
    console.log('---')
    console.log(loc.context?.substring(0, 200) + '...')
  })

  // 搜索函数定义
  const functions = await search.searchFunction('uploadFile')
  console.log(`\n找到 ${functions.length} 个函数定义`)

  // 搜索错误信息
  const errors = await search.searchError('Invalid filename')
  console.log(`找到 ${errors.length} 个相关错误`)
}

// ==================== 示例 4: LLM 分析 ====================

async function example4_LLMAnalysis() {
  console.log('=== 示例 4: LLM 代码分析 ===\n')

  const llm = new LLMClient({
    model: 'gpt-4',
    temperature: 0.7,
  })

  const code = `
function uploadFile(file) {
  const filename = file.name
  if (!filename.match(/^[a-zA-Z0-9.-]+$/)) {
    throw new Error('Invalid filename')
  }
  // ... 上传逻辑
}
`

  // 分析代码
  const analysis = await llm.analyzeCode(
    code,
    '这个函数有什么问题？如何修复？'
  )
  console.log('分析结果:')
  console.log(analysis)

  // 生成修复建议
  const fix = await llm.suggestFix(
    '文件名包含中文时会抛出错误',
    code
  )
  console.log('\n修复建议:')
  console.log('分析:', fix.analysis)
  console.log('根本原因:', fix.rootCause)
  console.log('解决方案:', fix.solution)
  console.log('\n修改后代码:')
  console.log(fix.modifiedCode)
}

// ==================== 示例 5: 进化学习 ====================

async function example5_Evolution() {
  console.log('=== 示例 5: 进化学习 ===\n')

  const store = new EvolutionStore('./evolution-store')

  // 查看统计
  const stats = store.getStats()
  console.log('进化统计:')
  console.log(`  - 总执行次数: ${stats.totalTrajectories}`)
  console.log(`  - 成功率: ${(stats.successfulTrajectories / stats.totalTrajectories * 100 || 0).toFixed(1)}%`)
  console.log(`  - 学习的模式: ${stats.totalPatterns}`)
  console.log(`  - 知识库条目: ${stats.totalKnowledge}`)
  console.log(`  - 平均置信度: ${(stats.averageConfidence * 100).toFixed(1)}%`)

  // 查找相关模式
  const patterns = store.findMatchingPatterns(['upload', 'file', 'error'])
  console.log(`\n找到 ${patterns.length} 个相关模式:`)
  patterns.forEach(p => {
    console.log(`  [${p.type}] ${p.trigger}`)
    console.log(`    → ${p.outcome}`)
    console.log(`    置信度: ${(p.confidence * 100).toFixed(1)}%`)
  })

  // 搜索知识库
  const knowledge = store.searchKnowledge('文件上传错误', 'bug-fix')
  console.log(`\n找到 ${knowledge.length} 条相关知识:`)
  knowledge.forEach(k => {
    console.log(`  [${k.category}] ${k.problem}`)
    console.log(`    解决方案: ${k.solution}`)
    console.log(`    评分: ${k.score}/10`)
  })

  // 运行模式挖掘
  console.log('\n运行模式挖掘...')
  const newPatterns = await store.minePatterns()
  console.log(`发现 ${newPatterns.length} 个新模式`)

  // 提取知识
  const newKnowledge = await store.extractKnowledgeFromSuccess()
  console.log(`提取 ${newKnowledge.length} 条新知识`)

  // 优化策略
  await store.optimizeStrategy()
  console.log('策略已优化')
}

// ==================== 示例 6: Shell 操作 ====================

async function example6_ShellOperations() {
  console.log('=== 示例 6: Shell 操作 ===\n')

  const shell = new ShellEnv('./test-repo')

  // 运行测试
  console.log('运行测试...')
  const testResult = await shell.runTests()
  console.log(`测试结果: ${testResult.passed}/${testResult.total} 通过`)
  if (testResult.failed > 0) {
    console.log(`\n失败的测试:`)
    testResult.failures?.forEach(f => {
      console.log(`  - ${f.test}`)
      console.log(`    ${f.message}`)
    })
  }

  // 代码检查
  console.log('\n运行 Lint...')
  const lintResult = await shell.lint()
  if (lintResult.success) {
    console.log('✅ Lint 通过')
  } else {
    console.log('⚠️  Lint 问题:')
    console.log(lintResult.stdout)
  }

  // 构建项目
  console.log('\n构建项目...')
  const buildResult = await shell.build()
  if (buildResult.success) {
    console.log('✅ 构建成功')
  } else {
    console.log('❌ 构建失败')
    console.log(buildResult.stderr)
  }
}

// ==================== 运行示例 ====================

async function main() {
  try {
    // 选择要运行的示例
    const example = process.argv[2] || '1'

    switch (example) {
      case '1':
        await example1_QuickFix()
        break
      case '2':
        await example2_FullProcess()
        break
      case '3':
        await example3_CodeSearch()
        break
      case '4':
        await example4_LLMAnalysis()
        break
      case '5':
        await example5_Evolution()
        break
      case '6':
        await example6_ShellOperations()
        break
      default:
        console.log('用法: node examples.js [1-6]')
        console.log('  1 - 快速修复')
        console.log('  2 - 完整流程')
        console.log('  3 - 代码搜索')
        console.log('  4 - LLM 分析')
        console.log('  5 - 进化学习')
        console.log('  6 - Shell 操作')
    }
  } catch (error) {
    console.error('错误:', error)
    process.exit(1)
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main()
}

module.exports = {
  example1_QuickFix,
  example2_FullProcess,
  example3_CodeSearch,
  example4_LLMAnalysis,
  example5_Evolution,
  example6_ShellOperations,
}
