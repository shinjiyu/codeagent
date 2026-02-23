/**
 * SWE-Agent-Node - Core Agent
 * 主要的 Agent 类，编排所有子模块
 */

import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs'
import * as path from 'path'
import { CodeSearch } from './code-search'
import { CodeModifier } from './code-modifier'
import { ShellEnv } from './shell-env'
import { EvolutionStore } from './evolution-store'
import type {
  AgentConfig,
  AgentEvent,
  AgentEventType,
  CodeLocation,
  CodeModification,
  CodeSnippet,
  ExecResult,
  Issue,
  Knowledge,
  LLMRequest,
  LLMResponse,
  Pattern,
  Repository,
  Result,
  Step,
  StepType,
  Strategy,
  TechStack,
  TestResult,
  Trajectory,
  TrajectoryMetadata,
} from './types'

export class Agent {
  private config: AgentConfig
  private trajectory: Trajectory | null = null
  private eventListeners: Map<AgentEventType, Function[]> = new Map()
  private strategy: Strategy
  private shellEnv: ShellEnv
  private evolutionStore: EvolutionStore | null = null

  constructor(config: AgentConfig) {
    this.config = config
    this.strategy = this.getDefaultStrategy()
    this.shellEnv = new ShellEnv()
    
    if (config.evolution.enabled) {
      this.evolutionStore = new EvolutionStore()
    }
  }

  /**
   * 主入口：解决一个 Issue
   */
  async solve(issue: Issue, repo: Repository): Promise<Result> {
    // 初始化轨迹记录
    this.trajectory = this.initTrajectory(issue, repo)
    const startTime = Date.now()

    try {
      // 1. 解析 Issue
      const parsedIssue = await this.executeStep(
        'parse-issue',
        { issue },
        async () => await this.parseIssue(issue)
      )

      // 2. 分析仓库
      const repoAnalysis = await this.executeStep(
        'analyze-repo',
        { repo },
        async () => await this.analyzeRepo(repo)
      )

      // 3. 搜索相关代码
      const locations = await this.executeStep(
        'search-code',
        { keywords: parsedIssue.keywords },
        async () => await this.searchCode(repo, parsedIssue.keywords || [])
      )

      if (locations.length === 0) {
        throw new Error('No relevant code found')
      }

      // 4. 生成修复方案
      const modifications = await this.executeStep(
        'generate-fix',
        { locations },
        async () => await this.generateFix(parsedIssue, locations, repo)
      )

      // 5. 应用修改
      await this.executeStep(
        'apply-modification',
        { modifications },
        async () => await this.applyModifications(repo, modifications)
      )

      // 6. 运行测试
      const testResult = await this.executeStep(
        'run-tests',
        { modifications },
        async () => await this.runTests(repo, modifications)
      )

      if (!testResult || testResult.failed === 0) {
        // 7. 提交更改
        const commitHash = await this.executeStep(
          'commit-changes',
          { modifications },
          async () => await this.commitChanges(repo, modifications, parsedIssue)
        )

        // 成功！
        const result: Result = {
          success: true,
          modifications,
          testResults: testResult,
          commitHash,
          summary: `Successfully fixed issue: ${issue.title}`,
        }

        this.trajectory.result = result
        return result
      } else {
        // 测试失败，需要回滚
        await this.rollback(repo)
        throw new Error(`Tests failed: ${testResult.failed} failures`)
      }
    } catch (error: any) {
      const result: Result = {
        success: false,
        modifications: [],
        summary: `Failed to fix issue: ${error.message}`,
        error: error.message,
      }
      this.trajectory.result = result
      throw error
    } finally {
      // 记录元数据
      const endTime = Date.now()
      this.trajectory.metadata.duration = endTime - startTime

      // 保存轨迹
      await this.saveTrajectory()

      // 学习和进化
      if (this.config.evolution.enabled) {
        await this.learn()
      }
    }
  }

  /**
   * 从经验中学习
   */
  async learn(): Promise<void> {
    if (!this.trajectory) return

    // 提取模式
    const patterns = this.extractPatterns(this.trajectory)
    for (const pattern of patterns) {
      await this.savePattern(pattern)
    }

    // 如果是成功的解决方案，添加到知识库
    if (this.trajectory.result.success) {
      const knowledge = this.extractKnowledge(this.trajectory)
      if (knowledge) {
        await this.saveKnowledge(knowledge)
      }
    }

    // 触发策略优化
    await this.optimizeStrategy()
  }

