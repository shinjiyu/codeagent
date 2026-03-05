#!/usr/bin/env node
/**
 * SWE-Agent-Node - CLI
 * 命令行入口
 */

import { Command } from 'commander'
import chalk from 'chalk'
import { Agent } from './agent'
import { GitEnv } from './git-env'
import { ShellEnv } from './shell-env'
import { EvolutionStore } from './evolution-store'
import type { AgentConfig, Issue } from './types'

const program = new Command()

program
  .name('swe-node')
  .description('Self-evolving software engineering agent for Node.js')
  .version('0.1.0')

// ==================== fix 命令 ====================

program
  .command('fix <issue>')
  .description('Fix a GitHub issue or problem description')
  .option('-r, --repo <path>', 'Path to the repository', '.')
  .option('-m, --model <model>', 'LLM model to use', 'glm-5')
  .option('--endpoint <url>', 'LLM API endpoint', 'https://open.bigmodel.cn/api/coding/paas/v4')
  .option('--no-evolution', 'Disable self-evolution', false)
  .option('-v, --verbose', 'Enable verbose output', false)
  .action(async (issue: string, options) => {
    console.log(chalk.blue.bold('🤖 SWE-Agent-Node'))
    console.log(chalk.gray('━'.repeat(50)))

    try {
      // 初始化配置
      const config: AgentConfig = {
        maxSteps: 10,
        maxRetries: 3,
        llm: {
          model: options.model,
          temperature: 0.7,
          maxTokens: 4000,
          endpoint: options.endpoint,
        },
        git: {
          defaultBranch: 'main',
          commitTemplate: 'fix: {issue}',
          autoPush: false,
        },
        test: {
          command: 'npm test',
          pattern: '**/*.test.{ts,js}',
          timeout: 60000,
        },
        evolution: {
          enabled: !options.noEvolution,
          patternMiningInterval: 10,
          minConfidence: 0.5,
          maxKnowledgeSize: 1000,
        },
      }

      // 解析 Issue
      const issueData = parseIssueInput(issue)
      console.log(chalk.cyan('Issue:'), issueData.title)

      // 打开仓库
      const gitEnv = new GitEnv()
      const repo = await gitEnv.open(options.repo)
      console.log(chalk.cyan('Repository:'), repo.path)

      // 创建 Agent
      const agent = new Agent(config)

      // 设置事件监听
      setupEventListeners(agent, options.verbose)

      // 解决 Issue
      console.log(chalk.gray('\n🚀 Starting agent...\n'))
      const result = await agent.solve(issueData, repo)

      // 输出结果
      console.log(chalk.gray('\n' + '━'.repeat(50)))
      if (result.success) {
        console.log(chalk.green.bold('✅ Issue fixed successfully!'))
        if (result.commitHash) {
          console.log(chalk.cyan('Commit:'), result.commitHash)
        }
      } else {
        console.log(chalk.red.bold('❌ Failed to fix issue'))
        console.log(chalk.red(result.error))
      }
      console.log(chalk.gray('\nSummary:'), result.summary)

    } catch (error: any) {
      console.error(chalk.red.bold('\n❌ Error:'), error.message)
      process.exit(1)
    }
  })

// ==================== analyze 命令 ====================

program
  .command('analyze <repo>')
  .description('Analyze a repository structure and detect issues')
  .option('-o, --output <file>', 'Output file for the report')
  .action(async (repoPath: string, options) => {
    console.log(chalk.blue.bold('🔍 Repository Analysis'))
    console.log(chalk.gray('━'.repeat(50)))

    try {
      const gitEnv = new GitEnv()
      const repo = await gitEnv.open(repoPath)

      // 分析项目结构
      console.log(chalk.cyan('\n📁 Project Structure:'))
      const structure = await gitEnv.analyzeStructure()
      console.log(`  Source: ${structure.srcDir || 'Not found'}`)
      console.log(`  Tests: ${structure.testDir || 'Not found'}`)
      console.log(`  Config: ${structure.configFile || 'Not found'}`)
      console.log(`  Total files: ${structure.files.length}`)

      // 检测技术栈
      console.log(chalk.cyan('\n🛠️  Tech Stack:'))
      const techStack = await gitEnv.detectTechStack()
      console.log(`  Language: ${techStack.language}`)
      if (techStack.framework) console.log(`  Framework: ${techStack.framework}`)
      if (techStack.testFramework) console.log(`  Testing: ${techStack.testFramework}`)
      if (techStack.buildTool) console.log(`  Build: ${techStack.buildTool}`)

      // 运行代码检查
      console.log(chalk.cyan('\n🔬 Running checks...'))
      const shell = new ShellEnv(repoPath)

      const lintResult = await shell.lint()
      if (lintResult.success) {
        console.log(chalk.green('  ✅ Lint passed'))
      } else {
        console.log(chalk.yellow('  ⚠️  Lint issues found'))
      }

      const testResult = await shell.runTests()
      if (testResult.failed === 0) {
        console.log(chalk.green(`  ✅ All tests passed (${testResult.passed}/${testResult.total})`))
      } else {
        console.log(chalk.yellow(`  ⚠️  Some tests failed (${testResult.failed}/${testResult.total})`))
      }

      // 生成报告
      const report = {
        path: repoPath,
        structure,
        techStack,
        checks: {
          lint: lintResult.success,
          tests: {
            passed: testResult.passed,
            failed: testResult.failed,
            total: testResult.total,
          },
        },
        analyzedAt: new Date().toISOString(),
      }

      if (options.output) {
        const fs = await import('fs')
        fs.writeFileSync(options.output, JSON.stringify(report, null, 2))
        console.log(chalk.cyan(`\n📄 Report saved to:`), options.output)
      }

    } catch (error: any) {
      console.error(chalk.red.bold('\n❌ Error:'), error.message)
      process.exit(1)
    }
  })

