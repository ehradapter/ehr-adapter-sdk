import {
  ComplianceLogger,
  ComplianceLoggerConfig,
  ComplianceEvent,
  ComplianceOutput,
  ConsoleComplianceOutput,
  createComplianceLogger,
  createHIPAAComplianceLogger,
  createGDPRComplianceLogger,
  ComplianceFramework,
  ComplianceEventType,
  DataClassification,
} from './ComplianceLogger';
import { AuditLogger, AuditLoggerConfig, AuditActor, AuditResource } from './AuditLogger';
import { StructuredLogger } from './StructuredLogger';

// Mock console methods
const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
};

describe('ComplianceLogger', () => {
  let config: ComplianceLoggerConfig;
  let auditLogger: AuditLogger;
  let logger: StructuredLogger;
  let complianceLogger: ComplianceLogger;
  let mockOutput: jest.Mocked<ComplianceOutput>;
  let mockAuditOutput: { write: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(console, mockConsole);

    mockOutput = {
      write: jest.fn().mockResolvedValue(undefined),
      flush: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    mockAuditOutput = { write: jest.fn() };

    // Create fresh config object for each test
    config = {
      framework: 'HIPAA',
      enabled: true,
      retentionPeriod: 365,
      encryptLogs: true,
      realTimeAlerts: true,
      alertThresholds: {
        violations: 5,
        breaches: 1,
        accessDenied: 10,
      },
      outputs: [mockOutput],
    };

    // Create completely fresh instances for each test
    const auditConfig: AuditLoggerConfig = { enabled: true };
    logger = new StructuredLogger('info');
    auditLogger = new AuditLogger(auditConfig, logger);
    auditLogger.addOutput(mockAuditOutput);
    complianceLogger = new ComplianceLogger(config, logger, auditLogger);

    // Ensure counters are reset - this should be redundant with constructor fix
    complianceLogger.resetCounters();
  });

  describe('Core Event Logging', () => {
    it('should log compliance event when enabled', async () => {
      const event: Partial<ComplianceEvent> = {
        eventType: 'DATA_ACCESS',
        actor: { type: 'USER', id: 'user123', name: 'John Doe' },
        action: 'VIEW_PATIENT_RECORD',
        description: 'User accessed patient record',
      };

      await complianceLogger.logEvent(event);

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'DATA_ACCESS',
          framework: 'HIPAA',
          actor: { type: 'USER', id: 'user123', name: 'John Doe' },
          action: 'VIEW_PATIENT_RECORD',
          description: 'User accessed patient record',
          eventId: expect.any(String),
          timestamp: expect.any(String),
        })
      );
    });

    it('should not log when disabled', async () => {
      config.enabled = false;
      complianceLogger = new ComplianceLogger(config, logger, auditLogger);

      const event: Partial<ComplianceEvent> = {
        eventType: 'DATA_ACCESS',
        actor: { type: 'USER', id: 'user123' },
      };

      await complianceLogger.logEvent(event);

      expect(mockOutput.write).not.toHaveBeenCalled();
    });

    it('should build complete compliance event with defaults', async () => {
      const event: Partial<ComplianceEvent> = {
        actor: { type: 'USER', id: 'user123' },
      };

      await complianceLogger.logEvent(event);

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: expect.any(String),
          timestamp: expect.any(String),
          framework: 'HIPAA',
          eventType: 'DATA_ACCESS',
          dataClassification: 'INTERNAL',
          actor: { type: 'USER', id: 'user123' },
          action: 'UNKNOWN',
          outcome: 'SUCCESS',
          riskLevel: 'MEDIUM',
          description: 'Compliance event',
          requirements: [],
        })
      );
    });

    it('should handle error during event logging', async () => {
      mockOutput.write.mockRejectedValue(new Error('Output error'));
      const loggerErrorSpy = jest.spyOn(logger, 'error');

      const event: Partial<ComplianceEvent> = {
        eventType: 'DATA_ACCESS',
        actor: { type: 'USER', id: 'user123' },
      };

      await complianceLogger.logEvent(event);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to log compliance event',
        expect.objectContaining({
          error: expect.any(Error),
          event,
        })
      );
    });

    it('should write to multiple outputs', async () => {
      const secondOutput = {
        write: jest.fn().mockResolvedValue(undefined),
      };
      config.outputs.push(secondOutput);
      complianceLogger = new ComplianceLogger(config, logger, auditLogger);

      const event: Partial<ComplianceEvent> = {
        eventType: 'DATA_ACCESS',
        actor: { type: 'USER', id: 'user123' },
      };

      await complianceLogger.logEvent(event);

      expect(mockOutput.write).toHaveBeenCalledTimes(1);
      expect(secondOutput.write).toHaveBeenCalledTimes(1);
    });

    it('should generate unique event IDs', async () => {
      const event: Partial<ComplianceEvent> = {
        eventType: 'DATA_ACCESS',
        actor: { type: 'USER', id: 'user123' },
      };

      await complianceLogger.logEvent(event);
      await complianceLogger.logEvent(event);

      const firstCall = mockOutput.write.mock.calls[0]?.[0];
      const secondCall = mockOutput.write.mock.calls[1]?.[0];

      expect(firstCall).toBeDefined();
      expect(secondCall).toBeDefined();
      expect(firstCall!.eventId).not.toBe(secondCall!.eventId);
      expect(firstCall!.eventId).toMatch(/^compliance_\d+_[a-z0-9]+$/);
      expect(secondCall!.eventId).toMatch(/^compliance_\d+_[a-z0-9]+$/);
    });
  });

  describe('Audit Trail Integration', () => {
    it('should log to audit logger', async () => {
      const event: Partial<ComplianceEvent> = {
        eventType: 'DATA_ACCESS',
        actor: { type: 'USER', id: 'user123' },
        resource: { type: 'PATIENT', id: 'patient456' },
        action: 'VIEW_RECORD',
        outcome: 'SUCCESS',
        riskLevel: 'HIGH',
        description: 'Patient record accessed',
      };

      await complianceLogger.logEvent(event);

      expect(mockAuditOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'COMPLIANCE_EVENT',
          severity: 'HIGH',
          actor: { type: 'USER', id: 'user123' },
          resource: { type: 'PATIENT', id: 'patient456' },
          action: 'VIEW_RECORD',
          outcome: 'SUCCESS',
          description: 'Patient record accessed',
          metadata: expect.objectContaining({
            framework: 'HIPAA',
            eventType: 'DATA_ACCESS',
            riskLevel: 'HIGH',
          }),
        })
      );
    });

    it('should map risk levels to audit severity correctly', async () => {
      const riskLevels: Array<{ risk: string; severity: string }> = [
        { risk: 'LOW', severity: 'LOW' },
        { risk: 'MEDIUM', severity: 'MEDIUM' },
        { risk: 'HIGH', severity: 'HIGH' },
        { risk: 'CRITICAL', severity: 'CRITICAL' },
      ];

      for (const { risk, severity } of riskLevels) {
        mockAuditOutput.write.mockClear();

        await complianceLogger.logEvent({
          eventType: 'DATA_ACCESS',
          actor: { type: 'USER', id: 'user123' },
          riskLevel: risk as any,
        });

        expect(mockAuditOutput.write).toHaveBeenCalledWith(
          expect.objectContaining({
            severity,
          })
        );
      }
    });

    it('should handle audit logger failures gracefully', async () => {
      mockAuditOutput.write.mockImplementation(() => {
        throw new Error('Audit error');
      });

      const event: Partial<ComplianceEvent> = {
        eventType: 'DATA_ACCESS',
        actor: { type: 'USER', id: 'user123' },
      };

      await expect(complianceLogger.logEvent(event)).resolves.toBeUndefined();
      expect(mockOutput.write).toHaveBeenCalled();
    });
  });

  describe('HIPAA Compliance Methods', () => {
    it('should log HIPAA data access with correct requirements', async () => {
      const actor: AuditActor = { type: 'USER', id: 'doctor123', name: 'Dr. Smith' };
      const resource: AuditResource = { type: 'PATIENT', id: 'patient456' };

      await complianceLogger.logHIPAADataAccess(actor, resource, 'VIEW_MEDICAL_HISTORY');

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          framework: 'HIPAA',
          eventType: 'DATA_ACCESS',
          dataClassification: 'CONFIDENTIAL',
          actor,
          resource,
          action: 'VIEW_MEDICAL_HISTORY',
          outcome: 'SUCCESS',
          riskLevel: 'MEDIUM',
          description: 'HIPAA-regulated data access: VIEW_MEDICAL_HISTORY',
          requirements: ['164.308(a)(5)(ii)(C)', '164.312(a)(2)(i)', '164.312(d)'],
        })
      );
    });

    it('should log HIPAA data access failure', async () => {
      const actor: AuditActor = { type: 'USER', id: 'user123' };
      const resource: AuditResource = { type: 'PATIENT', id: 'patient456' };

      await complianceLogger.logHIPAADataAccess(actor, resource, 'UNAUTHORIZED_ACCESS', 'FAILURE');

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'FAILURE',
          action: 'UNAUTHORIZED_ACCESS',
        })
      );
    });
  });

  describe('GDPR Compliance Methods', () => {
    beforeEach(() => {
      config.framework = 'GDPR';
      complianceLogger = new ComplianceLogger(config, logger, auditLogger);
    });

    it('should log GDPR data processing with lawful basis', async () => {
      const actor: AuditActor = { type: 'SYSTEM', id: 'data-processor' };
      const resource: AuditResource = { type: 'USER', id: 'user789' };

      await complianceLogger.logGDPRDataProcessing(actor, resource, 'PROFILE_UPDATE', 'Consent');

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          framework: 'GDPR',
          eventType: 'DATA_ACCESS',
          dataClassification: 'CONFIDENTIAL',
          actor,
          resource,
          action: 'PROFILE_UPDATE',
          outcome: 'SUCCESS',
          riskLevel: 'HIGH',
          description: 'GDPR data processing: PROFILE_UPDATE',
          requirements: ['Article 6', 'Article 30', 'Article 32'],
          metadata: {
            lawfulBasis: 'Consent',
            processingPurpose: 'PROFILE_UPDATE',
          },
        })
      );
    });

    it('should log GDPR data processing failure', async () => {
      const actor: AuditActor = { type: 'SYSTEM', id: 'data-processor' };
      const resource: AuditResource = { type: 'USER', id: 'user789' };

      await complianceLogger.logGDPRDataProcessing(
        actor,
        resource,
        'DATA_EXPORT',
        'Legitimate Interest',
        'FAILURE'
      );

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'FAILURE',
          action: 'DATA_EXPORT',
          metadata: {
            lawfulBasis: 'Legitimate Interest',
            processingPurpose: 'DATA_EXPORT',
          },
        })
      );
    });
  });

  describe('Consent Management', () => {
    it('should log consent granted', async () => {
      const actor: AuditActor = { type: 'USER', id: 'patient123' };
      const resource: AuditResource = { type: 'CONFIGURATION', id: 'consent456' };
      const consentDetails = {
        purposes: ['marketing', 'analytics'],
        dataTypes: ['email', 'preferences'],
        expiryDate: '2024-12-31',
      };

      await complianceLogger.logConsent(actor, resource, 'GRANTED', consentDetails);

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          framework: 'HIPAA',
          eventType: 'CONSENT_GRANTED',
          dataClassification: 'CONFIDENTIAL',
          actor,
          resource,
          action: 'CONSENT_GRANTED',
          outcome: 'SUCCESS',
          riskLevel: 'MEDIUM',
          description: 'Patient consent granted',
          metadata: consentDetails,
          evidence: expect.objectContaining({
            type: 'DOCUMENT',
            location: expect.stringMatching(/^consent\/consent456\/\d+$/),
            timestamp: expect.any(String),
            description: 'Consent granted evidence',
          }),
        })
      );
    });

    it('should log consent revoked', async () => {
      const actor: AuditActor = { type: 'USER', id: 'patient123' };
      const resource: AuditResource = { type: 'CONFIGURATION', id: 'consent456' };
      const consentDetails = { reason: 'user_request' };

      await complianceLogger.logConsent(actor, resource, 'REVOKED', consentDetails);

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'CONSENT_REVOKED',
          action: 'CONSENT_REVOKED',
          description: 'Patient consent revoked',
          metadata: consentDetails,
          evidence: expect.objectContaining({
            description: 'Consent revoked evidence',
          }),
        })
      );
    });

    it('should use framework-specific consent requirements', async () => {
      // Test HIPAA requirements
      const actor: AuditActor = { type: 'USER', id: 'patient123' };
      const resource: AuditResource = { type: 'CONFIGURATION', id: 'consent456' };

      await complianceLogger.logConsent(actor, resource, 'GRANTED', {});

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          requirements: ['164.508'],
        })
      );

      // Test GDPR requirements
      config.framework = 'GDPR';
      complianceLogger = new ComplianceLogger(config, logger, auditLogger);
      mockOutput.write.mockClear();

      await complianceLogger.logConsent(actor, resource, 'GRANTED', {});

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          requirements: ['Article 7'],
        })
      );
    });
  });

  describe('Data Breach Logging', () => {
    it('should log data breach with remediation plan', async () => {
      const actor: AuditActor = { type: 'SYSTEM', id: 'security-monitor' };
      const resource: AuditResource = { type: 'SYSTEM', id: 'patient-db' };
      const breachDetails = {
        type: 'UNAUTHORIZED_ACCESS',
        severity: 'HIGH' as const,
        affectedRecords: 1500,
        discoveryDate: '2023-01-15T10:30:00Z',
        description: 'Unauthorized access to patient database detected',
      };

      await complianceLogger.logDataBreach(actor, resource, breachDetails);

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          framework: 'HIPAA',
          eventType: 'BREACH_DETECTED',
          dataClassification: 'RESTRICTED',
          actor,
          resource,
          action: 'BREACH_DETECTED',
          outcome: 'VIOLATION',
          riskLevel: 'CRITICAL',
          description: 'Data breach detected: Unauthorized access to patient database detected',
          metadata: breachDetails,
          remediation: expect.objectContaining({
            required: true,
            actions: [
              'Contain the breach',
              'Assess the risk',
              'Notify affected individuals',
              'Notify regulatory authorities',
              'Document the incident',
            ],
            deadline: expect.any(String),
            status: 'PENDING',
          }),
        })
      );
    });

    it('should increment breach counter', async () => {
      complianceLogger.resetCounters(); // Ensure clean state
      const actor: AuditActor = { type: 'SYSTEM', id: 'security-monitor' };
      const resource: AuditResource = { type: 'SYSTEM', id: 'patient-db' };
      const breachDetails = {
        type: 'DATA_LEAK',
        severity: 'CRITICAL' as const,
        affectedRecords: 100,
        discoveryDate: '2023-01-15T10:30:00Z',
        description: 'Data leak detected',
      };

      const initialStats = complianceLogger.getStats();
      expect(initialStats.breachCount).toBe(0);

      await complianceLogger.logDataBreach(actor, resource, breachDetails);

      const updatedStats = complianceLogger.getStats();
      expect(updatedStats.breachCount).toBe(1);
    });

    it('should calculate correct breach notification deadlines', async () => {
      const actor: AuditActor = { type: 'SYSTEM', id: 'security-monitor' };
      const resource: AuditResource = { type: 'SYSTEM', id: 'patient-db' };
      const breachDetails = {
        type: 'DATA_BREACH',
        severity: 'HIGH' as const,
        affectedRecords: 50,
        discoveryDate: '2023-01-15T10:30:00Z',
        description: 'Test breach',
      };

      // Test HIPAA deadline (60 days)
      await complianceLogger.logDataBreach(actor, resource, breachDetails);
      const hipaaCall = mockOutput.write.mock.calls[0]?.[0];
      expect(hipaaCall).toBeDefined();
      expect(hipaaCall!.remediation).toBeDefined();
      const hipaaDeadline = new Date(hipaaCall!.remediation!.deadline!);
      const hipaaExpected = new Date();
      hipaaExpected.setDate(hipaaExpected.getDate() + 60);
      expect(hipaaDeadline.getDate()).toBe(hipaaExpected.getDate());

      // Test GDPR deadline (72 hours)
      config.framework = 'GDPR';
      complianceLogger = new ComplianceLogger(config, logger, auditLogger);
      mockOutput.write.mockClear();

      await complianceLogger.logDataBreach(actor, resource, breachDetails);
      const gdprCall = mockOutput.write.mock.calls[0]?.[0];
      expect(gdprCall).toBeDefined();
      expect(gdprCall!.remediation).toBeDefined();
      const gdprDeadline = new Date(gdprCall!.remediation!.deadline!);
      const gdprExpected = new Date();
      gdprExpected.setHours(gdprExpected.getHours() + 72);
      expect(Math.abs(gdprDeadline.getTime() - gdprExpected.getTime())).toBeLessThan(60000); // Within 1 minute
    });
  });

  describe('Policy Violation Logging', () => {
    it('should log policy violation with remediation', async () => {
      const actor: AuditActor = { type: 'USER', id: 'employee123' };
      const resource: AuditResource = { type: 'SYSTEM', id: 'hr-system' };
      const violation = {
        policy: 'DATA_ACCESS_POLICY',
        rule: 'MINIMUM_NECESSARY',
        severity: 'HIGH' as const,
        description: 'User accessed more data than necessary for their role',
      };

      await complianceLogger.logPolicyViolation(actor, resource, violation);

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          framework: 'HIPAA',
          eventType: 'POLICY_VIOLATION',
          dataClassification: 'INTERNAL',
          actor,
          resource,
          action: 'POLICY_VIOLATION',
          outcome: 'VIOLATION',
          riskLevel: 'HIGH',
          description: 'Policy violation: User accessed more data than necessary for their role',
          requirements: ['POLICY_COMPLIANCE'],
          metadata: violation,
          remediation: expect.objectContaining({
            required: true,
            actions: ['Review violation', 'Apply corrective measures', 'Update training'],
            status: 'PENDING',
          }),
        })
      );
    });

    it('should not require remediation for low severity violations', async () => {
      const actor: AuditActor = { type: 'USER', id: 'employee123' };
      const resource: AuditResource = { type: 'SYSTEM', id: 'hr-system' };
      const violation = {
        policy: 'PASSWORD_POLICY',
        rule: 'COMPLEXITY',
        severity: 'LOW' as const,
        description: 'Password complexity warning',
      };

      await complianceLogger.logPolicyViolation(actor, resource, violation);

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          remediation: expect.objectContaining({
            required: false,
          }),
        })
      );
    });

    it('should increment violation counter', async () => {
      complianceLogger.resetCounters(); // Ensure clean state
      const actor: AuditActor = { type: 'USER', id: 'employee123' };
      const resource: AuditResource = { type: 'SYSTEM', id: 'hr-system' };
      const violation = {
        policy: 'ACCESS_POLICY',
        rule: 'AUTHORIZATION',
        severity: 'MEDIUM' as const,
        description: 'Unauthorized access attempt',
      };

      const initialStats = complianceLogger.getStats();
      expect(initialStats.violationCount).toBe(0);

      await complianceLogger.logPolicyViolation(actor, resource, violation);

      const updatedStats = complianceLogger.getStats();
      expect(updatedStats.violationCount).toBe(1);
    });
  });

  describe('Access Denied Logging', () => {
    it('should log access denied events', async () => {
      const actor: AuditActor = { type: 'USER', id: 'user123' };
      const resource: AuditResource = { type: 'PATIENT', id: 'patient456' };
      const reason = 'Insufficient privileges';

      await complianceLogger.logAccessDenied(actor, resource, reason);

      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          framework: 'HIPAA',
          eventType: 'ACCESS_DENIED',
          dataClassification: 'INTERNAL',
          actor,
          resource,
          action: 'ACCESS_DENIED',
          outcome: 'FAILURE',
          riskLevel: 'MEDIUM',
          description: 'Access denied: Insufficient privileges',
          requirements: ['ACCESS_CONTROL'],
          metadata: { reason },
        })
      );
    });

    it('should increment access denied counter', async () => {
      complianceLogger.resetCounters(); // Ensure clean state
      const actor: AuditActor = { type: 'USER', id: 'user123' };
      const resource: AuditResource = { type: 'PATIENT', id: 'patient456' };

      const initialStats = complianceLogger.getStats();
      expect(initialStats.accessDeniedCount).toBe(0);

      await complianceLogger.logAccessDenied(actor, resource, 'Test reason');

      const updatedStats = complianceLogger.getStats();
      expect(updatedStats.accessDeniedCount).toBe(1);
    });
  });

  describe('Alert Threshold Management', () => {
    it('should trigger alert when violation threshold is reached', async () => {
      const loggerCriticalSpy = jest.spyOn(logger, 'critical');
      config.alertThresholds.violations = 2;
      complianceLogger = new ComplianceLogger(config, logger, auditLogger);
      complianceLogger.resetCounters(); // Reset counters for this test

      const actor: AuditActor = { type: 'USER', id: 'user123' };
      const resource: AuditResource = { type: 'SYSTEM', id: 'test-system' };
      const violation = {
        policy: 'TEST_POLICY',
        rule: 'TEST_RULE',
        severity: 'MEDIUM' as const,
        description: 'Test violation',
      };

      // First violation - should not trigger alert
      await complianceLogger.logPolicyViolation(actor, resource, violation);
      expect(loggerCriticalSpy).not.toHaveBeenCalled();

      // Second violation - should trigger alert
      await complianceLogger.logPolicyViolation(actor, resource, violation);
      expect(loggerCriticalSpy).toHaveBeenCalledWith(
        'Compliance alert triggered',
        expect.objectContaining({
          violationCount: 2,
          breachCount: 0,
          accessDeniedCount: 0,
        })
      );
    });

    it('should trigger alert when breach threshold is reached', async () => {
      const loggerCriticalSpy = jest.spyOn(logger, 'critical');
      config.alertThresholds.breaches = 1;
      complianceLogger = new ComplianceLogger(config, logger, auditLogger);

      const actor: AuditActor = { type: 'SYSTEM', id: 'security-monitor' };
      const resource: AuditResource = { type: 'SYSTEM', id: 'test-db' };
      const breachDetails = {
        type: 'TEST_BREACH',
        severity: 'HIGH' as const,
        affectedRecords: 10,
        discoveryDate: '2023-01-15T10:30:00Z',
        description: 'Test breach',
      };

      await complianceLogger.logDataBreach(actor, resource, breachDetails);

      expect(loggerCriticalSpy).toHaveBeenCalledWith(
        'Compliance alert triggered',
        expect.objectContaining({
          violationCount: 0,
          breachCount: 1,
          accessDeniedCount: 0,
        })
      );
    });

    it('should trigger alert when access denied threshold is reached', async () => {
      const loggerCriticalSpy = jest.spyOn(logger, 'critical');
      config.alertThresholds.accessDenied = 3;
      complianceLogger = new ComplianceLogger(config, logger, auditLogger);

      const actor: AuditActor = { type: 'USER', id: 'user123' };
      const resource: AuditResource = { type: 'SYSTEM', id: 'test-system' };

      // Log access denied events
      for (let i = 0; i < 3; i++) {
        await complianceLogger.logAccessDenied(actor, resource, 'Test reason');
      }

      expect(loggerCriticalSpy).toHaveBeenCalledWith(
        'Compliance alert triggered',
        expect.objectContaining({
          violationCount: 0,
          breachCount: 0,
          accessDeniedCount: 3,
        })
      );
    });

    it('should trigger alert for critical risk level events', async () => {
      const loggerCriticalSpy = jest.spyOn(logger, 'critical');
      config.realTimeAlerts = true;
      complianceLogger = new ComplianceLogger(config, logger, auditLogger);

      const event: Partial<ComplianceEvent> = {
        eventType: 'DATA_ACCESS',
        actor: { type: 'SYSTEM', id: 'security-system' },
        riskLevel: 'CRITICAL',
        description: 'Critical security event',
      };

      await complianceLogger.logEvent(event);

      expect(loggerCriticalSpy).toHaveBeenCalledWith(
        'Compliance alert triggered',
        expect.objectContaining({
          riskLevel: 'CRITICAL',
        })
      );
    });

    it('should not trigger alerts when real-time alerts are disabled', async () => {
      const loggerCriticalSpy = jest.spyOn(logger, 'critical');
      config.realTimeAlerts = false;
      complianceLogger = new ComplianceLogger(config, logger, auditLogger);

      const event: Partial<ComplianceEvent> = {
        eventType: 'DATA_ACCESS',
        actor: { type: 'SYSTEM', id: 'security-system' },
        riskLevel: 'CRITICAL',
        description: 'Critical security event',
      };

      await complianceLogger.logEvent(event);

      expect(loggerCriticalSpy).not.toHaveBeenCalled();
    });
  });

  describe('Statistics and Counter Management', () => {
    it('should return correct statistics', () => {
      const stats = complianceLogger.getStats();

      expect(stats).toEqual({
        violationCount: 0,
        breachCount: 0,
        accessDeniedCount: 0,
        framework: 'HIPAA',
        retentionPeriod: 365,
      });
    });

    it('should update counters correctly', async () => {
      complianceLogger.resetCounters(); // Ensure clean state
      const actor: AuditActor = { type: 'USER', id: 'user123' };
      const resource: AuditResource = { type: 'SYSTEM', id: 'test-system' };

      // Log different types of events
      await complianceLogger.logPolicyViolation(actor, resource, {
        policy: 'TEST_POLICY',
        rule: 'TEST_RULE',
        severity: 'MEDIUM',
        description: 'Test violation',
      });

      await complianceLogger.logDataBreach(actor, resource, {
        type: 'TEST_BREACH',
        severity: 'HIGH',
        affectedRecords: 10,
        discoveryDate: '2023-01-15T10:30:00Z',
        description: 'Test breach',
      });

      await complianceLogger.logAccessDenied(actor, resource, 'Test reason');

      const stats = complianceLogger.getStats();
      expect(stats.violationCount).toBe(1);
      expect(stats.breachCount).toBe(1);
      expect(stats.accessDeniedCount).toBe(1);
    });

    it('should reset counters', () => {
      // Set some initial values by calling the private updateCounters method indirectly
      const initialStats = complianceLogger.getStats();
      expect(initialStats.violationCount).toBe(0);
      expect(initialStats.breachCount).toBe(0);
      expect(initialStats.accessDeniedCount).toBe(0);

      complianceLogger.resetCounters();

      const resetStats = complianceLogger.getStats();
      expect(resetStats.violationCount).toBe(0);
      expect(resetStats.breachCount).toBe(0);
      expect(resetStats.accessDeniedCount).toBe(0);
    });
  });
});

