/**
 * SWE-Agent-Node - Core Agent
 * 主要的 Agent 类，编排所有子模块
 */

import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs'
import * as path from 'path'
import { CodeSearch } from './code-search'
import { CodeModifier } from './code-modifier'
import { LLMClient } from './llm-client'
import { ShellEnv } from './shell-env'
import { GitEnv } from './git-env'
import { EvolutionStore } from './evolution-store'
import { AutonomyManager, createDefaultAutonomyConfig } from './autonomy'
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
  private llmClient: LLMClient
  private evolutionStore: EvolutionStore | null = null
  private autonomyManager: AutonomyManager

  constructor(config: AgentConfig) {
    this.config = config
    this.strategy = this.getDefaultStrategy()
    this.shellEnv = new ShellEnv()
    this.llmClient = new LLMClient(config.llm)
    
    if (config.evolution.enabled) {
      this.evolutionStore = new EvolutionStore()
    }
    
    this.autonomyManager = new AutonomyManager(
      config.autonomy ?? createDefaultAutonomyConfig()
    )
  }

  /**
   * 主入口：解决一个 Issue（带自纠错重试）
   */
  async solve(issue: Issue, repo: Repository): Promise<Result> {
    this.trajectory = this.initTrajectory(issue, repo)
    const startTime = Date.now()
    const maxAttempts = this.config.maxRetries + 1
    const previousErrors: string[] = []

    try {
      // 1. 解析 Issue（只需做一次）
      const parsedIssue = await this.executeStep(
        'parse-issue',
        { issue },
        async () => await this.parseIssue(issue)
      )

      // 2. 分析仓库（只需做一次）
      await this.executeStep(
        'analyze-repo',
        { repo },
        async () => await this.analyzeRepo(repo)
      )

      // 3. 搜索相关代码（只需做一次）
      const locations = await this.executeStep(
        'search-code',
        { keywords: parsedIssue.keywords },
        async () => await this.searchCode(repo, parsedIssue.keywords || [])
      )

      if (locations.length === 0) {
        throw new Error('No relevant code found')
      }

      // 4-7. 生成→应用→测试→提交 的自纠错循环
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const isRetry = attempt > 1
        if (isRetry) {
          this.emit('step:start', { type: 'generate-fix', attempt, retry: true })
          console.log(`\n🔄 Retry attempt ${attempt}/${maxAttempts} — analyzing previous failure...`)
        }

        try {
          // 生成修复（重试时带上之前的失败信息）
          const modifications = await this.executeStep(
            'generate-fix',
            { locations, attempt, previousErrors },
            async () => await this.generateFix(parsedIssue, locations, repo, previousErrors)
          )

          if (modifications.length === 0) {
            const msg = 'No modifications generated'
            previousErrors.push(`Attempt ${attempt}: ${msg}`)
            if (attempt < maxAttempts) continue
            throw new Error(msg)
          }

          // 应用修改
          try {
            await this.executeStep(
              'apply-modification',
              { modifications, attempt },
              async () => await this.applyModifications(repo, modifications)
            )
          } catch (applyError: any) {
            await this.rollback(repo)
            previousErrors.push(`Attempt ${attempt} apply failed: ${applyError.message}`)
            if (attempt < maxAttempts) continue
            throw applyError
          }

          // 运行测试
          const testResult = await this.executeStep(
            'run-tests',
            { modifications, attempt },
            async () => await this.runTests(repo, modifications)
          )

          if (testResult && testResult.failed > 0) {
            await this.rollback(repo)
            const failMsg = `Tests failed: ${testResult.failed} failures` +
              (testResult.failures?.length ? ` — ${testResult.failures.map(f => f.message).join('; ')}` : '')
            previousErrors.push(`Attempt ${attempt}: ${failMsg}`)
            if (attempt < maxAttempts) continue
            throw new Error(failMsg)
          }

          // 提交
          const commitHash = await this.executeStep(
            'commit-changes',
            { modifications, attempt },
            async () => await this.commitChanges(repo, modifications, parsedIssue)
          )

          const result: Result = {
            success: true,
            modifications,
            testResults: testResult,
            commitHash,
            summary: `Successfully fixed issue: ${issue.title}` +
              (isRetry ? ` (after ${attempt} attempts)` : ''),
          }
          this.trajectory.result = result
          return result

        } catch (error: any) {
          if (attempt >= maxAttempts) throw error
          // 否则继续循环重试
        }
      }

      throw new Error('All retry attempts exhausted')
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
      const endTime = Date.now()
      this.trajectory.metadata.duration = endTime - startTime
      this.trajectory.metadata.retryCount = previousErrors.length

      await this.saveTrajectory()

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
    const gitEnv = new GitEnv()
    await gitEnv.open(repo.path)
    const structure = await gitEnv.analyzeStructure()
    const techStack = await gitEnv.detectTechStack()
    return { structure, techStack }
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
   * 生成修复方案（支持自纠错：将前次失败原因反馈给 LLM）
   */
  private async generateFix(
    issue: Issue,
    locations: CodeLocation[],
    repo: Repository,
    previousErrors: string[] = []
  ): Promise<CodeModification[]> {
    const searcher = new CodeSearch(repo.path)
    
    // 读取每个匹配位置的完整代码片段（带行号，帮助 LLM 精确定位）
    const codeContexts: string[] = []
    const fileContents = new Map<string, string>()
    const filesRead = new Set<string>()
    for (const loc of locations.slice(0, 5)) {
      if (filesRead.has(loc.file)) continue
      filesRead.add(loc.file)
      try {
        const filePath = path.isAbsolute(loc.file) ? loc.file : path.join(repo.path, loc.file)
        const fullContent = fs.readFileSync(filePath, 'utf-8')
        fileContents.set(loc.file, fullContent)
        
        const lines = fullContent.split('\n')
        const startLine = Math.max(0, (loc.line || 1) - 21)
        const endLine = Math.min(lines.length, (loc.line || 1) + 39)
        const numberedLines = lines.slice(startLine, endLine)
          .map((line, i) => `${String(startLine + i + 1).padStart(4)} | ${line}`)
          .join('\n')
        codeContexts.push(`--- ${loc.file} ---\n${numberedLines}`)
      } catch {
        if (loc.context) {
          codeContexts.push(`--- ${loc.file}:${loc.line} ---\n${loc.context}`)
        }
      }
    }

    if (codeContexts.length === 0) return []

    const errorFeedback = previousErrors.length > 0
      ? `\n## PREVIOUS FAILED ATTEMPTS\nThe following approaches were already tried and FAILED. You MUST try a DIFFERENT approach:\n${previousErrors.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n\nAnalyze why previous attempts failed and generate a corrected fix.\n`
      : ''

    const prompt = `You are fixing a code issue. Generate the MINIMAL fix — change as few lines as possible.

## Issue
Title: ${issue.title}
Description: ${issue.body}
${issue.errorTrace ? `\nError trace:\n${issue.errorTrace}` : ''}
${errorFeedback}
## Source code (with line numbers)
${codeContexts.join('\n\n')}

## Output format
Generate a JSON array with 1-3 modifications (fewer is better). Each modification:
- "file": relative file path (exactly as shown above)
- "type": "modify"
- "oldContent": the EXACT original lines to replace — copy them VERBATIM from the source code above, WITHOUT the line numbers. Include 2-3 lines of surrounding context so the match is unique. Preserve the exact whitespace/indentation.
- "newContent": the replacement code with the fix applied
- "description": one-line explanation

CRITICAL RULES:
1. Output ONLY a JSON array. No markdown, no explanation, no code fences.
2. Copy oldContent EXACTLY from the source — same indentation, same semicolons (or lack thereof), same quotes.
3. Keep modifications minimal — only change what's needed to fix the bug.
4. Each oldContent must be a UNIQUE substring of the file (include enough context lines).

Example: [{"file":"src/app.ts","type":"modify","oldContent":"    const result = calculate(x)\\n    return result","newContent":"    const result = calculate(x, y)\\n    return result","description":"pass missing parameter y"}]`

    const response = await this.llmClient.generateSimple(prompt, { task: 'bug-fix' })
    this.llmClient.clearHistory()

    // Parse LLM response
    let mods: any[] = []
    try {
      const jsonMatch = response.match(/\[[\s\S]*?\]/)
      if (!jsonMatch) return []
      mods = JSON.parse(jsonMatch[0])
      if (!Array.isArray(mods)) return []
    } catch {
      return []
    }

    // Post-process: clean, validate, and fix each modification
    const validMods: CodeModification[] = []
    const modifiedFiles = new Set<string>()
    for (const m of mods) {
      if (!m.file || !m.newContent || m.type !== 'modify') continue
      if (!m.oldContent || m.oldContent.trim() === '') continue
      if (modifiedFiles.has(m.file)) continue  // 同一文件只取第一个修改

      const fileContent = fileContents.get(m.file)
      if (!fileContent) continue

      // 清洗 LLM 输出：去掉行号前缀 (e.g. "  42 | code" → "code")
      const cleanOld = this.cleanLLMOutput(m.oldContent)
      const cleanNew = this.cleanLLMOutput(m.newContent)

      // 策略 1: 精确匹配清洗后的内容
      if (fileContent.includes(cleanOld)) {
        validMods.push({ file: m.file, type: 'modify', oldContent: cleanOld, newContent: cleanNew, description: m.description })
        modifiedFiles.add(m.file)
        continue
      }

      // 策略 2: 在文件中找到最接近的匹配区域
      const corrected = this.findBestMatch(fileContent, cleanOld)
      if (corrected) {
        validMods.push({ file: m.file, type: 'modify', oldContent: corrected, newContent: cleanNew, description: m.description })
        modifiedFiles.add(m.file)
      }
    }

    return validMods
  }

  /**
   * 清洗 LLM 输出中的行号前缀和 markdown 残留
   */
  private cleanLLMOutput(content: string): string {
    return content
      .split('\n')
      .map(line => {
        // 去掉 "  42 | code" 或 "42| code" 格式的行号前缀
        const lineNumMatch = line.match(/^\s*\d+\s*\|\s?(.*)$/)
        if (lineNumMatch) return lineNumMatch[1]
        return line
      })
      .join('\n')
      .replace(/^```\w*\n?/gm, '')  // 去掉 markdown 代码块标记
      .replace(/\n?```$/gm, '')
  }

  /**
   * 在文件内容中找到与 LLM 输出的 oldContent 最接近的匹配
   */
  private findBestMatch(fileContent: string, llmOldContent: string): string | null {
    const fileLines = fileContent.split('\n')
    const targetLines = llmOldContent.split('\n').filter(l => l.trim() !== '')
    
    if (targetLines.length === 0) return null

    const normalize = (s: string) => s.replace(/\s+/g, ' ').replace(/;\s*$/,'').trim()

    // 单行匹配：要求归一化后精确匹配
    if (targetLines.length === 1) {
      const target = normalize(targetLines[0])
      if (target.length < 5) return null
      for (let i = 0; i < fileLines.length; i++) {
        if (normalize(fileLines[i]) === target) {
          return fileLines[i]
        }
      }
      return null
    }

    // 多行匹配：滑动窗口 + 行级相似度
    let bestScore = 0
    let bestStart = -1
    let bestLength = 0
    const minThreshold = 0.75

    for (let i = 0; i <= fileLines.length - targetLines.length + 2; i++) {
      for (let len = Math.max(1, targetLines.length - 2); len <= Math.min(targetLines.length + 2, fileLines.length - i); len++) {
        const windowLines = fileLines.slice(i, i + len)
        const score = this.calculateSimilarity(windowLines, targetLines)
        
        if (score > bestScore && score >= minThreshold) {
          bestScore = score
          bestStart = i
          bestLength = len
        }
      }
    }

    if (bestStart >= 0) {
      return fileLines.slice(bestStart, bestStart + bestLength).join('\n')
    }

    return null
  }

  /**
   * 计算两组代码行的相似度 (0-1)
   */
  private calculateSimilarity(actual: string[], target: string[]): number {
    if (actual.length === 0 || target.length === 0) return 0

    const normalize = (s: string) => s.replace(/\s+/g, ' ').replace(/;\s*$/,'').trim()
    const normalizedActual = actual.map(normalize)
    const normalizedTarget = target.map(normalize).filter(l => l !== '')

    if (normalizedTarget.length === 0) return 0

    let matchedLines = 0
    for (const tl of normalizedTarget) {
      if (normalizedActual.some(al => al === tl)) {
        matchedLines++
      } else if (normalizedActual.some(al => al.includes(tl) || tl.includes(al))) {
        matchedLines += 0.6
      }
    }

    const lineScore = matchedLines / normalizedTarget.length
    const lengthRatio = Math.min(actual.length, target.length) / Math.max(actual.length, target.length)
    
    return lineScore * (0.7 + 0.3 * lengthRatio)
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
      .replace('{issue}', issue.title)
      .replace('{message}', issue.title)
      .replace('{issue_id}', issue.id)
    
    // Git commit（用单引号避免 shell 特殊字符展开，内部单引号转义）
    const safeMessage = commitMessage.replace(/'/g, "'\\''")
    const commitResult = await this.shellEnv.exec(`git commit -m '${safeMessage}'`)
    
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
    const patterns: Pattern[] = []
    const keywords = trajectory.issue.keywords || []
    const trigger = keywords.join(' ')
    if (!trigger) return []

    const successfulSteps = trajectory.steps.filter(s => s.success)
    const failedSteps = trajectory.steps.filter(s => !s.success)

    if (trajectory.result.success && successfulSteps.length > 0) {
      patterns.push({
        id: `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'success',
        trigger,
        action: successfulSteps.map(s => s.type).join(' → '),
        outcome: trajectory.result.summary,
        confidence: 0.8,
        usage: 1,
        trajectoryIds: [trajectory.id],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    if (failedSteps.length > 0) {
      const firstFail = failedSteps[0]
      patterns.push({
        id: `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'failure',
        trigger,
        action: firstFail.type,
        outcome: firstFail.error || 'Unknown error',
        confidence: 0.6,
        usage: 1,
        trajectoryIds: [trajectory.id],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    return patterns
  }

  private extractKnowledge(trajectory: Trajectory): Knowledge | null {
    if (!trajectory.result.success) return null
    const keywords = trajectory.issue.keywords || []

    return {
      id: `knowledge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      category: 'bug-fix',
      problem: trajectory.issue.title,
      solution: trajectory.result.summary,
      codeSnippets: [],
      references: [trajectory.issue.url || ''],
      score: 8,
      usage: 1,
      tags: keywords,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
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