// ==================== learn 命令 ====================

program
  .command('learn')
  .description('Learn from past executions and optimize strategies')
  .option('-s, --store <path>', 'Evolution store path', './evolution-store')
  .option('--mine', 'Run pattern mining', false)
  .option('--stats', 'Show evolution statistics', false)
  .action(async (options) => {
    console.log(chalk.blue.bold('🧠 Evolution Learning'))
    console.log(chalk.gray('━'.repeat(50)))

    try {
      const store = new EvolutionStore(options.store)

      if (options.stats) {
        const stats = store.getStats()
        console.log(chalk.cyan('\n📊 Evolution Statistics:'))
        console.log(`  Total executions: ${stats.totalTrajectories}`)
        console.log(`  Success rate: ${((stats.successfulTrajectories / stats.totalTrajectories) * 100 || 0).toFixed(1)}%`)
        console.log(`  Patterns learned: ${stats.totalPatterns}`)
        console.log(`    - Success patterns: ${stats.successPatterns}`)
        console.log(`    - Failure patterns: ${stats.failurePatterns}`)
        console.log(`  Knowledge entries: ${stats.totalKnowledge}`)
        console.log(`  Average confidence: ${(stats.averageConfidence * 100).toFixed(1)}%`)
      }

      if (options.mine) {
        console.log(chalk.cyan('\n⛏️  Mining patterns...'))
        const patterns = await store.minePatterns()
        console.log(chalk.green(`  ✅ Found ${patterns.length} new patterns`))

        console.log(chalk.cyan('\n📚 Extracting knowledge...'))
        const knowledge = await store.extractKnowledgeFromSuccess()
        console.log(chalk.green(`  ✅ Extracted ${knowledge.length} new knowledge entries`))

        console.log(chalk.cyan('\n🔧 Optimizing strategy...'))
        await store.optimizeStrategy()
        console.log(chalk.green('  ✅ Strategy optimized'))
      }

    } catch (error: any) {
      console.error(chalk.red.bold('\n❌ Error:'), error.message)
      process.exit(1)
    }
  })

// ==================== 辅助函数 ====================

function parseIssueInput(input: string): Issue {
  // 如果是 GitHub Issue URL
  if (input.startsWith('http') && input.includes('github.com')) {
    return {
      id: extractIssueId(input),
      url: input,
      title: 'GitHub Issue',
      body: `GitHub Issue: ${input}`,
    }
  }

  // 否则当作问题描述
  return {
    id: `local-${Date.now()}`,
    title: input.split('\n')[0], // 第一行作为标题
    body: input,
  }
}

function extractIssueId(url: string): string {
  const match = url.match(/issues\/(\d+)/)
  return match ? `gh-${match[1]}` : `url-${Date.now()}`
}

function setupEventListeners(agent: Agent, verbose: boolean) {
  agent.on('step:start', (event: any) => {
    console.log(chalk.gray(`\n▶ Step: ${event.data.type}`))
  })

  agent.on('step:end', (event: any) => {
    if (verbose && event.data.output) {
      console.log(chalk.gray('  Output:'), truncate(event.data.output.toString(), 100))
    }
    console.log(chalk.green(`  ✅ Completed (${event.data.duration}ms)`))
  })

  agent.on('step:error', (event: any) => {
    console.log(chalk.red(`  ❌ Error: ${event.data.error}`))
  })
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength) + '...'
}

// ==================== 启动 ====================

program.parse()
