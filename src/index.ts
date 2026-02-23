/**
 * SWE-Agent-Node - Main Entry
 * 导出公共 API
 */

// 核心类
export { Agent } from './agent'
export { GitEnv } from './git-env'
export { ShellEnv } from './shell-env'
export { CodeSearch } from './code-search'
export { CodeModifier, createModificationFromSnippet, createFileModification, deleteFileModification } from './code-modifier'
export { LLMClient, BUILTIN_TOOLS } from './llm-client'
export { EvolutionStore } from './evolution-store'
export { IssueParser } from './issue-parser'
export type { ParsedIssue, IssueType, Severity, ErrorStackFrame } from './issue-parser'

// 工具函数
export {
  retry,
  retryWithTimeout,
  withTimeout,
  calculateBackoff,
  delay,
  isRetryableError,
  CircuitBreaker,
  executeBatch,
} from './retry'
export type { RetryConfig } from './retry'

// 类型
export * from './types'

// 导入类型用于工具函数
import type { AgentConfig, Issue, Result } from './types'
import { Agent } from './agent'
import { GitEnv } from './git-env'

// 工具函数
export function createAgent(config: Partial<AgentConfig>): Agent {
  const defaultConfig: AgentConfig = {
    maxSteps: 10,
    maxRetries: 3,
    llm: {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 4000,
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
      enabled: true,
      patternMiningInterval: 10,
      minConfidence: 0.5,
      maxKnowledgeSize: 1000,
    },
  }

  return new Agent({ ...defaultConfig, ...config })
}

/**
 * 快速修复 Issue
 */
export async function fixIssue(
  issue: string | Issue,
  repoPath: string = '.',
  options?: {
    model?: string
    enableEvolution?: boolean
  }
): Promise<Result> {
  const gitEnv = new GitEnv()
  const repo = await gitEnv.open(repoPath)

  const agent = createAgent({
    llm: {
      model: options?.model || 'gpt-4',
    },
    evolution: {
      enabled: options?.enableEvolution ?? true,
      patternMiningInterval: 10,
      minConfidence: 0.5,
      maxKnowledgeSize: 1000,
    },
  })

  const issueData: Issue = typeof issue === 'string'
    ? {
        id: `local-${Date.now()}`,
        title: issue.split('\n')[0],
        body: issue,
      }
    : issue

  return await agent.solve(issueData, repo)
}
