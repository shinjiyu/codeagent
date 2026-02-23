/**
 * SWE-Agent-Node - Core Types
 * 自进化软件开发 Agent 的类型定义
 */

// ==================== Issue 相关 ====================

export interface Issue {
  id: string
  url?: string
  title: string
  body: string
  labels?: string[]
  author?: string
  createdAt?: Date
  /** 从 body 中提取的错误信息 */
  errorTrace?: string
  /** 关键词列表 */
  keywords?: string[]
}

// ==================== Repository 相关 ====================

export interface Repository {
  url: string
  path: string
  branch?: string
  /** 项目结构信息 */
  structure?: ProjectStructure
  /** 技术栈 */
  techStack?: TechStack
}

export interface ProjectStructure {
  root: string
  srcDir?: string
  testDir?: string
  configFile?: string
  packageFile?: string
  directories: string[]
  files: string[]
}

export interface TechStack {
  language: string
  framework?: string
  testFramework?: string
  buildTool?: string
  packageManager?: string
}

// ==================== Code 相关 ====================

export interface CodeLocation {
  file: string
  line?: number
  column?: number
  /** 上下文代码片段 */
  context?: string
}

export interface CodeSnippet {
  file: string
  content: string
  startLine: number
  endLine: number
  language?: string
}

export interface CodeModification {
  file: string
  type: 'create' | 'modify' | 'delete'
  /** 修改前的内容 (modify/delete) */
  oldContent?: string
  /** 修改后的内容 (create/modify) */
  newContent: string
  /** 修改描述 */
  description?: string
}

// ==================== Execution 相关 ====================

export interface Step {
  id: string
  type: StepType
  input: any
  output: any
  reasoning?: string
  timestamp: Date
  duration?: number
  success: boolean
  error?: string
}

export type StepType = 
  | 'parse-issue'
  | 'analyze-repo'
  | 'search-code'
  | 'generate-fix'
  | 'apply-modification'
  | 'run-tests'
  | 'commit-changes'

export interface Trajectory {
  id: string
  issue: Issue
  repo: Repository
  steps: Step[]
  result: Result
  metadata: TrajectoryMetadata
  createdAt: Date
}

export interface Result {
  success: boolean
  modifications: CodeModification[]
  testResults?: TestResult
  commitHash?: string
  prUrl?: string
  summary: string
  error?: string
}

export interface TestResult {
  passed: number
  failed: number
  skipped: number
  total: number
  output?: string
  failures?: TestFailure[]
}

export interface TestFailure {
  test: string
  file: string
  message: string
  stack?: string
}

export interface TrajectoryMetadata {
  model: string
  temperature?: number
  maxTokens?: number
  totalTokens?: number
  totalCost?: number
  duration: number
  retryCount?: number
}

// ==================== Evolution 相关 ====================

export interface Pattern {
  id: string
  type: 'success' | 'failure'
  /** 触发条件/问题特征 */
  trigger: string
  /** 采取的行动 */
  action: string
  /** 结果 */
  outcome: string
  /** 置信度 0-1 */
  confidence: number
  /** 使用次数 */
  usage: number
  /** 最后使用时间 */
  lastUsed?: Date
  /** 关联的轨迹 ID */
  trajectoryIds: string[]
  createdAt: Date
  updatedAt: Date
}

export interface Knowledge {
  id: string
  category: KnowledgeCategory
  /** 问题描述 */
  problem: string
  /** 解决方案 */
  solution: string
  /** 代码片段 */
  codeSnippets: CodeSnippet[]
  /** 参考链接 */
  references: string[]
  /** 评分 0-10 */
  score: number
  /** 使用次数 */
  usage: number
  /** 标签 */
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

export type KnowledgeCategory = 
  | 'bug-fix'
  | 'refactor'
  | 'feature'
  | 'optimization'
  | 'documentation'
  | 'test'
  | 'config'

export interface Strategy {
  /** 搜索优先级权重 */
  searchWeights: Record<string, number>
  /** Prompt 模板 */
  promptTemplates: Record<string, string>
  /** 决策阈值 */
  thresholds: Record<string, number>
  /** 首选工具 */
  preferredTools: string[]
  /** 最后更新时间 */
  updatedAt: Date
}

// ==================== Agent Configuration ====================

export interface AgentConfig {
  /** 最大步骤数 */
  maxSteps: number
  /** 最大重试次数 */
  maxRetries: number
  /** LLM 配置 */
  llm: LLMConfig
  /** Git 配置 */
  git: GitConfig
  /** 测试配置 */
  test: TestConfig
  /** 进化配置 */
  evolution: EvolutionConfig
}

export interface LLMConfig {
  model: string
  temperature?: number
  maxTokens?: number
  /** OpenClaw API endpoint */
  endpoint?: string
}

export interface GitConfig {
  /** 默认分支名 */
  defaultBranch: string
  /** Commit message 模板 */
  commitTemplate: string
  /** 是否自动 push */
  autoPush: boolean
}

export interface TestConfig {
  /** 测试命令 */
  command: string
  /** 测试文件模式 */
  pattern: string
  /** 超时时间 (ms) */
  timeout: number
}

export interface EvolutionConfig {
  /** 是否启用自进化 */
  enabled: boolean
  /** 模式挖掘间隔 (执行次数) */
  patternMiningInterval: number
  /** 最小置信度阈值 */
  minConfidence: number
  /** 知识库最大容量 */
  maxKnowledgeSize: number
}

// ==================== LLM 相关 ====================

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMRequest {
  messages: LLMMessage[]
  temperature?: number
  maxTokens?: number
  stopSequences?: string[]
}

export interface LLMResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  model: string
  finishReason: string
}

// ==================== Tool 相关 ====================

export interface Tool {
  name: string
  description: string
  execute: (params: any) => Promise<any>
  parameters?: ToolParameter[]
}

export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  required: boolean
  description: string
}

// ==================== Shell 相关 ====================

export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
  success: boolean
  duration: number
}

// ==================== Events ====================

export interface AgentEvent {
  type: AgentEventType
  data: any
  timestamp: Date
}

export type AgentEventType =
  | 'step:start'
  | 'step:end'
  | 'step:error'
  | 'llm:request'
  | 'llm:response'
  | 'code:modify'
  | 'test:run'
  | 'git:commit'
  | 'evolution:learn'
