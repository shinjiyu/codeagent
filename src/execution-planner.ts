/**
 * SWE-Agent-Node - Execution Planner
 * 执行计划生成器
 */

import type { Issue, CodeLocation, CodeModification } from './types'
import type { ParsedIssue } from './issue-parser'

export interface ExecutionStep {
  id: string
  type: StepType
  description: string
  dependencies: string[]
  estimatedTime?: number
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
}

export type StepType = 
  | 'analyze'
  | 'search'
  | 'read'
  | 'modify'
  | 'create'
  | 'delete'
  | 'test'
  | 'commit'

export interface ExecutionPlan {
  id: string
  issueId: string
  steps: ExecutionStep[]
  createdAt: Date
  estimatedTotalTime?: number
}

export interface PlanningContext {
  issue: ParsedIssue
  locations?: CodeLocation[]
  existingFiles?: string[]
}

export class ExecutionPlanner {
  /**
   * 生成执行计划
   */
  createPlan(context: PlanningContext): ExecutionPlan {
    const { issue, locations = [], existingFiles = [] } = context
    const steps: ExecutionStep[] = []
    
    // 根据问题类型选择策略
    const type = issue.parsed?.type || 'unknown'
    const severity = issue.parsed?.severity || 'unknown'
    
    switch (type) {
      case 'bug':
        return this.createBugFixPlan(issue, locations, severity)
      case 'feature':
        return this.createFeaturePlan(issue, existingFiles, severity)
      case 'enhancement':
        return this.createEnhancementPlan(issue, existingFiles, severity)
      case 'documentation':
        return this.createDocumentationPlan(issue, severity)
      default:
        return this.createGenericPlan(issue, severity)
    }
  }

  /**
   * Bug 修复计划
   */
  private createBugFixPlan(
    issue: ParsedIssue,
    locations: CodeLocation[],
    severity: string
  ): ExecutionPlan {
    const steps: ExecutionStep[] = []
    const files = issue.parsed?.mentionedFiles || []
    const errorStack = issue.parsed?.errorStack || []
    
    // 1. 分析问题
    steps.push({
      id: 'step-1',
      type: 'analyze',
      description: '分析错误原因和影响范围',
      dependencies: [],
      priority: 'high',
      status: 'pending',
    })

    // 2. 搜索相关代码
    if (files.length > 0) {
      steps.push({
        id: 'step-2',
        type: 'search',
        description: `搜索相关文件: ${files.slice(0, 3).join(', ')}`,
        dependencies: ['step-1'],
        priority: 'high',
        status: 'pending',
      })
    } else {
      steps.push({
        id: 'step-2',
        type: 'search',
        description: '搜索相关代码',
        dependencies: ['step-1'],
        priority: 'high',
        status: 'pending',
      })
    }

    // 3. 读取相关文件
    if (errorStack.length > 0) {
      const errorFile = errorStack[0].file
      steps.push({
        id: 'step-3',
        type: 'read',
        description: `读取错误文件: ${errorFile}`,
        dependencies: ['step-2'],
        priority: 'high',
        status: 'pending',
      })
    } else {
      steps.push({
        id: 'step-3',
        type: 'read',
        description: '读取相关源代码',
        dependencies: ['step-2'],
        priority: 'high',
        status: 'pending',
      })
    }

    // 4. 修改代码
    steps.push({
      id: 'step-4',
      type: 'modify',
      description: '修复 Bug',
      dependencies: ['step-3'],
      priority: severity === 'critical' ? 'high' : 'medium',
      status: 'pending',
    })

    // 5. 运行测试
    steps.push({
      id: 'step-5',
      type: 'test',
      description: '验证修复是否有效',
      dependencies: ['step-4'],
      priority: 'high',
      status: 'pending',
    })

    // 6. 提交更改
    steps.push({
      id: 'step-6',
      type: 'commit',
      description: '提交修复',
      dependencies: ['step-5'],
      priority: 'medium',
      status: 'pending',
    })

    return {
      id: `plan-${Date.now()}`,
      issueId: issue.id,
      steps,
      createdAt: new Date(),
      estimatedTotalTime: steps.length * 30, // 估算每步30秒
    }
  }

