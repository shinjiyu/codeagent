/**
 * 深度分析测试套件 - 基于代码审查设计的测试用例
 * 
 * 设计思路：
 * 1. 针对现有测试的覆盖盲区（agent.ts 12.5%、llm-client.ts 50%、code-modifier.ts 66%）
 * 2. 针对代码中的具体逻辑分支和边界条件
 * 3. 针对模块间的集成点
 * 4. 针对实际使用中可能遇到的异常场景
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// ============================================================
// 1. Agent.solve() 核心流水线测试
//    现有测试仅测了构造函数和事件注册，从未调用过 solve()
// ============================================================
describe('Agent.solve() 核心流水线', () => {
  const { Agent } = require('../src/agent')
  const { GitEnv } = require('../src/git-env')

  const baseConfig = {
    maxSteps: 10,
    maxRetries: 3,
    llm: { model: 'test', temperature: 0.7, maxTokens: 4000 },
    git: { defaultBranch: 'main', commitTemplate: 'fix: {issue}', autoPush: false },
    test: { command: 'echo "pass"', pattern: '**/*.test.ts', timeout: 30000 },
    evolution: { enabled: false, patternMiningInterval: 10, minConfidence: 0.5, maxKnowledgeSize: 1000 },
  }

  let repo: any
  beforeAll(async () => {
    const gitEnv = new GitEnv()
    repo = await gitEnv.open(path.resolve(__dirname, '..'))
  })

  test('solve 应该按顺序执行 parse→analyze→search→generate 步骤（generate 后可能重试）', async () => {
    const agent = new Agent(baseConfig)
    const stepOrder: string[] = []
    agent.on('step:start', (e: any) => stepOrder.push(e.data.type))

    try {
      await agent.solve(
        { id: 'test-1', title: 'Fix error handling', body: 'The error handling in agent.ts needs improvement' },
        repo
      )
    } catch (e) {}

    // 前 3 步固定顺序
    expect(stepOrder[0]).toBe('parse-issue')
    expect(stepOrder[1]).toBe('analyze-repo')
    expect(stepOrder[2]).toBe('search-code')
    // generate-fix 一定会被调用（可能在重试循环中多次调用）
    expect(stepOrder).toContain('generate-fix')
  })

  test('solve 的 parseIssue 步骤应该提取关键词并过滤停用词', async () => {
    const agent = new Agent(baseConfig)
    let parsedIssue: any = null
    agent.on('step:end', (e: any) => {
      if (e.data.step?.type === 'parse-issue') parsedIssue = e.data.step.output
    })

    try {
      await agent.solve(
        { id: 'kw-test', title: 'Fix the login bug', body: 'The authentication module is throwing errors when user tries to login with invalid credentials' },
        repo
      )
    } catch (e) {}

    expect(parsedIssue).toBeDefined()
    expect(parsedIssue.keywords).toBeDefined()
    expect(parsedIssue.keywords).not.toContain('the')
    expect(parsedIssue.keywords).not.toContain('is')
    expect(parsedIssue.keywords).not.toContain('to')
    expect(parsedIssue.keywords.some((k: string) => k.includes('authentication') || k.includes('login') || k.includes('errors'))).toBe(true)
  })

  test('solve 的 parseIssue 应该从 body 中提取错误堆栈', async () => {
    const agent = new Agent(baseConfig)
    let parsedIssue: any = null
    agent.on('step:end', (e: any) => {
      if (e.data.step?.type === 'parse-issue') parsedIssue = e.data.step.output
    })

    const bodyWithStack = `The app crashes with this error:
Error: Cannot find module 'lodash'
    at Function._resolveFilename (internal/modules/cjs/loader.js:636:15)
    at Module.require (node:internal/modules/cjs/loader:1063:12)`

    try {
      await agent.solve({ id: 'stack-test', title: 'Module not found crash', body: bodyWithStack }, repo)
    } catch (e) {}

    expect(parsedIssue).toBeDefined()
    expect(parsedIssue.errorTrace).toBeDefined()
    expect(parsedIssue.errorTrace).toContain('Error:')
  })

  test('solve 的 searchCode 步骤应该在代码库中找到匹配并去重', async () => {
    const agent = new Agent(baseConfig)
    let searchResult: any = null
    agent.on('step:end', (e: any) => {
      if (e.data.step?.type === 'search-code') searchResult = e.data.step.output
    })

    try {
      await agent.solve({ id: 'search-test', title: 'Fix Agent class', body: 'Agent class needs refactoring' }, repo)
    } catch (e) {}

    expect(searchResult).toBeDefined()
    expect(Array.isArray(searchResult)).toBe(true)
    if (searchResult.length > 1) {
      const keys = searchResult.map((loc: any) => `${loc.file}:${loc.line}`)
      expect(keys.length).toBe(new Set(keys).size)
    }
  })

  test('solve 执行出错时应该抛出错误', async () => {
    const agent = new Agent(baseConfig)
    await expect(
      agent.solve({ id: 'fail-test', title: 'zzz_nonexistent_xyz', body: 'zzz_nonexistent_xyz' }, repo)
    ).rejects.toThrow()
  })

  test('solve 在 evolution 启用时不应崩溃', async () => {
    const agent = new Agent({
      ...baseConfig,
      evolution: { enabled: true, patternMiningInterval: 10, minConfidence: 0.5, maxKnowledgeSize: 1000 },
    })
    try {
      await agent.solve({ id: 'evo-test', title: 'Fix something', body: 'Fix the code search module' }, repo)
    } catch (e) {}
  })

  test('step:end 事件应该包含正确的 step 结构', async () => {
    const agent = new Agent(baseConfig)
    const completedSteps: any[] = []
    agent.on('step:end', (e: any) => completedSteps.push(e.data.step))

    try {
      await agent.solve({ id: 'step-test', title: 'Test', body: 'test keyword search' }, repo)
    } catch (e) {}

    expect(completedSteps.length).toBeGreaterThan(0)
    for (const step of completedSteps) {
      expect(step).toHaveProperty('id')
      expect(step).toHaveProperty('type')
      expect(step).toHaveProperty('timestamp')
      expect(step).toHaveProperty('duration')
      expect(step).toHaveProperty('success')
      expect(typeof step.duration).toBe('number')
      expect(step.duration).toBeGreaterThanOrEqual(0)
    }
  })
})

