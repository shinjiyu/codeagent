/**
 * SWE-bench Mini Runner
 * 用 SWE-Agent-Node + GLM-5 跑 SWE-bench Lite 的采样任务
 * 
 * 流程：
 * 1. 读取 SWE-bench 任务（instance_id, repo, problem_statement, patch, base_commit）
 * 2. 对每个任务：clone repo → checkout base_commit → 用 Agent 修复 → 比对 diff 与 gold patch
 * 3. 输出结果报告
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

interface SWETask {
  instance_id: string
  repo: string
  problem_statement: string
  patch: string
  base_commit: string
  patch_lines: number
}

interface TaskResult {
  instance_id: string
  repo: string
  status: 'resolved' | 'partial' | 'failed' | 'error'
  attempt_count: number
  agent_patch: string
  gold_patch: string
  gold_files: string[]
  agent_files: string[]
  files_overlap: string[]
  duration_ms: number
  error?: string
}

const WORK_DIR = '/tmp/swe-bench-work'
const RESULTS_FILE = '/opt/cursor/artifacts/swe_bench_results.json'

function log(msg: string) {
  const ts = new Date().toISOString().substr(11, 8)
  process.stdout.write(`[${ts}] ${msg}\n`)
}

function extractPatchFiles(patch: string): string[] {
  const files: string[] = []
  for (const line of patch.split('\n')) {
    const match = line.match(/^diff --git a\/(.+?) b\//)
    if (match && !files.includes(match[1])) files.push(match[1])
  }
  return files
}

async function runTask(task: SWETask, idx: number, total: number): Promise<TaskResult> {
  log(`\n${'='.repeat(60)}`)
  log(`Task ${idx + 1}/${total}: ${task.instance_id}`)
  log(`Repo: ${task.repo} | Patch: ${task.patch_lines} lines`)
  log(`${'='.repeat(60)}`)

  const repoDir = path.join(WORK_DIR, task.instance_id.replace(/[\/\\]/g, '__'))
  const startTime = Date.now()

  try {
    // 1. Clone repo (shallow) and checkout base commit
    if (!fs.existsSync(repoDir)) {
      log(`Cloning ${task.repo}...`)
      execSync(
        `git clone --depth=100 --single-branch https://github.com/${task.repo}.git "${repoDir}"`,
        { timeout: 120000, stdio: 'pipe' }
      )
    }
    
    log(`Checking out ${task.base_commit.substring(0, 8)}...`)
    execSync(`git fetch --depth=100 origin ${task.base_commit} 2>/dev/null || true`, { cwd: repoDir, timeout: 60000, stdio: 'pipe' })
    execSync(`git checkout -f ${task.base_commit}`, { cwd: repoDir, timeout: 30000, stdio: 'pipe' })
    execSync('git clean -fd', { cwd: repoDir, timeout: 10000, stdio: 'pipe' })

    // 2. Run Agent
    log(`Running Agent with GLM-5...`)
    const issueText = task.problem_statement.substring(0, 3000) // 截断过长的描述
    const safeIssue = issueText.replace(/'/g, "'\\''")

    let agentOutput: string
    try {
      agentOutput = execSync(
        `cd /workspace && node dist/cli.js fix '${safeIssue}' --repo '${repoDir}' --verbose 2>&1`,
        { timeout: 300000, encoding: 'utf-8', env: { ...process.env, OPENAI_API_KEY: process.env.OPENAI_API_KEY } }
      )
    } catch (e: any) {
      agentOutput = e.stdout || e.stderr || e.message
    }

    const success = agentOutput.includes('Issue fixed successfully')
    log(`Agent result: ${success ? '✅ Fixed' : '❌ Failed'}`)

    // 3. Get agent's diff
    let agentPatch = ''
    let agentFiles: string[] = []
    try {
      agentPatch = execSync('git diff HEAD~1 HEAD 2>/dev/null || git diff', { cwd: repoDir, encoding: 'utf-8', timeout: 10000 })
      agentFiles = extractPatchFiles(agentPatch)
    } catch {}

    // 4. Compare with gold patch
    const goldFiles = extractPatchFiles(task.patch)
    const filesOverlap = goldFiles.filter(f => agentFiles.includes(f))

    let status: TaskResult['status'] = 'failed'
    if (success && agentFiles.length > 0) {
      if (filesOverlap.length === goldFiles.length) {
        status = 'resolved' // 修改了所有正确的文件
      } else if (filesOverlap.length > 0) {
        status = 'partial' // 修改了部分正确文件
      }
    } else if (!success) {
      status = agentOutput.includes('Error') ? 'error' : 'failed'
    }

    const duration = Date.now() - startTime
    log(`Status: ${status} | Files: agent=${agentFiles.join(',')} gold=${goldFiles.join(',')} overlap=${filesOverlap.join(',')}`)
    log(`Duration: ${(duration / 1000).toFixed(1)}s`)

    // Reset repo for next use
    try { execSync(`git checkout -f ${task.base_commit}`, { cwd: repoDir, timeout: 10000, stdio: 'pipe' }) } catch {}
    try { execSync('git clean -fd', { cwd: repoDir, timeout: 10000, stdio: 'pipe' }) } catch {}

    return {
      instance_id: task.instance_id,
      repo: task.repo,
      status,
      attempt_count: success ? 1 : 0,
      agent_patch: agentPatch.substring(0, 2000),
      gold_patch: task.patch.substring(0, 2000),
      gold_files: goldFiles,
      agent_files: agentFiles,
      files_overlap: filesOverlap,
      duration_ms: duration,
    }
  } catch (error: any) {
    const duration = Date.now() - startTime
    log(`ERROR: ${error.message.substring(0, 200)}`)
    return {
      instance_id: task.instance_id,
      repo: task.repo,
      status: 'error',
      attempt_count: 0,
      agent_patch: '',
      gold_patch: task.patch.substring(0, 2000),
      gold_files: extractPatchFiles(task.patch),
      agent_files: [],
      files_overlap: [],
      duration_ms: duration,
      error: error.message.substring(0, 500),
    }
  }
}

async function main() {
  log('╔══════════════════════════════════════════════════════════════╗')
  log('║   SWE-bench Mini Benchmark — SWE-Agent-Node + GLM-5        ║')
  log('╚══════════════════════════════════════════════════════════════╝')

  if (!process.env.OPENAI_API_KEY) {
    log('ERROR: OPENAI_API_KEY not set')
    process.exit(1)
  }

  // Load tasks
  const tasks: SWETask[] = JSON.parse(fs.readFileSync('/tmp/swe_bench_sample.json', 'utf-8'))
  log(`Loaded ${tasks.length} tasks`)

  // Ensure work dir
  if (!fs.existsSync(WORK_DIR)) fs.mkdirSync(WORK_DIR, { recursive: true })

  // Run tasks
  const results: TaskResult[] = []
  for (let i = 0; i < tasks.length; i++) {
    const result = await runTask(tasks[i], i, tasks.length)
    results.push(result)

    // Save intermediate results
    fs.writeFileSync(RESULTS_FILE, JSON.stringify({
      timestamp: new Date().toISOString(),
      model: 'glm-5',
      completed: i + 1,
      total: tasks.length,
      results,
    }, null, 2))
  }

  // Summary
  const resolved = results.filter(r => r.status === 'resolved').length
  const partial = results.filter(r => r.status === 'partial').length
  const failed = results.filter(r => r.status === 'failed').length
  const errors = results.filter(r => r.status === 'error').length
  const totalDuration = results.reduce((s, r) => s + r.duration_ms, 0)

  log('\n' + '═'.repeat(60))
  log('  SWE-bench Mini Results')
  log('═'.repeat(60))
  log(`  Resolved (correct files): ${resolved}/${tasks.length}`)
  log(`  Partial (some files):     ${partial}/${tasks.length}`)
  log(`  Failed:                   ${failed}/${tasks.length}`)
  log(`  Errors:                   ${errors}/${tasks.length}`)
  log(`  Total duration:           ${(totalDuration / 1000).toFixed(0)}s`)
  log(`  Avg per task:             ${(totalDuration / tasks.length / 1000).toFixed(0)}s`)
  log('═'.repeat(60))

  // Detail table
  log('\n  Instance ID                        | Status   | Agent Files | Gold Files')
  log('  ' + '-'.repeat(80))
  for (const r of results) {
    log(`  ${r.instance_id.padEnd(36)} | ${r.status.padEnd(8)} | ${r.agent_files.length.toString().padEnd(11)} | ${r.gold_files.length}`)
  }
}

main().catch(e => { log(`FATAL: ${e.message}`); process.exit(1) })
