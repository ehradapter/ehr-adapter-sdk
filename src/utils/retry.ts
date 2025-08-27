import { LoggerInterface } from '../logging/LoggerInterface';

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts?: number;
  /** Initial delay between retries in milliseconds */
  initialDelay?: number;
  /** Maximum delay between retries in milliseconds */
  maxDelay?: number;
  /** Backoff multiplier for exponential backoff */
  backoffMultiplier?: number;
  /** Jitter factor to add randomness to delays (0-1) */
  jitter?: number;
  /** Function to determine if an error should trigger a retry */
  shouldRetry?: (_error: Error, attempt: number) => boolean;
  /** Custom delay calculation function */
  calculateDelay?: (attempt: number, baseDelay: number) => number;
  /** Callback called before each retry attempt */
  onRetry?: (_error: Error, attempt: number, delay: number) => void;
}

/**
 * Retry result
 */
export interface RetryResult<T> {
  /** The successful result */
  result: T;
  /** Number of attempts made */
  attempts: number;
  /** Total time taken in milliseconds */
  totalTime: number;
  /** Array of errors from failed attempts */
  errors: Error[];
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: 0.1,
  shouldRetry: (_error: Error) => {
    // Retry on network errors, timeouts, and 5xx server errors
    if (_error.name === 'AbortError' || _error.message.includes('timeout')) {
      return true;
    }
    if (_error.message.includes('fetch')) {
      return true;
    }
    // Check for HTTP errors with 5xx status codes
    if ('status' in _error && typeof (_error as any).status === 'number') {
      const status = (_error as any).status;
      return status >= 500 || status === 408 || status === 429; // Include timeout and rate limit
    }
    return false;
  },
  calculateDelay: (attempt: number, baseDelay: number) => baseDelay * Math.pow(2, attempt - 1),
  onRetry: () => {},
};

/**
 * Retry utility class
 */
export class RetryManager {
  private logger: LoggerInterface;
  private defaultOptions: Required<RetryOptions>;

