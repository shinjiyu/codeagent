# RL Loop (AgentEvolver) 设计文档

## 概述

RL Loop 实现强化学习闭环，通过自我提问和细粒度归因实现自主训练。

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                        RL Loop                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    Training Loop                      │  │
│  │                                                       │  │
│  │   ┌─────────┐    ┌─────────┐    ┌─────────┐        │  │
│  │   │  State  │───▶│ Question│───▶│ Action  │        │  │
│  │   │         │    │  Gen    │    │ Select  │        │  │
│  │   └─────────┘    └─────────┘    └────┬────┘        │  │
│  │                                      │              │  │
│  │   ┌─────────┐    ┌─────────┐    ┌────▼────┐        │  │
│  │   │ Policy  │◀───│Attribut-│◀───│ Reward  │        │  │
│  │   │ Update  │    │  ion    │    │  Calc   │        │  │
│  │   └─────────┘    └─────────┘    └─────────┘        │  │
│  │                                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐                      │
│  │ Environment  │    │   Policy     │                      │
│  │   (Sandbox)  │    │   Storage    │                      │
│  └──────────────┘    └──────────────┘                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. Self Questioner

生成探索性问题。

**问题类型**:

| 类型 | 目的 | 示例 |
|------|------|------|
| **探索** | 发现新策略 | "What if I try a different approach?" |
| **验证** | 验证假设 | "Does this handle all edge cases?" |
| **反思** | 回顾学习 | "Why did the previous approach fail?" |

```typescript
interface SelfQuestion {
  id: string;
  question: string;
  type: 'exploration' | 'verification' | 'reflection';
  context: string;
  expectedAnswer?: string;
}
```

### 2. Action Selector

选择动作。

**策略**: ε-greedy

```typescript
class ActionSelector {
  private epsilon = 0.1;  // 10% 探索率

  selectAction(state: State, actions: Action[]): Action {
    if (Math.random() < this.epsilon) {
      // 探索：随机选择
      return randomChoice(actions);
    } else {
      // 利用：选择最优动作
      return this.bestAction(state, actions);
    }
  }
}
```

### 3. Environment

RL 环境。

**接口**:

```typescript
interface RLEnvironment {
  reset(task: string): State;
  step(action: Action): Promise<{
    state: State;
    reward: number;
    done: boolean;
    info: any;
  }>;
}
```

### 4. Reward Calculator

计算奖励。

**奖励组件**:

```typescript
interface RewardComponents {
  taskSuccess: number;    // 任务成功奖励 (+10)
  codeQuality: number;    // 代码质量 (0-2)
  efficiency: number;     // 效率 (0-1)
  safety: number;         // 安全惩罚 (-2 if unsafe)
  exploration: number;    // 探索奖励 (+0.5)
}
```

### 5. Attribution Analyzer

细粒度归因。

**方法**: 反事实推理 (Counterfactual Reasoning)

```typescript
interface Attribution {
  actionId: string;
  contribution: number;  // -1 到 1
  confidence: number;    // 0 到 1
  reason: string;
  features: Record<string, number>;
}
```

**归因流程**:
1. 记录完整轨迹
2. 对每个动作进行反事实模拟
3. 比较实际结果和反事实结果
4. 计算贡献度

### 6. Policy Optimizer

策略优化。

**方法**: 策略梯度 (Policy Gradient)

```typescript
class PolicyOptimizer {
  updatePolicy(attributions: Attribution[], trajectory: Trajectory): void {
    for (const attr of attributions) {
      const state = trajectory.getState(attr.actionId);
      const action = trajectory.getAction(attr.actionId);
      
      // 策略梯度更新
      const update = learningRate * attr.contribution;
      this.policy.adjust(state, action, update);
    }
  }
}
```

## 训练流程

### 单回合训练

```
1. 初始化环境
   │
   ▼
2. 生成自我提问
   │
   ▼
3. 选择动作 (ε-greedy)
   │
   ▼
4. 执行动作，观察结果
   │
   ▼
5. 计算奖励
   │
   ▼
6. 重复 2-5 直到任务完成
   │
   ▼
7. 归因分析
   │
   ▼
8. 策略更新
   │
   ▼
9. 保存轨迹
```

### 训练循环

```typescript
async function train(numEpisodes: number) {
  for (let i = 0; i < numEpisodes; i++) {
    const task = selectTask();
    const result = await trainer.trainEpisode(task);
    
    // 定期评估
    if (i % 100 === 0) {
      const stats = trainer.getStats();
      console.log(`Episode ${i}: Reward=${stats.avgReward}`);
    }
  }
}
```

