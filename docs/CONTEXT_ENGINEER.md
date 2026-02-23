# Context Engineer (ACE) 设计文档

## 概述

Context Engineer 实现 Prompt 演化能力，通过增量更新系统提示词来改进 Agent。

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Context Engineer                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │    Prompt    │    │   Template   │    │  Experience  │  │
│  │   Manager    │◀──▶│    Engine    │◀──▶│  Collector   │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                    │          │
│         └───────────────────┼────────────────────┘          │
│                             │                               │
│                    ┌────────▼────────┐                     │
│                    │   Prompt        │                     │
│                    │   Evolver       │                     │
│                    └────────┬────────┘                     │
│                             │                               │
│                    ┌────────▼────────┐                     │
│                    │   Evaluator     │                     │
│                    └─────────────────┘                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. Prompt Manager

管理系统提示词。

**职责**:
- Prompt 版本管理
- Prompt 组装和渲染
- Prompt 检索

```typescript
interface PromptTemplate {
  id: string;
  version: string;
  category: 'system' | 'task' | 'tool' | 'error_handling';
  sections: PromptSection[];
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    performanceScore: number;
    usageCount: number;
  };
}

interface PromptSection {
  name: string;
  content: string;
  priority: number;    // 高优先级 = 更重要
  mutable: boolean;    // 是否允许自动修改
}
```

### 2. Template Engine

渲染动态 Prompt。

**功能**:
- 变量替换
- 条件渲染
- 循环渲染
- 模板继承

```typescript
// 示例模板
const template = `
## Identity
{{identity}}

## Capabilities
{{#each capabilities}}
- {{this}}
{{/each}}

## Learned Patterns
{{#if learnedPatterns}}
{{learnedPatterns}}
{{else}}
No patterns learned yet.
{{/if}}
`;
```

### 3. Experience Collector

收集任务执行经验。

**收集内容**:
- 任务描述
- 执行动作
- 成功/失败结果
- 学到的教训

```typescript
interface TaskExperience {
  taskId: string;
  taskDescription: string;
  actions: string[];
  outcome: 'success' | 'failure' | 'partial';
  lessons: string[];
  timestamp: Date;
}
```

### 4. Prompt Evolver

进化 Prompt。

**进化流程**:
1. 分析经验
2. 生成更新建议
3. 验证更新
4. A/B 测试
5. 应用更新

```typescript
interface PromptUpdate {
  targetSection: string;
  updateType: 'append' | 'prepend' | 'replace';
  newContent: string;
  confidence: number;
  reason: string;
}
```

### 5. Evaluator

评估 Prompt 效果。

**评估维度**:
- 任务成功率
- 响应质量
- Token 效率
- 用户体验

## Prompt 结构

### 系统级 Prompt

```markdown
# System Prompt v2.0.0

## Identity (priority: 10, immutable)
You are SWE-Agent-Node, an AI software engineering assistant.

## Capabilities (priority: 8, immutable)
- Analyze code repositories
- Fix bugs and issues
- Generate tests
- Refactor code

## Error Handling (priority: 6, mutable)
When encountering errors, analyze the root cause before proposing solutions.

## Learned Patterns (priority: 5, mutable)
- For timeout issues, always add exponential backoff retry
- Always clean up event listeners when component unmounts
- Check network conditions before assuming server fault

## Best Practices (priority: 4, mutable)
- Write tests before fixing bugs
- Document complex logic
- Use meaningful variable names
```

## 增量更新机制

### 触发条件

```typescript
interface EvolutionTrigger {
  type: 'periodic' | 'threshold' | 'manual';
  config: {
    interval?: number;        // 周期性（任务数）
    successRateDrop?: number; // 成功率下降阈值
    manualApproval?: boolean; // 需要人工批准
  };
}
```

### 更新策略

1. **追加 (Append)**: 在现有内容后添加
2. **前置 (Prepend)**: 在现有内容前添加
3. **替换 (Replace)**: 完全替换内容

### 防止膨胀

```typescript
class PromptPruner {
  async prune(template: PromptTemplate): Promise<PromptTemplate> {
    // 1. 移除低效内容（效用 < 0.1）
    // 2. 合并重复内容
    // 3. 压缩冗长内容
    // 4. 限制总长度（< 8000 tokens）
  }
}
```

## A/B 测试

### 测试流程

```
┌──────────────┐
│  创建变体    │
└──────┬───────┘
       │
┌──────▼───────┐
│  分配流量    │ (50% A, 50% B)
└──────┬───────┘
       │
┌──────▼───────┐
│  收集数据    │ (N 个任务)
└──────┬───────┘
       │
┌──────▼───────┐
│  统计分析    │ (p-value < 0.05)
└──────┬───────┘
       │
┌──────▼───────┐
│  决策        │ (采用/拒绝/继续测试)
└──────────────┘
```

## 效果评估

### 评估指标

| 指标 | 描述 | 权重 |
|------|------|------|
| `success_rate` | 任务成功率 | 0.4 |
| `quality_score` | 输出质量分数 | 0.3 |
| `efficiency` | Token 效率 | 0.2 |
| `user_satisfaction` | 用户满意度 | 0.1 |

### 综合得分

```
score = Σ(weight_i × metric_i)
```

## 配置

```yaml
context_engineer:
  enabled: true
  
  prompt_templates_dir: "./prompts"
  max_prompt_length: 8000
  
  evolution:
    trigger: periodic
    interval: 100          # 每 100 个任务评估一次
    min_experiences: 10    # 最少 10 个经验才更新
    confidence_threshold: 0.7
  
  ab_testing:
    enabled: true
    sample_size: 50        # 每组 50 个样本
    significance: 0.05     # 统计显著性
  
  pruning:
    enabled: true
    utility_threshold: 0.1
    max_length: 8000
```

## 使用示例

```typescript
const evolver = new PromptEvolver('./ace-storage');

// 记录经验
await evolver.evolveFromExperience({
  taskId: 'task-001',
  taskDescription: 'Fix timeout in upload handler',
  actions: ['analyze', 'identify bottleneck', 'add retry'],
  outcome: 'success',
  lessons: ['For timeouts, use exponential backoff'],
  timestamp: new Date()
});

// 获取当前 Prompt
const prompt = evolver.getCurrentPrompt();

// 评估效果
const evaluation = evolver.evaluateCurrentPrompt();
console.log(`Score: ${evaluation.score}`);
```

## 最佳实践

### Prompt 编写

1. **清晰的结构**: 使用标题和分节
2. **具体的指导**: 避免模糊的指令
3. **示例驱动**: 提供具体示例
4. **优先级明确**: 重要内容放前面

### 进化策略

1. **小步迭代**: 每次只更新一小部分
2. **验证优先**: 先验证再应用
3. **保留历史**: 维护版本历史
4. **人工监督**: 高风险更新需要批准

## 监控

### 日志

```json
{
  "event": "prompt_updated",
  "section": "learned_patterns",
  "old_version": "2.0.0",
  "new_version": "2.1.0",
  "improvement": 0.12,
  "confidence": 0.85
}
```

### 告警

- Prompt 膨胀超过 8000 tokens
- 成功率下降超过 10%
- A/B 测试无明显差异

---

*版本: 1.0.0*
*创建日期: 2026-02-24*
