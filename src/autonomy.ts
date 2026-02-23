/**
 * SWE-Agent-Node - Autonomy Levels
 * 自主性级别系统，基于 Cursor 的 autonomy slider 概念
 */

/**
 * 自主性级别
 * 
 * 参考 Cursor 的 "autonomy slider" 设计
 * - Level 0: 仅建议（人类决策）
 * - Level 1: 辅助编辑（需确认）
 * - Level 2: 自动执行（可回滚）
 * - Level 3: 完全自主（trust & verify）
 */
export enum AutonomyLevel {
  /** 仅建议 - Agent 只提供建议，所有决策由人类做出 */
  SUGGEST = 0,
  
  /** 辅助编辑 - Agent 可以执行操作，但需要人类确认 */
  ASSIST = 1,
  
  /** 自动执行 - Agent 自动执行，但支持回滚 */
  AUTO = 2,
  
  /** 完全自主 - Agent 完全自主执行，事后验证 */
  AUTONOMOUS = 3,
}

/**
 * 自主性配置
 */
export interface AutonomyConfig {
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

/**
 * 操作类型（需要确认或限制的）
 */
export type StepType = 
  | 'parse-issue'
  | 'analyze-repo'
  | 'search-code'
  | 'generate-fix'
  | 'apply-modification'
  | 'run-tests'
  | 'commit-changes'
  | 'push-changes'
  | 'rollback'

/**
 * 自主性决策结果
 */
export interface AutonomyDecision {
  /** 是否允许执行 */
  allowed: boolean
  
  /** 是否需要确认 */
  requiresConfirmation: boolean
  
  /** 是否可以回滚 */
  canRollback: boolean
  
  /** 原因说明 */
  reason?: string
  
  /** 安全警告 */
  warnings?: string[]
}

/**
 * 自主性管理器
 */
export class AutonomyManager {
  private config: AutonomyConfig
  
  constructor(config: AutonomyConfig) {
    this.config = this.applyDefaults(config)
  }
  
  /**
   * 应用默认配置
   */
  private applyDefaults(config: AutonomyConfig): AutonomyConfig {
    return {
      level: config.level ?? AutonomyLevel.ASSIST,
      requireConfirmation: config.requireConfirmation ?? this.getDefaultConfirmationSteps(config.level),
      autoRollbackTimeout: config.autoRollbackTimeout ?? 300000, // 5 分钟
      maxAutoSteps: config.maxAutoSteps ?? 20,
      enableSafetyBoundaries: config.enableSafetyBoundaries ?? true,
      forbiddenActions: config.forbiddenActions ?? this.getDefaultForbiddenActions(),
    }
  }
  
  /**
   * 根据级别获取需要确认的步骤
   */
  private getDefaultConfirmationSteps(level: AutonomyLevel): string[] {
    switch (level) {
      case AutonomyLevel.SUGGEST:
        // Level 0: 所有操作都需要确认
        return [
          'apply-modification',
          'commit-changes',
          'push-changes',
          'rollback',
        ]
      
      case AutonomyLevel.ASSIST:
        // Level 1: 危险操作需要确认
        return [
          'apply-modification',
          'commit-changes',
          'push-changes',
        ]
      
      case AutonomyLevel.AUTO:
        // Level 2: 只有 push 需要确认
        return ['push-changes']
      
      case AutonomyLevel.AUTONOMOUS:
        // Level 3: 不需要确认
        return []
      
      default:
        return ['apply-modification', 'commit-changes', 'push-changes']
    }
  }
  
  /**
   * 获取默认禁止的操作
   */
  private getDefaultForbiddenActions(): string[] {
    return [
      'delete-repository',
      'force-push',
      'reset-hard',
      'delete-branch',
    ]
  }
  
