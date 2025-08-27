import {
  StructuredLogger,
  LogOutput,
  ConsoleOutput,
  FileOutput,
  RemoteOutput,
  LoggerFactory,
  createStructuredLogger,
  createDevelopmentLogger,
  createProductionLogger,
} from './StructuredLogger';
import { LogEntry, LogLevel } from './LoggerInterface';

// Mock console methods
const mockConsole = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
};

// Mock fetch for RemoteOutput tests
global.fetch = jest.fn();

// Mock setInterval and clearInterval for timer tests
jest.useFakeTimers();

describe('StructuredLogger', () => {
  let logger: StructuredLogger;
  let mockOutput: jest.Mocked<LogOutput>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    // Replace console methods with mocks
    Object.assign(console, mockConsole);

    mockOutput = {
      write: jest.fn(),
      flush: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    logger = new StructuredLogger('info', {}, [mockOutput]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Core Logging Functionality', () => {
    it('should create logger with default parameters', () => {
      const defaultLogger = new StructuredLogger();
      expect(defaultLogger.getLevel()).toBe('info');
    });

    it('should create logger with custom level and context', () => {
      const customLogger = new StructuredLogger('debug', { service: 'test' });
      expect(customLogger.getLevel()).toBe('debug');
    });

    it('should log debug message when level is debug', () => {
      logger.setLevel('debug');
      logger.debug('Debug message', { key: 'value' });

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug',
          message: 'Debug message',
          metadata: { key: 'value' },
          timestamp: expect.any(String),
        })
      );
    });

    it('should log info message', () => {
      logger.info('Info message', { key: 'value' });

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          message: 'Info message',
          metadata: { key: 'value' },
          timestamp: expect.any(String),
        })
      );
    });

    it('should log warn message', () => {
      logger.warn('Warning message', { key: 'value' });

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warn',
          message: 'Warning message',
          metadata: { key: 'value' },
          timestamp: expect.any(String),
        })
      );
    });

    it('should log error message', () => {
      logger.error('Error message', { key: 'value' });

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'error',
          message: 'Error message',
          metadata: { key: 'value' },
          timestamp: expect.any(String),
        })
      );
    });

    it('should log critical message', () => {
      logger.critical('Critical message', { key: 'value' });

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'critical',
          message: 'Critical message',
          metadata: { key: 'value' },
          timestamp: expect.any(String),
        })
      );
    });

    it('should not log messages below current level', () => {
      logger.setLevel('warn');
      logger.debug('Debug message');
      logger.info('Info message');

      expect(mockOutput.write).not.toHaveBeenCalled();
    });

    it('should log messages at or above current level', () => {
      logger.setLevel('warn');
      logger.warn('Warning message');
      logger.error('Error message');
      logger.critical('Critical message');

      expect(mockOutput.write).toHaveBeenCalledTimes(3);
    });
  });

  describe('Level Management', () => {
    it('should set and get log level', () => {
      logger.setLevel('debug');
      expect(logger.getLevel()).toBe('debug');

      logger.setLevel('critical');
      expect(logger.getLevel()).toBe('critical');
    });

    it('should correctly check if level is enabled', () => {
      logger.setLevel('warn');

      expect(logger.isLevelEnabled('debug')).toBe(false);
      expect(logger.isLevelEnabled('info')).toBe(false);
      expect(logger.isLevelEnabled('warn')).toBe(true);
      expect(logger.isLevelEnabled('error')).toBe(true);
      expect(logger.isLevelEnabled('critical')).toBe(true);
    });

    it('should handle all log levels correctly', () => {
      const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'critical'];

      levels.forEach((level, index) => {
        logger.setLevel(level);

        levels.forEach((testLevel, testIndex) => {
          const shouldBeEnabled = testIndex >= index;
          expect(logger.isLevelEnabled(testLevel)).toBe(shouldBeEnabled);
        });
      });
    });
  });

  describe('Context and Metadata Handling', () => {
    it('should include context in log entries', () => {
      const contextLogger = new StructuredLogger('info', { service: 'test', version: '1.0' }, [
        mockOutput,
      ]);
      contextLogger.info('Test message');

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          context: { service: 'test', version: '1.0' },
        })
      );
    });

    it('should include correlationId from context', () => {
      const contextLogger = new StructuredLogger('info', { correlationId: 'test-correlation-id' }, [
        mockOutput,
      ]);
      contextLogger.info('Test message');

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: 'test-correlation-id',
        })
      );
    });

    it('should include requestId from context', () => {
      const contextLogger = new StructuredLogger('info', { requestId: 'test-request-id' }, [
        mockOutput,
      ]);
      contextLogger.info('Test message');

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'test-request-id',
        })
      );
    });

    it('should include tenantId from context', () => {
      const contextLogger = new StructuredLogger('info', { tenantId: 'test-tenant-id' }, [
        mockOutput,
      ]);
      contextLogger.info('Test message');

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'test-tenant-id',
        })
      );
    });

    it('should handle metadata correctly', () => {
      logger.info('Test message', { userId: '123', action: 'login' });

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { userId: '123', action: 'login' },
        })
      );
    });

    it('should not include metadata when not provided', () => {
      logger.info('Test message');

      const call = mockOutput.write.mock.calls[0]?.[0];
      expect(call?.metadata).toBeUndefined();
    });

    it('should not include context when empty', () => {
      const emptyContextLogger = new StructuredLogger('info', {}, [mockOutput]);
      emptyContextLogger.info('Test message');

      const call = mockOutput.write.mock.calls[0]?.[0];
      expect(call?.context).toBeUndefined();
    });
  });

  describe('Child Logger', () => {
    it('should create child logger with merged context', () => {
      const parentLogger = new StructuredLogger('info', { service: 'parent' }, [mockOutput]);
      const childLogger = parentLogger.child({ component: 'child', requestId: 'req-123' });

      childLogger.info('Child message');

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          context: { service: 'parent', component: 'child', requestId: 'req-123' },
          requestId: 'req-123',
        })
      );
    });

    it('should inherit parent level and outputs', () => {
      const parentLogger = new StructuredLogger('warn', { service: 'parent' }, [mockOutput]);
      const childLogger = parentLogger.child({ component: 'child' });

      expect(childLogger.getLevel()).toBe('warn');

      childLogger.info('Should not log');
      expect(mockOutput.write).not.toHaveBeenCalled();

      childLogger.warn('Should log');
      expect(mockOutput.write).toHaveBeenCalledTimes(1);
    });

    it('should override parent context with child context', () => {
      const parentLogger = new StructuredLogger('info', { service: 'parent', env: 'dev' }, [
        mockOutput,
      ]);
      const childLogger = parentLogger.child({ service: 'child', version: '1.0' });

      childLogger.info('Test message');

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          context: { service: 'child', env: 'dev', version: '1.0' },
        })
      );
    });
  });

  describe('Output Management', () => {
    it('should add output', () => {
      const newOutput = { write: jest.fn() };
      logger.addOutput(newOutput);

      logger.info('Test message');

      expect(mockOutput.write).toHaveBeenCalledTimes(1);
      expect(newOutput.write).toHaveBeenCalledTimes(1);
    });

    it('should remove output', () => {
      const newOutput = { write: jest.fn() };
      logger.addOutput(newOutput);
      logger.removeOutput(newOutput);

      logger.info('Test message');

      expect(mockOutput.write).toHaveBeenCalledTimes(1);
      expect(newOutput.write).not.toHaveBeenCalled();
    });

    it('should handle output write errors gracefully', () => {
      const errorOutput = {
        write: jest.fn().mockImplementation(() => {
          throw new Error('Output error');
        }),
      };
      logger.addOutput(errorOutput);

      logger.info('Test message');

      expect(mockConsole.error).toHaveBeenCalledWith('Log output failed:', expect.any(Error));
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Test message"')
      );
    });

    it('should flush all outputs', async () => {
      const output1 = { write: jest.fn(), flush: jest.fn().mockResolvedValue(undefined) };
      const output2 = { write: jest.fn(), flush: jest.fn().mockResolvedValue(undefined) };

      logger.addOutput(output1);
      logger.addOutput(output2);

      await logger.flush();

      expect(mockOutput.flush).toHaveBeenCalledTimes(1);
      expect(output1.flush).toHaveBeenCalledTimes(1);
      expect(output2.flush).toHaveBeenCalledTimes(1);
    });

    it('should close all outputs', async () => {
      const output1 = { write: jest.fn(), close: jest.fn().mockResolvedValue(undefined) };
      const output2 = { write: jest.fn(), close: jest.fn().mockResolvedValue(undefined) };

      logger.addOutput(output1);
      logger.addOutput(output2);

      await logger.close();

      expect(mockOutput.close).toHaveBeenCalledTimes(1);
      expect(output1.close).toHaveBeenCalledTimes(1);
      expect(output2.close).toHaveBeenCalledTimes(1);
    });

    it('should handle outputs without flush/close methods', async () => {
      const simpleOutput = { write: jest.fn() };
      logger.addOutput(simpleOutput);

      await expect(logger.flush()).resolves.toBeUndefined();
      await expect(logger.close()).resolves.toBeUndefined();
    });
  });

  describe('Timestamp Generation', () => {
    it('should include valid ISO timestamp', () => {
      const beforeLog = new Date().toISOString();
      logger.info('Test message');
      const afterLog = new Date().toISOString();

      const logEntry = mockOutput.write.mock.calls[0]?.[0];
      expect(logEntry).toBeDefined();
      expect(logEntry!.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(logEntry!.timestamp >= beforeLog).toBe(true);
      expect(logEntry!.timestamp <= afterLog).toBe(true);
    });
  });
});