## 探索 vs 利用

### ε-greedy 调度

```typescript
// 线性衰减
function epsilonDecay(episode: number, maxEpisodes: number): number {
  const epsilonStart = 0.3;
  const epsilonEnd = 0.01;
  const decay = (maxEpisodes - episode) / maxEpisodes;
  return epsilonEnd + (epsilonStart - epsilonEnd) * decay;
}
```

### 好奇心驱动

```typescript
class CuriosityDrivenExploration {
  private noveltyBonus = 0.1;

  getExplorationBonus(state: State): number {
    const similarity = this.calculateSimilarity(state, this.visitedStates);
    const novelty = 1 - similarity;
    return novelty * this.noveltyBonus;
  }
}
```

## 归因分析详解

### 反事实推理

```
实际轨迹:
  S0 → A1 → S1 → A2 → S2 → A3 → S3 (success)
  R1   R2   R3

反事实（如果没有 A2）:
  S0 → A1 → S1 → ? → ? → A3 → ? (?)
  R1   ?   ?

贡献度 = (R_actual - R_counterfactual) / |R_total|
```

### 特征提取

```typescript
function extractFeatures(action: Action): Record<string, number> {
  return {
    is_search: action.type === 'search' ? 1 : 0,
    is_modify: action.type === 'modify' ? 1 : 0,
    is_test: action.type === 'test' ? 1 : 0,
    confidence: action.confidence,
    complexity: action.parameters.complexity || 0
  };
}
```

## 配置

```yaml
rl_loop:
  enabled: true
  
  exploration:
    strategy: epsilon_greedy
    epsilon_start: 0.3
    epsilon_end: 0.01
    decay_episodes: 1000
  
  learning:
    learning_rate: 0.001
    batch_size: 32
    discount_factor: 0.99
  
  reward:
    weights:
      task_success: 10.0
      code_quality: 2.0
      efficiency: 1.0
      safety: -2.0
      exploration: 0.5
  
  attribution:
    method: counterfactual
    sample_size: 10  # 反事实样本数
  
  training:
    max_episodes: 10000
    save_interval: 100
    eval_interval: 50
```

## 使用示例

```typescript
const trainer = new AgentTrainer('./rl-storage');

// 训练
for (let i = 0; i < 1000; i++) {
  const task = getRandomTask();
  const result = await trainer.trainEpisode(task);
  
  console.log(`Episode ${i}: Reward=${result.totalReward.toFixed(2)}`);
}

// 获取统计
const stats = trainer.getStats();
console.log(`Success rate: ${(stats.successRate * 100).toFixed(1)}%`);

// 获取学习到的策略
const policy = trainer.getPolicy();
```

## 监控

### 指标

| 指标 | 描述 | 目标 |
|------|------|------|
| `avg_reward` | 平均奖励 | 持续提升 |
| `success_rate` | 成功率 | > 80% |
| `exploration_rate` | 探索率 | 10-30% |
| `policy_stability` | 策略稳定性 | 高 |

### TensorBoard 可视化

```typescript
// 记录训练曲线
writer.addScalar('Reward/avg', avgReward, episode);
writer.addScalar('Success/rate', successRate, episode);
writer.addScalar('Exploration/epsilon', epsilon, episode);
```

## 挑战与解决方案

| 挑战 | 解决方案 |
|------|----------|
| 奖励稀疏 | 塑造奖励 + 课程学习 |
| 样本效率低 | 经验回放 + 迁移学习 |
| 探索不足 | 好奇心驱动 + 内在动机 |
| 策略不稳定 | 目标网络 + 软更新 |

## 安全约束

### 禁止动作

- 删除文件
- 修改配置
- 执行危险命令
- 访问敏感数据

### 约束实现

```typescript
class SafeActionFilter {
  private forbiddenActions = ['delete', 'format', 'drop'];

  filter(actions: Action[]): Action[] {
    return actions.filter(a => 
      !this.forbiddenActions.some(f => a.description.includes(f))
    );
  }
}
```

## 未来扩展

1. **多任务学习**: 同时学习多种任务
2. **元学习**: 学习如何学习
3. **模仿学习**: 从人类示范中学习
4. **分层 RL**: 分层决策结构

---

*版本: 1.0.0*
*创建日期: 2026-02-24*
