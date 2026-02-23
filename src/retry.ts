/**
 * SWE-Agent-Node - Retry Utility
 * 重试机制和错误恢复
 */

export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number
  /** 初始延迟 (ms) */
  initialDelay: number
  /** 最大延迟 (ms) */
  maxDelay: number
  /** 退避因子 */
  backoffFactor: number
  /** 可重试的错误判断函数 */
  shouldRetry?: (error: Error) => boolean
  /** 重试前回调 */
  onRetry?: (attempt: number, error: Error, delay: number) => void
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
}

/**
 * 计算退避延迟
 */
export function calculateBackoff(
  attempt: number,
  config: Partial<RetryConfig>
): number {
  const { initialDelay = 1000, maxDelay = 30000, backoffFactor = 2 } = config
  
  // 指数退避 + 随机抖动
  const baseDelay = initialDelay * Math.pow(backoffFactor, attempt)
  const jitter = Math.random() * 0.1 * baseDelay
  const delay = baseDelay + jitter
  
  return Math.min(delay, maxDelay)
}

/**
 * 延迟函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 带重试的异步函数执行
 */
export async function retry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  const { maxRetries, shouldRetry, onRetry } = finalConfig
  
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      
      // 检查是否应该重试
      if (attempt < maxRetries) {
        const shouldRetryError = shouldRetry ? shouldRetry(error) : isRetryableError(error)
        
        if (shouldRetryError) {
          const backoffDelay = calculateBackoff(attempt, finalConfig)
          
          // 调用回调
          if (onRetry) {
            onRetry(attempt + 1, error, backoffDelay)
          }
          
          // 等待后重试
          await delay(backoffDelay)
          continue
        }
      }
      
      // 不可重试或达到最大重试次数
      throw error
    }
  }
  
  // 理论上不会到达这里
  throw lastError
}

/**
 * 判断是否为可重试错误
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase()
  const name = error.name?.toLowerCase() || ''
  
  // 网络错误
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('socket hang up') ||
    message.includes('fetch failed')
  ) {
    return true
  }
  
  // HTTP 状态码错误 (5xx 服务端错误)
  if (
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504') ||
    message.includes('429') // Too Many Requests
  ) {
    return true
  }
  
  // 速率限制
  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('quota exceeded')
  ) {
    return true
  }
  
  // 特定错误类型
  if (
    name === 'networkerror' ||
    name === 'timeouterror'
  ) {
    return true
  }
  
  return false
}

/**
 * 带超时的执行
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Operation timed out'
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage))
    }, timeoutMs)
    
    fn()
      .then(result => {
        clearTimeout(timer)
        resolve(result)
      })
      .catch(error => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

/**
 * 带重试和超时的执行
 */
export async function retryWithTimeout<T>(
  fn: () => Promise<T>,
  retryConfig: Partial<RetryConfig> = {},
  timeoutMs?: number
): Promise<T> {
  const wrappedFn = timeoutMs
    ? () => withTimeout(fn, timeoutMs)
    : fn
  
  return retry(wrappedFn, retryConfig)
}

/**
 * 电路断路器状态
 */
type CircuitState = 'closed' | 'open' | 'half-open'

/**
 * 电路断路器
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed'
  private failureCount = 0
  private lastFailureTime = 0
  
  constructor(
    private readonly threshold: number = 5,
    private readonly resetTimeout: number = 30000
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // 检查是否应该尝试恢复
    if (this.state === 'open') {
      const now = Date.now()
      if (now - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }
    
    try {
      const result = await fn()
      
      // 成功，重置状态
      if (this.state === 'half-open') {
        this.state = 'closed'
        this.failureCount = 0
      }
      
      return result
    } catch (error) {
      this.failureCount++
      this.lastFailureTime = Date.now()
      
      // 达到阈值，打开断路器
      if (this.failureCount >= this.threshold) {
        this.state = 'open'
      }
      
      throw error
    }
  }
  
  getState(): CircuitState {
    return this.state
  }
  
  reset(): void {
    this.state = 'closed'
    this.failureCount = 0
    this.lastFailureTime = 0
  }
}

/**
 * 批量执行，支持部分失败
 */
export async function executeBatch<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  options: {
    concurrency?: number
    continueOnError?: boolean
  } = {}
): Promise<{
  successful: Array<{ item: T; result: R }>
  failed: Array<{ item: T; error: Error }>
}> {
  const { concurrency = 5, continueOnError = true } = options
  
  const successful: Array<{ item: T; result: R }> = []
  const failed: Array<{ item: T; error: Error }> = []
  
  // 分批执行
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    
    const results = await Promise.allSettled(
      batch.map(item => fn(item))
    )
    
    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      const item = batch[j]
      
      if (result.status === 'fulfilled') {
        successful.push({ item, result: result.value })
      } else {
        failed.push({ item, error: result.reason })
        
        if (!continueOnError) {
          throw result.reason
        }
      }
    }
  }
  
  return { successful, failed }
}
