/**
 * RL Loop (AgentEvolver) - PoC
 * 
 * 演示如何通过自我提问和细粒度归因实现强化学习
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// 类型定义
// ============================================================================

interface State {
  id: string;
  taskDescription: string;
  codebaseContext: string;
  history: string[];
  features: Record<string, number>;
}

interface Action {
  id: string;
  type: 'search' | 'analyze' | 'modify' | 'test' | 'commit';
  description: string;
  parameters: Record<string, any>;
  confidence: number;
}

interface Trajectory {
  id: string;
  taskId: string;
  states: State[];
  actions: Action[];
  rewards: number[];
  outcome: {
    success: boolean;
    codeQuality: number;
    timeTaken: number;
    errorCount: number;
  };
  timestamp: Date;
}

interface Attribution {
  actionId: string;
  contribution: number;  // -1 到 1
  confidence: number;
  reason: string;
  features: Record<string, number>;
}

interface RewardComponents {
  taskSuccess: number;
  codeQuality: number;
  efficiency: number;
  safety: number;
  exploration: number;
}

interface SelfQuestion {
  id: string;
  question: string;
  type: 'exploration' | 'verification' | 'reflection';
  context: string;
  expectedAnswer?: string;
}

// ============================================================================
// Self Questioner
// ============================================================================

class SelfQuestioner {
  private questionTemplates = {
    exploration: [
      'What if I try a different approach for {context}?',
      'Are there alternative tools I could use here?',
      'What would happen if I searched in a different directory?',
      'Could this problem be solved more efficiently?'
    ],
    verification: [
      'Does this solution handle all edge cases?',
      'Have I considered the error paths?',
      'Will this change break existing functionality?',
      'Is this the minimal necessary change?'
    ],
    reflection: [
      'Why did the previous approach fail?',
      'What was the key insight that led to success?',
      'What assumptions did I make that were wrong?',
      'What would I do differently next time?'
    ]
  };

  /**
   * 生成自我提问
   */
  generateQuestions(state: State, recentAction?: Action): SelfQuestion[] {
    const questions: SelfQuestion[] = [];

    // 基于当前状态生成探索性问题
    questions.push({
      id: `q_${Date.now()}_exp`,
      question: this.selectTemplate('exploration', state.taskDescription),
      type: 'exploration',
      context: state.taskDescription
    });

    // 如果有最近的行动，生成验证性问题
    if (recentAction) {
      questions.push({
        id: `q_${Date.now()}_ver`,
        question: this.selectTemplate('verification', recentAction.description),
        type: 'verification',
        context: recentAction.description
      });
    }

    // 如果有历史，生成反思性问题
    if (state.history.length > 0) {
      const lastFailure = state.history.filter(h => h.includes('failed')).slice(-1)[0];
      if (lastFailure) {
        questions.push({
          id: `q_${Date.now()}_ref`,
          question: this.selectTemplate('reflection', lastFailure),
          type: 'reflection',
          context: lastFailure
        });
      }
    }

    return questions;
  }

  private selectTemplate(type: 'exploration' | 'verification' | 'reflection', context: string): string {
    const templates = this.questionTemplates[type];
    const template = templates[Math.floor(Math.random() * templates.length)];
    return template.replace('{context}', context.slice(0, 50));
  }
}

// ============================================================================
// Attribution Analyzer
// ============================================================================

class AttributionAnalyzer {
  /**
   * 分析轨迹中每个动作的贡献
   */
  analyze(trajectory: Trajectory): Attribution[] {
    const attributions: Attribution[] = [];

    // 1. 计算总奖励
    const totalReward = trajectory.rewards.reduce((a, b) => a + b, 0);

    // 2. 为每个动作计算贡献
    for (let i = 0; i < trajectory.actions.length; i++) {
      const action = trajectory.actions[i];
      const reward = trajectory.rewards[i] || 0;

      // 反事实推理：如果没有这个动作会怎样？
      const counterfactualReward = this.simulateCounterfactual(trajectory, i);

      // 贡献度 = 实际奖励 - 反事实奖励
      const contribution = (reward - counterfactualReward) / Math.max(Math.abs(totalReward), 1);

      // 确定贡献原因
      let reason = 'Neutral contribution';
      if (contribution > 0.1) {
        reason = 'Positive impact on task completion';
      } else if (contribution < -0.1) {
        reason = 'Negative impact or wasted effort';
      }

      attributions.push({
        actionId: action.id,
        contribution: Math.max(-1, Math.min(1, contribution)),
        confidence: 0.7,  // 简化的置信度
        reason,
        features: this.extractActionFeatures(action)
      });
    }

    return attributions;
  }