  /**
   * 功能开发计划
   */
  private createFeaturePlan(
    issue: ParsedIssue,
    existingFiles: string[],
    severity: string
  ): ExecutionPlan {
    const steps: ExecutionStep[] = []
    
    // 1. 分析需求
    steps.push({
      id: 'step-1',
      type: 'analyze',
      description: '分析功能需求',
      dependencies: [],
      priority: 'high',
      status: 'pending',
    })

    // 2. 搜索相关代码
    steps.push({
      id: 'step-2',
      type: 'search',
      description: '查找可复用的代码和模式',
      dependencies: ['step-1'],
      priority: 'medium',
      status: 'pending',
    })

    // 3. 读取相关文件
    steps.push({
      id: 'step-3',
      type: 'read',
      description: '理解现有代码结构',
      dependencies: ['step-2'],
      priority: 'medium',
      status: 'pending',
    })

    // 4. 创建新文件/修改现有文件
    steps.push({
      id: 'step-4',
      type: 'create',
      description: '实现新功能',
      dependencies: ['step-3'],
      priority: 'high',
      status: 'pending',
    })

    // 5. 运行测试
    steps.push({
      id: 'step-5',
      type: 'test',
      description: '验证功能正确性',
      dependencies: ['step-4'],
      priority: 'high',
      status: 'pending',
    })

    // 6. 提交更改
    steps.push({
      id: 'step-6',
      type: 'commit',
      description: '提交新功能',
      dependencies: ['step-5'],
      priority: 'medium',
      status: 'pending',
    })

    return {
      id: `plan-${Date.now()}`,
      issueId: issue.id,
      steps,
      createdAt: new Date(),
      estimatedTotalTime: steps.length * 60, // 功能开发估算每步60秒
    }
  }

  /**
   * 增强计划
   */
  private createEnhancementPlan(
    issue: ParsedIssue,
    existingFiles: string[],
    severity: string
  ): ExecutionPlan {
    const steps: ExecutionStep[] = []
    
    steps.push({
      id: 'step-1',
      type: 'analyze',
      description: '分析优化目标',
      dependencies: [],
      priority: 'medium',
      status: 'pending',
    })

    steps.push({
      id: 'step-2',
      type: 'search',
      description: '定位需要优化的代码',
      dependencies: ['step-1'],
      priority: 'medium',
      status: 'pending',
    })

    steps.push({
      id: 'step-3',
      type: 'read',
      description: '理解现有实现',
      dependencies: ['step-2'],
      priority: 'medium',
      status: 'pending',
    })

    steps.push({
      id: 'step-4',
      type: 'modify',
      description: '优化代码',
      dependencies: ['step-3'],
      priority: 'medium',
      status: 'pending',
    })

    steps.push({
      id: 'step-5',
      type: 'test',
      description: '验证优化效果',
      dependencies: ['step-4'],
      priority: 'medium',
      status: 'pending',
    })

    steps.push({
      id: 'step-6',
      type: 'commit',
      description: '提交优化',
      dependencies: ['step-5'],
      priority: 'low',
      status: 'pending',
    })

    return {
      id: `plan-${Date.now()}`,
      issueId: issue.id,
      steps,
      createdAt: new Date(),
      estimatedTotalTime: steps.length * 45,
    }
  }

  /**
   * 文档计划
   */
  private createDocumentationPlan(
    issue: ParsedIssue,
    severity: string
  ): ExecutionPlan {
    const steps: ExecutionStep[] = []
    
    steps.push({
      id: 'step-1',
      type: 'analyze',
      description: '分析文档需求',
      dependencies: [],
      priority: 'low',
      status: 'pending',
    })

    steps.push({
      id: 'step-2',
      type: 'search',
      description: '查找相关代码',
      dependencies: ['step-1'],
      priority: 'low',
      status: 'pending',
    })

    steps.push({
      id: 'step-3',
      type: 'modify',
      description: '更新文档',
      dependencies: ['step-2'],
      priority: 'low',
      status: 'pending',
    })

    steps.push({
      id: 'step-4',
      type: 'commit',
      description: '提交文档更新',
      dependencies: ['step-3'],
      priority: 'low',
      status: 'pending',
    })

    return {
      id: `plan-${Date.now()}`,
      issueId: issue.id,
      steps,
      createdAt: new Date(),
      estimatedTotalTime: steps.length * 20,
    }
  }