describe('ConsoleOutput', () => {
  let consoleOutput: ConsoleOutput;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(console, mockConsole);
  });

  describe('Pretty Format', () => {
    beforeEach(() => {
      consoleOutput = new ConsoleOutput('pretty');
    });

    it('should format debug messages correctly', () => {
      const entry: LogEntry = {
        level: 'debug',
        message: 'Debug message',
        timestamp: '2023-01-01T00:00:00.000Z',
      };

      consoleOutput.write(entry);

      expect(mockConsole.debug).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG    Debug message')
      );
    });

    it('should format info messages correctly', () => {
      const entry: LogEntry = {
        level: 'info',
        message: 'Info message',
        timestamp: '2023-01-01T00:00:00.000Z',
      };

      consoleOutput.write(entry);

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('INFO     Info message')
      );
    });

    it('should format warn messages correctly', () => {
      const entry: LogEntry = {
        level: 'warn',
        message: 'Warning message',
        timestamp: '2023-01-01T00:00:00.000Z',
      };

      consoleOutput.write(entry);

      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('WARN     Warning message')
      );
    });

    it('should format error messages correctly', () => {
      const entry: LogEntry = {
        level: 'error',
        message: 'Error message',
        timestamp: '2023-01-01T00:00:00.000Z',
      };

      consoleOutput.write(entry);

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('ERROR    Error message')
      );
    });

    it('should format critical messages correctly', () => {
      const entry: LogEntry = {
        level: 'critical',
        message: 'Critical message',
        timestamp: '2023-01-01T00:00:00.000Z',
      };

      consoleOutput.write(entry);

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL Critical message')
      );
    });

    it('should include context in pretty format', () => {
      const entry: LogEntry = {
        level: 'info',
        message: 'Test message',
        timestamp: '2023-01-01T00:00:00.000Z',
        context: { service: 'test', version: '1.0' },
      };

      consoleOutput.write(entry);

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[service=test, version=1.0]')
      );
    });

    it('should include metadata in pretty format', () => {
      const entry: LogEntry = {
        level: 'info',
        message: 'Test message',
        timestamp: '2023-01-01T00:00:00.000Z',
        metadata: { userId: '123', action: 'login' },
      };

      consoleOutput.write(entry);

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('{"userId":"123","action":"login"}')
      );
    });

    it('should handle unknown log levels', () => {
      const entry: LogEntry = {
        level: 'unknown' as LogLevel,
        message: 'Unknown message',
        timestamp: '2023-01-01T00:00:00.000Z',
      };

      consoleOutput.write(entry);

      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Unknown message'));
    });
  });

  describe('JSON Format', () => {
    beforeEach(() => {
      consoleOutput = new ConsoleOutput('json');
    });

    it('should output JSON format', () => {
      const entry: LogEntry = {
        level: 'info',
        message: 'Test message',
        timestamp: '2023-01-01T00:00:00.000Z',
        metadata: { key: 'value' },
      };

      consoleOutput.write(entry);

      expect(mockConsole.log).toHaveBeenCalledWith(JSON.stringify(entry));
    });
  });
});