  /**
   * 检查是否允许执行某个操作
   */
  canExecute(
    stepType: StepType,
    currentStep: number,
    context?: {
      hasBackup?: boolean
      testPassing?: boolean
    }
  ): AutonomyDecision {
    const warnings: string[] = []
    
    // 1. 检查是否在禁止列表中
    if (this.config.forbiddenActions?.includes(stepType)) {
      return {
        allowed: false,
        requiresConfirmation: false,
        canRollback: false,
        reason: `操作 "${stepType}" 被禁止执行`,
        warnings: ['此操作在禁止列表中'],
      }
    }
    
    // 2. 检查步数限制
    if (currentStep >= (this.config.maxAutoSteps ?? 20)) {
      return {
        allowed: false,
        requiresConfirmation: true,
        canRollback: true,
        reason: `已达到最大步数限制 (${this.config.maxAutoSteps})`,
        warnings: ['需要人工介入以继续'],
      }
    }
    
    // 3. 检查是否需要确认（如果在列表中就需要确认，无论级别）
    const requiresConfirmation = 
      this.config.requireConfirmation?.includes(stepType) ?? false
    
    // 4. 检查安全边界
    if (this.config.enableSafetyBoundaries) {
      if (stepType === 'apply-modification' && !context?.hasBackup) {
        warnings.push('建议在修改前创建备份')
      }
      
      if (stepType === 'commit-changes' && !context?.testPassing) {
        warnings.push('测试未通过，提交可能包含错误')
      }
    }
    
    // 5. 根据级别决定是否允许
    const allowed = 
      this.config.level >= AutonomyLevel.AUTO || 
      (this.config.level >= AutonomyLevel.ASSIST && !requiresConfirmation) ||
      this.config.level === AutonomyLevel.SUGGEST
    
    // 6. 检查是否可以回滚
    const canRollback = 
      this.config.level >= AutonomyLevel.AUTO && 
      ['apply-modification', 'commit-changes'].includes(stepType) &&
      !requiresConfirmation
    
    return {
      allowed,
      requiresConfirmation,
      canRollback,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }
  
  /**
   * 获取当前配置
   */
  getConfig(): AutonomyConfig {
    return { ...this.config }
  }
  
  /**
   * 更新自主性级别
   */
  setLevel(level: AutonomyLevel): void {
    this.config.level = level
    this.config.requireConfirmation = this.getDefaultConfirmationSteps(level)
  }
  
  /**
   * 添加需要确认的操作
   */
  addConfirmationStep(stepType: StepType): void {
    if (!this.config.requireConfirmation?.includes(stepType)) {
      this.config.requireConfirmation = this.config.requireConfirmation ?? []
      this.config.requireConfirmation.push(stepType)
    }
  }
  
  /**
   * 移除需要确认的操作
   */
  removeConfirmationStep(stepType: StepType): void {
    this.config.requireConfirmation = this.config.requireConfirmation?.filter(
      s => s !== stepType
    )
  }
  
  /**
   * 获取级别描述
   */
  static getLevelDescription(level: AutonomyLevel): string {
    const descriptions = {
      [AutonomyLevel.SUGGEST]: '仅建议 - Agent 只提供建议，所有决策由人类做出',
      [AutonomyLevel.ASSIST]: '辅助编辑 - Agent 可以执行操作，但需要人类确认',
      [AutonomyLevel.AUTO]: '自动执行 - Agent 自动执行，但支持回滚',
      [AutonomyLevel.AUTONOMOUS]: '完全自主 - Agent 完全自主执行，事后验证',
    }
    return descriptions[level]
  }
  
  /**
   * 获取级别名称
   */
  static getLevelName(level: AutonomyLevel): string {
    const names = {
      [AutonomyLevel.SUGGEST]: 'SUGGEST',
      [AutonomyLevel.ASSIST]: 'ASSIST',
      [AutonomyLevel.AUTO]: 'AUTO',
      [AutonomyLevel.AUTONOMOUS]: 'AUTONOMOUS',
    }
    return names[level]
  }
}

/**
 * 创建默认自主性配置
 */
export function createDefaultAutonomyConfig(
  level: AutonomyLevel = AutonomyLevel.ASSIST
): AutonomyConfig {
  return {
    level,
    requireConfirmation: undefined, // 将使用默认值
    autoRollbackTimeout: 300000,
    maxAutoSteps: 20,
    enableSafetyBoundaries: true,
    forbiddenActions: undefined, // 将使用默认值
  }
}
