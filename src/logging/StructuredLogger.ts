import { LoggerInterface, LogLevel, LogEntry } from './LoggerInterface';

/**
 * Structured logger implementation with JSON output and metadata support
 */
export class StructuredLogger implements LoggerInterface {
  private level: LogLevel = 'info';
  private context: Record<string, any> = {};
  private outputs: LogOutput[] = [];

  constructor(
    level: LogLevel = 'info',
    context: Record<string, any> = {},
    outputs: LogOutput[] = [new ConsoleOutput()]
  ) {
    this.level = level;
    this.context = context;
    this.outputs = outputs;
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata);
  }

  error(message: string, metadata?: Record<string, any>): void {
    this.log('error', message, metadata);
  }

  critical(message: string, metadata?: Record<string, any>): void {
    this.log('critical', message, metadata);
  }

  child(context: Record<string, any>): LoggerInterface {
    return new StructuredLogger(this.level, { ...this.context, ...context }, this.outputs);
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

  async flush(): Promise<void> {
    await Promise.all(this.outputs.map(output => output.flush?.()));
  }

  async close(): Promise<void> {
    await Promise.all(this.outputs.map(output => output.close?.()));
  }

  /**
   * Add log output
   */
  addOutput(output: LogOutput): void {
    this.outputs.push(output);
  }

  /**
   * Remove log output
   */
  removeOutput(output: LogOutput): void {
    const index = this.outputs.indexOf(output);
    if (index >= 0) {
      this.outputs.splice(index, 1);
    }
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    if (!this.isLevelEnabled(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    if (metadata) {
      entry.metadata = metadata;
    }
    if (Object.keys(this.context).length > 0) {
      entry.context = this.context;
    }
    if (this.context.correlationId) {
      entry.correlationId = this.context.correlationId;
    }
    if (this.context.requestId) {
      entry.requestId = this.context.requestId;
    }
    if (this.context.tenantId) {
      entry.tenantId = this.context.tenantId;
    }

    // Send to all outputs
    this.outputs.forEach(output => {
      try {
        output.write(entry);
      } catch (error) {
        // Fallback to console if output fails
        console.error('Log output failed:', error);
        console.log(JSON.stringify(entry));
      }
    });
  }
}

/**
 * Log output interface
 */
export interface LogOutput {
  write(entry: LogEntry): void;
  flush?(): Promise<void>;
  close?(): Promise<void>;
}

/**
 * Console output implementation
 */
export class ConsoleOutput implements LogOutput {
  private format: 'json' | 'pretty' = 'pretty';

  constructor(format: 'json' | 'pretty' = 'pretty') {
    this.format = format;
  }

  write(entry: LogEntry): void {
    if (this.format === 'json') {
      console.log(JSON.stringify(entry));
    } else {
      const timestamp = new Date(entry.timestamp).toLocaleString();
      const level = entry.level.toUpperCase().padEnd(8);
      const context = entry.context
        ? ` [${Object.entries(entry.context)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ')}]`
        : '';
      const metadata = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';

      const logMessage = `${timestamp} ${level} ${entry.message}${context}${metadata}`;

      switch (entry.level) {
        case 'debug':
          console.debug(logMessage);
          break;
        case 'info':
          console.info(logMessage);
          break;
        case 'warn':
          console.warn(logMessage);
          break;
        case 'error':
        case 'critical':
          console.error(logMessage);
          break;
        default:
          console.log(logMessage);
      }
    }
  }
}

/**
 * File output implementation
 */
export class FileOutput implements LogOutput {
  private filePath: string;
  private writeStream?: unknown;
  private buffer: LogEntry[] = [];
  private bufferSize = 100;
  private flushInterval = 5000; // 5 seconds
  private flushTimer?: NodeJS.Timeout;

  constructor(filePath: string, bufferSize = 100, flushInterval = 5000) {
    this.filePath = filePath;
    this.bufferSize = bufferSize;
    this.flushInterval = flushInterval;
    this.initializeStream();
    this.startFlushTimer();
  }

  private initializeStream(): void {
    try {
      // In a real implementation, this would use fs.createWriteStream
      // For now, we'll simulate it
      this.writeStream = {
        write: (data: string) => {
          // Simulate file writing
          console.log(`[FILE: ${this.filePath}] ${data}`);
        },
        end: () => {
          // Simulate stream end
        },
      };
    } catch (error) {
      console.error(`Failed to initialize file stream for ${this.filePath}:`, error);
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  write(entry: LogEntry): void {
    this.buffer.push(entry);

    if (this.buffer.length >= this.bufferSize) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.writeStream) {
      return;
    }

    const entries = this.buffer.splice(0);

    for (const entry of entries) {
      const logLine = JSON.stringify(entry) + '\n';
      (this.writeStream as any).write(logLine);
    }
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    await this.flush();

    if (this.writeStream) {
      (this.writeStream as any).end();
    }
  }
}

/**
 * Remote output implementation for sending logs to external services
 */
export class RemoteOutput implements LogOutput {
  private endpoint: string;
  private apiKey?: string;
  private buffer: LogEntry[] = [];
  private bufferSize = 50;
  private flushInterval = 10000; // 10 seconds
  private flushTimer?: NodeJS.Timeout;
  private headers: Record<string, string>;

  constructor(endpoint: string, apiKey?: string, bufferSize = 50, flushInterval = 10000) {
    this.endpoint = endpoint;
    if (apiKey) {
      this.apiKey = apiKey;
    }
    this.bufferSize = bufferSize;
    this.flushInterval = flushInterval;

    this.headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'EHR-Adapter-Logger/1.0',
    };

    if (this.apiKey) {
      this.headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    this.startFlushTimer();
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  write(entry: LogEntry): void {
    this.buffer.push(entry);

    if (this.buffer.length >= this.bufferSize) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const entries = this.buffer.splice(0);

    try {
      const _response = await fetch(this.endpoint, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ logs: entries }),
      });

      if (!_response.ok) {
        throw new Error(`HTTP ${_response.status}: ${_response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send logs to remote endpoint:', error);
      // Re-add entries to buffer for retry (with limit to prevent memory issues)
      if (this.buffer.length < 1000) {
        this.buffer.unshift(...entries);
      }
    }
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    await this.flush();
  }
}

/**
 * Create structured logger with common configurations
 */
export function createStructuredLogger(
  level: LogLevel = 'info',
  _context: Record<string, any> = {},
  outputs?: LogOutput[]
): StructuredLogger {
  return new StructuredLogger(level, _context, outputs);
}

/**
 * Create logger for development environment
 */
export function createDevelopmentLogger(context: Record<string, any> = {}): StructuredLogger {
  return new StructuredLogger('debug', context, [new ConsoleOutput('pretty')]);
}

/**
 * Create logger for production environment
 */
export function createProductionLogger(
  _context: Record<string, any> = {},
  logFile?: string,
  remoteEndpoint?: string,
  remoteApiKey?: string
): StructuredLogger {
  const outputs: LogOutput[] = [new ConsoleOutput('json')];

  if (logFile) {
    outputs.push(new FileOutput(logFile));
  }

  if (remoteEndpoint) {
    outputs.push(new RemoteOutput(remoteEndpoint, remoteApiKey));
  }

  return new StructuredLogger('warn', _context, outputs);
}

/**
 * Logger factory
 */
export class LoggerFactory {
  private static defaultLevel: LogLevel = 'info';
  private static defaultContext: Record<string, any> = {};
  private static defaultOutputs: LogOutput[] = [new ConsoleOutput()];

  static setDefaults(
    level: LogLevel,
    context: Record<string, any> = {},
    outputs: LogOutput[] = [new ConsoleOutput()]
  ): void {
    LoggerFactory.defaultLevel = level;
    LoggerFactory.defaultContext = context;
    LoggerFactory.defaultOutputs = outputs;
  }

  static create(name: string, additionalContext: Record<string, any> = {}): StructuredLogger {
    const context = {
      ...LoggerFactory.defaultContext,
      logger: name,
      ...additionalContext,
    };

    return new StructuredLogger(LoggerFactory.defaultLevel, context, LoggerFactory.defaultOutputs);
  }

  static createForTenant(
    tenantId: string,
    name: string,
    additionalContext: Record<string, any> = {}
  ): StructuredLogger {
    return LoggerFactory.create(name, {
      tenantId,
      ...additionalContext,
    });
  }

  static createForRequest(
    requestId: string,
    name: string,
    additionalContext: Record<string, any> = {}
  ): StructuredLogger {
    return LoggerFactory.create(name, {
      requestId,
      ...additionalContext,
    });
  }
}
