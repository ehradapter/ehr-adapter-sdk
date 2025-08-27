import {
  RetryManager,
  CircuitBreaker,
  CircuitBreakerState,
  RetryError,
  createRetryManager,
  createCircuitBreaker,
} from './retry';
import { StructuredLogger } from '../logging/StructuredLogger';

describe('Retry', () => {
  let logger: StructuredLogger;

  beforeEach(() => {
    logger = new StructuredLogger('info');
    jest.clearAllMocks();
  });

  describe('RetryManager', () => {
    describe('basic functionality', () => {
      it('should execute a function that succeeds on the first try', async () => {
        const retryManager = new RetryManager(logger);
        const fn = jest.fn().mockResolvedValue('success');
        const result = await retryManager.execute(fn);

        expect(result.result).toBe('success');
        expect(result.attempts).toBe(1);
        expect(result.errors).toHaveLength(0);
        expect(result.totalTime).toBeGreaterThanOrEqual(0);
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it('should retry a function that fails and eventually succeeds', async () => {
        const retryManager = new RetryManager(logger, { initialDelay: 1 });
        const fn = jest
          .fn()
          .mockRejectedValueOnce(new Error('fail1'))
          .mockRejectedValueOnce(new Error('fail2'))
          .mockResolvedValue('success');

        const result = await retryManager.execute(fn, {
          maxAttempts: 3,
          shouldRetry: () => true, // Allow retrying on any error for this test
        });

        expect(result.result).toBe('success');
        expect(result.attempts).toBe(3);
        expect(result.errors).toHaveLength(2);
        expect(fn).toHaveBeenCalledTimes(3);
      });

      it('should fail after max attempts', async () => {
        const retryManager = new RetryManager(logger, { initialDelay: 1 });
        const fn = jest.fn().mockRejectedValue(new Error('fail'));

        await expect(
          retryManager.execute(fn, {
            maxAttempts: 2,
            shouldRetry: () => true, // Allow retrying on any error for this test
          })
        ).rejects.toThrow(RetryError);
        expect(fn).toHaveBeenCalledTimes(2);
      });

      it('should use context in error messages', async () => {
        const retryManager = new RetryManager(logger, { initialDelay: 1 });
        const fn = jest.fn().mockRejectedValue(new Error('fail'));

        await expect(
          retryManager.execute(fn, { maxAttempts: 1 }, 'test-operation')
        ).rejects.toThrow('test-operation failed after 1 attempts: fail');
      });
    });

    describe('retry options', () => {
      it('should respect custom maxAttempts', async () => {
        const retryManager = new RetryManager(logger, { initialDelay: 1 });
        const fn = jest.fn().mockRejectedValue(new Error('fail'));

        await expect(
          retryManager.execute(fn, {
            maxAttempts: 5,
            shouldRetry: () => true, // Allow retrying on any error for this test
          })
        ).rejects.toThrow(RetryError);
        expect(fn).toHaveBeenCalledTimes(5);
      });

      it('should use custom shouldRetry function', async () => {
        const retryManager = new RetryManager(logger, { initialDelay: 1 });
        const shouldRetry = jest.fn().mockReturnValue(false);
        const fn = jest.fn().mockRejectedValue(new Error('fail'));

        await expect(retryManager.execute(fn, { maxAttempts: 3, shouldRetry })).rejects.toThrow(
          RetryError
        );
        expect(fn).toHaveBeenCalledTimes(1);
        expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error), 1);
      });

      it('should call onRetry callback', async () => {
        const retryManager = new RetryManager(logger, { initialDelay: 1 });
        const onRetry = jest.fn();
        const fn = jest.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('success');

        await retryManager.execute(fn, {
          maxAttempts: 2,
          onRetry,
          shouldRetry: () => true, // Allow retrying on any error for this test
        });

        expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, expect.any(Number));
      });

      it('should use custom calculateDelay function', async () => {
        const retryManager = new RetryManager(logger);
        const calculateDelay = jest.fn().mockReturnValue(5);
        const fn = jest.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('success');

        await retryManager.execute(fn, {
          maxAttempts: 2,
          calculateDelay,
          shouldRetry: () => true, // Allow retrying on any error for this test
        });

        expect(calculateDelay).toHaveBeenCalledWith(1, expect.any(Number));
      });

      it('should respect maxDelay limit', async () => {
        const retryManager = new RetryManager(logger);
        const calculateDelay = jest.fn().mockReturnValue(10000); // Very high delay
        const fn = jest.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('success');

        const startTime = Date.now();
        await retryManager.execute(fn, {
          maxAttempts: 2,
          calculateDelay,
          maxDelay: 10, // Very low max delay
          shouldRetry: () => true, // Allow retrying on any error for this test
        });
        const endTime = Date.now();

        // Should not take more than 200ms due to maxDelay limit (allowing for test overhead)
        expect(endTime - startTime).toBeLessThan(200);
      });

      it('should add jitter to delays', async () => {
        const retryManager = new RetryManager(logger);
        const delays: number[] = [];
        const onRetry = jest.fn((_, __, delay) => delays.push(delay));
        const fn = jest
          .fn()
          .mockRejectedValueOnce(new Error('fail'))
          .mockRejectedValueOnce(new Error('fail'))
          .mockResolvedValue('success');

        await retryManager.execute(fn, {
          maxAttempts: 3,
          initialDelay: 100,
          jitter: 0.5,
          onRetry,
          shouldRetry: () => true, // Allow retrying on any error for this test
        });

        // With jitter, delays should vary
        expect(delays).toHaveLength(2);
        expect(delays[0]).not.toBe(delays[1]);
      });
    });

    describe('default shouldRetry behavior', () => {
      it('should retry on timeout errors', async () => {
        const retryManager = new RetryManager(logger, { initialDelay: 1 });
        const timeoutError = new Error('timeout');
        timeoutError.name = 'AbortError';
        const fn = jest.fn().mockRejectedValueOnce(timeoutError).mockResolvedValue('success');

        const result = await retryManager.execute(fn, { maxAttempts: 2 });
        expect(result.result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
      });

      it('should retry on fetch errors', async () => {
        const retryManager = new RetryManager(logger, { initialDelay: 1 });
        const fetchError = new Error('fetch failed');
        const fn = jest.fn().mockRejectedValueOnce(fetchError).mockResolvedValue('success');

        const result = await retryManager.execute(fn, { maxAttempts: 2 });
        expect(result.result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
      });

      it('should retry on 5xx HTTP errors', async () => {
        const retryManager = new RetryManager(logger, { initialDelay: 1 });
        const httpError = new Error('Server error') as any;
        httpError.status = 500;
        const fn = jest.fn().mockRejectedValueOnce(httpError).mockResolvedValue('success');

        const result = await retryManager.execute(fn, { maxAttempts: 2 });
        expect(result.result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
      });

      it('should not retry on 4xx HTTP errors', async () => {
        const retryManager = new RetryManager(logger, { initialDelay: 1 });
        const httpError = new Error('Client error') as any;
        httpError.status = 400;
        const fn = jest.fn().mockRejectedValue(httpError);

        await expect(retryManager.execute(fn, { maxAttempts: 3 })).rejects.toThrow(RetryError);
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it('should not retry on generic errors by default', async () => {
        const retryManager = new RetryManager(logger, { initialDelay: 1 });
        const genericError = new Error('Generic error');
        const fn = jest.fn().mockRejectedValue(genericError);

        await expect(retryManager.execute(fn, { maxAttempts: 3 })).rejects.toThrow(RetryError);
        expect(fn).toHaveBeenCalledTimes(1);
      });
    });

    describe('backoff strategies', () => {
      it('should use exponential backoff', async () => {
        const retryManager = new RetryManager(logger);
        const fn = jest.fn().mockResolvedValue('success');

        const result = await retryManager.executeWithExponentialBackoff(fn, 3, 100);
        expect(result.result).toBe('success');
        expect(result.attempts).toBe(1);
      });

      it('should use linear backoff', async () => {
        const retryManager = new RetryManager(logger);
        const fn = jest.fn().mockResolvedValue('success');

        const result = await retryManager.executeWithLinearBackoff(fn, 3, 100);
        expect(result.result).toBe('success');
        expect(result.attempts).toBe(1);
      });

      it('should use fixed delay', async () => {
        const retryManager = new RetryManager(logger);
        const fn = jest.fn().mockResolvedValue('success');

        const result = await retryManager.executeWithFixedDelay(fn, 3, 100);
        expect(result.result).toBe('success');
        expect(result.attempts).toBe(1);
      });

      it('should calculate exponential backoff correctly', async () => {
        const retryManager = new RetryManager(logger);
        const delays: number[] = [];
        const onRetry = jest.fn((_, __, delay) => delays.push(delay));
        const fn = jest
          .fn()
          .mockRejectedValueOnce(new Error('fail'))
          .mockRejectedValueOnce(new Error('fail'))
          .mockResolvedValue('success');

        await retryManager.executeWithExponentialBackoff(fn, 3, 100, 'test', {
          shouldRetry: () => true, // Allow retrying on any error for this test
          onRetry,
        });

        // Should have exponential growth (approximately)
        expect(delays).toHaveLength(2);
        expect(delays[1]!).toBeGreaterThan(delays[0]!);
      });
    });

    describe('error handling', () => {
      it('should handle non-Error objects', async () => {
        const retryManager = new RetryManager(logger, { initialDelay: 1 });
        const fn = jest.fn().mockRejectedValue('string error');

        await expect(retryManager.execute(fn, { maxAttempts: 1 })).rejects.toThrow(RetryError);
      });

      it('should preserve original error stack traces', async () => {
        const retryManager = new RetryManager(logger, { initialDelay: 1 });
        const originalError = new Error('original error');
        const fn = jest.fn().mockRejectedValue(originalError);

        try {
          await retryManager.execute(fn, { maxAttempts: 1 });
        } catch (error) {
          expect(error).toBeInstanceOf(RetryError);
          const retryError = error as RetryError;
          expect(retryError.getLastError()).toBe(originalError);
        }
      });
    });
  });

  describe('RetryError', () => {
    it('should provide access to all errors', () => {
      const errors = [new Error('error1'), new Error('error2')];
      const retryError = new RetryError('Test failed', errors, 2, 1000);

      expect(retryError.errors).toEqual(errors);
      expect(retryError.attempts).toBe(2);
      expect(retryError.totalTime).toBe(1000);
      expect(retryError.getLastError()).toBe(errors[1]);
      expect(retryError.getAllErrorMessages()).toEqual(['error1', 'error2']);
    });

    it('should handle empty errors array', () => {
      const retryError = new RetryError('Test failed', [], 0, 0);

      expect(retryError.getLastError()).toBeUndefined();
      expect(retryError.getAllErrorMessages()).toEqual([]);
    });
  });

  describe('CircuitBreaker', () => {
    describe('basic functionality', () => {
      it('should start in CLOSED state', () => {
        const circuitBreaker = new CircuitBreaker(logger);
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      });

      it('should execute function successfully when closed', async () => {
        const circuitBreaker = new CircuitBreaker(logger);
        const fn = jest.fn().mockResolvedValue('success');

        const result = await circuitBreaker.execute(fn);
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it('should open after failure threshold', async () => {
        const circuitBreaker = new CircuitBreaker(logger, { failureThreshold: 2, timeout: 100 });
        const fn = jest.fn().mockRejectedValue(new Error('fail'));

        await expect(circuitBreaker.execute(fn)).rejects.toThrow('fail');
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);

        await expect(circuitBreaker.execute(fn)).rejects.toThrow('fail');
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      });

      it('should reject immediately when open', async () => {
        const circuitBreaker = new CircuitBreaker(logger, { failureThreshold: 1, timeout: 100 });
        const fn = jest.fn().mockRejectedValue(new Error('fail'));

        await expect(circuitBreaker.execute(fn)).rejects.toThrow('fail');
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

        await expect(circuitBreaker.execute(fn)).rejects.toThrow(
          'Circuit breaker is OPEN for operation'
        );
        expect(fn).toHaveBeenCalledTimes(1); // Should not call function when open
      });

      it('should transition to half-open after timeout', async () => {
        const circuitBreaker = new CircuitBreaker(logger, {
          failureThreshold: 1,
          timeout: 10,
          successThreshold: 1,
        });
        const fn = jest.fn().mockRejectedValue(new Error('fail'));

        await expect(circuitBreaker.execute(fn)).rejects.toThrow('fail');
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

        await new Promise(resolve => setTimeout(resolve, 15));

        const successFn = jest.fn().mockResolvedValue('success');
        await circuitBreaker.execute(successFn);
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      });

      it('should require multiple successes to close from half-open', async () => {
        const circuitBreaker = new CircuitBreaker(logger, {
          failureThreshold: 1,
          successThreshold: 3,
          timeout: 10,
        });
        const failFn = jest.fn().mockRejectedValue(new Error('fail'));
        const successFn = jest.fn().mockResolvedValue('success');

        // Open the circuit
        await expect(circuitBreaker.execute(failFn)).rejects.toThrow('fail');
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

        // Wait for timeout
        await new Promise(resolve => setTimeout(resolve, 15));

        // First success should move to half-open
        await circuitBreaker.execute(successFn);
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);

        // Second success should still be half-open
        await circuitBreaker.execute(successFn);
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);

        // Third success should close the circuit
        await circuitBreaker.execute(successFn);
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      });

      it('should return to open on failure in half-open state', async () => {
        const circuitBreaker = new CircuitBreaker(logger, {
          failureThreshold: 1,
          successThreshold: 2,
          timeout: 10,
        });
        const failFn = jest.fn().mockRejectedValue(new Error('fail'));
        const successFn = jest.fn().mockResolvedValue('success');

        // Open the circuit
        await expect(circuitBreaker.execute(failFn)).rejects.toThrow('fail');
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

        // Wait for timeout
        await new Promise(resolve => setTimeout(resolve, 15));

        // First success should move to half-open
        await circuitBreaker.execute(successFn);
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);

        // Failure should return to open
        await expect(circuitBreaker.execute(failFn)).rejects.toThrow('fail');
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      });
    });

    describe('custom isFailure function', () => {
      it('should use custom isFailure function', async () => {
        const isFailure = jest.fn().mockReturnValue(false);
        const circuitBreaker = new CircuitBreaker(logger, {
          failureThreshold: 1,
          isFailure,
        });
        const fn = jest.fn().mockRejectedValue(new Error('fail'));

        await expect(circuitBreaker.execute(fn)).rejects.toThrow('fail');
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
        expect(isFailure).toHaveBeenCalledWith(expect.any(Error));
      });

      it('should only count failures that match isFailure criteria', async () => {
        const isFailure = jest.fn((error: Error) => error.message === 'critical');
        const circuitBreaker = new CircuitBreaker(logger, {
          failureThreshold: 2,
          isFailure,
        });

        // Non-critical error should not count
        const nonCriticalFn = jest.fn().mockRejectedValue(new Error('non-critical'));
        await expect(circuitBreaker.execute(nonCriticalFn)).rejects.toThrow('non-critical');
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);

        // Critical errors should count
        const criticalFn = jest.fn().mockRejectedValue(new Error('critical'));
        await expect(circuitBreaker.execute(criticalFn)).rejects.toThrow('critical');
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);

        await expect(circuitBreaker.execute(criticalFn)).rejects.toThrow('critical');
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      });
    });

    describe('state change callbacks', () => {
      it('should call onStateChange callback', async () => {
        const onStateChange = jest.fn();
        const circuitBreaker = new CircuitBreaker(logger, {
          failureThreshold: 1,
          onStateChange,
        });
        const fn = jest.fn().mockRejectedValue(new Error('fail'));

        await expect(circuitBreaker.execute(fn)).rejects.toThrow('fail');

        expect(onStateChange).toHaveBeenCalledWith(CircuitBreakerState.OPEN);
      });

      it('should not call onStateChange if state does not change', async () => {
        const onStateChange = jest.fn();
        const circuitBreaker = new CircuitBreaker(logger, {
          failureThreshold: 3,
          onStateChange,
        });
        const fn = jest.fn().mockRejectedValue(new Error('fail'));

        await expect(circuitBreaker.execute(fn)).rejects.toThrow('fail');
        await expect(circuitBreaker.execute(fn)).rejects.toThrow('fail');

        expect(onStateChange).not.toHaveBeenCalled();
      });
    });

    describe('statistics and management', () => {
      it('should provide accurate statistics', async () => {
        const circuitBreaker = new CircuitBreaker(logger, { failureThreshold: 2 });
        const fn = jest.fn().mockRejectedValue(new Error('fail'));

        const initialStats = circuitBreaker.getStats();
        expect(initialStats.state).toBe(CircuitBreakerState.CLOSED);
        expect(initialStats.failureCount).toBe(0);
        expect(initialStats.successCount).toBe(0);

        await expect(circuitBreaker.execute(fn)).rejects.toThrow('fail');

        const afterFailureStats = circuitBreaker.getStats();
        expect(afterFailureStats.failureCount).toBe(1);
        expect(afterFailureStats.lastFailureTime).toBeGreaterThan(0);
      });

      it('should reset circuit breaker state', async () => {
        const circuitBreaker = new CircuitBreaker(logger, { failureThreshold: 1 });
        const fn = jest.fn().mockRejectedValue(new Error('fail'));

        await expect(circuitBreaker.execute(fn)).rejects.toThrow('fail');
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

        circuitBreaker.reset();

        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
        const stats = circuitBreaker.getStats();
        expect(stats.failureCount).toBe(0);
        expect(stats.successCount).toBe(0);
        expect(stats.lastFailureTime).toBe(0);
      });
    });

    describe('context handling', () => {
      it('should use context in error messages', async () => {
        const circuitBreaker = new CircuitBreaker(logger, { failureThreshold: 1 });
        const fn = jest.fn().mockRejectedValue(new Error('fail'));

        await expect(circuitBreaker.execute(fn)).rejects.toThrow('fail');

        await expect(circuitBreaker.execute(fn, 'test-operation')).rejects.toThrow(
          'Circuit breaker is OPEN for test-operation'
        );
      });
    });
  });

  describe('Factory functions', () => {
    it('should create RetryManager with factory function', () => {
      const retryManager = createRetryManager(logger, { maxAttempts: 5 });
      expect(retryManager).toBeInstanceOf(RetryManager);
    });

    it('should create CircuitBreaker with factory function', () => {
      const circuitBreaker = createCircuitBreaker(logger, { failureThreshold: 3 });
      expect(circuitBreaker).toBeInstanceOf(CircuitBreaker);
    });

    it('should create with default options', () => {
      const retryManager = createRetryManager(logger);
      const circuitBreaker = createCircuitBreaker(logger);

      expect(retryManager).toBeInstanceOf(RetryManager);
      expect(circuitBreaker).toBeInstanceOf(CircuitBreaker);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle rapid successive calls', async () => {
      const retryManager = new RetryManager(logger, { initialDelay: 1 });
      const fn = jest.fn().mockResolvedValue('success');

      const promises = Array(10)
        .fill(0)
        .map(() => retryManager.execute(fn));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.result).toBe('success');
        expect(result.attempts).toBe(1);
      });
    });

    it('should handle concurrent circuit breaker operations', async () => {
      const circuitBreaker = new CircuitBreaker(logger, { failureThreshold: 1 });
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      // First call should fail and open circuit
      await expect(circuitBreaker.execute(fn)).rejects.toThrow('fail');
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

      // Subsequent concurrent calls should all be rejected immediately
      const promises = Array(5)
        .fill(0)
        .map(() => expect(circuitBreaker.execute(fn)).rejects.toThrow('Circuit breaker is OPEN'));

      await Promise.all(promises);
      expect(fn).toHaveBeenCalledTimes(1); // Only the first call should execute
    });
  });
});
