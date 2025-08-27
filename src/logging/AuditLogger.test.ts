import {
  AuditLogger,
  AuditLoggerConfig,
  AuditEvent,
  AuditActor,
  AuditResource,
  AuditOutcome,
} from './AuditLogger';
import { StructuredLogger } from './StructuredLogger';

describe('AuditLogger', () => {
  let config: AuditLoggerConfig;
  let logger: StructuredLogger;
  let auditLogger: AuditLogger;
  let mockOutput: { write: jest.Mock };

  beforeEach(() => {
    config = {
      enabled: true,
      maskSensitiveData: true,
      sensitiveFields: ['password', 'ssn'],
    };
    logger = new StructuredLogger('info');
    jest.spyOn(logger, 'info');
    jest.spyOn(logger, 'error');
    mockOutput = { write: jest.fn() };
    auditLogger = new AuditLogger(config, logger);
    auditLogger.addOutput(mockOutput);
  });

  it('should log an event', async () => {
    const event: Partial<AuditEvent> = {
      eventType: 'AUTHENTICATION',
      actor: { type: 'USER', id: 'user1' },
      action: 'LOGIN',
      outcome: 'SUCCESS',
    };
    await auditLogger.logEvent(event);
    expect(mockOutput.write).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('Audit event logged', expect.any(Object));
  });

  it('should log a data access event', async () => {
    const actor: AuditActor = { type: 'USER', id: 'user1' };
    const resource: AuditResource = { type: 'PATIENT', id: 'patient1' };
    await auditLogger.logDataAccess(actor, resource, 'READ');
    expect(mockOutput.write).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'DATA_ACCESS' })
    );
  });

  it('should mask sensitive data', async () => {
    const event: Partial<AuditEvent> = {
      eventType: 'DATA_MODIFICATION',
      actor: { type: 'USER', id: 'user1' },
      action: 'UPDATE_USER',
      outcome: 'SUCCESS',
      metadata: {
        username: 'testuser',
        password: 'secretpassword',
        ssn: '123-456-7890',
      },
    };
    await auditLogger.logEvent(event);
    const loggedEvent: AuditEvent = mockOutput.write.mock.calls[0][0];
    expect(loggedEvent.metadata?.password).toBe('se**********rd');
    expect(loggedEvent.metadata?.ssn).toBe('12********90');
  });

  it('should not log if disabled', async () => {
    auditLogger = new AuditLogger({ ...config, enabled: false }, logger);
    auditLogger.addOutput(mockOutput);
    await auditLogger.logEvent({});
    expect(mockOutput.write).not.toHaveBeenCalled();
  });

  it('should handle errors during logging', async () => {
    const errorOutput = {
      write: jest.fn().mockRejectedValue(new Error('Output error')),
    };
    auditLogger.addOutput(errorOutput);
    await auditLogger.logEvent({});
    expect(logger.error).toHaveBeenCalledWith('Failed to log audit event', expect.any(Object));
  });

  it('should remove an output', async () => {
    auditLogger.removeOutput(mockOutput);
    await auditLogger.logEvent({});
    expect(mockOutput.write).not.toHaveBeenCalled();
  });

  it('should flush and close outputs', async () => {
    const flushableOutput = {
      write: jest.fn(),
      flush: jest.fn(),
      close: jest.fn(),
    };
    auditLogger.addOutput(flushableOutput);
    await auditLogger.flush();
    expect(flushableOutput.flush).toHaveBeenCalled();
    await auditLogger.close();
    expect(flushableOutput.close).toHaveBeenCalled();
  });
});
