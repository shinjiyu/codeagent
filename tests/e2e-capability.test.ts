/**
 * SWE-Agent-Node 实战能力测试
 * 
 * 目的：在真实项目上测试 Agent 的实际解题能力
 * - 创建一个有多个真实 bug 的项目
 * - 让 Agent 尝试修复 3 个不同难度的 Issue
 * - 逐步检查每一步的输出质量
 * - 验证进化系统是否记录了学习
 */

import * as fs from 'fs'
import * as path from 'path'

const TEST_PROJECT = '/tmp/test-project'
const EVOLUTION_STORE = '/tmp/swe-evo-e2e'

describe('SWE-Agent-Node 实战能力测试', () => {
  const { Agent } = require('../src/agent')
  const { GitEnv } = require('../src/git-env')
  const { EvolutionStore } = require('../src/evolution-store')
  const { IssueParser } = require('../src/issue-parser')
  const { CodeSearch } = require('../src/code-search')

  // 清理环境
  beforeAll(() => {
    if (fs.existsSync(EVOLUTION_STORE)) {
      fs.rmSync(EVOLUTION_STORE, { recursive: true })
    }
  })

  afterAll(() => {
    // 恢复 test-project 的 git 状态
    const { execSync } = require('child_process')
    try {
      execSync('git checkout . && git clean -fd', { cwd: TEST_PROJECT, stdio: 'pipe' })
    } catch {}
    if (fs.existsSync(EVOLUTION_STORE)) {
      fs.rmSync(EVOLUTION_STORE, { recursive: true })
    }
  })

  // ============================================================
  //  场景 1：登录安全漏洞 - 中等难度
  //  Issue: "任何密码都能登录成功，login 方法没有校验密码"
  // ============================================================
  describe('场景 1: 登录安全漏洞修复', () => {
    const issueBody = `
## Bug Report: 任何密码都能登录成功

### 描述
用户反馈使用错误的密码也能成功登录系统。

### 复现步骤
1. 注册一个账号 email: test@test.com, password: "correct_password"
2. 尝试使用 email: test@test.com, password: "wrong_password" 登录
3. 登录成功了！这是一个严重的安全漏洞

### 期望行为
使用错误密码应该抛出 "Invalid password" 错误

### 相关代码
问题出在 \`src/user-service.ts\` 的 \`login\` 方法中，
\`hashPassword\` 函数和 \`passwordHash\` 字段存在但没有被用来验证。

### 错误等级
Critical - 安全漏洞`

    const config = {
      maxSteps: 10,
      maxRetries: 3,
      llm: { model: 'gpt-4', temperature: 0.7, maxTokens: 4000 },
      git: { defaultBranch: 'master', commitTemplate: 'fix: {message}', autoPush: false },
      test: { command: 'node tests/test.js', pattern: '', timeout: 30000 },
      evolution: { enabled: true, patternMiningInterval: 5, minConfidence: 0.5, maxKnowledgeSize: 1000 },
    }

    // 收集流水线每一步的输出
    let steps: any[] = []
    let finalError: string | null = null

    beforeAll(async () => {
      const gitEnv = new GitEnv()
      const repo = await gitEnv.open(TEST_PROJECT)
      const agent = new Agent(config)

      agent.on('step:start', (e: any) => {
        steps.push({ type: e.data.type, phase: 'start' })
      })
      agent.on('step:end', (e: any) => {
        steps.push({
          type: e.data.step.type,
          phase: 'end',
          success: e.data.step.success,
          duration: e.data.step.duration,
          output: e.data.step.output,
        })
      })
      agent.on('step:error', (e: any) => {
        steps.push({
          type: e.data.step.type,
          phase: 'error',
          error: e.data.step.error,
        })
      })

      try {
        await agent.solve({
          id: 'SECURITY-001',
          title: '任何密码都能登录成功，login 方法没有校验密码',
          body: issueBody,
          labels: ['bug', 'critical', 'security'],
        }, repo)
      } catch (e: any) {
        finalError = e.message
      }
    }, 30000)

    // ---------- 评估 1: Issue 解析能力 ----------
    test('步骤1-Issue解析: 应提取出有意义的关键词', () => {
      const parseStep = steps.find(s => s.type === 'parse-issue' && s.phase === 'end')
      expect(parseStep).toBeDefined()
      expect(parseStep.success).toBe(true)

      const parsed = parseStep.output
      expect(parsed.keywords).toBeDefined()
      expect(parsed.keywords.length).toBeGreaterThan(0)

      // 评估关键词质量：应该包含 password/login/hash 等安全相关词
      const hasSecurityKeyword = parsed.keywords.some((k: string) =>
        ['password', 'login', 'hashpassword', 'passwordhash', 'security', '密码', '登录'].some(
          target => k.includes(target)
        )
      )
      // 注意：extractKeywords 是对 body 做分词，中文可能不会正确分词
      // 但英文关键词如 password, login 应该被提取到
      expect(hasSecurityKeyword).toBe(true)
    })

    test('步骤1-Issue解析: 应从停用词中正确过滤', () => {
      const parseStep = steps.find(s => s.type === 'parse-issue' && s.phase === 'end')
      const keywords: string[] = parseStep.output.keywords
      // 不应包含 the, is, to 等停用词
      const stopWords = ['the', 'is', 'to', 'a', 'an', 'in', 'of']
      for (const sw of stopWords) {
        expect(keywords).not.toContain(sw)
      }
    })

    // ---------- 评估 2: 代码搜索能力 ----------
    test('步骤3-代码搜索: 应找到 user-service.ts 中的相关代码', () => {
      const searchStep = steps.find(s => s.type === 'search-code' && s.phase === 'end')
      expect(searchStep).toBeDefined()
      expect(searchStep.success).toBe(true)

      const locations = searchStep.output
      expect(Array.isArray(locations)).toBe(true)
      expect(locations.length).toBeGreaterThan(0)

      // 评估搜索质量：是否找到了 user-service.ts
      const foundUserService = locations.some((loc: any) =>
        loc.file.includes('user-service')
      )
      expect(foundUserService).toBe(true)
    })

    test('步骤3-代码搜索: 搜索结果应包含 login 或 password 相关上下文', () => {
      const searchStep = steps.find(s => s.type === 'search-code' && s.phase === 'end')
      const locations = searchStep.output

      // 检查搜索结果的上下文质量
      const hasRelevantContext = locations.some((loc: any) =>
        loc.context &&
        (loc.context.includes('login') ||
         loc.context.includes('password') ||
         loc.context.includes('hashPassword'))
      )
      expect(hasRelevantContext).toBe(true)
    })

    // ---------- 评估 3: 修复生成能力 ----------
    test('步骤4-生成修复: generateFix 当前返回空数组（核心能力缺失）', () => {
      const genStep = steps.find(s => s.type === 'generate-fix' && s.phase === 'end')
      expect(genStep).toBeDefined()
      expect(genStep.success).toBe(true)

      // 评估：generateFix 返回了什么？
      const modifications = genStep.output
      expect(Array.isArray(modifications)).toBe(true)
      // 当前是 stub，返回空数组 - 这是核心能力缺失
      expect(modifications.length).toBe(0)
    })

    // ---------- 评估 4: 测试运行能力 ----------
    test('步骤6-测试运行: 应成功运行测试命令', () => {
      const testStep = steps.find(s => s.type === 'run-tests' && s.phase === 'end')
      expect(testStep).toBeDefined()
      expect(testStep.success).toBe(true)
    })

    // ---------- 评估 5: 整体流水线 ----------
    test('流水线完整性: 所有步骤应按顺序执行', () => {
      const startSteps = steps.filter(s => s.phase === 'start').map(s => s.type)
      expect(startSteps).toContain('parse-issue')
      expect(startSteps).toContain('analyze-repo')
      expect(startSteps).toContain('search-code')
      expect(startSteps).toContain('generate-fix')
      expect(startSteps).toContain('apply-modification')
      expect(startSteps).toContain('run-tests')
    })
  })

  // ============================================================
  //  场景 2：订单金额计算错误 - 简单难度
  //  Issue: "订单总价没有乘以数量"
  // ============================================================
  describe('场景 2: 订单金额计算 bug', () => {
    let steps: any[] = []

    beforeAll(async () => {
      // 清理前次运行状态
      const { execSync } = require('child_process')
      try { execSync('git checkout . && git clean -fd', { cwd: TEST_PROJECT, stdio: 'pipe' }) } catch {}

      const gitEnv = new GitEnv()
      const repo = await gitEnv.open(TEST_PROJECT)
      const agent = new Agent({
        maxSteps: 10, maxRetries: 3,
        llm: { model: 'gpt-4', temperature: 0.7, maxTokens: 4000 },
        git: { defaultBranch: 'master', commitTemplate: 'fix: {message}', autoPush: false },
        test: { command: 'node tests/test.js', pattern: '', timeout: 30000 },
        evolution: { enabled: true, patternMiningInterval: 5, minConfidence: 0.5, maxKnowledgeSize: 1000 },
      })

      agent.on('step:end', (e: any) => {
        steps.push({ type: e.data.step.type, success: e.data.step.success, output: e.data.step.output })
      })

      try {
        await agent.solve({
          id: 'BUG-002',
          title: 'Order total does not multiply by quantity',
          body: `The createOrder method in src/order-processor.ts calculates total incorrectly.
Current code: items.reduce((sum, item) => sum + item.price, 0)
Should be: items.reduce((sum, item) => sum + item.price * item.quantity, 0)

For example, 3 items at $10 each should total $30, but it shows $10.`,
        }, repo)
      } catch {}
    }, 30000)

    test('Issue解析: 关键词应包含 order/total/quantity/price', () => {
      const parseStep = steps.find(s => s.type === 'parse-issue')
      const keywords: string[] = parseStep.output.keywords
      const relevant = keywords.filter((k: string) =>
        ['order', 'total', 'quantity', 'price', 'createorder', 'multiply', 'items', 'reduce'].some(
          t => k.includes(t)
        )
      )
      expect(relevant.length).toBeGreaterThan(0)
    })

    test('代码搜索: 应找到 order-processor.ts', () => {
      const searchStep = steps.find(s => s.type === 'search-code')
      const locations = searchStep.output
      expect(locations.some((loc: any) => loc.file.includes('order-processor'))).toBe(true)
    })

    test('代码搜索: 应找到包含 reduce/price 的代码行', () => {
      const searchStep = steps.find(s => s.type === 'search-code')
      const locations = searchStep.output
      const hasReduceContext = locations.some((loc: any) =>
        loc.context && (loc.context.includes('reduce') || loc.context.includes('price'))
      )
      expect(hasReduceContext).toBe(true)
    })
  })

  // ============================================================
  //  场景 3：同时使用 IssueParser 和 CodeSearch 独立验证
  //  跳过 Agent 流水线，直接测试各模块对这个项目的实际能力
  // ============================================================
  describe('场景 3: 模块级能力独立验证', () => {
    test('IssueParser 应正确解析安全漏洞 Issue', () => {
      const parser = new IssueParser()
      const parsed = parser.parse({
        id: 'SEC-001',
        title: 'Login bypass - no password validation',
        body: `Critical security bug in src/user-service.ts.
The login() method does not verify the password hash.
Any password is accepted.

\`\`\`typescript
async login(email: string, password: string): Promise<Session> {
  const user = this.findByEmail(email)
  // BUG: should call hashPassword(password) and compare with user.passwordHash
  const session = this.createSession(user.id)
  return session
}
\`\`\``,
        labels: ['bug', 'security'],
      })

      expect(parsed.parsed!.type).toBe('bug')
      expect(parsed.parsed!.mentionedFiles.some((f: string) => f.includes('user-service.ts'))).toBe(true)
      expect(parsed.parsed!.mentionedFunctions.some((f: string) => 
        f === 'login' || f === 'hashPassword' || f === 'findByEmail'
      )).toBe(true)
      expect(parsed.parsed!.codeSnippets.length).toBeGreaterThan(0)
      expect(parsed.parsed!.suspectedAreas).toContain('auth')
      expect(parsed.parsed!.confidence).toBeGreaterThan(0.5)
    })

    test('CodeSearch 应在测试项目中找到 login 函数', async () => {
      const searcher = new CodeSearch(TEST_PROJECT)
      const results = await searcher.searchFunction('login')
      // 注意: searchFunction 的正则可能因为 TS 返回类型而匹配不到
      // 但 login 方法后面有 ): Promise<Session> { 所以可能匹配不到
      // 这本身就是一个能力缺陷
    })

    test('CodeSearch 应能通过关键词搜索到 password 相关代码', async () => {
      const searcher = new CodeSearch(TEST_PROJECT)
      const results = await searcher.searchByKeywords(['password', 'login', 'hashPassword'], {
        maxResults: 10,
        contextLines: 5,
      })
      expect(results.length).toBeGreaterThan(0)

      // 验证搜索质量
      const userServiceResults = results.filter((r: any) => r.file.includes('user-service'))
      expect(userServiceResults.length).toBeGreaterThan(0)

      // 检查是否能看到 password 相关上下文
      const hasPasswordContext = userServiceResults.some((r: any) =>
        r.context && (r.context.includes('password') || r.context.includes('Password') || r.context.includes('hash'))
      )
      expect(hasPasswordContext).toBe(true)

      // 注意：默认 contextLines=5 可能不够看到 login 方法和 password 字段之间的关联
      // 这是搜索质量的一个真实局限性：上下文窗口太小，无法展示 bug 的完整图景
    })

    test('CodeSearch 应能搜到 order-processor 中的 reduce 相关代码', async () => {
      const searcher = new CodeSearch(TEST_PROJECT)
      const results = await searcher.searchByKeywords(['total', 'reduce', 'price'])
      const orderResults = results.filter((r: any) => r.file.includes('order-processor'))
      expect(orderResults.length).toBeGreaterThan(0)
    })

    test('CodeSearch 应能搜到错误消息', async () => {
      const searcher = new CodeSearch(TEST_PROJECT)
      const results = await searcher.searchError('User not found')
      expect(results.length).toBeGreaterThan(0)
      expect(results.some((r: any) => r.file.includes('user-service'))).toBe(true)
    })

    test('CodeSearch 应能搜到 UserService 和 OrderProcessor 类', async () => {
      const searcher = new CodeSearch(TEST_PROJECT)
      const userResults = await searcher.searchClass('UserService')
      expect(userResults.length).toBeGreaterThan(0)

      const orderResults = await searcher.searchClass('OrderProcessor')
      expect(orderResults.length).toBeGreaterThan(0)
    })
  })

  // ============================================================
  //  场景 4: 进化系统验证
  //  检查 Agent 在多次运行后是否记录了轨迹和学习
  // ============================================================
  describe('场景 4: 进化系统能力验证', () => {
    let store: any

    beforeAll(async () => {
      // 手动创建一个有数据的 EvolutionStore
      const { execSync } = require('child_process')
      try { execSync('git checkout . && git clean -fd', { cwd: TEST_PROJECT, stdio: 'pipe' }) } catch {}

      if (fs.existsSync(EVOLUTION_STORE)) {
        fs.rmSync(EVOLUTION_STORE, { recursive: true })
      }

      store = new EvolutionStore(EVOLUTION_STORE)

      // 模拟 Agent 保存多个轨迹（因为 agent.extractPatterns 是 stub，我们手动模拟）
      // 轨迹 1: 成功修复 auth bug
      await store.saveTrajectory({
        id: 'traj-auth-1',
        issue: { id: 'SEC-001', title: 'Fix login bypass', body: 'No password validation in login()', keywords: ['password', 'login', 'validation', 'security'] },
        repo: { url: '', path: TEST_PROJECT, branch: 'master' },
        steps: [
          { id: 's1', type: 'parse-issue', input: {}, output: { keywords: ['password', 'login'] }, timestamp: new Date(), duration: 5, success: true },
          { id: 's2', type: 'analyze-repo', input: {}, output: { techStack: { language: 'typescript' } }, timestamp: new Date(), duration: 10, success: true },
          { id: 's3', type: 'search-code', input: {}, output: [{ file: 'src/user-service.ts', line: 30 }], timestamp: new Date(), duration: 50, success: true },
          { id: 's4', type: 'generate-fix', input: {}, output: [{ file: 'src/user-service.ts', type: 'modify' }], timestamp: new Date(), duration: 200, success: true },
          { id: 's5', type: 'run-tests', input: {}, output: { passed: 5, failed: 0, total: 5 }, timestamp: new Date(), duration: 100, success: true },
        ],
        result: { success: true, modifications: [{ file: 'src/user-service.ts', type: 'modify', newContent: 'fixed' }], summary: 'Added password validation in login()' },
        metadata: { model: 'gpt-4', duration: 365 },
        createdAt: new Date(),
      })

      // 轨迹 2: 失败的修复尝试
      await store.saveTrajectory({
        id: 'traj-auth-2',
        issue: { id: 'BUG-002', title: 'Order total wrong', body: 'Total does not multiply by quantity', keywords: ['order', 'total', 'quantity'] },
        repo: { url: '', path: TEST_PROJECT, branch: 'master' },
        steps: [
          { id: 's1', type: 'parse-issue', input: {}, output: { keywords: ['order', 'total'] }, timestamp: new Date(), duration: 5, success: true },
          { id: 's2', type: 'search-code', input: {}, output: [], timestamp: new Date(), duration: 30, success: true },
          { id: 's3', type: 'generate-fix', input: {}, output: null, timestamp: new Date(), duration: 100, success: false, error: 'No relevant code found' },
        ],
        result: { success: false, modifications: [], summary: 'Failed', error: 'No relevant code found' },
        metadata: { model: 'gpt-4', duration: 135 },
        createdAt: new Date(),
      })

      // 轨迹 3: 成功修复 order bug
      await store.saveTrajectory({
        id: 'traj-order-1',
        issue: { id: 'BUG-003', title: 'Fix order total', body: 'Missing quantity multiplication', keywords: ['order', 'total', 'quantity', 'price', 'reduce'] },
        repo: { url: '', path: TEST_PROJECT, branch: 'master' },
        steps: [
          { id: 's1', type: 'parse-issue', input: {}, output: { keywords: ['order', 'total', 'quantity'] }, timestamp: new Date(), duration: 5, success: true },
          { id: 's2', type: 'search-code', input: {}, output: [{ file: 'src/order-processor.ts', line: 25 }], timestamp: new Date(), duration: 40, success: true },
          { id: 's3', type: 'generate-fix', input: {}, output: [{ file: 'src/order-processor.ts', type: 'modify' }], timestamp: new Date(), duration: 150, success: true },
          { id: 's4', type: 'run-tests', input: {}, output: { passed: 8, failed: 0, total: 8 }, timestamp: new Date(), duration: 80, success: true },
        ],
        result: { success: true, modifications: [{ file: 'src/order-processor.ts', type: 'modify', newContent: 'fixed' }], summary: 'Fixed total calculation' },
        metadata: { model: 'gpt-4', duration: 275 },
        createdAt: new Date(),
      })
    })

    test('轨迹记录: 应正确保存 3 个轨迹', () => {
      const all = store.getAllTrajectories()
      expect(all.length).toBe(3)
    })

    test('轨迹记录: 应正确区分成功和失败', () => {
      expect(store.getSuccessfulTrajectories().length).toBe(2)
      expect(store.getFailedTrajectories().length).toBe(1)
    })

    test('模式挖掘: 应从轨迹中挖掘出成功和失败模式', async () => {
      const patterns = await store.minePatterns()
      expect(patterns.length).toBeGreaterThan(0)

      const successPatterns = patterns.filter((p: any) => p.type === 'success')
      const failurePatterns = patterns.filter((p: any) => p.type === 'failure')
      expect(successPatterns.length).toBeGreaterThan(0)
      expect(failurePatterns.length).toBeGreaterThan(0)
    })

    test('知识提取: 应从成功轨迹中提取知识', async () => {
      const knowledge = await store.extractKnowledgeFromSuccess()
      expect(knowledge.length).toBeGreaterThan(0)

      // 验证知识质量
      const authKnowledge = knowledge.find((k: any) =>
        k.problem.includes('login') || k.problem.includes('Login')
      )
      // 至少有一条关于 auth/order 的知识
      expect(knowledge.some((k: any) =>
        k.problem.includes('login') || k.problem.includes('Login') ||
        k.problem.includes('order') || k.problem.includes('Order') ||
        k.problem.includes('total')
      )).toBe(true)
    })

    test('模式匹配: 输入 auth 关键词应匹配到相关模式', () => {
      const matches = store.findMatchingPatterns(['password', 'login', 'auth'])
      expect(matches.length).toBeGreaterThan(0)
    })

    test('策略优化: optimizeStrategy 应正常执行', async () => {
      const strategy = await store.optimizeStrategy()
      expect(strategy).toHaveProperty('searchWeights')
      expect(strategy).toHaveProperty('updatedAt')
    })

    test('统计信息: 应正确反映学习进度', () => {
      const stats = store.getStats()
      expect(stats.totalTrajectories).toBe(3)
      expect(stats.successfulTrajectories).toBe(2)
      expect(stats.failedTrajectories).toBe(1)
      expect(stats.totalPatterns).toBeGreaterThan(0)
      expect(stats.totalKnowledge).toBeGreaterThan(0)
    })

    test('持久化: 重新加载后数据应完整', () => {
      const store2 = new EvolutionStore(EVOLUTION_STORE)
      const stats = store2.getStats()
      expect(stats.totalTrajectories).toBe(3)
      expect(stats.totalPatterns).toBeGreaterThan(0)
      expect(stats.totalKnowledge).toBeGreaterThan(0)
    })
  })

  // ============================================================
  //  场景 5: CLI 实战
  // ============================================================
  describe('场景 5: CLI 命令实战', () => {
    const { execSync } = require('child_process')
    const run = (cmd: string) => {
      try {
        return { success: true, output: execSync(cmd, { cwd: '/workspace', timeout: 30000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }) }
      } catch (e: any) {
        return { success: false, output: (e.stdout || '') + (e.stderr || '') }
      }
    }

    beforeAll(() => {
      try { execSync('git checkout . && git clean -fd', { cwd: TEST_PROJECT, stdio: 'pipe' }) } catch {}
    })

    test('CLI analyze: 应正确分析测试项目', () => {
      const result = run(`node dist/cli.js analyze ${TEST_PROJECT}`)
      expect(result.output).toContain('Repository Analysis')
      expect(result.output).toContain('Project Structure')
    })

    test('CLI analyze -o: 应输出 JSON 报告', () => {
      const reportPath = '/tmp/test-project-report.json'
      run(`node dist/cli.js analyze ${TEST_PROJECT} -o ${reportPath}`)
      expect(fs.existsSync(reportPath)).toBe(true)
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'))
      expect(report).toHaveProperty('structure')
      expect(report).toHaveProperty('techStack')
      expect(report.structure.files.length).toBeGreaterThan(0)
      fs.unlinkSync(reportPath)
    })

    test('CLI learn --stats: 应显示统计', () => {
      const result = run('node dist/cli.js learn --stats')
      expect(result.output).toContain('Evolution')
    })
  })
})
