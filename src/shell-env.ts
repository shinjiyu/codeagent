/**
 * SWE-Agent-Node - Shell Environment
 * 执行命令行工具
 */

import { exec as execCallback } from 'child_process'
import { promisify } from 'util'
import type { ExecResult, TestResult } from './types'

const exec = promisify(execCallback)

export class ShellEnv {
  private cwd: string

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd
  }

  /**
   * 执行命令
   * 设计理念：每个命令独立进程，无状态
   */
  async exec(command: string, cwd?: string): Promise<ExecResult> {
    const startTime = Date.now()
    const workDir = cwd || this.cwd

    try {
      const { stdout, stderr } = await exec(command, {
        cwd: workDir,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        timeout: 300000, // 5 minutes timeout
      })

      const duration = Date.now() - startTime

      return {
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: 0,
        success: true,
        duration,
      }
    } catch (error: any) {
      const duration = Date.now() - startTime

      return {
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || error.message,
        exitCode: error.code || 1,
        success: false,
        duration,
      }
    }
  }

  /**
   * 安装依赖
   */
  async installDeps(packageManager: string = 'npm'): Promise<ExecResult> {
    const commands: Record<string, string> = {
      npm: 'npm install',
      yarn: 'yarn install',
      pnpm: 'pnpm install',
    }

    const command = commands[packageManager] || commands.npm
    return await this.exec(command)
  }

  /**
   * 运行测试
   */
  async runTests(testCommand?: string, testPattern?: string): Promise<TestResult> {
    // 如果没有提供测试命令，尝试检测
    const command = testCommand || await this.detectTestCommand()
    
    const fullCommand = testPattern 
      ? `${command} ${testPattern}`
      : command

    const result = await this.exec(fullCommand)

    // 解析测试结果
    return this.parseTestResult(result)
  }

  /**
   * 检测测试命令
   */
  private async detectTestCommand(): Promise<string> {
    // 常见测试命令
    const testCommands = [
      'npm test',
      'yarn test',
      'pnpm test',
      'make test',
      'pytest',
      'go test ./...',
      'cargo test',
    ]

    // 简单起见，返回 npm test
    // TODO: 可以检查 package.json 或其他配置文件
    return 'npm test'
  }

  /**
   * 解析测试结果
   */
  private parseTestResult(execResult: ExecResult): TestResult {
    const result: TestResult = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      output: execResult.stdout + '\n' + execResult.stderr,
      failures: [],
    }

    if (!execResult.success) {
      // Jest 输出格式
      const jestPattern = /Tests:\s+(\d+) passed,?\s*(\d+)?\s*failed,?\s*(\d+)?\s*skipped,?\s*(\d+)?\s*total/i
      const jestMatch = execResult.stdout.match(jestPattern) || execResult.stderr.match(jestPattern)
      
      if (jestMatch) {
        result.passed = parseInt(jestMatch[1]) || 0
        result.failed = parseInt(jestMatch[2]) || 0
        result.skipped = parseInt(jestMatch[3]) || 0
        result.total = parseInt(jestMatch[4]) || (result.passed + result.failed + result.skipped)
      } else {
        // 如果无法解析，假设全部失败
        result.failed = 1
        result.total = 1
      }
    } else {
      // 测试通过，尝试解析数量
      const passPattern = /(\d+)\s+(passing|passed)/i
      const passMatch = execResult.stdout.match(passPattern)
      
      if (passMatch) {
        result.passed = parseInt(passMatch[1])
        result.total = result.passed
      } else {
        // 无法解析，假设全部通过
        result.passed = 1
        result.total = 1
      }
    }

    // 提取失败信息
    result.failures = this.extractFailures(execResult.stdout + '\n' + execResult.stderr)

    return result
  }

  /**
   * 提取测试失败详情
   */
  private extractFailures(output: string): Array<{ test: string; file: string; message: string; stack?: string }> {
    const failures: Array<{ test: string; file: string; message: string; stack?: string }> = []

    // Jest 失败格式
    const jestFailPattern = /● (.+?)\n\n([\s\S]+?)(?=\n\n●|\n\nFAIL|$)/g
    let match

    while ((match = jestFailPattern.exec(output)) !== null) {
      const testName = match[1]
      const errorBody = match[2]

      // 提取文件名
      const filePattern = /at\s+(.+?):(\d+):(\d+)/
      const fileMatch = errorBody.match(filePattern)

      failures.push({
        test: testName,
        file: fileMatch ? fileMatch[1] : 'unknown',
        message: errorBody.split('\n')[0],
        stack: errorBody,
      })
    }

    return failures
  }

  /**
   * 构建项目
   */
  async build(buildCommand?: string): Promise<ExecResult> {
    const command = buildCommand || 'npm run build'
    return await this.exec(command)
  }

  /**
   * 代码格式化
   */
  async format(files?: string[], formatter: string = 'prettier'): Promise<ExecResult> {
    const fileList = files && files.length > 0 ? files.join(' ') : '.'
    const command = `${formatter} --write ${fileList}`
    return await this.exec(command)
  }

  /**
   * 代码检查
   */
  async lint(lintCommand?: string): Promise<ExecResult> {
    const command = lintCommand || 'npm run lint'
    return await this.exec(command)
  }
}