describe('FileOutput', () => {
  let fileOutput: FileOutput;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
    fileOutput = new FileOutput('/test/log.txt', 2, 1000); // Small buffer and flush interval for testing
  });

  afterEach(async () => {
    await fileOutput.close();
    jest.useRealTimers();
  });

  it('should create FileOutput with default parameters', async () => {
    const defaultFileOutput = new FileOutput('/test/default.log');
    expect(defaultFileOutput).toBeDefined();
    await defaultFileOutput.close();
  });

  it('should buffer log entries', () => {
    const entry1: LogEntry = {
      level: 'info',
      message: 'Message 1',
      timestamp: '2023-01-01T00:00:00.000Z',
    };

    const entry2: LogEntry = {
      level: 'warn',
      message: 'Message 2',
      timestamp: '2023-01-01T00:00:01.000Z',
    };

    fileOutput.write(entry1);
    fileOutput.write(entry2);

    // Should trigger flush when buffer size is reached
    expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('[FILE: /test/log.txt]'));
  });

  it('should flush on timer', async () => {
    const entry: LogEntry = {
      level: 'info',
      message: 'Timer message',
      timestamp: '2023-01-01T00:00:00.000Z',
    };

    fileOutput.write(entry);

    // Advance timer to trigger flush
    jest.advanceTimersByTime(1000);

    expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('[FILE: /test/log.txt]'));
  });

  it('should flush manually', async () => {
    const entry: LogEntry = {
      level: 'info',
      message: 'Manual flush message',
      timestamp: '2023-01-01T00:00:00.000Z',
    };

    fileOutput.write(entry);
    await fileOutput.flush();

    expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('[FILE: /test/log.txt]'));
  });

  it('should handle empty buffer flush', async () => {
    await fileOutput.flush();
    expect(mockConsole.log).not.toHaveBeenCalled();
  });

  it('should close properly', async () => {
    const entry: LogEntry = {
      level: 'info',
      message: 'Close message',
      timestamp: '2023-01-01T00:00:00.000Z',
    };

    fileOutput.write(entry);
    await fileOutput.close();

    expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('[FILE: /test/log.txt]'));
  });

  it('should write JSON formatted entries', async () => {
    const entry: LogEntry = {
      level: 'info',
      message: 'JSON message',
      timestamp: '2023-01-01T00:00:00.000Z',
      metadata: { key: 'value' },
    };

    fileOutput.write(entry);
    await fileOutput.flush();

    expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify(entry)));
  });
});

