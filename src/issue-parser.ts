/**
 * SWE-Agent-Node - Issue Parser
 * 解析 Issue 提取结构化信息
 */

import type { Issue, CodeLocation } from './types'

export interface ParsedIssue extends Issue {
  /** 解析后的结构化信息 */
  parsed?: {
    /** 问题类型 */
    type: IssueType
    /** 严重程度 */
    severity: Severity
    /** 提取的错误堆栈 */
    errorStack?: ErrorStackFrame[]
    /** 提取的文件路径 */
    mentionedFiles: string[]
    /** 提取的函数名 */
    mentionedFunctions: string[]
    /** 提取的类名 */
    mentionedClasses: string[]
    /** 代码片段 */
    codeSnippets: string[]
    /** 预期的修复区域 */
    suspectedAreas: string[]
    /** 置信度 */
    confidence: number
  }
}

export type IssueType = 'bug' | 'feature' | 'enhancement' | 'documentation' | 'question' | 'unknown'
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'unknown'

export interface ErrorStackFrame {
  file: string
  line?: number
  column?: number
  function?: string
  code?: string
}

export class IssueParser {
  /**
   * 解析 Issue
   */
  parse(issue: Issue): ParsedIssue {
    const parsed: ParsedIssue['parsed'] = {
      type: this.detectType(issue),
      severity: this.detectSeverity(issue),
      errorStack: this.extractErrorStack(issue.body),
      mentionedFiles: this.extractFiles(issue.body),
      mentionedFunctions: this.extractFunctions(issue.body),
      mentionedClasses: this.extractClasses(issue.body),
      codeSnippets: this.extractCodeSnippets(issue.body),
      suspectedAreas: this.inferSuspectedAreas(issue),
      confidence: 0,
    }

    // 计算置信度
    parsed.confidence = this.calculateConfidence(parsed)

    return {
      ...issue,
      keywords: this.extractKeywords(issue.body),
      errorTrace: parsed.errorStack?.map(f => `${f.file}:${f.line}`).join('\n'),
      parsed,
    }
  }

  /**
   * 从 URL 解析 Issue
   */
  parseGitHubUrl(url: string): { owner: string; repo: string; number: number } | null {
    const pattern = /github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/
    const match = url.match(pattern)
    
    if (match) {
      return {
        owner: match[1],
        repo: match[2],
        number: parseInt(match[3]),
      }
    }
    
    return null
  }

  /**
   * 检测问题类型
   */
  private detectType(issue: Issue): IssueType {
    const text = `${issue.title} ${issue.body}`.toLowerCase()
    const labels = issue.labels?.map(l => l.toLowerCase()) || []

    // 检查 labels
    if (labels.some(l => l.includes('bug') || l.includes('fix'))) return 'bug'
    if (labels.some(l => l.includes('feature') || l.includes('enhancement'))) return 'feature'
    if (labels.some(l => l.includes('doc'))) return 'documentation'
    if (labels.some(l => l.includes('question'))) return 'question'

    // 检查标题关键词
    if (text.includes('fix') || text.includes('bug') || text.includes('error') || 
        text.includes('crash') || text.includes('fail')) {
      return 'bug'
    }
    if (text.includes('add') || text.includes('implement') || text.includes('feature')) {
      return 'feature'
    }
    if (text.includes('improve') || text.includes('optimize') || text.includes('enhance')) {
      return 'enhancement'
    }
    if (text.includes('document') || text.includes('readme') || text.includes('comment')) {
      return 'documentation'
    }
    if (text.includes('how') || text.includes('question') || text.includes('?')) {
      return 'question'
    }

    return 'unknown'
  }

