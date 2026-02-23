#!/usr/bin/env node
/**
 * SWE-Agent-Node 持续迭代脚本
 * 每 30 分钟执行一次
 * 
 * 功能：
 * 1. Git pull 最新代码
 * 2. 使用 HR Skill 招募开发团队
 * 3. 执行一轮迭代（轮换：竞品研究/功能开发/测试/文档）
 * 4. Git commit & push 变更
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = '/root/.openclaw/workspace/swe-agent-node';
const STATE_FILE = path.join(PROJECT_ROOT, '.iteration-state.json');

// 迭代轮换任务
const ITERATION_TASKS = [
  { type: 'research', name: '竞品研究', description: '研究 SWE-Agent、Devin 等竞品的最新动态' },
  { type: 'develop', name: '功能开发', description: '实现新功能或优化现有功能' },
  { type: 'test', name: '测试', description: '编写或改进测试用例' },
  { type: 'docs', name: '文档', description: '更新 README、API 文档等' }
];

// 读取或初始化状态
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  }
  return {
    lastIteration: 0,
    currentTaskIndex: 0,
    totalIterations: 0,
    lastCommit: null
  };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Git 操作
function gitPull() {
  try {
    execSync('git pull', { cwd: PROJECT_ROOT, stdio: 'pipe' });
    return true;
  } catch (err) {
    console.log('Git pull failed (可能是本地修改冲突):', err.message);
    return false;
  }
}

function gitCommit(message) {
  try {
    execSync('git add -A', { cwd: PROJECT_ROOT });
    execSync(`git commit -m "${message}"`, { cwd: PROJECT_ROOT, stdio: 'pipe' });
    return true;
  } catch (err) {
    console.log('Git commit failed (可能没有变更):', err.message);
    return false;
  }
}

function gitPush() {
  try {
    execSync('git push', { cwd: PROJECT_ROOT, stdio: 'pipe' });
    return true;
  } catch (err) {
    console.log('Git push failed:', err.message);
    return false;
  }
}

// 主函数
async function main() {
  console.log('=== SWE-Agent-Node 迭代任务开始 ===\n');
  
  // 1. 读取状态
  const state = loadState();
  const currentTask = ITERATION_TASKS[state.currentTaskIndex];
  
  console.log(`当前任务: ${currentTask.name} - ${currentTask.description}`);
  console.log(`迭代次数: ${state.totalIterations + 1}\n`);
  
  // 2. Git pull
  console.log('[1/4] 拉取最新代码...');
  gitPull();
  
  // 3. 生成迭代提示（供 Agent 执行）
  const prompt = generateIterationPrompt(currentTask, state);
  console.log('\n[2/4] 迭代任务提示:');
  console.log(prompt);
  
  // 4. 更新状态
  state.currentTaskIndex = (state.currentTaskIndex + 1) % ITERATION_TASKS.length;
  state.totalIterations++;
  state.lastIteration = Date.now();
  saveState(state);
  
  // 5. Git commit & push
  console.log('\n[3/4] 提交变更...');
  const commitMessage = `chore: 迭代 #${state.totalIterations} - ${currentTask.name}`;
  if (gitCommit(commitMessage)) {
    console.log('[4/4] 推送到远程...');
    gitPush();
  }
  
  console.log('\n=== 迭代任务完成 ===');
  console.log(`下次任务: ${ITERATION_TASKS[state.currentTaskIndex].name}`);
}

function generateIterationPrompt(task, state) {
  return `
## 本次迭代任务: ${task.name}

### 任务描述
${task.description}

### 执行步骤

**如果是「竞品研究」：**
1. 访问 SWE-Agent GitHub: https://github.com/princeton-nlp/SWE-agent
2. 查看最近的 commits、issues、discussions
3. 记录新功能、改进、bug 修复
4. 更新 PROJECT.md 中的竞品分析部分

**如果是「功能开发」：**
1. 查看 ROADMAP.md 中的待办事项
2. 选择一个小功能实现（≤ 2 小时）
3. 编写代码，遵循现有架构
4. 本地测试确保可用

**如果是「测试」：**
1. 检查 src/ 目录下的测试覆盖率
2. 为未覆盖的函数添加测试
3. 运行 npm test 确保通过

**如果是「文档」：**
1. 更新 README.md 的安装/使用说明
2. 检查 API 文档是否完整
3. 添加示例代码到 examples/

### 统计
- 总迭代次数: ${state.totalIterations + 1}
- 上次迭代: ${state.lastIteration ? new Date(state.lastIteration).toISOString() : '无'}
`;
}

// 运行
main().catch(console.error);
