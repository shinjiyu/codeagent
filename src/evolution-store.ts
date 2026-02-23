/**
 * SWE-Agent-Node - Evolution Store
 * 自进化系统：经验记录、模式挖掘、知识积累
 */

import * as fs from 'fs'
import * as path from 'path'
import type { Knowledge, Pattern, Strategy, Trajectory } from './types'

export class EvolutionStore {
  private storePath: string
  private trajectories: Map<string, Trajectory> = new Map()
  private patterns: Map<string, Pattern> = new Map()
  private knowledge: Map<string, Knowledge> = new Map()
  private strategy: Strategy

  constructor(storePath: string = './evolution-store') {
    this.storePath = storePath
    this.strategy = this.getDefaultStrategy()
    this.load()
  }

  // ==================== Trajectory (轨迹) ====================

  /**
   * 保存执行轨迹
   */
  async saveTrajectory(trajectory: Trajectory): Promise<void> {
    this.trajectories.set(trajectory.id, trajectory)
    await this.persistTrajectory(trajectory)
  }

  /**
   * 获取轨迹
   */
  getTrajectory(id: string): Trajectory | undefined {
    return this.trajectories.get(id)
  }

  /**
   * 获取所有轨迹
   */
  getAllTrajectories(): Trajectory[] {
    return Array.from(this.trajectories.values())
  }

  /**
   * 获取成功的轨迹
   */
  getSuccessfulTrajectories(): Trajectory[] {
    return this.getAllTrajectories().filter(t => t.result.success)
  }

  /**
   * 获取失败的轨迹
   */
  getFailedTrajectories(): Trajectory[] {
    return this.getAllTrajectories().filter(t => !t.result.success)
  }

  // ==================== Pattern (模式) ====================

  /**
   * 保存模式
   */
  async savePattern(pattern: Pattern): Promise<void> {
    this.patterns.set(pattern.id, pattern)
    await this.persistPatterns()
  }

  /**
   * 获取模式
   */
  getPattern(id: string): Pattern | undefined {
    return this.patterns.get(id)
  }

  /**
   * 获取所有模式
   */
  getAllPatterns(): Pattern[] {
    return Array.from(this.patterns.values())
  }