  /**
   * 检测严重程度
   */
  private detectSeverity(issue: Issue): Severity {
    const text = `${issue.title} ${issue.body}`.toLowerCase()
    const labels = issue.labels?.map(l => l.toLowerCase()) || []

    // 检查 labels
    if (labels.some(l => l.includes('critical') || l.includes('urgent'))) return 'critical'
    if (labels.some(l => l.includes('high'))) return 'high'
    if (labels.some(l => l.includes('low'))) return 'low'

    // 检查关键词
    const criticalWords = ['critical', 'urgent', 'security', 'data loss', 'production']
    const highWords = ['important', 'blocking', 'regression', 'crash']
    const lowWords = ['minor', 'cosmetic', 'nice to have']

    if (criticalWords.some(w => text.includes(w))) return 'critical'
    if (highWords.some(w => text.includes(w))) return 'high'
    if (lowWords.some(w => text.includes(w))) return 'low'

    // 默认基于类型
    const type = this.detectType(issue)
    if (type === 'bug') return 'medium'
    if (type === 'feature') return 'low'
    
    return 'unknown'
  }

  /**
   * 提取错误堆栈
   */
  private extractErrorStack(body: string): ErrorStackFrame[] {
    const frames: ErrorStackFrame[] = []

    // 匹配常见错误堆栈格式
    const patterns = [
      // TypeScript/JavaScript
      /at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/g,
      // Python
      /File\s+"(.+?)",\s+line\s+(\d+),\s+in\s+(.+)/g,
      // Java
      /at\s+(.+?)\((.+?):(\d+)\)/g,
      // Go
      /(.+?)\.go:(\d+):\s+(.+)/g,
    ]

    // TypeScript/JavaScript 格式
    let match
    const tsPattern = /at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/g
    while ((match = tsPattern.exec(body)) !== null) {
      frames.push({
        function: match[1] || 'anonymous',
        file: match[2],
        line: parseInt(match[3]),
        column: parseInt(match[4]),
      })
    }

    // Python 格式
    const pyPattern = /File\s+"(.+?)",\s+line\s+(\d+)(?:,\s+in\s+(.+?))?/g
    while ((match = pyPattern.exec(body)) !== null) {
      frames.push({
        file: match[1],
        line: parseInt(match[2]),
        function: match[3],
      })
    }

    return frames
  }