describe('ConsoleComplianceOutput', () => {
  let consoleOutput: ConsoleComplianceOutput;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(console, mockConsole);
    consoleOutput = new ConsoleComplianceOutput();
  });

  it('should write compliance event to console', async () => {
    const event: ComplianceEvent = {
      eventId: 'test-event-123',
      timestamp: '2023-01-01T00:00:00.000Z',
      framework: 'HIPAA',
      eventType: 'DATA_ACCESS',
      dataClassification: 'CONFIDENTIAL',
      actor: { type: 'USER', id: 'user123' },
      action: 'VIEW_RECORD',
      outcome: 'SUCCESS',
      riskLevel: 'MEDIUM',
      description: 'Test compliance event',
      requirements: ['164.308'],
    };

    await consoleOutput.write(event);

    expect(mockConsole.log).toHaveBeenCalledWith(
      '[COMPLIANCE] 2023-01-01T00:00:00.000Z HIPAA DATA_ACCESS MEDIUM'
    );
    expect(mockConsole.log).toHaveBeenCalledWith(JSON.stringify(event, null, 2));
  });
});

describe('Factory Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createComplianceLogger', () => {
    it('should create compliance logger with provided config', () => {
      const config: ComplianceLoggerConfig = {
        framework: 'GDPR',
        enabled: true,
        retentionPeriod: 2190,
        encryptLogs: true,
        realTimeAlerts: false,
        alertThresholds: { violations: 10, breaches: 1, accessDenied: 20 },
        outputs: [],
      };
      const logger = new StructuredLogger();
      const auditLogger = new AuditLogger({ enabled: true }, logger);

      const complianceLogger = createComplianceLogger(config, logger, auditLogger);

      expect(complianceLogger).toBeInstanceOf(ComplianceLogger);
      expect(complianceLogger.getStats().framework).toBe('GDPR');
      expect(complianceLogger.getStats().retentionPeriod).toBe(2190);
    });
  });

  describe('createHIPAAComplianceLogger', () => {
    it('should create HIPAA compliance logger with correct defaults', () => {
      const logger = new StructuredLogger();
      const auditLogger = new AuditLogger({ enabled: true }, logger);

      const complianceLogger = createHIPAAComplianceLogger(logger, auditLogger);

      expect(complianceLogger).toBeInstanceOf(ComplianceLogger);
      const stats = complianceLogger.getStats();
      expect(stats.framework).toBe('HIPAA');
      expect(stats.retentionPeriod).toBe(2555); // 7 years
    });
  });

  describe('createGDPRComplianceLogger', () => {
    it('should create GDPR compliance logger with correct defaults', () => {
      const logger = new StructuredLogger();
      const auditLogger = new AuditLogger({ enabled: true }, logger);

      const complianceLogger = createGDPRComplianceLogger(logger, auditLogger);

      expect(complianceLogger).toBeInstanceOf(ComplianceLogger);
      const stats = complianceLogger.getStats();
      expect(stats.framework).toBe('GDPR');
      expect(stats.retentionPeriod).toBe(2190); // 6 years
    });
  });
});
