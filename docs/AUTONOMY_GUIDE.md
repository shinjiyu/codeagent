# 自主性系统使用指南

本文档详细介绍 SWE-Agent-Node 的自主性系统，帮助你理解和有效使用这一核心功能。

---

## 📖 目录

- [概述](#概述)
- [4 级自主性设计](#4-级自主性设计)
- [快速开始](#快速开始)
- [详细配置](#详细配置)
- [使用场景](#使用场景)
- [安全机制](#安全机制)
- [最佳实践](#最佳实践)
- [常见问题](#常见问题)

---

## 概述

### 什么是自主性系统？

自主性系统是 SWE-Agent-Node 的核心特性之一，灵感来源于 Cursor 的 "autonomy slider" 概念。它允许你精确控制 AI Agent 的行为自主程度，从完全由人类控制到完全自主执行。

### 为什么需要自主性系统？

在使用 AI Agent 时，不同场景需要不同程度的控制：

- **关键代码修改** → 需要严格控制和确认
- **日常开发工作** → 需要平衡效率和安全
- **批量处理任务** → 需要高度自动化

自主性系统让你可以根据实际情况灵活调整，获得最佳体验。

---

## 4 级自主性设计

### Level 0 - SUGGEST（仅建议）

**特点**: Agent 只提供建议，所有决策由人类做出

**适用场景**:
- 首次使用 Agent
- 处理关键代码
- 不熟悉的项目
- 学习 Agent 行为

**行为**:
- ✅ Agent 分析问题并提供解决方案
- ❌ 不自动执行任何修改操作
- ✅ 所有操作都需要人类确认

**示例配置**:
```typescript
const agent = new Agent({
  autonomy: { level: AutonomyLevel.SUGGEST }
});
```

---

### Level 1 - ASSIST（辅助编辑）[默认]

**特点**: Agent 可以执行操作，但危险操作需要确认

**适用场景**:
- 日常开发工作
- 需要一定控制
- 平衡效率和安全

**行为**:
- ✅ 自动执行安全操作（搜索、分析）
- ⚠️ 危险操作需要确认（修改、提交、推送）
- ✅ 提供操作说明和风险提示

**需要确认的操作**:
- `apply-modification` - 修改代码
- `commit-changes` - 提交更改
- `push-changes` - 推送到远程

**示例配置**:
```typescript
const agent = new Agent({
  autonomy: { level: AutonomyLevel.ASSIST }
});
```

---

### Level 2 - AUTO（自动执行）

**特点**: Agent 自动执行，支持回滚机制

**适用场景**:
- 熟悉的项目
- 重复性任务
- 信任 Agent 能力

**行为**:
- ✅ 自动执行大部分操作
- ⚠️ 只有 push 需要确认
- ✅ 支持自动回滚
- ✅ 提供详细日志

**需要确认的操作**:
- `push-changes` - 推送到远程

**示例配置**:
```typescript
const agent = new Agent({
  autonomy: {
    level: AutonomyLevel.AUTO,
    maxAutoSteps: 50,
    autoRollbackTimeout: 600000
  }
});
```

---

### Level 3 - AUTONOMOUS（完全自主）

**特点**: Agent 完全自主执行，事后验证

**适用场景**:
- 非关键任务
- 批量处理
- 完全信任 Agent

**行为**:
- ✅ 完全自主执行
- ✅ 不需要确认
- ✅ 事后提供执行报告
- ✅ 高效率处理

**需要确认的操作**: 无

**示例配置**:
```typescript
const agent = new Agent({
  autonomy: {
    level: AutonomyLevel.AUTONOMOUS,
    maxAutoSteps: 100
  }
});
```

---

## 快速开始

### 1. 使用默认配置

最简单的方式是不指定自主性配置，系统会使用默认的 ASSIST 级别：

```typescript
import { Agent } from 'swe-agent-node';

const agent = new Agent({
  maxSteps: 10,
  llm: { model: 'gpt-4' },
  git: {
    defaultBranch: 'main',
    commitTemplate: 'fix: {message}',
    autoPush: false,
  },
  test: {
    command: 'npm test',
    pattern: '**/*.test.ts',
    timeout: 30000,
  },
  evolution: {
    enabled: true,
    patternMiningInterval: 10,
    minConfidence: 0.5,
    maxKnowledgeSize: 100,
  },
  // 不指定 autonomy，使用默认 ASSIST 级别
});
```

### 2. 指定自主性级别

```typescript
import { Agent, AutonomyLevel } from 'swe-agent-node';

const agent = new Agent({
  // ... 其他配置
  autonomy: {
    level: AutonomyLevel.AUTO,
  },
});
```

### 3. 使用完整配置

```typescript
import { Agent, AutonomyLevel } from 'swe-agent-node';

const agent = new Agent({
  // ... 其他配置
  autonomy: {
    level: AutonomyLevel.AUTO,
    maxAutoSteps: 50,
    autoRollbackTimeout: 600000,
    enableSafetyBoundaries: true,
    forbiddenActions: ['delete-repository', 'force-push'],
    requireConfirmation: ['push-changes'],
  },
});
```

---

## 详细配置

### AutonomyConfig 接口

```typescript
interface AutonomyConfig {
  /** 当前自主性级别 */
  level: AutonomyLevel
  
  /** 需要确认的操作类型 */
  requireConfirmation?: string[]
  
  /** 自动回滚的超时时间（毫秒） */
  autoRollbackTimeout?: number
  
  /** 最大自动执行步数 */
  maxAutoSteps?: number
  
  /** 是否启用安全边界 */
  enableSafetyBoundaries?: boolean
  
  /** 禁止的操作类型 */
  forbiddenActions?: string[]
}
```

### 配置参数说明

#### level（必需）

自主性级别，可选值：
- `AutonomyLevel.SUGGEST` (0)
- `AutonomyLevel.ASSIST` (1)
- `AutonomyLevel.AUTO` (2)
- `AutonomyLevel.AUTONOMOUS` (3)

#### maxAutoSteps（可选，默认 20）

Agent 在自动模式下最多执行的步骤数。超过限制后需要人工介入。

**推荐值**:
- SUGGEST: 不适用
- ASSIST: 10-20
- AUTO: 30-50
- AUTONOMOUS: 50-100

#### autoRollbackTimeout（可选，默认 300000ms）

自动回滚的超时时间，单位毫秒。仅对 AUTO 级别有效。

**推荐值**:
- 5 分钟 (300000ms) - 保守
- 10 分钟 (600000ms) - 推荐
- 30 分钟 (1800000ms) - 激进

#### enableSafetyBoundaries（可选，默认 true）

是否启用安全边界检查。启用后会在特定情况下提供警告。

**警告场景**:
- 修改代码前没有备份
- 提交代码时测试未通过
- 步数接近上限

#### requireConfirmation（可选，自动设置）

需要确认的操作列表。根据级别自动设置，也可以自定义。

**操作类型**:
- `apply-modification` - 修改代码
- `commit-changes` - 提交更改
- `push-changes` - 推送到远程
- `rollback` - 回滚操作
- `search-code` - 搜索代码

#### forbiddenActions（可选，默认 4 个）

禁止执行的操作列表。默认禁止危险操作。

**默认禁止操作**:
- `delete-repository` - 删除仓库
- `force-push` - 强制推送
- `reset-hard` - 硬重置
- `delete-branch` - 删除分支

---

## 使用场景

### 场景 1: 首次使用 Agent

**推荐配置**: Level 0 (SUGGEST)

```typescript
const agent = new Agent({
  autonomy: {
    level: AutonomyLevel.SUGGEST,
  },
});
```

**原因**:
- 完全控制，了解 Agent 行为
- 学习 Agent 的决策过程
- 建立对 Agent 的信任

---

### 场景 2: 日常开发工作

**推荐配置**: Level 1 (ASSIST)

```typescript
const agent = new Agent({
  autonomy: {
    level: AutonomyLevel.ASSIST,
  },
});
```

**原因**:
- 平衡效率和安全
- 自动执行安全操作
- 危险操作需要确认

---

### 场景 3: 熟悉的项目

**推荐配置**: Level 2 (AUTO)

```typescript
const agent = new Agent({
  autonomy: {
    level: AutonomyLevel.AUTO,
    maxAutoSteps: 50,
    autoRollbackTimeout: 600000,
  },
});
```

**原因**:
- 提高效率
- 支持回滚机制
- 信任 Agent 能力

---

### 场景 4: 批量处理任务

**推荐配置**: Level 3 (AUTONOMOUS)

```typescript
const agent = new Agent({
  autonomy: {
    level: AutonomyLevel.AUTONOMOUS,
    maxAutoSteps: 100,
  },
});
```

**原因**:
- 完全自动化
- 高效处理
- 非关键任务

---

## 安全机制

### 3 层安全保护

#### 1. 步数限制

**作用**: 防止 Agent 无限执行

**配置**: `maxAutoSteps`

**示例**:
```typescript
autonomy: {
  level: AutonomyLevel.AUTO,
  maxAutoSteps: 30, // 最多 30 步
}
```

**触发条件**: 当前步数 ≥ maxAutoSteps

**行为**: 停止执行，请求人工介入

---

#### 2. 禁止操作

**作用**: 防止执行危险操作

**配置**: `forbiddenActions`

**示例**:
```typescript
autonomy: {
  level: AutonomyLevel.AUTO,
  forbiddenActions: [
    'delete-repository',
    'force-push',
    'custom-dangerous-op',
  ],
}
```

**触发条件**: 尝试执行禁止操作

**行为**: 拒绝执行，返回错误

---

#### 3. 安全警告

**作用**: 在潜在危险情况下提醒用户

**配置**: `enableSafetyBoundaries`

**示例**:
```typescript
autonomy: {
  level: AutonomyLevel.AUTO,
  enableSafetyBoundaries: true,
}
```

**触发条件**:
- 修改代码前无备份
- 提交代码时测试失败
- 步数接近上限

**行为**: 返回警告信息，但不阻止执行

---

## 最佳实践

### 1. 渐进式信任

从低级别开始，逐步提升：

```
首次使用 → Level 0 (SUGGEST)
    ↓
熟悉后 → Level 1 (ASSIST)
    ↓
信任建立 → Level 2 (AUTO)
    ↓
完全信任 → Level 3 (AUTONOMOUS)
```

### 2. 场景化选择

根据实际情况选择级别：

| 场景 | 推荐级别 | 原因 |
|------|---------|------|
| 首次使用 | SUGGEST | 学习和了解 |
| 关键代码 | SUGGEST/ASSIST | 需要控制 |
| 日常开发 | ASSIST | 平衡效率 |
| 熟悉项目 | AUTO | 提高效率 |
| 批量任务 | AUTONOMOUS | 完全自动化 |

### 3. 安全优先

始终启用安全机制：

```typescript
autonomy: {
  level: AutonomyLevel.AUTO,
  enableSafetyBoundaries: true, // 启用安全边界
  maxAutoSteps: 50, // 限制步数
  forbiddenActions: [
    'delete-repository',
    'force-push',
    // 添加更多危险操作
  ],
}
```

### 4. 定期审查

定期检查和调整配置：

- 每周审查 Agent 行为
- 根据信任度调整级别
- 更新禁止操作列表
- 优化步数限制

---

## 常见问题

### Q1: 如何选择合适的自主性级别？

**A**: 根据以下因素综合考虑：
- 项目重要性
- 代码熟悉程度
- 任务复杂度
- 时间紧迫性

建议从 Level 1 (ASSIST) 开始，根据实际体验调整。

### Q2: Level 3 (AUTONOMOUS) 安全吗？

**A**: 相对安全，但需要注意：
- 启用安全边界
- 设置合理的步数限制
- 仅用于非关键任务
- 事后检查执行报告

### Q3: 如何动态调整级别？

**A**: 目前需要重新创建 Agent 实例。未来版本将支持运行时调整。

### Q4: 自主性系统会影响性能吗？

**A**: 影响很小。级别越高，效率越高（减少确认环节）。

### Q5: 可以自定义需要确认的操作吗？

**A**: 可以。通过 `requireConfirmation` 配置：

```typescript
autonomy: {
  level: AutonomyLevel.AUTO,
  requireConfirmation: [
    'apply-modification',
    'commit-changes',
    'search-code', // 添加额外确认
  ],
}
```

### Q6: 如何查看当前配置？

**A**: 使用 AutonomyManager 的 `getConfig()` 方法：

```typescript
const manager = new AutonomyManager(config);
console.log(manager.getConfig());
```

---

## 进阶话题

### 与进化系统集成

自主性系统可以与进化系统配合使用：

```typescript
const agent = new Agent({
  evolution: {
    enabled: true,
    minConfidence: 0.8,
  },
  autonomy: {
    level: AutonomyLevel.AUTO,
    // 高置信度时使用高级别
  },
});
```

### 多 Agent 协作

未来版本将支持多个 Agent 使用不同级别：

```typescript
// 主 Agent - 高级别
const mainAgent = new Agent({
  autonomy: { level: AutonomyLevel.AUTONOMOUS },
});

// 审查 Agent - 低级别
const reviewAgent = new Agent({
  autonomy: { level: AutonomyLevel.SUGGEST },
});
```

---

## 相关资源

- [API 文档](./API.md)
- [示例代码](../examples/autonomy-example.ts)
- [测试用例](../tests/autonomy.test.ts)
- [竞品研究](./COMPETITOR_RESEARCH.md)

---

## 更新日志

- **2026-02-24**: 初始版本，实现 4 级自主性系统
- 基于 Cursor 的 "autonomy slider" 概念
- 参考 Andrej Karpathy 的设计理念

---

**最后更新**: 2026-02-24 (迭代 #28)