  /**
   * 提取文件路径
   */
  private extractFiles(body: string): string[] {
    const files: string[] = []
    
    // 匹配文件路径
    const patterns = [
      // 常见源代码文件
      /\b([a-zA-Z0-9_\-/.]+\.(ts|tsx|js|jsx|py|java|go|rs|c|cpp|h))\b/g,
      // 配置文件
      /\b([a-zA-Z0-9_\-/.]+\.(json|yaml|yml|toml|ini|env))\b/g,
      // 相对路径
      /\b(\.\/[a-zA-Z0-9_\-/.]+)\b/g,
      // 绝对路径（简化）
      /\b(\/[a-zA-Z0-9_\-/.]+)\b/g,
    ]

    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(body)) !== null) {
        const file = match[1]
        // 过滤掉一些误匹配
        if (!file.startsWith('http') && 
            !file.includes('node_modules') &&
            file.length > 3 &&
            file.length < 200) {
          if (!files.includes(file)) {
            files.push(file)
          }
        }
      }
    }

    return files
  }

  /**
   * 提取函数名
   */
  private extractFunctions(body: string): string[] {
    const functions: string[] = []
    
    // 匹配函数名
    const patterns = [
      // function name() 或 name()
      /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g,
      // method calls
      /\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g,
    ]

    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(body)) !== null) {
        const name = match[1]
        // 过滤常见关键词
        const keywords = ['if', 'for', 'while', 'switch', 'catch', 'function', 'const', 'let', 'var', 'return', 'console', 'await', 'async']
        if (!keywords.includes(name) && name.length > 2) {
          if (!functions.includes(name)) {
            functions.push(name)
          }
        }
      }
    }

    return functions.slice(0, 20) // 限制数量
  }

  /**
   * 提取类名
   */
  private extractClasses(body: string): string[] {
    const classes: string[] = []
    
    // 匹配类名（大写开头）
    const pattern = /\b([A-Z][a-zA-Z0-9_]*)\b/g
    let match
    
    while ((match = pattern.exec(body)) !== null) {
      const name = match[1]
      // 过滤单个字母和常见词
      if (name.length > 2 && !['The', 'This', 'That', 'Error', 'Type', 'Value'].includes(name)) {
        if (!classes.includes(name)) {
          classes.push(name)
        }
      }
    }

    return classes.slice(0, 10)
  }

  /**
   * 提取代码片段
   */
  private extractCodeSnippets(body: string): string[] {
    const snippets: string[] = []
    
    // 匹配代码块
    const pattern = /```[\w]*\n([\s\S]*?)```/g
    let match
    
    while ((match = pattern.exec(body)) !== null) {
      snippets.push(match[1].trim())
    }

    // 匹配行内代码
    const inlinePattern = /`([^`]+)`/g
    while ((match = inlinePattern.exec(body)) !== null) {
      if (match[1].length > 3) {
        snippets.push(match[1])
      }
    }

    return snippets
  }

  /**
   * 推断可能的修复区域
   */
  private inferSuspectedAreas(issue: Issue): string[] {
    const areas: string[] = []
    const body = `${issue.title} ${issue.body}`.toLowerCase()

    // 基于关键词推断
    const areaKeywords: Record<string, string[]> = {
      'auth': ['login', 'auth', 'password', 'token', 'session', 'user'],
      'api': ['api', 'endpoint', 'request', 'response', 'http'],
      'database': ['database', 'db', 'sql', 'query', 'table', 'model'],
      'ui': ['ui', 'component', 'render', 'display', 'style', 'css'],
      'test': ['test', 'spec', 'jest', 'mocha', 'assert'],
      'config': ['config', 'setting', 'env', 'environment'],
      'validation': ['validate', 'check', 'verify', 'input', 'form'],
    }

    for (const [area, keywords] of Object.entries(areaKeywords)) {
      if (keywords.some(k => body.includes(k))) {
        areas.push(area)
      }
    }

    return areas
  }

  /**
   * 提取关键词
   */
  private extractKeywords(body: string): string[] {
    const keywords: string[] = []
    const words = body.toLowerCase().split(/\s+/)
    
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of',
      'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
      'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you',
      'your', 'it', 'its', 'they', 'them', 'their', 'and', 'or', 'but', 'not',
    ])

    for (const word of words) {
      const cleaned = word.replace(/[^a-z0-9]/g, '')
      if (cleaned.length > 2 && !stopWords.has(cleaned)) {
        if (!keywords.includes(cleaned)) {
          keywords.push(cleaned)
        }
      }
    }

    return keywords.slice(0, 15)
  }

  /**
   * 计算解析置信度
   */
  private calculateConfidence(parsed: ParsedIssue['parsed']): number {
    if (!parsed) return 0

    let score = 0
    const weights = {
      type: 0.2,
      severity: 0.1,
      errorStack: 0.3,
      mentionedFiles: 0.2,
      codeSnippets: 0.1,
      suspectedAreas: 0.1,
    }

    if (parsed.type !== 'unknown') score += weights.type
    if (parsed.severity !== 'unknown') score += weights.severity
    if (parsed.errorStack && parsed.errorStack.length > 0) {
      score += Math.min(weights.errorStack, weights.errorStack * parsed.errorStack.length / 3)
    }
    if (parsed.mentionedFiles.length > 0) {
      score += Math.min(weights.mentionedFiles, weights.mentionedFiles * parsed.mentionedFiles.length / 5)
    }
    if (parsed.codeSnippets.length > 0) {
      score += Math.min(weights.codeSnippets, weights.codeSnippets * parsed.codeSnippets.length / 2)
    }
    if (parsed.suspectedAreas.length > 0) {
      score += Math.min(weights.suspectedAreas, weights.suspectedAreas * parsed.suspectedAreas.length / 3)
    }

    return Math.min(1, score)
  }
}
