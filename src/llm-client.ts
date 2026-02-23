/**
 * SWE-Agent-Node - LLM Client
 * 与语言模型交互，支持 Tool Calling
 */

import type { 
  LLMConfig, 
  LLMMessage, 
  LLMRequest, 
  LLMResponse,
  ToolDefinition,
  ToolCall,
  Tool
} from './types'

export class LLMClient {
  private config: LLMConfig
  private messageHistory: LLMMessage[] = []
  private tools: Map<string, Tool> = new Map()
  private toolDefinitions: ToolDefinition[] = []

  constructor(config: LLMConfig) {
    this.config = config
  }

  /**
   * 注册工具
   */
  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool)
    
    // 构建 tool definition
    const definition: ToolDefinition = {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    }

    // 添加参数定义
    if (tool.parameters) {
      for (const param of tool.parameters) {
        definition.function.parameters.properties[param.name] = {
          type: param.type,
          description: param.description,
        }
        if (param.required) {
          definition.function.parameters.required!.push(param.name)
        }
      }
    }

    this.toolDefinitions.push(definition)
  }

  /**
   * 注册多个工具
   */
  registerTools(tools: Tool[]): void {
    for (const tool of tools) {
      this.registerTool(tool)
    }
  }

  /**
   * 获取已注册的工具定义
   */
  getToolDefinitions(): ToolDefinition[] {
    return this.toolDefinitions
  }

  /**
   * 执行工具调用
   */
  async executeToolCall(toolCall: ToolCall): Promise<string> {
    const toolName = toolCall.function.name
    const tool = this.tools.get(toolName)
    
    if (!tool) {
      return JSON.stringify({ error: `Unknown tool: ${toolName}` })
    }

    try {
      const args = JSON.parse(toolCall.function.arguments)
      const result = await tool.execute(args)
      return JSON.stringify(result)
    } catch (error: any) {
      return JSON.stringify({ error: error.message })
    }
  }

  /**
   * 生成响应（支持 Tool Calling）
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

    // 循环处理 tool calls
    let response = await this.generateWithTools(messages)
    let iterations = 0
    const maxIterations = 10

    while (response.toolCalls && response.toolCalls.length > 0 && iterations < maxIterations) {
      iterations++
      
      // 添加 assistant 消息（包含 tool calls）
      messages.push({
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls,
      })

      // 执行每个 tool call 并添加结果
      for (const toolCall of response.toolCalls) {
        const toolResult = await this.executeToolCall(toolCall)
        messages.push({
          role: 'tool',
          content: toolResult,
          toolCallId: toolCall.id,
        })
      }

      // 继续生成
      response = await this.generateWithTools(messages)
    }

    // 添加到历史
    this.messageHistory.push(
      { role: 'user', content: prompt },
      { role: 'assistant', content: response.content }
    )

    return response.content
  }

  /**
   * 使用工具生成响应
   */
  private async generateWithTools(messages: LLMMessage[]): Promise<LLMResponse> {
    const request: LLMRequest = {
      messages,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      tools: this.toolDefinitions.length > 0 ? this.toolDefinitions : undefined,
      toolChoice: this.toolDefinitions.length > 0 ? 'auto' : undefined,
    }

    return await this.callLLM(request)
  }

  /**
   * 不使用工具的简单生成
   */
  async generateSimple(prompt: string, context?: Context): Promise<string> {
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

    if (this.tools.size > 0) {
      basePrompt += `\n\n你可以使用以下工具：
${Array.from(this.tools.values()).map(t => `- ${t.name}: ${t.description}`).join('\n')}

当需要执行操作时，请使用工具调用而不是描述操作。`
    }

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
    console.log('[LLM] Tools:', request.tools?.length || 0)

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
 * 预定义工具集合
 */
export const BUILTIN_TOOLS: Tool[] = [
  {
    name: 'read_file',
    description: '读取文件内容',
    parameters: [
      { name: 'path', type: 'string', required: true, description: '文件路径' },
    ],
    execute: async (params: { path: string }) => {
      const fs = await import('fs')
      return { content: fs.readFileSync(params.path, 'utf-8') }
    },
  },
  {
    name: 'write_file',
    description: '写入文件内容',
    parameters: [
      { name: 'path', type: 'string', required: true, description: '文件路径' },
      { name: 'content', type: 'string', required: true, description: '文件内容' },
    ],
    execute: async (params: { path: string; content: string }) => {
      const fs = await import('fs')
      fs.writeFileSync(params.path, params.content, 'utf-8')
      return { success: true }
    },
  },
  {
    name: 'run_command',
    description: '执行 Shell 命令',
    parameters: [
      { name: 'command', type: 'string', required: true, description: '要执行的命令' },
      { name: 'cwd', type: 'string', required: false, description: '工作目录' },
    ],
    execute: async (params: { command: string; cwd?: string }) => {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)
      try {
        const { stdout, stderr } = await execAsync(params.command, { cwd: params.cwd })
        return { stdout, stderr, success: true }
      } catch (error: any) {
        return { stdout: '', stderr: error.message, success: false }
      }
    },
  },
  {
    name: 'search_code',
    description: '在代码库中搜索关键词',
    parameters: [
      { name: 'query', type: 'string', required: true, description: '搜索查询' },
      { name: 'filePattern', type: 'string', required: false, description: '文件模式' },
    ],
    execute: async (params: { query: string; filePattern?: string }) => {
      // 简单实现，实际应该使用 CodeSearch
      return { results: [], note: 'Use CodeSearch class for actual implementation' }
    },
  },
]

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
 *     tools: request.tools,
 *     tool_choice: request.toolChoice,
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
 *     toolCalls: response.tool_calls,
 *   }
 * }
 */
