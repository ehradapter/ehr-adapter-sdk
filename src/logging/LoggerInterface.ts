/**
 * Logger Interface
 *
 * Standardized logging interface for the EHR Adapter SDK.
 * Supports structured logging with metadata and different log levels.
 */

export interface LoggerInterface {
  /**
   * Log debug message
   */
  debug(message: string, metadata?: Record<string, any>): void;

  /**
   * Log info message
   */
  info(message: string, metadata?: Record<string, any>): void;

  /**
   * Log warning message
   */
  warn(message: string, metadata?: Record<string, any>): void;

  /**
   * Log error message
   */
  error(message: string, metadata?: Record<string, any>): void;

  /**
   * Log critical error message
   */
  critical(message: string, metadata?: Record<string, any>): void;

  /**
   * Create child logger with additional context
   */
  child(_context: Record<string, any>): LoggerInterface;

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void;

  /**
   * Get current log level
   */
  getLevel(): LogLevel;

  /**
   * Check if level is enabled
   */
  isLevelEnabled(level: LogLevel): boolean;

  /**
   * Flush any pending log entries
   */
  flush?(): Promise<void>;

  /**
   * Close logger and cleanup resources
   */
  close?(): Promise<void>;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
  context?: Record<string, any>;
  correlationId?: string;
  requestId?: string;
  tenantId?: string;
}

/**
 * Default console logger implementation
 */
export class ConsoleLogger implements LoggerInterface {
  private level: LogLevel = 'info';
  private context: Record<string, any> = {};

  constructor(level: LogLevel = 'info', _context: Record<string, any> = {}) {
    this.level = level;
    this.context = _context;
  }

  debug(message: string, metadata?: Record<string, any>): void {
    if (this.isLevelEnabled('debug')) {
      console.debug(this.formatMessage('debug', message, metadata));
    }
  }

  info(message: string, metadata?: Record<string, any>): void {
    if (this.isLevelEnabled('info')) {
      console.info(this.formatMessage('info', message, metadata));
    }
  }

  warn(message: string, metadata?: Record<string, any>): void {
    if (this.isLevelEnabled('warn')) {
      console.warn(this.formatMessage('warn', message, metadata));
    }
  }

  error(message: string, metadata?: Record<string, any>): void {
    if (this.isLevelEnabled('error')) {
      console.error(this.formatMessage('error', message, metadata));
    }
  }

  critical(message: string, metadata?: Record<string, any>): void {
    if (this.isLevelEnabled('critical')) {
      console.error(this.formatMessage('critical', message, metadata));
    }
  }

  child(_context: Record<string, any>): LoggerInterface {
    return new ConsoleLogger(this.level, { ...this.context, ..._context });
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  isLevelEnabled(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'critical'];
    const currentLevelIndex = levels.indexOf(this.level);
    const checkLevelIndex = levels.indexOf(level);
    return checkLevelIndex >= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, metadata?: Record<string, any>): string {
    const timestamp = new Date().toISOString();
    const contextStr = Object.keys(this.context).length > 0 ? JSON.stringify(this.context) : '';
    const metadataStr = metadata ? JSON.stringify(metadata) : '';

    return `[${timestamp}] ${level.toUpperCase()}: ${message} ${contextStr} ${metadataStr}`.trim();
  }
}

/**
 * No-op logger for testing or when logging is disabled
 */
export class NoOpLogger implements LoggerInterface {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  critical(): void {}

  child(): LoggerInterface {
    return new NoOpLogger();
  }

  setLevel(): void {}
  getLevel(): LogLevel {
    return 'info';
  }

  isLevelEnabled(): boolean {
    return false;
  }
}