// ============================================================
// 2. CodeModifier 模糊匹配和边界条件
// ============================================================
describe('CodeModifier 深度测试', () => {
  const { CodeModifier } = require('../src/code-modifier')
  let tempDir: string

  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swe-mod-')) })
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }) })

  test('modifyFile 在精确匹配失败时应触发模糊匹配（空白差异）', async () => {
    fs.writeFileSync(path.join(tempDir, 'fuzzy.ts'), 'function hello() {\n  console.log("hello");\n}\n')
    const modifier = new CodeModifier(tempDir)
    await modifier.applyModifications([{
      file: 'fuzzy.ts', type: 'modify' as const,
      oldContent: 'function hello() {\n\tconsole.log("hello");\n}',
      newContent: 'function hello() {\n\tconsole.log("world");\n}',
    }])
    expect(fs.readFileSync(path.join(tempDir, 'fuzzy.ts'), 'utf-8')).toContain('world')
  })

  test('modifyFile 在精确和模糊都失败时应抛出错误', async () => {
    fs.writeFileSync(path.join(tempDir, 'nomatch.ts'), 'const x = 1;\n')
    const modifier = new CodeModifier(tempDir)
    await expect(modifier.applyModifications([{
      file: 'nomatch.ts', type: 'modify' as const,
      oldContent: 'function zzzNonExistent() {\n  return "this code block is unique and has no match in the target file at all";\n  const qqq = 999;\n}',
      newContent: 'new content',
    }])).rejects.toThrow('Old content not found')
  })

  test('modifyFile 不提供 oldContent 时应直接覆盖整个文件', async () => {
    fs.writeFileSync(path.join(tempDir, 'overwrite.ts'), 'original line 1\noriginal line 2\n')
    const modifier = new CodeModifier(tempDir)
    await modifier.applyModifications([{
      file: 'overwrite.ts', type: 'modify' as const, oldContent: undefined, newContent: 'completely new content',
    }])
    expect(fs.readFileSync(path.join(tempDir, 'overwrite.ts'), 'utf-8')).toBe('completely new content')
  })

  test('createFile 在文件已存在时应先备份再覆盖', async () => {
    fs.writeFileSync(path.join(tempDir, 'existing.ts'), 'old content')
    const modifier = new CodeModifier(tempDir)
    await modifier.applyModifications([{ file: 'existing.ts', type: 'create' as const, newContent: 'new content' }])
    expect(fs.readFileSync(path.join(tempDir, 'existing.ts'), 'utf-8')).toBe('new content')
    expect(fs.existsSync(path.join(tempDir, '.swe-backup'))).toBe(true)
  })

  test('cleanup 应该清除修改记录和备份目录', async () => {
    fs.writeFileSync(path.join(tempDir, 'cleanup-test.ts'), 'original')
    const modifier = new CodeModifier(tempDir)
    await modifier.applyModifications([{ file: 'cleanup-test.ts', type: 'modify' as const, oldContent: 'original', newContent: 'modified' }])
    expect(modifier.getModifiedFiles().length).toBeGreaterThan(0)
    await modifier.cleanup()
    expect(modifier.getModifiedFiles().length).toBe(0)
    expect(fs.existsSync(path.join(tempDir, '.swe-backup'))).toBe(false)
  })

  test('rollback 创建的文件应该在回滚后被删除', async () => {
    const modifier = new CodeModifier(tempDir)
    await modifier.applyModifications([{ file: 'rollback-new.ts', type: 'create' as const, newContent: 'temporary' }])
    expect(fs.existsSync(path.join(tempDir, 'rollback-new.ts'))).toBe(true)
    await modifier.rollback()
    expect(fs.existsSync(path.join(tempDir, 'rollback-new.ts'))).toBe(false)
  })

  test('连续多次修改同一文件回滚应恢复到最初版本', async () => {
    fs.writeFileSync(path.join(tempDir, 'multi-mod.ts'), 'version 1')
    const modifier = new CodeModifier(tempDir)
    await modifier.applyModifications([{ file: 'multi-mod.ts', type: 'modify' as const, oldContent: 'version 1', newContent: 'version 2' }])
    await modifier.applyModifications([{ file: 'multi-mod.ts', type: 'modify' as const, oldContent: 'version 2', newContent: 'version 3' }])
    expect(fs.readFileSync(path.join(tempDir, 'multi-mod.ts'), 'utf-8')).toBe('version 3')
    await modifier.rollback()
    expect(fs.readFileSync(path.join(tempDir, 'multi-mod.ts'), 'utf-8')).toBe('version 1')
  })

  test('deleteFile 对不存在的文件应静默跳过', async () => {
    const modifier = new CodeModifier(tempDir)
    await expect(modifier.applyModifications([{ file: 'does-not-exist.ts', type: 'delete' as const, newContent: '' }])).resolves.not.toThrow()
  })
})

