/**
 * SWE-Agent-Node - Code Modifier
 * 应用代码修改到文件系统
 */

import * as fs from 'fs'
import * as path from 'path'
import type { CodeModification, CodeSnippet, Repository } from './types'

export class CodeModifier {
  private repoPath: string
  private backupDir: string
  private modifications: Map<string, string> = new Map() // file -> original content

  constructor(repoPath: string) {
    this.repoPath = repoPath
    this.backupDir = path.join(repoPath, '.swe-backup')
  }

  /**
   * 应用多个修改
   */
  async applyModifications(modifications: CodeModification[]): Promise<void> {
    // 确保备份目录存在
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true })
    }

    for (const mod of modifications) {
      await this.applyModification(mod)
    }
  }

  /**
   * 应用单个修改
   */
  private async applyModification(mod: CodeModification): Promise<void> {
    const filePath = path.isAbsolute(mod.file) 
      ? mod.file 
      : path.join(this.repoPath, mod.file)

    switch (mod.type) {
      case 'create':
        await this.createFile(filePath, mod.newContent)
        break
      case 'modify':
        await this.modifyFile(filePath, mod.oldContent, mod.newContent)
        break
      case 'delete':
        await this.deleteFile(filePath, mod.oldContent)
        break
    }
  }

  /**
   * 创建新文件
   */
  private async createFile(filePath: string, content: string): Promise<void> {
    // 确保目录存在
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // 如果文件已存在，先备份
    if (fs.existsSync(filePath)) {
      await this.backupFile(filePath)
    }

    // 记录原内容（空表示新创建）
    this.modifications.set(filePath, '')

    // 写入新文件
    fs.writeFileSync(filePath, content, 'utf-8')
  }

  /**
   * 修改现有文件
   */
  private async modifyFile(
    filePath: string,
    oldContent: string | undefined,
    newContent: string
  ): Promise<void> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`)
    }

    // 备份原文件
    await this.backupFile(filePath)

    const currentContent = fs.readFileSync(filePath, 'utf-8')

    // 如果提供了旧内容，进行替换
    if (oldContent) {
      // 精确匹配替换
      if (currentContent.includes(oldContent)) {
        const updatedContent = currentContent.replace(oldContent, newContent)
        fs.writeFileSync(filePath, updatedContent, 'utf-8')
      } else {
        // 尝试模糊匹配（忽略空白差异）
        const normalizedOld = this.normalizeContent(oldContent)
        const normalizedCurrent = this.normalizeContent(currentContent)
        
        if (normalizedCurrent.includes(normalizedOld)) {
          // 找到近似匹配，使用行级替换
          const updatedContent = this.fuzzyReplace(currentContent, oldContent, newContent)
          fs.writeFileSync(filePath, updatedContent, 'utf-8')
        } else {
          throw new Error(`Old content not found in file: ${filePath}`)
        }
      }
    } else {
      // 没有提供旧内容，直接覆盖
      fs.writeFileSync(filePath, newContent, 'utf-8')
    }
  }

  /**
   * 删除文件
   */
  private async deleteFile(filePath: string, oldContent: string | undefined): Promise<void> {
    if (!fs.existsSync(filePath)) {
      return // 文件不存在，无需删除
    }

    // 备份原文件
    await this.backupFile(filePath)

    // 记录原内容用于恢复
    this.modifications.set(filePath, fs.readFileSync(filePath, 'utf-8'))

    // 删除文件
    fs.unlinkSync(filePath)
  }

  /**
   * 备份文件
   */
  private async backupFile(filePath: string): Promise<void> {
    if (!fs.existsSync(filePath)) {
      return
    }

    // 记录原内容（只记录第一次）
    if (!this.modifications.has(filePath)) {
      this.modifications.set(filePath, fs.readFileSync(filePath, 'utf-8'))
    }

    // 创建备份文件
    const backupPath = path.join(
      this.backupDir,
      `${path.basename(filePath)}.${Date.now()}.bak`
    )
    fs.copyFileSync(filePath, backupPath)
  }

  /**
   * 回滚所有修改
   */
  async rollback(): Promise<void> {
    for (const [filePath, originalContent] of this.modifications) {
      if (originalContent === '') {
        // 原本不存在，删除创建的文件
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      } else {
        // 恢复原内容
        fs.writeFileSync(filePath, originalContent, 'utf-8')
      }
    }

    // 清空修改记录
    this.modifications.clear()

    // 清理备份目录
    if (fs.existsSync(this.backupDir)) {
      fs.rmSync(this.backupDir, { recursive: true })
    }
  }

  /**
   * 清理备份（确认修改后调用）
   */
  async cleanup(): Promise<void> {
    this.modifications.clear()
    
    if (fs.existsSync(this.backupDir)) {
      fs.rmSync(this.backupDir, { recursive: true })
    }
  }

  /**
   * 规范化内容（用于模糊匹配）
   */
  private normalizeContent(content: string): string {
    return content
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * 模糊替换（行级匹配）
   */
  private fuzzyReplace(
    currentContent: string,
    oldContent: string,
    newContent: string
  ): string {
    const currentLines = currentContent.split('\n')
    const oldLines = oldContent.split('\n')
    const newLines = newContent.split('\n')

    // 找到匹配的起始行
    let startLine = -1
    for (let i = 0; i <= currentLines.length - oldLines.length; i++) {
      let match = true
      for (let j = 0; j < oldLines.length; j++) {
        if (currentLines[i + j].trim() !== oldLines[j].trim()) {
          match = false
          break
        }
      }
      if (match) {
        startLine = i
        break
      }
    }

    if (startLine === -1) {
      // 找不到匹配，追加新内容
      return currentContent + '\n' + newContent
    }

    // 替换匹配的行
    const result = [
      ...currentLines.slice(0, startLine),
      ...newLines,
      ...currentLines.slice(startLine + oldLines.length),
    ]

    return result.join('\n')
  }

  /**
   * 获取修改的文件列表
   */
  getModifiedFiles(): string[] {
    return Array.from(this.modifications.keys())
  }

  /**
   * 预览修改（不实际应用）
   */
  preview(modifications: CodeModification[]): string {
    const previews: string[] = []

    for (const mod of modifications) {
      const filePath = path.isAbsolute(mod.file)
        ? mod.file
        : path.join(this.repoPath, mod.file)

      switch (mod.type) {
        case 'create':
          previews.push(`+++ CREATE: ${filePath}\n${mod.newContent}`)
          break
        case 'modify':
          previews.push(`--- MODIFY: ${filePath}\n--- OLD ---\n${mod.oldContent || '(none)'}\n--- NEW ---\n${mod.newContent}`)
          break
        case 'delete':
          previews.push(`--- DELETE: ${filePath}`)
          break
      }
    }

    return previews.join('\n\n' + '='.repeat(40) + '\n\n')
  }
}

/**
 * 辅助函数：从代码片段构建修改
 */
export function createModificationFromSnippet(
  snippet: CodeSnippet,
  newContent: string,
  description?: string
): CodeModification {
  return {
    file: snippet.file,
    type: 'modify',
    oldContent: snippet.content,
    newContent,
    description,
  }
}

/**
 * 辅助函数：创建新文件修改
 */
export function createFileModification(
  filePath: string,
  content: string,
  description?: string
): CodeModification {
  return {
    file: filePath,
    type: 'create',
    newContent: content,
    description,
  }
}

/**
 * 辅助函数：创建删除文件修改
 */
export function deleteFileModification(
  filePath: string,
  currentContent?: string,
  description?: string
): CodeModification {
  return {
    file: filePath,
    type: 'delete',
    oldContent: currentContent,
    newContent: '',
    description,
  }
}