  constructor(logger: LoggerInterface, defaultOptions: RetryOptions = {}) {
    this.logger = logger;
    this.defaultOptions = { ...DEFAULT_RETRY_OPTIONS, ...defaultOptions };
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {},
    context?: string
  ): Promise<RetryResult<T>> {
    const config = { ...this.defaultOptions, ...options };
    const startTime = Date.now();
    const errors: Error[] = [];
    const contextStr = context || 'operation';

    this.logger.debug(`Starting ${contextStr} with retry`, {
      maxAttempts: config.maxAttempts,
      initialDelay: config.initialDelay,
      backoffMultiplier: config.backoffMultiplier,
    });

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const _result = await fn();
        const totalTime = Date.now() - startTime;

        this.logger.debug(`${contextStr} succeeded`, {
          attempt,
          totalTime,
          totalAttempts: attempt,
        });

        return {
          result: _result,
          attempts: attempt,
          totalTime,
          errors,
        };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push(err);

        this.logger.warn(`${contextStr} failed on attempt ${attempt}`, {
          attempt,
          maxAttempts: config.maxAttempts,
          error: err.message,
          errorType: err.name,
        });

        // Check if we should retry
        if (attempt === config.maxAttempts || !config.shouldRetry(err, attempt)) {
          const totalTime = Date.now() - startTime;

          this.logger.error(`${contextStr} failed after ${attempt} attempts`, {
            totalAttempts: attempt,
            totalTime,
            finalError: err.message,
            allErrors: errors.map(e => e.message),
          });

          throw new RetryError(
            `${contextStr} failed after ${attempt} attempts: ${err.message}`,
            errors,
            attempt,
            totalTime
          );
        }

        // Calculate delay for next attempt
        if (attempt < config.maxAttempts) {
          const baseDelay = config.calculateDelay(attempt, config.initialDelay);
          const jitteredDelay = this.addJitter(baseDelay, config.jitter);
          const delay = Math.min(jitteredDelay, config.maxDelay);

          this.logger.debug(`Retrying ${contextStr} in ${delay}ms`, {
            attempt: attempt + 1,
            delay,
            baseDelay,
            jitteredDelay,
          });

          config.onRetry(err, attempt, delay);
          await this.delay(delay);
        }
      }
    }

    // This should never be reached, but TypeScript requires it
    throw new Error('Unexpected end of retry loop');
  }

  /**
   * Execute with exponential backoff
   */
  async executeWithExponentialBackoff<T>(
    fn: () => Promise<T>,
    maxAttempts = 3,
    initialDelay = 1000,
    context?: string,
    additionalOptions?: Partial<RetryOptions>
  ): Promise<RetryResult<T>> {
    return this.execute(
      fn,
      {
        maxAttempts,
        initialDelay,
        backoffMultiplier: 2,
        calculateDelay: (attempt, baseDelay) => baseDelay * Math.pow(2, attempt - 1),
        ...additionalOptions,
      },
      context
    );
  }

  /**
   * Execute with linear backoff
   */
  async executeWithLinearBackoff<T>(
    fn: () => Promise<T>,
    maxAttempts = 3,
    delay = 1000,
    context?: string
  ): Promise<RetryResult<T>> {
    return this.execute(
      fn,
      {
        maxAttempts,
        initialDelay: delay,
        calculateDelay: (attempt, baseDelay) => baseDelay * attempt,
      },
      context
    );
  }

  /**
   * Execute with fixed delay
   */
  async executeWithFixedDelay<T>(
    fn: () => Promise<T>,
    maxAttempts = 3,
    delay = 1000,
    context?: string
  ): Promise<RetryResult<T>> {
    return this.execute(
      fn,
      {
        maxAttempts,
        initialDelay: delay,
        calculateDelay: () => delay,
      },
      context
    );
  }

  /**
   * Add jitter to delay to avoid thundering herd
   */
  private addJitter(delay: number, jitter: number): number {
    if (jitter <= 0) {
      return delay;
    }

    const jitterAmount = delay * jitter;
    const randomJitter = (Math.random() - 0.5) * 2 * jitterAmount;
    return Math.max(0, delay + randomJitter);
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Retry error class
 */
export class RetryError extends Error {
  constructor(
    message: string,
    public readonly errors: Error[],
    public readonly attempts: number,
    public readonly totalTime: number
  ) {
    super(message);
    this.name = 'RetryError';
  }

  /**
   * Get the last error that caused the retry to fail
   */
  getLastError(): Error | undefined {
    return this.errors[this.errors.length - 1];
  }

  /**
   * Get all error messages
   */
  getAllErrorMessages(): string[] {
    return this.errors.map(error => error.message);
  }
}

/**
 * Circuit breaker state
 */
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
  /** Failure threshold to open the circuit */
  failureThreshold?: number;
  /** Success threshold to close the circuit from half-open */
  successThreshold?: number;
  /** Timeout in milliseconds before trying to close the circuit */
  timeout?: number;
  /** Function to determine if an error should count as a failure */
  isFailure?: (_error: Error) => boolean;
  /** Callback when circuit state changes */
  onStateChange?: (state: CircuitBreakerState) => void;
}

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private logger: LoggerInterface;
  private options: Required<CircuitBreakerOptions>;

  constructor(logger: LoggerInterface, options: CircuitBreakerOptions = {}) {
    this.logger = logger;
    this.options = {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 60000, // 1 minute
      isFailure: () => true,
      onStateChange: () => {},
      ...options,
    };
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>, context?: string): Promise<T> {
    const contextStr = context || 'operation';

    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime < this.options.timeout) {
        throw new Error(`Circuit breaker is OPEN for ${contextStr}`);
      } else {
        this.setState(CircuitBreakerState.HALF_OPEN);
      }
    }

    try {
      const _result = await fn();
      this.onSuccess(contextStr);
      return _result;
    } catch (error) {
      this.onFailure(error as Error, contextStr);
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(context: string): void {
    this.failureCount = 0;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.options.successThreshold) {
        this.setState(CircuitBreakerState.CLOSED);
        this.successCount = 0;
      }
    }

    this.logger.debug(`Circuit breaker success for ${context}`, {
      state: this.state,
      successCount: this.successCount,
    });
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: Error, context: string): void {
    if (this.options.isFailure(error)) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.state === CircuitBreakerState.HALF_OPEN) {
        this.setState(CircuitBreakerState.OPEN);
        this.successCount = 0;
      } else if (this.failureCount >= this.options.failureThreshold) {
        this.setState(CircuitBreakerState.OPEN);
      }
    }

    this.logger.warn(`Circuit breaker failure for ${context}`, {
      state: this.state,
      failureCount: this.failureCount,
      error: error.message,
    });
  }

  /**
   * Set circuit breaker state
   */
  private setState(newState: CircuitBreakerState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;

      this.logger.info('Circuit breaker state changed', {
        from: oldState,
        to: newState,
        failureCount: this.failureCount,
        successCount: this.successCount,
      });

      this.options.onStateChange(newState);
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Get statistics
   */
  getStats(): {
    state: CircuitBreakerState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.setState(CircuitBreakerState.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;

    this.logger.info('Circuit breaker reset');
  }
}

/**
 * Create retry manager instance
 */
export function createRetryManager(logger: LoggerInterface, options?: RetryOptions): RetryManager {
  return new RetryManager(logger, options);
}

/**
 * Create circuit breaker instance
 */
export function createCircuitBreaker(
  logger: LoggerInterface,
  options?: CircuitBreakerOptions
): CircuitBreaker {
  return new CircuitBreaker(logger, options);
}
