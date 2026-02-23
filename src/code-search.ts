/**
 * SWE-Agent-Node - Code Search Engine
 * 在代码库中搜索相关代码
 */

import * as fs from 'fs'
import * as path from 'path'
import * as glob from 'glob'
import type { CodeLocation, CodeSnippet, Repository } from './types'

export class CodeSearch {
  private repoPath: string
  private ignorePatterns: string[]

  constructor(repoPath: string) {
    this.repoPath = repoPath
    this.ignorePatterns = [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      '*.min.js',
      '*.min.css',
      'coverage/**',
      '.next/**',
      '__pycache__/**',
      'venv/**',
      '*.lock',
      'package-lock.json',
      'yarn.lock',
    ]
  }

  /**
   * 搜索包含关键词的文件
   */
  async searchByKeywords(
    keywords: string[],
    options: SearchOptions = {}
  ): Promise<CodeLocation[]> {
    const locations: CodeLocation[] = []
    const files = await this.getSourceFiles(options.extensions)

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')

      // 计算文件匹配得分
      const score = this.calculateScore(content, keywords, options.weights)

      if (score > 0) {
        // 找到匹配的行
        const matchingLines: number[] = []
        lines.forEach((line, index) => {
          if (keywords.some(keyword => 
            line.toLowerCase().includes(keyword.toLowerCase())
          )) {
            matchingLines.push(index + 1)
          }
        })

        if (matchingLines.length > 0) {
          // 取第一个匹配位置
          const firstMatch = matchingLines[0]
          const context = this.getContext(lines, firstMatch - 1, options.contextLines || 5)

          locations.push({
            file: path.relative(this.repoPath, file),
            line: firstMatch,
            context,
          })
        }
      }
    }

    // 按得分排序
    locations.sort((a, b) => {
      const scoreA = this.calculateScore(a.context || '', keywords, options.weights)
      const scoreB = this.calculateScore(b.context || '', keywords, options.weights)
      return scoreB - scoreA
    })