  /**
   * 模拟反事实（简化版）
   */
  private simulateCounterfactual(trajectory: Trajectory, actionIndex: number): number {
    // 简化的反事实模拟
    // 实际中应该重新运行任务或使用更复杂的模型

    const rewardsWithout = [...trajectory.rewards];
    rewardsWithout[actionIndex] = 0;

    // 假设后续奖励会减少（因为这个动作没有发生）
    for (let i = actionIndex + 1; i < rewardsWithout.length; i++) {
      rewardsWithout[i] *= 0.8;  // 20% 衰减
    }

    return rewardsWithout.reduce((a, b) => a + b, 0) / trajectory.rewards.length;
  }

  /**
   * 提取动作特征
   */
  private extractActionFeatures(action: Action): Record<string, number> {
    return {
      is_search: action.type === 'search' ? 1 : 0,
      is_modify: action.type === 'modify' ? 1 : 0,
      is_test: action.type === 'test' ? 1 : 0,
      confidence: action.confidence
    };
  }
}

// ============================================================================
// Reward Calculator
// ============================================================================

class RewardCalculator {
  private weights = {
    taskSuccess: 10.0,
    codeQuality: 2.0,
    efficiency: 1.0,
    safety: -2.0,
    exploration: 0.5
  };

  /**
   * 计算奖励
   */
  calculate(outcome: Trajectory['outcome'], action: Action): number {
    let reward = 0;

    // 1. 任务成功奖励
    if (outcome.success) {
      reward += this.weights.taskSuccess;
    }

    // 2. 代码质量奖励
    reward += outcome.codeQuality * this.weights.codeQuality;

    // 3. 效率奖励
    const efficiencyBonus = Math.max(0, 1 - outcome.timeTaken / 300);  // 5 分钟基准
    reward += efficiencyBonus * this.weights.efficiency;

    // 4. 错误惩罚
    reward -= outcome.errorCount * 0.5;

    // 5. 探索奖励（鼓励探索性行为）
    if (action.type === 'search' || action.confidence < 0.7) {
      reward += this.weights.exploration;
    }

    return reward;
  }

  /**
   * 分解奖励组件
   */
  breakdown(outcome: Trajectory['outcome']): RewardComponents {
    return {
      taskSuccess: outcome.success ? this.weights.taskSuccess : 0,
      codeQuality: outcome.codeQuality * this.weights.codeQuality,
      efficiency: Math.max(0, 1 - outcome.timeTaken / 300) * this.weights.efficiency,
      safety: 0,  // 无安全问题时为 0
      exploration: 0.5  // 基础探索奖励
    };
  }
}

// ============================================================================
// Policy Optimizer
// ============================================================================

class PolicyOptimizer {
  private learningRate = 0.001;
  private epsilon = 0.1;  // 探索率
  private policy: Map<string, number[]> = new Map();  // 状态 -> 动作概率

  /**
   * 选择动作
   */
  selectAction(state: State, availableActions: Action[]): Action {
    // ε-greedy 策略
    if (Math.random() < this.epsilon) {
      // 探索：随机选择
      return availableActions[Math.floor(Math.random() * availableActions.length)];
    }

    // 利用：选择最优动作
    return this.bestAction(state, availableActions);
  }

  /**
   * 选择最优动作
   */
  private bestAction(state: State, availableActions: Action[]): Action {
    // 计算每个动作的期望值
    let bestAction = availableActions[0];
    let bestValue = -Infinity;

    for (const action of availableActions) {
      const value = this.estimateActionValue(state, action);
      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    }

    return bestAction;
  }

  /**
   * 估计动作价值
   */
  private estimateActionValue(state: State, action: Action): number {
    // 基于特征的状态-动作值估计
    const stateKey = this.getStateKey(state);

    if (!this.policy.has(stateKey)) {
      // 初始化为均匀分布
      this.policy.set(stateKey, [0.5, 0.5, 0.5, 0.5, 0.5]);
    }

    const actionProbs = this.policy.get(stateKey)!;
    const actionIndex = this.getActionIndex(action.type);

    return actionProbs[actionIndex] * action.confidence;
  }

  /**
   * 更新策略
   */
  updatePolicy(attributions: Attribution[], trajectory: Trajectory): void {
    for (const attr of attributions) {
      const action = trajectory.actions.find(a => a.id === attr.actionId);
      if (!action) continue;

      const state = trajectory.states[trajectory.actions.indexOf(action)];
      const stateKey = this.getStateKey(state);
      const actionIndex = this.getActionIndex(action.type);

      if (!this.policy.has(stateKey)) {
        this.policy.set(stateKey, [0.5, 0.5, 0.5, 0.5, 0.5]);
      }

      const probs = this.policy.get(stateKey)!;

      // 简单的策略梯度更新
      const update = this.learningRate * attr.contribution;
      probs[actionIndex] = Math.max(0, Math.min(1, probs[actionIndex] + update));

      this.policy.set(stateKey, probs);
    }
  }