  /**
   * 查找匹配的模式
   */
  findMatchingPatterns(triggerKeywords: string[]): Pattern[] {
    const patterns = this.getAllPatterns()
    
    return patterns
      .filter(p => {
        // 检查触发条件是否匹配
        const triggerWords = p.trigger.toLowerCase().split(/\s+/)
        return triggerKeywords.some(keyword => 
          triggerWords.some(tw => tw.includes(keyword.toLowerCase()))
        )
      })
      .sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * 更新模式使用统计
   */
  async updatePatternUsage(patternId: string, trajectoryId: string): Promise<void> {
    const pattern = this.patterns.get(patternId)
    if (pattern) {
      pattern.usage++
      pattern.lastUsed = new Date()
      if (!pattern.trajectoryIds.includes(trajectoryId)) {
        pattern.trajectoryIds.push(trajectoryId)
      }
      await this.persistPatterns()
    }
  }

  // ==================== Knowledge (知识) ====================

  /**
   * 保存知识
   */
  async saveKnowledge(knowledge: Knowledge): Promise<void> {
    this.knowledge.set(knowledge.id, knowledge)
    await this.persistKnowledge()
  }

  /**
   * 获取知识
   */
  getKnowledge(id: string): Knowledge | undefined {
    return this.knowledge.get(id)
  }

  /**
   * 获取所有知识
   */
  getAllKnowledge(): Knowledge[] {
    return Array.from(this.knowledge.values())
  }

  /**
   * 搜索知识
   */
  searchKnowledge(query: string, category?: string): Knowledge[] {
    let results = this.getAllKnowledge()

    if (category) {
      results = results.filter(k => k.category === category)
    }

    // 简单的关键词匹配
    const queryWords = query.toLowerCase().split(/\s+/)
    results = results.filter(k => {
      const text = `${k.problem} ${k.solution} ${k.tags.join(' ')}`.toLowerCase()
      return queryWords.some(word => text.includes(word))
    })

    // 按评分和使用次数排序
    return results.sort((a, b) => {
      const scoreA = a.score * 0.7 + (a.usage / 100) * 0.3
      const scoreB = b.score * 0.7 + (b.usage / 100) * 0.3
      return scoreB - scoreA
    })
  }

  /**
   * 更新知识使用统计
   */
  async updateKnowledgeUsage(knowledgeId: string): Promise<void> {
    const knowledge = this.knowledge.get(knowledgeId)
    if (knowledge) {
      knowledge.usage++
      knowledge.updatedAt = new Date()
      await this.persistKnowledge()
    }
  }

  // ==================== Strategy (策略) ====================

  /**
   * 获取当前策略
   */
  getStrategy(): Strategy {
    return this.strategy
  }

  /**
   * 更新策略
   */
  async updateStrategy(updates: Partial<Strategy>): Promise<void> {
    this.strategy = {
      ...this.strategy,
      ...updates,
      updatedAt: new Date(),
    }
    await this.persistStrategy()
  }

  // ==================== Mining (挖掘) ====================

  /**
   * 从轨迹中挖掘模式
   */
  async minePatterns(): Promise<Pattern[]> {
    const trajectories = this.getAllTrajectories()
    const newPatterns: Pattern[] = []

    // 成功模式挖掘
    const successTrajectories = trajectories.filter(t => t.result.success)
    for (const trajectory of successTrajectories) {
      const pattern = this.extractSuccessPattern(trajectory)
      if (pattern && !this.isDuplicatePattern(pattern)) {
        newPatterns.push(pattern)
        await this.savePattern(pattern)
      }
    }

    // 失败模式挖掘
    const failedTrajectories = trajectories.filter(t => !t.result.success)
    for (const trajectory of failedTrajectories) {
      const pattern = this.extractFailurePattern(trajectory)
      if (pattern && !this.isDuplicatePattern(pattern)) {
        newPatterns.push(pattern)
        await this.savePattern(pattern)
      }
    }

    return newPatterns
  }

  /**
   * 从成功的轨迹中提取知识
   */
  async extractKnowledgeFromSuccess(): Promise<Knowledge[]> {
    const trajectories = this.getSuccessfulTrajectories()
    const newKnowledge: Knowledge[] = []

    for (const trajectory of trajectories) {
      const knowledge = this.createKnowledgeFromTrajectory(trajectory)
      if (knowledge && !this.isDuplicateKnowledge(knowledge)) {
        newKnowledge.push(knowledge)
        await this.saveKnowledge(knowledge)
      }
    }

    return newKnowledge
  }

  /**
   * 优化策略
   */
  async optimizeStrategy(): Promise<Strategy> {
    const patterns = this.getAllPatterns()
    const knowledge = this.getAllKnowledge()

    // 分析高置信度的成功模式
    const successPatterns = patterns
      .filter(p => p.type === 'success' && p.confidence > 0.7)
      .sort((a, b) => b.usage - a.usage)

    // 更新搜索权重
    const searchWeights = { ...this.strategy.searchWeights }
    for (const pattern of successPatterns) {
      // 根据模式调整权重
      // TODO: 实现更智能的权重调整
    }

    // 更新策略
    await this.updateStrategy({
      searchWeights,
    })

    return this.strategy
  }

  // ==================== 辅助方法 ====================

  private extractSuccessPattern(trajectory: Trajectory): Pattern | null {
    // TODO: 实现更智能的模式提取
    if (trajectory.steps.length === 0) return null

    const keywords = trajectory.issue.keywords || []
    const successfulSteps = trajectory.steps.filter(s => s.success)

    return {
      id: `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'success',
      trigger: keywords.join(' '),
      action: `${successfulSteps.length} steps executed successfully`,
      outcome: 'Issue resolved',
      confidence: 0.8,
      usage: 1,
      trajectoryIds: [trajectory.id],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  private extractFailurePattern(trajectory: Trajectory): Pattern | null {
    // TODO: 实现更智能的失败模式提取
    const failedStep = trajectory.steps.find(s => !s.success)
    if (!failedStep) return null

    return {
      id: `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'failure',
      trigger: trajectory.issue.keywords?.join(' ') || '',
      action: failedStep.type,
      outcome: failedStep.error || 'Unknown error',
      confidence: 0.6,
      usage: 1,
      trajectoryIds: [trajectory.id],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  private createKnowledgeFromTrajectory(trajectory: Trajectory): Knowledge | null {
    // TODO: 实现知识提取
    if (!trajectory.result.success) return null

    return {
      id: `knowledge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      category: 'bug-fix',
      problem: trajectory.issue.title,
      solution: trajectory.result.summary,
      codeSnippets: [],
      references: [trajectory.issue.url || ''],
      score: 8,
      usage: 1,
      tags: trajectory.issue.keywords || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  private isDuplicatePattern(pattern: Pattern): boolean {
    const existing = this.getAllPatterns()
    return existing.some(p => 
      p.trigger === pattern.trigger && p.action === pattern.action
    )
  }

  private isDuplicateKnowledge(knowledge: Knowledge): boolean {
    const existing = this.getAllKnowledge()
    return existing.some(k => 
      k.problem === knowledge.problem && k.category === knowledge.category
    )
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

  // ==================== 持久化 ====================

  private load(): void {
    // 加载轨迹
    const trajectoriesPath = path.join(this.storePath, 'trajectories')
    if (fs.existsSync(trajectoriesPath)) {
      const files = fs.readdirSync(trajectoriesPath).filter(f => f.endsWith('.json'))
      for (const file of files) {
        const content = fs.readFileSync(path.join(trajectoriesPath, file), 'utf-8')
        const trajectory: Trajectory = JSON.parse(content)
        this.trajectories.set(trajectory.id, trajectory)
      }
    }

    // 加载模式
    const patternsPath = path.join(this.storePath, 'patterns.json')
    if (fs.existsSync(patternsPath)) {
      const content = fs.readFileSync(patternsPath, 'utf-8')
      const patterns: Pattern[] = JSON.parse(content)
      patterns.forEach(p => this.patterns.set(p.id, p))
    }

    // 加载知识
    const knowledgePath = path.join(this.storePath, 'knowledge.json')
    if (fs.existsSync(knowledgePath)) {
      const content = fs.readFileSync(knowledgePath, 'utf-8')
      const knowledgeList: Knowledge[] = JSON.parse(content)
      knowledgeList.forEach(k => this.knowledge.set(k.id, k))
    }

    // 加载策略
    const strategyPath = path.join(this.storePath, 'strategy.json')
    if (fs.existsSync(strategyPath)) {
      const content = fs.readFileSync(strategyPath, 'utf-8')
      this.strategy = JSON.parse(content)
    }
  }

  private async persistTrajectory(trajectory: Trajectory): Promise<void> {
    const dir = path.join(this.storePath, 'trajectories')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const filePath = path.join(dir, `${trajectory.id}.json`)
    fs.writeFileSync(filePath, JSON.stringify(trajectory, null, 2))
  }

  private async persistPatterns(): Promise<void> {
    if (!fs.existsSync(this.storePath)) {
      fs.mkdirSync(this.storePath, { recursive: true })
    }
    const filePath = path.join(this.storePath, 'patterns.json')
    const patterns = Array.from(this.patterns.values())
    fs.writeFileSync(filePath, JSON.stringify(patterns, null, 2))
  }

  private async persistKnowledge(): Promise<void> {
    if (!fs.existsSync(this.storePath)) {
      fs.mkdirSync(this.storePath, { recursive: true })
    }
    const filePath = path.join(this.storePath, 'knowledge.json')
    const knowledge = Array.from(this.knowledge.values())
    fs.writeFileSync(filePath, JSON.stringify(knowledge, null, 2))
  }

  private async persistStrategy(): Promise<void> {
    if (!fs.existsSync(this.storePath)) {
      fs.mkdirSync(this.storePath, { recursive: true })
    }
    const filePath = path.join(this.storePath, 'strategy.json')
    fs.writeFileSync(filePath, JSON.stringify(this.strategy, null, 2))
  }

  // ==================== 统计 ====================

  getStats(): EvolutionStats {
    return {
      totalTrajectories: this.trajectories.size,
      successfulTrajectories: this.getSuccessfulTrajectories().length,
      failedTrajectories: this.getFailedTrajectories().length,
      totalPatterns: this.patterns.size,
      successPatterns: Array.from(this.patterns.values()).filter(p => p.type === 'success').length,
      failurePatterns: Array.from(this.patterns.values()).filter(p => p.type === 'failure').length,
      totalKnowledge: this.knowledge.size,
      averageConfidence: this.calculateAverageConfidence(),
    }
  }

  private calculateAverageConfidence(): number {
    const patterns = Array.from(this.patterns.values())
    if (patterns.length === 0) return 0
    const sum = patterns.reduce((acc, p) => acc + p.confidence, 0)
    return sum / patterns.length
  }
}

export interface EvolutionStats {
  totalTrajectories: number
  successfulTrajectories: number
  failedTrajectories: number
  totalPatterns: number
  successPatterns: number
  failurePatterns: number
  totalKnowledge: number
  averageConfidence: number
}