describe('RemoteOutput', () => {
  let remoteOutput: RemoteOutput;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    } as Response);

    remoteOutput = new RemoteOutput('https://logs.example.com/api', 'test-api-key', 2, 1000);
  });

  afterEach(async () => {
    await remoteOutput.close();
    jest.useRealTimers();
  });

  it('should create RemoteOutput with API key', () => {
    expect(remoteOutput).toBeDefined();
  });

  it('should create RemoteOutput without API key', async () => {
    const noKeyOutput = new RemoteOutput('https://logs.example.com/api');
    expect(noKeyOutput).toBeDefined();
    await noKeyOutput.close();
  });

  it('should buffer and send log entries', async () => {
    const entry1: LogEntry = {
      level: 'info',
      message: 'Remote message 1',
      timestamp: '2023-01-01T00:00:00.000Z',
    };

    const entry2: LogEntry = {
      level: 'warn',
      message: 'Remote message 2',
      timestamp: '2023-01-01T00:00:01.000Z',
    };

    remoteOutput.write(entry1);
    remoteOutput.write(entry2);

    // Should trigger flush when buffer size is reached
    await jest.runOnlyPendingTimersAsync();

    expect(mockFetch).toHaveBeenCalledWith('https://logs.example.com/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'EHR-Adapter-Logger/1.0',
        Authorization: 'Bearer test-api-key',
      },
      body: JSON.stringify({ logs: [entry1, entry2] }),
    });
  });

  it('should send logs on timer', async () => {
    const entry: LogEntry = {
      level: 'info',
      message: 'Timer remote message',
      timestamp: '2023-01-01T00:00:00.000Z',
    };

    remoteOutput.write(entry);

    // Advance timer to trigger flush
    jest.advanceTimersByTime(1000);
    await jest.runOnlyPendingTimersAsync();

    expect(mockFetch).toHaveBeenCalledWith('https://logs.example.com/api', {
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-api-key',
      }),
      body: JSON.stringify({ logs: [entry] }),
    });
  });

  it('should handle API errors gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    const entry: LogEntry = {
      level: 'error',
      message: 'Error message',
      timestamp: '2023-01-01T00:00:00.000Z',
    };

    remoteOutput.write(entry);
    remoteOutput.write(entry); // Trigger flush

    await jest.runOnlyPendingTimersAsync();

    expect(mockConsole.error).toHaveBeenCalledWith(
      'Failed to send logs to remote endpoint:',
      expect.any(Error)
    );
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const entry: LogEntry = {
      level: 'error',
      message: 'Network error message',
      timestamp: '2023-01-01T00:00:00.000Z',
    };

    remoteOutput.write(entry);
    remoteOutput.write(entry); // Trigger flush

    await jest.runOnlyPendingTimersAsync();

    expect(mockConsole.error).toHaveBeenCalledWith(
      'Failed to send logs to remote endpoint:',
      expect.any(Error)
    );
  });

  it('should re-add entries to buffer on failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const entries: LogEntry[] = [];
    for (let i = 0; i < 5; i++) {
      entries.push({
        level: 'info',
        message: `Message ${i}`,
        timestamp: '2023-01-01T00:00:00.000Z',
      });
    }

    // Fill buffer and trigger flush
    entries.forEach(entry => remoteOutput.write(entry));

    await jest.runOnlyPendingTimersAsync();

    // Should have attempted to send
    expect(mockFetch).toHaveBeenCalled();
    expect(mockConsole.error).toHaveBeenCalled();
  });

  it('should limit buffer size on retry', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    // Create many entries to test buffer limit
    for (let i = 0; i < 1100; i++) {
      remoteOutput.write({
        level: 'info',
        message: `Message ${i}`,
        timestamp: '2023-01-01T00:00:00.000Z',
      });
    }

    await jest.runOnlyPendingTimersAsync();

    // Should have attempted to send multiple times
    expect(mockFetch).toHaveBeenCalled();
  });

  it('should flush manually', async () => {
    const entry: LogEntry = {
      level: 'info',
      message: 'Manual flush remote message',
      timestamp: '2023-01-01T00:00:00.000Z',
    };

    remoteOutput.write(entry);
    await remoteOutput.flush();

    expect(mockFetch).toHaveBeenCalledWith('https://logs.example.com/api', {
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ logs: [entry] }),
    });
  });

  it('should close properly', async () => {
    const entry: LogEntry = {
      level: 'info',
      message: 'Close remote message',
      timestamp: '2023-01-01T00:00:00.000Z',
    };

    remoteOutput.write(entry);
    await remoteOutput.close();

    expect(mockFetch).toHaveBeenCalled();
  });

  it('should handle empty buffer flush', async () => {
    await remoteOutput.flush();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should not include Authorization header without API key', async () => {
    const noKeyOutput = new RemoteOutput('https://logs.example.com/api');
    const entry: LogEntry = {
      level: 'info',
      message: 'No key message',
      timestamp: '2023-01-01T00:00:00.000Z',
    };

    noKeyOutput.write(entry);
    noKeyOutput.write(entry); // Trigger flush

    await jest.runOnlyPendingTimersAsync();

    expect(mockFetch).toHaveBeenCalledWith('https://logs.example.com/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'EHR-Adapter-Logger/1.0',
      },
      body: expect.any(String),
    });
  });
});