  /**
   * 执行单步操作
   */
  private async executeStep<T>(
    type: StepType,
    input: any,
    action: () => Promise<T>
  ): Promise<T> {
    const stepId = uuidv4()
    const startTime = Date.now()

    this.emit('step:start', { stepId, type, input })

    try {
      const output = await action()
      const duration = Date.now() - startTime

      const step: Step = {
        id: stepId,
        type,
        input,
        output,
        timestamp: new Date(),
        duration,
        success: true,
      }

      this.trajectory?.steps.push(step)
      this.emit('step:end', { step })

      return output
    } catch (error: any) {
      const duration = Date.now() - startTime

      const step: Step = {
        id: stepId,
        type,
        input,
        output: null,
        timestamp: new Date(),
        duration,
        success: false,
        error: error.message,
      }

      this.trajectory?.steps.push(step)
      this.emit('step:error', { step, error })

      throw error
    }
  }

  // ==================== 子模块方法（待实现）====================

  /**
   * 解析 Issue 提取关键信息
   */
  private async parseIssue(issue: Issue): Promise<Issue> {
    // TODO: 实现更智能的解析
    const keywords = this.extractKeywords(issue.body)
    const errorTrace = this.extractErrorTrace(issue.body)

    return {
      ...issue,
      keywords,
      errorTrace,
    }
  }

  /**
   * 分析仓库结构
   */
  private async analyzeRepo(repo: Repository): Promise<{
    structure: any
    techStack: TechStack
  }> {
    // TODO: 实现仓库分析
    return {
      structure: {},
      techStack: {
        language: 'typescript',
        testFramework: 'jest',
      },
    }
  }