  private getStateKey(state: State): string {
    // 简化的状态键
    return state.taskDescription.slice(0, 20).replace(/\s+/g, '_');
  }

  private getActionIndex(actionType: Action['type']): number {
    const indices = { search: 0, analyze: 1, modify: 2, test: 3, commit: 4 };
    return indices[actionType] || 0;
  }

  /**
   * 获取当前策略
   */
  getPolicy(): Record<string, number[]> {
    return Object.fromEntries(this.policy);
  }
}

// ============================================================================
// RL Environment
// ============================================================================

class RLEnvironment {
  private currentTask: string = '';
  private stepCount: number = 0;
  private maxSteps: number = 20;

  /**
   * 重置环境
   */
  reset(taskDescription: string): State {
    this.currentTask = taskDescription;
    this.stepCount = 0;

    return {
      id: `state_${Date.now()}`,
      taskDescription,
      codebaseContext: 'Loading codebase...',
      history: [],
      features: {}
    };
  }

  /**
   * 执行动作
   */
  async step(action: Action): Promise<{
    state: State;
    reward: number;
    done: boolean;
    info: any;
  }> {
    this.stepCount++;

    // 模拟动作执行
    const newState: State = {
      id: `state_${Date.now()}`,
      taskDescription: this.currentTask,
      codebaseContext: 'Updated context',
      history: [`Action: ${action.description}`],
      features: {}
    };

    // 简化的奖励计算
    const reward = action.confidence * 0.5;
    const done = this.stepCount >= this.maxSteps;

    return {
      state: newState,
      reward,
      done,
      info: {
        step: this.stepCount,
        actionType: action.type
      }
    };
  }
}

// ============================================================================
// Agent Trainer
// ============================================================================

class AgentTrainer {
  private questioner: SelfQuestioner;
  private attributionAnalyzer: AttributionAnalyzer;
  private rewardCalculator: RewardCalculator;
  private policyOptimizer: PolicyOptimizer;
  private environment: RLEnvironment;

  private trajectories: Trajectory[] = [];
  private storagePath: string;

  constructor(storagePath: string = './rl-storage') {
    this.questioner = new SelfQuestioner();
    this.attributionAnalyzer = new AttributionAnalyzer();
    this.rewardCalculator = new RewardCalculator();
    this.policyOptimizer = new PolicyOptimizer();
    this.environment = new RLEnvironment();
    this.storagePath = storagePath;
  }

  /**
   * 训练一个回合
   */
  async trainEpisode(taskDescription: string): Promise<{
    trajectory: Trajectory;
    attributions: Attribution[];
    totalReward: number;
  }> {
    console.log(`\n🎯 Starting training episode: ${taskDescription.slice(0, 50)}...`);

    const trajectory: Trajectory = {
      id: `traj_${Date.now()}`,
      taskId: `task_${Date.now()}`,
      states: [],
      actions: [],
      rewards: [],
      outcome: {
        success: false,
        codeQuality: 0.7,
        timeTaken: 0,
        errorCount: 0
      },
      timestamp: new Date()
    };

    let state = this.environment.reset(taskDescription);
    trajectory.states.push(state);
    const startTime = Date.now();

    while (true) {
      // 1. 生成自我提问
      const lastAction = trajectory.actions.slice(-1)[0];
      const questions = this.questioner.generateQuestions(state, lastAction);

      if (questions.length > 0) {
        console.log(`   Question: ${questions[0].question}`);
      }

      // 2. 生成可用动作
      const availableActions = this.generateActions(state);

      // 3. 选择动作
      const action = this.policyOptimizer.selectAction(state, availableActions);
      console.log(`   Action: ${action.type} - ${action.description.slice(0, 30)}...`);

      // 4. 执行动作
      const stepResult = await this.environment.step(action);

      // 5. 记录
      trajectory.actions.push(action);
      trajectory.rewards.push(stepResult.reward);
      trajectory.states.push(stepResult.state);

      // 6. 检查是否结束
      if (stepResult.done) {
        trajectory.outcome.success = stepResult.reward > 5;
        trajectory.outcome.timeTaken = (Date.now() - startTime) / 1000;
        break;
      }

      state = stepResult.state;
    }

    // 7. 归因分析
    const attributions = this.attributionAnalyzer.analyze(trajectory);
    console.log(`\n   Attributions:`);
    attributions.slice(0, 3).forEach(attr => {
      console.log(`   - ${attr.actionId}: ${attr.contribution.toFixed(2)} (${attr.reason})`);
    });

    // 8. 策略更新
    this.policyOptimizer.updatePolicy(attributions, trajectory);

    // 9. 保存轨迹
    this.trajectories.push(trajectory);
    this.saveTrajectory(trajectory);

    const totalReward = trajectory.rewards.reduce((a, b) => a + b, 0);
    console.log(`\n   Total reward: ${totalReward.toFixed(2)}`);
    console.log(`   Success: ${trajectory.outcome.success ? '✅' : '❌'}`);

    return { trajectory, attributions, totalReward };
  }