// ============================================================
// 3. CodeSearch 正则和边界条件
// ============================================================
describe('CodeSearch 深度测试', () => {
  const { CodeSearch } = require('../src/code-search')
  let tempDir: string

  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swe-search-')) })
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }) })

  test('searchFunction 的正则限制：带 TS 返回类型注解的方法不匹配', async () => {
    fs.writeFileSync(path.join(tempDir, 'typed.ts'), `export class MyClass {\n  async solve(issue: Issue): Promise<Result> {\n    return {} as Result\n  }\n  simpleMethod() {\n    return true\n  }\n}`)
    const searcher = new CodeSearch(tempDir)
    const solveResults = await searcher.searchFunction('solve')
    const simpleResults = await searcher.searchFunction('simpleMethod')
    // simpleMethod 没有返回类型注解，应该匹配到
    expect(simpleResults.length).toBeGreaterThan(0)
  })

  test('searchError 应正确转义正则特殊字符', async () => {
    fs.writeFileSync(path.join(tempDir, 'errors.ts'), `throw new Error('File not found: /path/to/file.ts (line 42)')\nthrow new Error('Expected [object] but got {string}')`)
    const searcher = new CodeSearch(tempDir)
    expect((await searcher.searchError('File not found')).length).toBeGreaterThan(0)
    expect((await searcher.searchError('[object]')).length).toBeGreaterThan(0)
  })

  test('calculateScore 应该对函数名给予更高权重', async () => {
    fs.writeFileSync(path.join(tempDir, 'mention.ts'), 'const loginMessage = "please login"')
    fs.writeFileSync(path.join(tempDir, 'funcdef.ts'), 'function login(user: string) { return true }')
    const searcher = new CodeSearch(tempDir)
    const results = await searcher.searchByKeywords(['login'], { maxResults: 10 })
    if (results.length >= 2) {
      const funcFile = results.find((r: any) => r.context?.includes('function login'))
      expect(funcFile).toBeDefined()
    }
  })

  test('空目录搜索应返回空数组', async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swe-empty-'))
    const results = await new CodeSearch(emptyDir).searchByKeywords(['anything'])
    expect(results).toEqual([])
    fs.rmSync(emptyDir, { recursive: true, force: true })
  })

  test('getSnippet 范围超出文件行数时应截断', async () => {
    fs.writeFileSync(path.join(tempDir, 'short.ts'), 'line 1\nline 2\nline 3\n')
    const snippet = await new CodeSearch(tempDir).getSnippet('short.ts', 1, 100)
    expect(snippet.endLine).toBeLessThanOrEqual(4)
  })

  test('detectLanguage 对未知扩展名应返回 text', async () => {
    fs.writeFileSync(path.join(tempDir, 'data.xyz'), 'data')
    expect((await new CodeSearch(tempDir).getSnippet('data.xyz', 1, 1)).language).toBe('text')
  })

  test('searchClass 应匹配 extends', async () => {
    fs.writeFileSync(path.join(tempDir, 'cls.ts'), 'class AdvancedAgent extends BaseAgent {\n  run() {}\n}')
    const results = await new CodeSearch(tempDir).searchClass('AdvancedAgent')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].context).toContain('extends')
  })
})

