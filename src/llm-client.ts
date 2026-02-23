/**
 * SWE-Agent-Node - LLM Client
 * 与语言模型交互
 */

import type { LLMConfig, LLMMessage, LLMRequest, LLMResponse } from './types'

export class LLMClient {
  private config: LLMConfig
  private messageHistory: LLMMessage[] = []

  constructor(config: LLMConfig) {
    this.config = config
  }

  /**
   * 生成响应
   */
  async generate(prompt: string, context?: Context): Promise<string> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: this.getSystemPrompt(context),
      },
      ...this.messageHistory,
      {
        role: 'user',
        content: prompt,
      },
    ]

    const request: LLMRequest = {
      messages,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    }

    const response = await this.callLLM(request)

    // 添加到历史
    this.messageHistory.push(
      { role: 'user', content: prompt },
      { role: 'assistant', content: response.content }
    )

    return response.content
  }

  /**
   * 分析代码
   */
  async analyzeCode(code: string, question: string): Promise<string> {
    const prompt = `分析以下代码并回答问题：

\`\`\`
${code}
\`\`\`

问题：${question}

请详细分析并给出答案。`

    return await this.generate(prompt, { task: 'code-analysis' })
  }

  /**
   * 生成修复方案
   */
  async suggestFix(
    problem: string,
    code: string,
    errorTrace?: string
  ): Promise<FixSuggestion> {
    const prompt = `你需要修复以下问题：

问题：
${problem}

${errorTrace ? `错误堆栈：\n\`\`\`\n${errorTrace}\n\`\`\`\n` : ''}

相关代码：
\`\`\`
${code}
\`\`\`

请分析问题原因并提供修复方案。以 JSON 格式输出：
{
  "analysis": "问题分析",
  "rootCause": "根本原因",
  "solution": "解决方案描述",
  "modifiedCode": "修改后的代码",
  "explanation": "修改说明"
}`

    const response = await this.generate(prompt, { task: 'bug-fix' })

    try {
      return JSON.parse(response)
    } catch {
      return {
        analysis: response,
        rootCause: 'Unknown',
        solution: response,
        modifiedCode: code,
        explanation: 'AI 未能提供结构化输出',
      }
    }
  }

  /**
   * 生成 commit message
   */
  async generateCommitMessage(
    changes: string,
    issueTitle: string
  ): Promise<string> {
    const prompt = `根据以下代码变更生成 commit message：

Issue: ${issueTitle}

Changes:
${changes}

要求：
1. 使用 conventional commits 格式（feat/fix/refactor/docs/test 等）
2. 简洁明了，不超过 72 个字符
3. 只输出 commit message，不要其他内容`

    return await this.generate(prompt, { task: 'commit-message' })
  }

  /**
   * 清空历史
   */
  clearHistory(): void {
    this.messageHistory = []
  }

  /**
   * 获取系统提示词
   */
  private getSystemPrompt(context?: Context): string {
    let basePrompt = `你是一个专业的软件工程师 AI 助手，专门负责修复代码问题和改进代码质量。

你的职责：
1. 准确理解问题描述
2. 定位相关代码
3. 分析根本原因
4. 生成高质量的修复方案
5. 确保修复不会引入新问题

你的原则：
- 保持代码风格一致
- 添加必要的测试
- 编写清晰的注释
- 遵循最佳实践
- 考虑边界情况`

    if (context?.task === 'bug-fix') {
      basePrompt += `\n\n当前任务：修复 Bug
请仔细分析错误堆栈，找出根本原因，提供最小化的修复方案。`
    } else if (context?.task === 'code-analysis') {
      basePrompt += `\n\n当前任务：代码分析
请深入分析代码逻辑，识别潜在问题和改进空间。`
    }

    return basePrompt
  }

  /**
   * 调用 LLM API
   * 这里应该对接 OpenClaw 的 LLM 接口
   */
  private async callLLM(request: LLMRequest): Promise<LLMResponse> {
    // TODO: 对接 OpenClaw LLM 接口
    // 当前返回模拟响应
    
    console.log('[LLM] Calling model:', this.config.model)
    console.log('[LLM] Messages:', request.messages.length)

    // 模拟响应
    return {
      content: 'This is a mock response. Please integrate with OpenClaw LLM API.',
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      model: this.config.model,
      finishReason: 'stop',
    }
  }
}

export interface Context {
  task?: string
  repository?: string
  language?: string
}

export interface FixSuggestion {
  analysis: string
  rootCause: string
  solution: string
  modifiedCode: string
  explanation: string
}

/**
 * OpenClaw LLM 集成示例
 * 
 * 如果要对接 OpenClaw，可以这样实现：
 * 
 * import { getLLM } from '@openclaw/llm'
 * 
 * private async callLLM(request: LLMRequest): Promise<LLMResponse> {
 *   const llm = getLLM(this.config.model)
 *   const response = await llm.chat({
 *     messages: request.messages,
 *     temperature: request.temperature,
 *     max_tokens: request.maxTokens,
 *   })
 *   
 *   return {
 *     content: response.content,
 *     usage: {
 *       promptTokens: response.usage.prompt_tokens,
 *       completionTokens: response.usage.completion_tokens,
 *       totalTokens: response.usage.total_tokens,
 *     },
 *     model: response.model,
 *     finishReason: response.finish_reason,
 *   }
 * }
 */