  /**
   * 生成可用动作
   */
  private generateActions(state: State): Action[] {
    return [
      {
        id: `act_${Date.now()}_1`,
        type: 'search',
        description: 'Search for relevant code in the codebase',
        parameters: { query: state.taskDescription },
        confidence: 0.8
      },
      {
        id: `act_${Date.now()}_2`,
        type: 'analyze',
        description: 'Analyze the found code structure',
        parameters: {},
        confidence: 0.7
      },
      {
        id: `act_${Date.now()}_3`,
        type: 'modify',
        description: 'Apply code modification',
        parameters: {},
        confidence: 0.6
      },
      {
        id: `act_${Date.now()}_4`,
        type: 'test',
        description: 'Run tests to verify changes',
        parameters: {},
        confidence: 0.9
      },
      {
        id: `act_${Date.now()}_5`,
        type: 'commit',
        description: 'Commit the changes',
        parameters: {},
        confidence: 0.85
      }
    ];
  }

  /**
   * 保存轨迹
   */
  private saveTrajectory(trajectory: Trajectory): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
    const filePath = path.join(this.storagePath, `trajectory_${trajectory.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(trajectory, null, 2));
  }

  /**
   * 获取训练统计
   */
  getStats(): {
    totalEpisodes: number;
    avgReward: number;
    successRate: number;
  } {
    const totalEpisodes = this.trajectories.length;
    const avgReward = this.trajectories.length > 0
      ? this.trajectories.reduce((sum, t) => sum + t.rewards.reduce((a, b) => a + b, 0), 0) / totalEpisodes
      : 0;
    const successCount = this.trajectories.filter(t => t.outcome.success).length;
    const successRate = totalEpisodes > 0 ? successCount / totalEpisodes : 0;

    return { totalEpisodes, avgReward, successRate };
  }

  /**
   * 获取当前策略
   */
  getPolicy(): Record<string, number[]> {
    return this.policyOptimizer.getPolicy();
  }
}

// ============================================================================
// Demo
// ============================================================================

async function runDemo() {
  console.log('='.repeat(60));
  console.log('RL Loop (AgentEvolver) - PoC Demo');
  console.log('='.repeat(60));
  console.log();

  const trainer = new AgentTrainer('./rl-storage');

  // 训练多个回合
  const tasks = [
    'Fix the null pointer exception in the user service',
    'Optimize the database query performance',
    'Add error handling to the API endpoint'
  ];

  for (let i = 0; i < tasks.length; i++) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Episode ${i + 1}/${tasks.length}`);
    console.log('='.repeat(60));

    await trainer.trainEpisode(tasks[i]);

    // 显示统计
    const stats = trainer.getStats();
    console.log(`\n📊 Current Stats:`);
    console.log(`   Episodes: ${stats.totalEpisodes}`);
    console.log(`   Avg Reward: ${stats.avgReward.toFixed(2)}`);
    console.log(`   Success Rate: ${(stats.successRate * 100).toFixed(1)}%`);
  }

  // 显示最终策略
  console.log(`\n${'='.repeat(60)}`);
  console.log('Final Policy (sample):');
  console.log('='.repeat(60));
  const policy = trainer.getPolicy();
  Object.entries(policy).slice(0, 3).forEach(([state, probs]) => {
    console.log(`   ${state}: [${probs.map(p => p.toFixed(2)).join(', ')}]`);
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log('Demo completed!');
  console.log('='.repeat(60));
}

// 运行 Demo
if (require.main === module) {
  runDemo().catch(console.error);
}

export {
  AgentTrainer,
  SelfQuestioner,
  AttributionAnalyzer,
  RewardCalculator,
  PolicyOptimizer,
  RLEnvironment,
  State,
  Action,
  Trajectory,
  Attribution,
  SelfQuestion
};