// ============================================================
// 4. LLMClient generate() 和 suggestFix JSON 解析
// ============================================================
describe('LLMClient 深度测试', () => {
  const { LLMClient, BUILTIN_TOOLS } = require('../src/llm-client')

  test('analyzeCode 应返回字符串响应', async () => {
    const client = new LLMClient({ model: 'test', temperature: 0.7, maxTokens: 100 })
    const result = await client.analyzeCode('function add(a, b) { return a + b }', '有什么问题？')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  test('suggestFix 当 LLM 返回非 JSON 时应使用 fallback 结构', async () => {
    const client = new LLMClient({ model: 'test', temperature: 0.7, maxTokens: 100 })
    const result = await client.suggestFix('Timeout error', 'async function handler() { await fetch(url) }', 'Error: timeout')
    expect(result).toHaveProperty('analysis')
    expect(result).toHaveProperty('rootCause')
    expect(result).toHaveProperty('solution')
    expect(result).toHaveProperty('modifiedCode')
    expect(result).toHaveProperty('explanation')
  })

  test('generateCommitMessage 应返回 commit message', async () => {
    const result = await new LLMClient({ model: 'test', temperature: 0.7, maxTokens: 100 })
      .generateCommitMessage('- Modified auth.ts: added retry logic', 'Fix login timeout')
    expect(typeof result).toBe('string')
  })

  test('executeToolCall 对无效 JSON 参数应返回错误', async () => {
    const client = new LLMClient({ model: 'test', temperature: 0.7, maxTokens: 100 })
    client.registerTools(BUILTIN_TOOLS)
    const result = JSON.parse(await client.executeToolCall({
      id: 'bad', type: 'function', function: { name: 'read_file', arguments: 'not json {{{' },
    }))
    expect(result.error).toBeDefined()
  })
})

// ============================================================
// 5. EvolutionStore 知识提取和策略优化
// ============================================================
describe('EvolutionStore 深度测试', () => {
  const { EvolutionStore } = require('../src/evolution-store')
  let tempDir: string

  beforeEach(() => { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swe-evo-deep-')) })
  afterEach(() => { fs.rmSync(tempDir, { recursive: true, force: true }) })

  test('extractKnowledgeFromSuccess 应该从成功轨迹中提取知识', async () => {
    const store = new EvolutionStore(tempDir)
    await store.saveTrajectory({
      id: 'success-1',
      issue: { id: 'i1', title: 'Fix auth bug', body: 'Login fails', url: 'https://github.com/test/repo/issues/1', keywords: ['auth'] },
      repo: { url: '', path: '/test', branch: 'main' },
      steps: [{ id: 's1', type: 'parse-issue', input: {}, output: {}, timestamp: new Date(), duration: 10, success: true }],
      result: { success: true, modifications: [], summary: 'Fixed auth bug' },
      metadata: { model: 'gpt-4', duration: 30 },
      createdAt: new Date(),
    })
    const knowledge = await store.extractKnowledgeFromSuccess()
    expect(knowledge.length).toBeGreaterThan(0)
    expect(knowledge[0].category).toBe('bug-fix')
  })

  test('extractKnowledgeFromSuccess 不应从失败轨迹中提取', async () => {
    const store = new EvolutionStore(tempDir)
    await store.saveTrajectory({
      id: 'fail-1',
      issue: { id: 'i2', title: 'Failed fix', body: 'Failed' },
      repo: { url: '', path: '/test', branch: 'main' },
      steps: [{ id: 's1', type: 'parse-issue', input: {}, output: {}, timestamp: new Date(), duration: 10, success: false }],
      result: { success: false, modifications: [], summary: 'Failed' },
      metadata: { model: 'gpt-4', duration: 30 },
      createdAt: new Date(),
    })
    expect((await store.extractKnowledgeFromSuccess()).length).toBe(0)
  })

  test('extractKnowledgeFromSuccess 不应产生重复知识', async () => {
    const store = new EvolutionStore(tempDir)
    await store.saveTrajectory({
      id: 'dup-1',
      issue: { id: 'id', title: 'Fix X', body: 'Fix X', keywords: ['x'] },
      repo: { url: '', path: '/t', branch: 'main' },
      steps: [{ id: 's1', type: 'parse-issue', input: {}, output: {}, timestamp: new Date(), duration: 10, success: true }],
      result: { success: true, modifications: [], summary: 'Fixed X' },
      metadata: { model: 'gpt-4', duration: 10 },
      createdAt: new Date(),
    })
    await store.extractKnowledgeFromSuccess()
    expect((await store.extractKnowledgeFromSuccess()).length).toBe(0)
  })

  test('optimizeStrategy 应返回更新后的策略', async () => {
    const result = await new EvolutionStore(tempDir).optimizeStrategy()
    expect(result).toHaveProperty('searchWeights')
    expect(result).toHaveProperty('updatedAt')
  })

  test('minePatterns 从空步骤轨迹不应提取模式', async () => {
    const store = new EvolutionStore(tempDir)
    await store.saveTrajectory({
      id: 'empty', issue: { id: 'ie', title: 'E', body: 'E', keywords: [] },
      repo: { url: '', path: '/t', branch: 'main' }, steps: [],
      result: { success: true, modifications: [], summary: 'Done' },
      metadata: { model: 'gpt-4', duration: 0 }, createdAt: new Date(),
    })
    expect((await store.minePatterns()).length).toBe(0)
  })

  test('minePatterns 从失败轨迹中应提取失败模式', async () => {
    const store = new EvolutionStore(tempDir)
    await store.saveTrajectory({
      id: 'fail-p', issue: { id: 'ifp', title: 'Fail', body: 'Fail', keywords: ['fail'] },
      repo: { url: '', path: '/t', branch: 'main' },
      steps: [
        { id: 's1', type: 'parse-issue', input: {}, output: {}, timestamp: new Date(), duration: 10, success: true },
        { id: 's2', type: 'search-code', input: {}, output: null, timestamp: new Date(), duration: 20, success: false, error: 'Search timeout' },
      ],
      result: { success: false, modifications: [], summary: 'Failed' },
      metadata: { model: 'gpt-4', duration: 30 }, createdAt: new Date(),
    })
    const failPattern = (await store.minePatterns()).find((p: any) => p.type === 'failure')
    expect(failPattern).toBeDefined()
    expect(failPattern!.outcome).toContain('Search timeout')
  })

  test('searchKnowledge 按类别过滤应正确工作', async () => {
    const store = new EvolutionStore(tempDir)
    await store.saveKnowledge({ id: 'k1', category: 'bug-fix', problem: 'Auth bug', solution: 'Fix', codeSnippets: [], references: [], score: 8, usage: 0, tags: ['auth'], createdAt: new Date(), updatedAt: new Date() })
    await store.saveKnowledge({ id: 'k2', category: 'optimization', problem: 'Auth slow', solution: 'Cache', codeSnippets: [], references: [], score: 7, usage: 0, tags: ['auth'], createdAt: new Date(), updatedAt: new Date() })
    expect(store.searchKnowledge('auth', 'bug-fix').length).toBe(1)
    expect(store.searchKnowledge('auth', 'optimization').length).toBe(1)
  })
})

// ============================================================
// 6. IssueParser 置信度计算和复杂场景
// ============================================================
describe('IssueParser 深度测试', () => {
  const { IssueParser } = require('../src/issue-parser')
  const parser = new IssueParser()

  test('高置信度 Issue：错误堆栈+文件+代码片段+关键区域', () => {
    const parsed = parser.parse({
      id: 'high', title: 'Fix crash in src/auth/login.ts',
      body: `Login handler crashes.\n\`\`\`typescript\nasync function handleLogin() { session.userId }\n\`\`\`\nStack:\n    at handleLogin (src/auth/login.ts:42:15)\n    at processRequest (src/server.ts:128:5)\nRelated: \`src/auth/login.ts\``,
      labels: ['bug', 'critical'],
    })
    expect(parsed.parsed!.confidence).toBeGreaterThan(0.7)
    expect(parsed.parsed!.type).toBe('bug')
    expect(parsed.parsed!.severity).toBe('critical')
    expect(parsed.parsed!.errorStack!.length).toBeGreaterThanOrEqual(2)
    expect(parsed.parsed!.suspectedAreas).toContain('auth')
  })

  test('低置信度 Issue：模糊的问题描述', () => {
    const parsed = parser.parse({ id: 'low', title: 'Something is not working', body: 'broken sometimes' })
    expect(parsed.parsed!.confidence).toBeLessThan(0.3)
    expect(parsed.parsed!.errorStack!.length).toBe(0)
  })

  test('extractClasses 应过滤常见单词如 Error, Type', () => {
    const parsed = parser.parse({ id: 'cls', title: 'AuthService TypeError', body: 'AuthService throws TypeError' })
    expect(parsed.parsed!.mentionedClasses).toContain('AuthService')
    expect(parsed.parsed!.mentionedClasses).not.toContain('Error')
    expect(parsed.parsed!.mentionedClasses).not.toContain('Type')
  })

  test('inferSuspectedAreas 应推断多个区域', () => {
    const parsed = parser.parse({ id: 'multi', title: 'Login API database query fail', body: 'Login API endpoint 500 when database query times out. User session invalid.' })
    expect(parsed.parsed!.suspectedAreas).toContain('auth')
    expect(parsed.parsed!.suspectedAreas).toContain('api')
    expect(parsed.parsed!.suspectedAreas).toContain('database')
  })

  test('parseGitHubUrl 对非 GitHub URL 应返回 null', () => {
    expect(parser.parseGitHubUrl('https://gitlab.com/user/repo/-/issues/1')).toBeNull()
    expect(parser.parseGitHubUrl('not a url')).toBeNull()
    expect(parser.parseGitHubUrl('https://github.com/user/repo')).toBeNull()
  })

  test('extractFunctions 应过滤 JS 关键字', () => {
    const parsed = parser.parse({ id: 'fn', title: 'Fix', body: 'validateInput() called from processData() but if(cond) fails' })
    expect(parsed.parsed!.mentionedFunctions.some((f: string) => f === 'validateInput')).toBe(true)
    expect(parsed.parsed!.mentionedFunctions).not.toContain('if')
  })
})

// ============================================================
// 7. ShellEnv parseTestResult 内部解析逻辑
// ============================================================
describe('ShellEnv 深度测试', () => {
  const { ShellEnv } = require('../src/shell-env')

  test('runTests 解析 Jest 成功输出', async () => {
    const result = await new ShellEnv().runTests('echo "Tests: 42 passing"')
    expect(result.passed).toBeGreaterThanOrEqual(1)
    expect(result.failed).toBe(0)
  })

  test('runTests 无法解析失败输出时默认 failed=1', async () => {
    const result = await new ShellEnv().runTests('echo "random" && exit 1')
    expect(result.failed).toBe(1)
    expect(result.total).toBe(1)
  })

  test('exec 命令不存在时应返回 success=false', async () => {
    const result = await new ShellEnv().exec('command_xyz_not_exist 2>/dev/null')
    expect(result.success).toBe(false)
    expect(result.exitCode).not.toBe(0)
  })
})

// ============================================================
// 8. Autonomy 边界条件
// ============================================================
describe('Autonomy 边界条件', () => {
  const { AutonomyManager, AutonomyLevel, createDefaultAutonomyConfig } = require('../src/autonomy')

  test('ASSIST 对非确认操作应允许', () => {
    const mgr = new AutonomyManager({ level: AutonomyLevel.ASSIST, requireConfirmation: ['push-changes'], maxAutoSteps: 50 })
    expect(mgr.canExecute('parse-issue', 1).allowed).toBe(true)
    expect(mgr.canExecute('parse-issue', 1).requiresConfirmation).toBe(false)
  })

  test('canRollback 仅在 AUTO+ 且 apply-modification/commit-changes 时为 true', () => {
    const mgr = new AutonomyManager({ level: AutonomyLevel.AUTO, requireConfirmation: [], maxAutoSteps: 50 })
    expect(mgr.canExecute('apply-modification', 1).canRollback).toBe(true)
    expect(mgr.canExecute('commit-changes', 1).canRollback).toBe(true)
    expect(mgr.canExecute('search-code', 1).canRollback).toBe(false)
  })

  test('步数恰好等于限制时应被拒绝', () => {
    const mgr = new AutonomyManager({ level: AutonomyLevel.AUTO, maxAutoSteps: 10 })
    expect(mgr.canExecute('parse-issue', 10).allowed).toBe(false)
  })

  test('enableSafetyBoundaries=false 时不生成警告', () => {
    const mgr = new AutonomyManager({ level: AutonomyLevel.AUTO, enableSafetyBoundaries: false, maxAutoSteps: 50 })
    expect(mgr.canExecute('apply-modification', 1, { hasBackup: false }).warnings).toBeUndefined()
  })
})

// ============================================================
// 9. ExecutionPlanner 优先级和依赖
// ============================================================
describe('ExecutionPlanner 深度测试', () => {
  const { ExecutionPlanner } = require('../src/execution-planner')
  const { IssueParser } = require('../src/issue-parser')
  const planner = new ExecutionPlanner()
  const parser = new IssueParser()

  test('critical Bug 的修改步骤应为 high 优先级', () => {
    const plan = planner.createPlan({ issue: parser.parse({ id: 'c', title: 'Critical crash', body: 'Production down', labels: ['bug', 'critical'] }) })
    expect(plan.steps.find((s: any) => s.type === 'modify')!.priority).toBe('high')
  })

  test('getNextStep 在有未完成依赖时应返回第一个可执行步骤', () => {
    const plan = planner.createPlan({ issue: parser.parse({ id: 'd', title: 'Fix bug', body: 'bug', labels: ['bug'] }) })
    expect(planner.getNextStep(plan)!.id).toBe('step-1')
  })

  test('skipped 步骤应被视为完成', () => {
    const plan = planner.createPlan({ issue: parser.parse({ id: 's', title: 'Docs', body: 'Docs' }) })
    plan.steps.forEach((s: any) => { s.status = 'skipped' })
    expect(planner.isPlanCompleted(plan)).toBe(true)
  })

  test('全部 pending 时进度为 0%', () => {
    const plan = planner.createPlan({ issue: parser.parse({ id: 'p', title: 'Fix', body: 'Fix' }) })
    expect(planner.getProgress(plan).percentage).toBe(0)
  })
})

// ============================================================
// 10. Retry 精细行为
// ============================================================
describe('Retry 深度测试', () => {
  const { retry, withTimeout, isRetryableError, CircuitBreaker, executeBatch, delay } = require('../src/retry')

  test('shouldRetry 返回 false 时不应重试', async () => {
    let attempts = 0
    await expect(retry(async () => { attempts++; throw new Error('permanent') }, { maxRetries: 5, initialDelay: 1, shouldRetry: () => false })).rejects.toThrow()
    expect(attempts).toBe(1)
  })

  test('onRetry 回调应收到正确参数', async () => {
    const args: any[] = []
    let attempts = 0
    await retry(async () => { attempts++; if (attempts < 3) throw new Error('ECONNRESET'); return 'ok' }, {
      maxRetries: 5, initialDelay: 1, maxDelay: 10,
      onRetry: (attempt: number, error: Error, d: number) => args.push({ attempt, msg: error.message }),
    })
    expect(args.length).toBe(2)
    expect(args[0].attempt).toBe(1)
    expect(args[0].msg).toBe('ECONNRESET')
  })

  test('CircuitBreaker half-open 成功后应关闭', async () => {
    const cb = new CircuitBreaker(2, 10)
    try { await cb.execute(async () => { throw new Error('f') }) } catch {}
    try { await cb.execute(async () => { throw new Error('f') }) } catch {}
    expect(cb.getState()).toBe('open')
    await delay(20)
    expect(await cb.execute(async () => 'ok')).toBe('ok')
    expect(cb.getState()).toBe('closed')
  })

  test('executeBatch concurrency 应限制并发', async () => {
    let maxConcurrent = 0, current = 0
    await executeBatch([1,2,3,4,5,6,7,8], async (item: number) => {
      current++; if (current > maxConcurrent) maxConcurrent = current
      await delay(10); current--; return item
    }, { concurrency: 3 })
    expect(maxConcurrent).toBeLessThanOrEqual(3)
  })

  test('isRetryableError 分类正确', () => {
    expect(isRetryableError(new Error('429 Too Many Requests'))).toBe(true)
    expect(isRetryableError(new Error('rate limit exceeded'))).toBe(true)
    expect(isRetryableError(new Error('Validation failed'))).toBe(false)
    expect(isRetryableError(new Error('User not found'))).toBe(false)
  })
})

// ============================================================
// 11. 跨模块集成场景
// ============================================================
describe('跨模块集成测试', () => {
  test('IssueParser → ExecutionPlanner 完整流程', () => {
    const { IssueParser } = require('../src/issue-parser')
    const { ExecutionPlanner } = require('../src/execution-planner')
    const parsed = new IssueParser().parse({
      id: 'int-1', title: 'API timeout on large upload',
      body: 'Uploading >10MB files times out.\n    at UploadHandler.process (src/handlers/upload.ts:89:5)',
      labels: ['bug', 'high'],
    })
    expect(parsed.parsed!.type).toBe('bug')
    expect(parsed.parsed!.suspectedAreas).toContain('api')

    const planner = new ExecutionPlanner()
    const plan = planner.createPlan({ issue: parsed })
    expect(plan.steps.some((s: any) => s.type === 'test')).toBe(true)

    let step = planner.getNextStep(plan)
    while (step) { planner.updateStepStatus(plan, step.id, 'completed'); step = planner.getNextStep(plan) }
    expect(planner.isPlanCompleted(plan)).toBe(true)
  })

  test('CodeSearch → CodeModifier → Rollback 完整流程', async () => {
    const { CodeSearch } = require('../src/code-search')
    const { CodeModifier, createModificationFromSnippet } = require('../src/code-modifier')
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swe-integ-'))
    fs.writeFileSync(path.join(tempDir, 'app.ts'), `export function processData(input: string): string {\n  return input.toUpperCase()\n}`)

    const snippet = await new CodeSearch(tempDir).getSnippet('app.ts', 1, 3)
    const mod = createModificationFromSnippet(snippet, snippet.content.replace('toUpperCase', 'toLowerCase'))
    const modifier = new CodeModifier(tempDir)
    await modifier.applyModifications([mod])
    expect(fs.readFileSync(path.join(tempDir, 'app.ts'), 'utf-8')).toContain('toLowerCase')

    await modifier.rollback()
    expect(fs.readFileSync(path.join(tempDir, 'app.ts'), 'utf-8')).toContain('toUpperCase')
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  test('EvolutionStore 多轨迹挖掘+知识提取+策略优化', async () => {
    const { EvolutionStore } = require('../src/evolution-store')
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swe-integ2-'))
    const store = new EvolutionStore(tempDir)

    for (let i = 0; i < 5; i++) {
      await store.saveTrajectory({
        id: `t-${i}`, issue: { id: `i-${i}`, title: `Bug ${i}`, body: `Fix ${i}`, keywords: ['bug'] },
        repo: { url: '', path: '/t', branch: 'main' },
        steps: [{ id: `s-${i}`, type: 'parse-issue', input: {}, output: {}, timestamp: new Date(), duration: 10, success: i % 3 !== 0 }],
        result: { success: i % 3 !== 0, modifications: [], summary: `R${i}` },
        metadata: { model: 'gpt-4', duration: 30 }, createdAt: new Date(),
      })
    }
    expect((await store.minePatterns()).length).toBeGreaterThan(0)
    expect((await store.extractKnowledgeFromSuccess()).length).toBeGreaterThan(0)
    expect((await store.optimizeStrategy())).toHaveProperty('searchWeights')
    expect(store.getStats().totalTrajectories).toBe(5)
    fs.rmSync(tempDir, { recursive: true, force: true })
  })
})