describe('Factory Functions', () => {
  const createdLoggers: StructuredLogger[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(async () => {
    // Clean up all created loggers
    await Promise.all(createdLoggers.map(logger => logger.close()));
    createdLoggers.length = 0;
    jest.useRealTimers();
  });

  describe('createStructuredLogger', () => {
    it('should create logger with default parameters', () => {
      const logger = createStructuredLogger();
      createdLoggers.push(logger);
      expect(logger).toBeInstanceOf(StructuredLogger);
      expect(logger.getLevel()).toBe('info');
    });

    it('should create logger with custom parameters', () => {
      const mockOutput = { write: jest.fn() };
      const logger = createStructuredLogger('debug', { service: 'test' }, [mockOutput]);
      createdLoggers.push(logger);

      expect(logger.getLevel()).toBe('debug');

      logger.info('Test message');
      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          context: { service: 'test' },
        })
      );
    });
  });

  describe('createDevelopmentLogger', () => {
    it('should create development logger with debug level', () => {
      const logger = createDevelopmentLogger();
      createdLoggers.push(logger);
      expect(logger).toBeInstanceOf(StructuredLogger);
      expect(logger.getLevel()).toBe('debug');
    });

    it('should create development logger with context', () => {
      const mockOutput = { write: jest.fn() };
      const logger = createDevelopmentLogger({ service: 'dev-test' });
      createdLoggers.push(logger);
      logger.addOutput(mockOutput);

      logger.debug('Debug message');
      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug',
          context: { service: 'dev-test' },
        })
      );
    });
  });

  describe('createProductionLogger', () => {
    it('should create production logger with warn level', () => {
      const logger = createProductionLogger();
      createdLoggers.push(logger);
      expect(logger).toBeInstanceOf(StructuredLogger);
      expect(logger.getLevel()).toBe('warn');
    });

    it('should create production logger with file output', () => {
      const logger = createProductionLogger({}, '/var/log/app.log');
      createdLoggers.push(logger);
      expect(logger).toBeInstanceOf(StructuredLogger);
    });

    it('should create production logger with remote output', () => {
      const logger = createProductionLogger({}, undefined, 'https://logs.example.com', 'api-key');
      createdLoggers.push(logger);
      expect(logger).toBeInstanceOf(StructuredLogger);
    });

    it('should create production logger with both file and remote outputs', () => {
      const logger = createProductionLogger(
        { service: 'prod-app' },
        '/var/log/app.log',
        'https://logs.example.com',
        'api-key'
      );
      createdLoggers.push(logger);
      expect(logger).toBeInstanceOf(StructuredLogger);
    });
  });
});