  /**
   * 通用计划
   */
  private createGenericPlan(
    issue: ParsedIssue,
    severity: string
  ): ExecutionPlan {
    const steps: ExecutionStep[] = []
    
    steps.push({
      id: 'step-1',
      type: 'analyze',
      description: '分析问题',
      dependencies: [],
      priority: 'medium',
      status: 'pending',
    })

    steps.push({
      id: 'step-2',
      type: 'search',
      description: '搜索相关代码',
      dependencies: ['step-1'],
      priority: 'medium',
      status: 'pending',
    })

    steps.push({
      id: 'step-3',
      type: 'modify',
      description: '执行修改',
      dependencies: ['step-2'],
      priority: 'medium',
      status: 'pending',
    })

    steps.push({
      id: 'step-4',
      type: 'test',
      description: '验证修改',
      dependencies: ['step-3'],
      priority: 'medium',
      status: 'pending',
    })

    steps.push({
      id: 'step-5',
      type: 'commit',
      description: '提交更改',
      dependencies: ['step-4'],
      priority: 'medium',
      status: 'pending',
    })

    return {
      id: `plan-${Date.now()}`,
      issueId: issue.id,
      steps,
      createdAt: new Date(),
      estimatedTotalTime: steps.length * 40,
    }
  }

  /**
   * 获取下一步
   */
  getNextStep(plan: ExecutionPlan): ExecutionStep | null {
    const pendingSteps = plan.steps.filter(s => s.status === 'pending')
    
    for (const step of pendingSteps) {
      // 检查依赖是否都已完成
      const depsCompleted = step.dependencies.every(depId => {
        const dep = plan.steps.find(s => s.id === depId)
        return dep && dep.status === 'completed'
      })
      
      if (depsCompleted) {
        return step
      }
    }
    
    return null
  }

  /**
   * 更新步骤状态
   */
  updateStepStatus(
    plan: ExecutionPlan,
    stepId: string,
    status: ExecutionStep['status']
  ): ExecutionPlan {
    const step = plan.steps.find(s => s.id === stepId)
    if (step) {
      step.status = status
    }
    return plan
  }

  /**
   * 检查计划是否完成
   */
  isPlanCompleted(plan: ExecutionPlan): boolean {
    return plan.steps.every(s => 
      s.status === 'completed' || s.status === 'skipped'
    )
  }

  /**
   * 获取计划进度
   */
  getProgress(plan: ExecutionPlan): {
    total: number
    completed: number
    failed: number
    pending: number
    percentage: number
  } {
    const total = plan.steps.length
    const completed = plan.steps.filter(s => s.status === 'completed').length
    const failed = plan.steps.filter(s => s.status === 'failed').length
    const pending = plan.steps.filter(s => s.status === 'pending').length
    
    return {
      total,
      completed,
      failed,
      pending,
      percentage: Math.round((completed / total) * 100),
    }
  }

  /**
   * 生成计划摘要
   */
  summarizePlan(plan: ExecutionPlan): string {
    const lines: string[] = [
      `执行计划 #${plan.id}`,
      `问题: ${plan.issueId}`,
      `创建时间: ${plan.createdAt.toISOString()}`,
      `预计时间: ${plan.estimatedTotalTime}s`,
      '',
      '步骤:',
    ]
    
    plan.steps.forEach((step, index) => {
      const statusIcon = {
        pending: '⏳',
        running: '🔄',
        completed: '✅',
        failed: '❌',
        skipped: '⏭️',
      }[step.status]
      
      lines.push(`  ${index + 1}. [${statusIcon}] ${step.description}`)
    })
    
    const progress = this.getProgress(plan)
    lines.push('')
    lines.push(`进度: ${progress.completed}/${progress.total} (${progress.percentage}%)`)
    
    return lines.join('\n')
  }
}