  /**
   * 搜索相关代码
   */
  private async searchCode(
    repo: Repository,
    keywords: string[]
  ): Promise<CodeLocation[]> {
    const searcher = new CodeSearch(repo.path)
    
    // 搜索关键词匹配
    const locations = await searcher.searchByKeywords(keywords, {
      maxResults: 20,
      contextLines: 10,
    })

    // 如果有错误信息，搜索错误
    const errorLocations = keywords.filter(k => 
      k.includes('error') || k.includes('Error') || k.includes('exception')
    )

    for (const error of errorLocations) {
      const errorResults = await searcher.searchError(error)
      locations.push(...errorResults.slice(0, 5))
    }

    // 去重
    const seen = new Set<string>()
    return locations.filter(loc => {
      const key = `${loc.file}:${loc.line}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  /**
   * 生成修复方案
   */
  private async generateFix(
    issue: Issue,
    locations: CodeLocation[],
    repo: Repository
  ): Promise<CodeModification[]> {
    // TODO: 实现 LLM 驱动的修复生成
    return []
  }

  /**
   * 应用代码修改
   */
  private async applyModifications(
    repo: Repository,
    modifications: CodeModification[]
  ): Promise<void> {
    const modifier = new CodeModifier(repo.path)
    
    try {
      await modifier.applyModifications(modifications)
    } catch (error: any) {
      // 应用失败，回滚
      await modifier.rollback()
      throw new Error(`Failed to apply modifications: ${error.message}`)
    }
  }

  /**
   * 运行测试
   */
  private async runTests(
    repo: Repository,
    modifications: CodeModification[]
  ): Promise<TestResult | undefined> {
    // 设置工作目录
    this.shellEnv = new ShellEnv(repo.path)
    
    // 使用配置的测试命令
    const testCommand = this.config.test.command
    const testPattern = this.config.test.pattern
    
    try {
      const result = await this.shellEnv.runTests(testCommand, testPattern)
      return result
    } catch (error: any) {
      // 测试运行失败
      return {
        passed: 0,
        failed: 1,
        skipped: 0,
        total: 1,
        output: error.message,
        failures: [{
          test: 'test-execution',
          file: 'unknown',
          message: error.message,
        }],
      }
    }
  }

  /**
   * 提交更改
   */
  private async commitChanges(
    repo: Repository,
    modifications: CodeModification[],
    issue: Issue
  ): Promise<string> {
    // 设置工作目录
    this.shellEnv = new ShellEnv(repo.path)
    
    // Git add
    const files = modifications.map(m => m.file).join(' ')
    const addResult = await this.shellEnv.exec(`git add ${files}`)
    
    if (!addResult.success) {
      throw new Error(`Failed to stage changes: ${addResult.stderr}`)
    }
    
    // 生成提交消息
    const commitMessage = this.config.git.commitTemplate
      .replace('{message}', issue.title)
      .replace('{issue_id}', issue.id)
    
    // Git commit
    const commitResult = await this.shellEnv.exec(`git commit -m "${commitMessage}"`)
    
    if (!commitResult.success) {
      throw new Error(`Failed to commit changes: ${commitResult.stderr}`)
    }
    
    // 获取 commit hash
    const hashResult = await this.shellEnv.exec('git rev-parse HEAD')
    return hashResult.stdout.trim()
  }

  /**
   * 回滚更改
   */
  private async rollback(repo: Repository): Promise<void> {
    this.shellEnv = new ShellEnv(repo.path)
    
    try {
      // Git reset --hard 回滚所有更改
      await this.shellEnv.exec('git checkout .')
      await this.shellEnv.exec('git clean -fd')
    } catch (error) {
      console.error('Rollback failed:', error)
    }
  }

  // ==================== 辅助方法 ====================

  private initTrajectory(issue: Issue, repo: Repository): Trajectory {
    return {
      id: uuidv4(),
      issue,
      repo,
      steps: [],
      result: {
        success: false,
        modifications: [],
        summary: '',
      },
      metadata: {
        model: this.config.llm.model,
        duration: 0,
      },
      createdAt: new Date(),
    }
  }

  private extractKeywords(text: string): string[] {
    // 简单的关键词提取
    const words = text.toLowerCase().split(/\s+/)
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'being'])

    return words
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10)
  }

  private extractErrorTrace(text: string): string | undefined {
    // 提取错误堆栈
    const errorPattern = /Error:.*|at\s+.*\(.+\)/gs
    const matches = text.match(errorPattern)
    return matches ? matches.join('\n') : undefined
  }

  private extractPatterns(trajectory: Trajectory): Pattern[] {
    // TODO: 实现模式提取
    return []
  }

  private extractKnowledge(trajectory: Trajectory): Knowledge | null {
    // TODO: 实现知识提取
    return null
  }

  private getDefaultStrategy(): Strategy {
    return {
      searchWeights: {
        'function-name': 0.3,
        'error-message': 0.25,
        'variable-name': 0.2,
        'comment': 0.15,
        'import': 0.1,
      },
      promptTemplates: {},
      thresholds: {
        'min-confidence': 0.5,
        'max-retries': 3,
      },
      preferredTools: ['grep', 'find', 'git'],
      updatedAt: new Date(),
    }
  }

  // ==================== 持久化方法 ====================

  private async saveTrajectory(): Promise<void> {
    if (!this.evolutionStore || !this.trajectory) return
    
    await this.evolutionStore.saveTrajectory(this.trajectory)
  }

  private async savePattern(pattern: Pattern): Promise<void> {
    if (!this.evolutionStore) return
    
    await this.evolutionStore.savePattern(pattern)
  }

  private async saveKnowledge(knowledge: Knowledge): Promise<void> {
    if (!this.evolutionStore) return
    
    await this.evolutionStore.saveKnowledge(knowledge)
  }

  private async optimizeStrategy(): Promise<void> {
    if (!this.evolutionStore) return
    
    const patterns = this.evolutionStore.getAllPatterns()
    const successPatterns = patterns.filter(p => p.type === 'success' && p.confidence > 0.7)
    
    // 根据成功模式调整搜索权重
    for (const pattern of successPatterns) {
      // 增加相关权重
      const triggerWords = pattern.trigger.toLowerCase().split(/\s+/)
      for (const word of triggerWords) {
        if (this.strategy.searchWeights[word] !== undefined) {
          this.strategy.searchWeights[word] *= 1.1
        }
      }
    }
    
    await this.evolutionStore.updateStrategy(this.strategy)
  }

  // ==================== 事件系统 ====================

  on(event: AgentEventType, listener: Function): void {
    const listeners = this.eventListeners.get(event) || []
    listeners.push(listener)
    this.eventListeners.set(event, listeners)
  }

  private emit(event: AgentEventType, data: any): void {
    const listeners = this.eventListeners.get(event) || []
    const agentEvent: AgentEvent = {
      type: event,
      data,
      timestamp: new Date(),
    }
    listeners.forEach(listener => listener(agentEvent))
  }
}