describe('LoggerFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset factory defaults
    LoggerFactory.setDefaults('info', {}, [new ConsoleOutput()]);
  });

  describe('setDefaults', () => {
    it('should set default configuration', () => {
      const mockOutput = { write: jest.fn() };
      LoggerFactory.setDefaults('debug', { app: 'test' }, [mockOutput]);

      const logger = LoggerFactory.create('test-logger');
      expect(logger.getLevel()).toBe('debug');

      logger.info('Test message');
      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          context: { app: 'test', logger: 'test-logger' },
        })
      );
    });
  });

  describe('create', () => {
    it('should create logger with name in context', () => {
      const mockOutput = { write: jest.fn() };
      LoggerFactory.setDefaults('info', {}, [mockOutput]);

      const logger = LoggerFactory.create('my-service');
      logger.info('Test message');

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          context: { logger: 'my-service' },
        })
      );
    });

    it('should merge additional context', () => {
      const mockOutput = { write: jest.fn() };
      LoggerFactory.setDefaults('info', { app: 'test-app' }, [mockOutput]);

      const logger = LoggerFactory.create('my-service', { version: '1.0' });
      logger.info('Test message');

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          context: { app: 'test-app', logger: 'my-service', version: '1.0' },
        })
      );
    });
  });

  describe('createForTenant', () => {
    it('should create logger with tenant context', () => {
      const mockOutput = { write: jest.fn() };
      LoggerFactory.setDefaults('info', {}, [mockOutput]);

      const logger = LoggerFactory.createForTenant('tenant-123', 'tenant-service');
      logger.info('Tenant message');

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          context: { logger: 'tenant-service', tenantId: 'tenant-123' },
          tenantId: 'tenant-123',
        })
      );
    });

    it('should merge additional context with tenant', () => {
      const mockOutput = { write: jest.fn() };
      LoggerFactory.setDefaults('info', {}, [mockOutput]);

      const logger = LoggerFactory.createForTenant('tenant-123', 'tenant-service', {
        module: 'auth',
      });
      logger.info('Tenant auth message');

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          context: { logger: 'tenant-service', tenantId: 'tenant-123', module: 'auth' },
          tenantId: 'tenant-123',
        })
      );
    });
  });

  describe('createForRequest', () => {
    it('should create logger with request context', () => {
      const mockOutput = { write: jest.fn() };
      LoggerFactory.setDefaults('info', {}, [mockOutput]);

      const logger = LoggerFactory.createForRequest('req-456', 'request-service');
      logger.info('Request message');

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          context: { logger: 'request-service', requestId: 'req-456' },
          requestId: 'req-456',
        })
      );
    });

    it('should merge additional context with request', () => {
      const mockOutput = { write: jest.fn() };
      LoggerFactory.setDefaults('info', {}, [mockOutput]);

      const logger = LoggerFactory.createForRequest('req-456', 'request-service', {
        endpoint: '/api/users',
      });
      logger.info('Request endpoint message');

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          context: { logger: 'request-service', requestId: 'req-456', endpoint: '/api/users' },
          requestId: 'req-456',
        })
      );
    });
  });
});
