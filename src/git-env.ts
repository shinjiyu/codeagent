/**
 * SWE-Agent-Node - Git Environment
 * 管理 Git 仓库操作
 */

import simpleGit, { SimpleGit } from 'simple-git'
import type { Repository, ProjectStructure, TechStack } from './types'
import * as fs from 'fs'
import * as path from 'path'
import * as glob from 'glob'

export class GitEnv {
  private git: SimpleGit | null = null
  private repoPath: string = ''

  /**
   * 克隆仓库
   */
  async clone(url: string, targetPath?: string): Promise<Repository> {
    const repoName = this.extractRepoName(url)
    this.repoPath = targetPath || path.join('./repos', repoName)

    // 如果目录已存在，拉取最新代码
    if (fs.existsSync(this.repoPath)) {
      this.git = simpleGit(this.repoPath)
      await this.git.pull()
    } else {
      // 克隆新仓库
      this.git = simpleGit()
      await this.git.clone(url, this.repoPath)
      this.git = simpleGit(this.repoPath)
    }

    return {
      url,
      path: this.repoPath,
    }
  }

  /**
   * 打开已存在的仓库
   */
  async open(repoPath: string): Promise<Repository> {
    this.repoPath = repoPath
    this.git = simpleGit(repoPath)

    const remotes = await this.git.getRemotes(true)
    const originUrl = remotes.find(r => r.name === 'origin')?.refs?.fetch || ''

    return {
      url: originUrl,
      path: repoPath,
    }
  }

  /**
   * 创建新分支
   */
  async createBranch(name: string): Promise<void> {
    if (!this.git) throw new Error('No repository open')
    await this.git.checkoutLocalBranch(name)
  }

  /**
   * 获取当前分支名
   */
  async getCurrentBranch(): Promise<string> {
    if (!this.git) throw new Error('No repository open')
    const status = await this.git.status()
    return status.current || 'main'
  }

  /**
   * 添加文件到暂存区
   */
  async add(files: string | string[]): Promise<void> {
    if (!this.git) throw new Error('No repository open')
    await this.git.add(files)
  }

  /**
   * 提交更改
   */
  async commit(message: string): Promise<string> {
    if (!this.git) throw new Error('No repository open')
    const result = await this.git.commit(message)
    return result.commit || ''
  }

  /**
   * 推送到远程
   */
  async push(branch?: string): Promise<void> {
    if (!this.git) throw new Error('No repository open')
    const targetBranch = branch || await this.getCurrentBranch()
    await this.git.push('origin', targetBranch, ['--set-upstream'])
  }

  /**
   * 回滚所有未提交的更改
   */
  async resetHard(): Promise<void> {
    if (!this.git) throw new Error('No repository open')
    await this.git.reset(['--hard'])
  }

  /**
   * 获取文件状态
   */
  async getStatus(): Promise<{
    modified: string[]
    created: string[]
    deleted: string[]
    untracked: string[]
  }> {
    if (!this.git) throw new Error('No repository open')

    const status = await this.git.status()

    return {
      modified: status.modified,
      created: status.created,
      deleted: status.deleted,
      untracked: status.not_added,
    }
  }

  /**
   * 分析项目结构
   */
  async analyzeStructure(): Promise<ProjectStructure> {
    if (!this.repoPath) throw new Error('No repository open')

    const structure: ProjectStructure = {
      root: this.repoPath,
      directories: [],
      files: [],
    }

    // 读取根目录
    const rootItems = fs.readdirSync(this.repoPath)

    // 检测常见目录
    const srcCandidates = ['src', 'lib', 'app', 'source']
    const testCandidates = ['test', 'tests', '__tests__', 'spec', '__mocks__']
    const configCandidates = ['tsconfig.json', 'package.json', 'jest.config.js', '.eslintrc.js']
    const packageCandidates = ['package.json', 'Cargo.toml', 'setup.py', 'go.mod', 'pom.xml']

    for (const item of rootItems) {
      const itemPath = path.join(this.repoPath, item)
      const stat = fs.statSync(itemPath)

      if (stat.isDirectory()) {
        structure.directories.push(item)

        if (srcCandidates.includes(item.toLowerCase()) && !structure.srcDir) {
          structure.srcDir = itemPath
        }
        if (testCandidates.includes(item.toLowerCase()) && !structure.testDir) {
          structure.testDir = itemPath
        }
      } else {
        structure.files.push(item)

        if (configCandidates.includes(item) && !structure.configFile) {
          structure.configFile = itemPath
        }
        if (packageCandidates.includes(item) && !structure.packageFile) {
          structure.packageFile = itemPath
        }
      }
    }

    // 递归扫描所有文件
    const allFiles = glob.sync('**/*', {
      cwd: this.repoPath,
      ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
      nodir: true,
    })

    structure.files = allFiles

    return structure
  }

  /**
   * 检测技术栈
   */
  async detectTechStack(): Promise<TechStack> {
    if (!this.repoPath) throw new Error('No repository open')

    const techStack: TechStack = {
      language: 'unknown',
    }

    // 检查 package.json
    const packageJsonPath = path.join(this.repoPath, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
      techStack.language = 'typescript'
      techStack.packageManager = 'npm'

      // 检测框架
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }
      if (deps.react) techStack.framework = 'react'
      if (deps.vue) techStack.framework = 'vue'
      if (deps.express) techStack.framework = 'express'
      if (deps.next) techStack.framework = 'nextjs'

      // 检测测试框架
      if (deps.jest) techStack.testFramework = 'jest'
      if (deps.mocha) techStack.testFramework = 'mocha'
      if (deps.vitest) techStack.testFramework = 'vitest'

      // 检测构建工具
      if (deps.webpack) techStack.buildTool = 'webpack'
      if (deps.vite) techStack.buildTool = 'vite'
      if (deps.rollup) techStack.buildTool = 'rollup'
    }

    // 检查其他语言
    if (fs.existsSync(path.join(this.repoPath, 'Cargo.toml'))) {
      techStack.language = 'rust'
    } else if (fs.existsSync(path.join(this.repoPath, 'go.mod'))) {
      techStack.language = 'go'
    } else if (fs.existsSync(path.join(this.repoPath, 'setup.py'))) {
      techStack.language = 'python'
    } else if (fs.existsSync(path.join(this.repoPath, 'pom.xml'))) {
      techStack.language = 'java'
    }

    return techStack
  }

  /**
   * 获取文件内容
   */
  getFileContent(filePath: string): string {
    const fullPath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(this.repoPath, filePath)
    
    return fs.readFileSync(fullPath, 'utf-8')
  }

  /**
   * 写入文件内容
   */
  writeFile(filePath: string, content: string): void {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.repoPath, filePath)
    
    // 确保目录存在
    const dir = path.dirname(fullPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(fullPath, content, 'utf-8')
  }

  /**
   * 获取 Git diff
   */
  async getDiff(file?: string): Promise<string> {
    if (!this.git) throw new Error('No repository open')

    if (file) {
      return await this.git.diff(['--', file])
    } else {
      return await this.git.diff()
    }
  }

  /**
   * 辅助方法：从 URL 提取仓库名
   */
  private extractRepoName(url: string): string {
    const parts = url.split('/')
    const lastPart = parts[parts.length - 1]
    return lastPart.replace('.git', '')
  }
}
