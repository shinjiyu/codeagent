/**
 * Retry 工具测试
 */

import {
  retry,
  withTimeout,
  calculateBackoff,
  delay,
  isRetryableError,
  CircuitBreaker,
  executeBatch,
} from '../src/retry';

describe('Retry Utility', () => {
  describe('calculateBackoff', () => {
    it('应该计算指数退避延迟', () => {
      const delay0 = calculateBackoff(0, { initialDelay: 1000 });
      const delay1 = calculateBackoff(1, { initialDelay: 1000 });
      const delay2 = calculateBackoff(2, { initialDelay: 1000 });
      
      // 延迟应该递增
      expect(delay1).toBeGreaterThan(delay0);
      expect(delay2).toBeGreaterThan(delay1);
    });

    it('应该不超过最大延迟', () => {
      const maxDelay = 10000;
      const delay = calculateBackoff(10, { initialDelay: 1000, maxDelay });
      
      expect(delay).toBeLessThanOrEqual(maxDelay);
    });

    it('应该包含随机抖动', () => {
      const delays = [
        calculateBackoff(1, { initialDelay: 1000 }),
        calculateBackoff(1, { initialDelay: 1000 }),
        calculateBackoff(1, { initialDelay: 1000 }),
      ];
      
      // 由于抖动，延迟应该不完全相同
      const uniqueDelays = new Set(delays.map(d => Math.floor(d / 10)));
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('delay', () => {
    it('应该等待指定时间', async () => {
      const start = Date.now();
      await delay(100);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('retry', () => {
    it('应该在成功时立即返回', async () => {
      let calls = 0;
      
      const result = await retry(async () => {
        calls++;
        return 'success';
      });
      
      expect(result).toBe('success');
      expect(calls).toBe(1);
    });

    it('应该在失败后重试', async () => {
      let attempts = 0;
      
      const result = await retry(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Network timeout');
          }
          return 'success';
        },
        { maxRetries: 3, initialDelay: 10 }
      );
      
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('应该达到最大重试次数后抛出错误', async () => {
      let attempts = 0;
      
      await expect(
        retry(
          async () => {
            attempts++;
            throw new Error('Network timeout');
          },
          { maxRetries: 2, initialDelay: 10 }
        )
      ).rejects.toThrow('Network timeout');
      
      expect(attempts).toBe(3); // 初始 + 2 次重试
    });

    it('应该只重试可重试错误', async () => {
      let attempts = 0;
      
      await expect(
        retry(
          async () => {
            attempts++;
            throw new Error('Invalid argument');
          },
          { maxRetries: 3, initialDelay: 10 }
        )
      ).rejects.toThrow('Invalid argument');
      
      // 不可重试错误，只执行一次
      expect(attempts).toBe(1);
    });

    it('应该使用自定义 shouldRetry', async () => {
      let attempts = 0;
      
      const result = await retry(
        async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error('Custom error');
          }
          return 'success';
        },
        {
          maxRetries: 3,
          initialDelay: 10,
          shouldRetry: (error) => error.message === 'Custom error',
        }
      );
      
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('应该调用 onRetry 回调', async () => {
      const retryEvents: Array<{ attempt: number; delay: number }> = [];
      let attempts = 0;
      
      await retry(
        async () => {
          attempts++;
          if (attempts < 3) throw new Error('Network timeout');
          return 'success';
        },
        {
          maxRetries: 3,
          initialDelay: 10,
          onRetry: (attempt, error, delay) => {
            retryEvents.push({ attempt, delay });
          },
        }
      );
      
      expect(retryEvents).toHaveLength(2);
      expect(retryEvents[0].attempt).toBe(1);
    });
  });

  describe('isRetryableError', () => {
    it('应该识别网络错误', () => {
      expect(isRetryableError(new Error('Network error'))).toBe(true);
      expect(isRetryableError(new Error('Connection timeout'))).toBe(true);
      expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
    });

    it('应该识别 HTTP 5xx 错误', () => {
      expect(isRetryableError(new Error('500 Internal Server Error'))).toBe(true);
      expect(isRetryableError(new Error('502 Bad Gateway'))).toBe(true);
      expect(isRetryableError(new Error('503 Service Unavailable'))).toBe(true);
    });

    it('应该识别速率限制错误', () => {
      expect(isRetryableError(new Error('Rate limit exceeded'))).toBe(true);
      expect(isRetryableError(new Error('429 Too Many Requests'))).toBe(true);
    });

    it('应该不识别不可重试错误', () => {
      expect(isRetryableError(new Error('Invalid input'))).toBe(false);
      expect(isRetryableError(new Error('Not found'))).toBe(false);
      expect(isRetryableError(new Error('Authentication failed'))).toBe(false);
    });
  });

  describe('withTimeout', () => {
    it('应该在超时前完成', async () => {
      const result = await withTimeout(
        async () => {
          await delay(50);
          return 'success';
        },
        1000
      );
      
      expect(result).toBe('success');
    });

    it('应该在超时后抛出错误', async () => {
      await expect(
        withTimeout(
          async () => {
            await delay(200);
            return 'success';
          },
          100
        )
      ).rejects.toThrow('timed out');
    });

    it('应该使用自定义超时消息', async () => {
      await expect(
        withTimeout(
          async () => {
            await delay(200);
            return 'success';
          },
          100,
          'Custom timeout'
        )
      ).rejects.toThrow('Custom timeout');
    });
  });

  describe('CircuitBreaker', () => {
    it('应该在正常情况下执行', async () => {
      const breaker = new CircuitBreaker(3);
      
      const result = await breaker.execute(async () => 'success');
      expect(result).toBe('success');
      expect(breaker.getState()).toBe('closed');
    });

    it('应该在连续失败后打开', async () => {
      const breaker = new CircuitBreaker(2);
      
      // 第一次失败
      await expect(
        breaker.execute(async () => { throw new Error('Fail'); })
      ).rejects.toThrow();
      
      expect(breaker.getState()).toBe('closed');
      
      // 第二次失败
      await expect(
        breaker.execute(async () => { throw new Error('Fail'); })
      ).rejects.toThrow();
      
      // 达到阈值，断路器打开
      expect(breaker.getState()).toBe('open');
    });

    it('应该在打开时拒绝请求', async () => {
      const breaker = new CircuitBreaker(1);
      
      // 触发打开
      await expect(
        breaker.execute(async () => { throw new Error('Fail'); })
      ).rejects.toThrow();
      
      expect(breaker.getState()).toBe('open');
      
      // 打开状态下拒绝
      await expect(
        breaker.execute(async () => 'success')
      ).rejects.toThrow('Circuit breaker is open');
    });

    it('应该可以重置', async () => {
      const breaker = new CircuitBreaker(1);
      
      // 触发打开
      await expect(
        breaker.execute(async () => { throw new Error('Fail'); })
      ).rejects.toThrow();
      
      expect(breaker.getState()).toBe('open');
      
      // 重置
      breaker.reset();
      expect(breaker.getState()).toBe('closed');
      
      // 可以再次执行
      const result = await breaker.execute(async () => 'success');
      expect(result).toBe('success');
    });
  });

  describe('executeBatch', () => {
    it('应该批量执行并返回结果', async () => {
      const items = [1, 2, 3, 4, 5];
      
      const { successful, failed } = await executeBatch(
        items,
        async (item) => item * 2,
        { concurrency: 2 }
      );
      
      expect(successful).toHaveLength(5);
      expect(failed).toHaveLength(0);
      expect(successful.map(s => s.result)).toEqual([2, 4, 6, 8, 10]);
    });

    it('应该处理部分失败', async () => {
      const items = [1, 2, 3, 4, 5];
      
      const { successful, failed } = await executeBatch(
        items,
        async (item) => {
          if (item % 2 === 0) {
            throw new Error(`Even number: ${item}`);
          }
          return item * 2;
        },
        { concurrency: 2, continueOnError: true }
      );
      
      expect(successful).toHaveLength(3); // 1, 3, 5
      expect(failed).toHaveLength(2); // 2, 4
    });

    it('应该在不继续错误时停止', async () => {
      const items = [1, 2, 3];
      let processed = 0;
      
      await expect(
        executeBatch(
          items,
          async (item) => {
            processed++;
            if (item === 2) throw new Error('Fail');
            return item;
          },
          { concurrency: 1, continueOnError: false }
        )
      ).rejects.toThrow('Fail');
      
      // 在第一个错误后停止
      expect(processed).toBe(2);
    });
  });
});