    return locations.slice(0, options.maxResults || 20)
  }

  /**
   * 搜索函数定义
   */
  async searchFunction(functionName: string): Promise<CodeLocation[]> {
    const locations: CodeLocation[] = []
    const files = await this.getSourceFiles(['.ts', '.js', '.tsx', '.jsx'])

    // 函数定义的正则模式
    const patterns = [
      new RegExp(`function\\s+${functionName}\\s*\\(`, 'g'),
      new RegExp(`const\\s+${functionName}\\s*=\\s*(async\\s*)?\\(`, 'g'),
      new RegExp(`(public|private|protected)?\\s*${functionName}\\s*\\([^)]*\\)\\s*{`, 'g'),
    ]

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')

      for (const pattern of patterns) {
        let match
        while ((match = pattern.exec(content)) !== null) {
          const lineNumber = content.substring(0, match.index).split('\n').length
          const context = this.getContext(lines, lineNumber - 1, 10)

          locations.push({
            file: path.relative(this.repoPath, file),
            line: lineNumber,
            context,
          })
        }
      }
    }

    return locations
  }

  /**
   * 搜索类定义
   */
  async searchClass(className: string): Promise<CodeLocation[]> {
    const locations: CodeLocation[] = []
    const files = await this.getSourceFiles(['.ts', '.js', '.tsx', '.jsx'])

    const pattern = new RegExp(`class\\s+${className}\\s*({|extends|implements)`, 'g')

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')

      let match
      while ((match = pattern.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length
        const context = this.getContext(lines, lineNumber - 1, 15)

        locations.push({
          file: path.relative(this.repoPath, file),
          line: lineNumber,
          context,
        })
      }
    }

    return locations
  }

  /**
   * 搜索错误信息
   */
  async searchError(errorMessage: string): Promise<CodeLocation[]> {
    const locations: CodeLocation[] = []
    const files = await this.getSourceFiles()

    // 搜索 throw 语句和错误字符串
    const patterns = [
      new RegExp(`throw\\s+.*${this.escapeRegex(errorMessage)}.*`, 'gi'),
      new RegExp(`Error\\(['"\`].*${this.escapeRegex(errorMessage)}.*['"\`]\\)`, 'gi'),
      new RegExp(`['"\`]${this.escapeRegex(errorMessage)}['"\`]`, 'gi'),
    ]

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')

      for (const pattern of patterns) {
        let match
        while ((match = pattern.exec(content)) !== null) {
          const lineNumber = content.substring(0, match.index).split('\n').length
          const context = this.getContext(lines, lineNumber - 1, 10)

          locations.push({
            file: path.relative(this.repoPath, file),
            line: lineNumber,
            context,
          })
        }
      }
    }

    return locations
  }

  /**
   * 获取代码片段
   */
  async getSnippet(
    file: string,
    startLine: number,
    endLine: number
  ): Promise<CodeSnippet> {
    const filePath = path.isAbsolute(file) ? file : path.join(this.repoPath, file)
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')

    const snippetLines = lines.slice(startLine - 1, endLine)
    const snippetContent = snippetLines.join('\n')

    return {
      file: path.relative(this.repoPath, filePath),
      content: snippetContent,
      startLine,
      endLine: Math.min(endLine, lines.length),
      language: this.detectLanguage(filePath),
    }
  }

  /**
   * 查找文件
   */
  async findFiles(pattern: string): Promise<string[]> {
    return glob.sync(pattern, {
      cwd: this.repoPath,
      ignore: this.ignorePatterns,
      absolute: true,
    })
  }

  /**
   * 获取所有源代码文件
   */
  private async getSourceFiles(extensions?: string[]): Promise<string[]> {
    const exts = extensions || [
      '.ts', '.tsx', '.js', '.jsx',
      '.py', '.java', '.go', '.rs',
      '.c', '.cpp', '.h', '.hpp',
      '.rb', '.php', '.cs',
    ]

    const pattern = `**/*{${exts.join(',')}}`

    return glob.sync(pattern, {
      cwd: this.repoPath,
      ignore: this.ignorePatterns,
      absolute: true,
      nodir: true,
    })
  }

  /**
   * 计算代码片段的匹配得分
   */
  private calculateScore(
    content: string,
    keywords: string[],
    weights?: Record<string, number>
  ): number {
    const w = weights || {
      exact: 2.0,
      partial: 1.0,
      function: 1.5,
      class: 1.3,
      variable: 1.0,
    }

    let score = 0
    const lowerContent = content.toLowerCase()

    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase()

      // 精确匹配
      if (lowerContent.includes(lowerKeyword)) {
        score += w.exact
      }

      // 检查是否是函数名
      if (lowerContent.includes(`function ${lowerKeyword}`) ||
          lowerContent.includes(`${lowerKeyword}(`)) {
        score += w.function
      }

      // 检查是否是类名
      if (lowerContent.includes(`class ${lowerKeyword}`)) {
        score += w.class
      }
    }

    return score
  }

  /**
   * 获取代码上下文
   */
  private getContext(lines: string[], centerLine: number, contextSize: number): string {
    const start = Math.max(0, centerLine - contextSize)
    const end = Math.min(lines.length, centerLine + contextSize + 1)
    return lines.slice(start, end).join('\n')
  }

  /**
   * 检测语言
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    const langMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'c',
      '.hpp': 'cpp',
      '.rb': 'ruby',
      '.php': 'php',
      '.cs': 'csharp',
    }
    return langMap[ext] || 'text'
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}

export interface SearchOptions {
  /** 文件扩展名过滤 */
  extensions?: string[]
  /** 最大结果数 */
  maxResults?: number
  /** 上下文行数 */
  contextLines?: number
  /** 关键词权重 */
  weights?: Record<string, number>
}
