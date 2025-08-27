import { LoggerInterface } from './LoggerInterface';
import { AuditLogger, AuditActor, AuditResource } from './AuditLogger';

/**
 * Compliance framework types
 */
export type ComplianceFramework = 'HIPAA' | 'GDPR' | 'SOC2' | 'HITECH' | 'PCI_DSS' | 'ISO_27001';

/**
 * Data classification levels
 */
export type DataClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

/**
 * Compliance event types
 */
export type ComplianceEventType =
  | 'DATA_ACCESS'
  | 'DATA_EXPORT'
  | 'DATA_DELETION'
  | 'CONSENT_GRANTED'
  | 'CONSENT_REVOKED'
  | 'BREACH_DETECTED'
  | 'POLICY_VIOLATION'
  | 'RETENTION_EXPIRED'
  | 'ENCRYPTION_FAILURE'
  | 'ACCESS_DENIED';

/**
 * Compliance event interface
 */
export interface ComplianceEvent {
  eventId: string;
  timestamp: string;
  framework: ComplianceFramework;
  eventType: ComplianceEventType;
  dataClassification: DataClassification;
  actor: AuditActor;
  resource?: AuditResource;
  action: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'VIOLATION';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  requirements: string[];
  evidence?: ComplianceEvidence;
  remediation?: ComplianceRemediation;
  metadata?: Record<string, any>;
}

/**
 * Compliance evidence
 */
export interface ComplianceEvidence {
  type: 'LOG_ENTRY' | 'SCREENSHOT' | 'DOCUMENT' | 'SIGNATURE' | 'CERTIFICATE';
  location: string;
  hash?: string;
  timestamp: string;
  description: string;
}

/**
 * Compliance remediation
 */
export interface ComplianceRemediation {
  required: boolean;
  actions: string[];
  deadline?: string;
  responsible?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
}

/**
 * Compliance logger configuration
 */
export interface ComplianceLoggerConfig {
  framework: ComplianceFramework;
  enabled: boolean;
  retentionPeriod: number; // days
  encryptLogs: boolean;
  realTimeAlerts: boolean;
  alertThresholds: {
    violations: number;
    breaches: number;
    accessDenied: number;
  };
  outputs: ComplianceOutput[];
}

/**
 * Compliance output interface
 */
export interface ComplianceOutput {
  write(event: ComplianceEvent): Promise<void>;
  flush?(): Promise<void>;
  close?(): Promise<void>;
}

/**
 * Compliance logger implementation
 */
export class ComplianceLogger {
  private config: ComplianceLoggerConfig;
  private logger: LoggerInterface;
  private auditLogger: AuditLogger;
  private outputs: ComplianceOutput[];
  private violationCount = 0;
  private breachCount = 0;
  private accessDeniedCount = 0;

  constructor(config: ComplianceLoggerConfig, logger: LoggerInterface, auditLogger: AuditLogger) {
    this.config = config;
    this.logger = logger;
    this.auditLogger = auditLogger;
    this.outputs = config.outputs;
    // Explicitly initialize counters to ensure clean state
    this.violationCount = 0;
    this.breachCount = 0;
    this.accessDeniedCount = 0;
  }

  /**
   * Log compliance event
   */
  async logEvent(event: Partial<ComplianceEvent>): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      const complianceEvent = this.buildComplianceEvent(event);

      // Update counters
      this.updateCounters(complianceEvent);

      // Check alert thresholds
      await this.checkAlertThresholds(complianceEvent);

      // Write to compliance outputs
      await Promise.all(this.outputs.map(output => output.write(complianceEvent)));

      // Also log to audit logger
      await this.auditLogger.logEvent({
        eventType: 'COMPLIANCE_EVENT',
        severity: this.mapRiskLevelToSeverity(complianceEvent.riskLevel),
        actor: complianceEvent.actor,
        ...(complianceEvent.resource && { resource: complianceEvent.resource }),
        action: complianceEvent.action,
        outcome: complianceEvent.outcome === 'SUCCESS' ? 'SUCCESS' : 'FAILURE',
        description: complianceEvent.description,
        metadata: {
          framework: complianceEvent.framework,
          eventType: complianceEvent.eventType,
          dataClassification: complianceEvent.dataClassification,
          requirements: complianceEvent.requirements,
          riskLevel: complianceEvent.riskLevel,
        },
      });

      this.logger.info('Compliance event logged', {
        eventId: complianceEvent.eventId,
        framework: complianceEvent.framework,
        eventType: complianceEvent.eventType,
        riskLevel: complianceEvent.riskLevel,
      });
    } catch (error) {
      this.logger.error('Failed to log compliance event', { error, event });
    }
  }

  /**
   * Log HIPAA data access
   */
  async logHIPAADataAccess(
    actor: AuditActor,
    resource: AuditResource,
    action: string,
    outcome: 'SUCCESS' | 'FAILURE' = 'SUCCESS'
  ): Promise<void> {
    await this.logEvent({
      framework: 'HIPAA',
      eventType: 'DATA_ACCESS',
      dataClassification: 'CONFIDENTIAL',
      actor,
      resource,
      action,
      outcome,
      riskLevel: 'MEDIUM',
      description: `HIPAA-regulated data access: ${action}`,
      requirements: [
        '164.308(a)(5)(ii)(C)', // Access management
        '164.312(a)(2)(i)', // Unique user identification
        '164.312(d)', // Person or entity authentication
      ],
    });
  }

  /**
   * Log GDPR data processing
   */
  async logGDPRDataProcessing(
    actor: AuditActor,
    resource: AuditResource,
    action: string,
    lawfulBasis: string,
    outcome: 'SUCCESS' | 'FAILURE' = 'SUCCESS'
  ): Promise<void> {
    await this.logEvent({
      framework: 'GDPR',
      eventType: 'DATA_ACCESS',
      dataClassification: 'CONFIDENTIAL',
      actor,
      resource,
      action,
      outcome,
      riskLevel: 'HIGH',
      description: `GDPR data processing: ${action}`,
      requirements: [
        'Article 6', // Lawfulness of processing
        'Article 30', // Records of processing activities
        'Article 32', // Security of processing
      ],
      metadata: {
        lawfulBasis,
        processingPurpose: action,
      },
    });
  }

  /**
   * Log consent event
   */
  async logConsent(
    actor: AuditActor,
    resource: AuditResource,
    consentType: 'GRANTED' | 'REVOKED',
    consentDetails: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      framework: this.config.framework,
      eventType: consentType === 'GRANTED' ? 'CONSENT_GRANTED' : 'CONSENT_REVOKED',
      dataClassification: 'CONFIDENTIAL',
      actor,
      resource,
      action: `CONSENT_${consentType}`,
      outcome: 'SUCCESS',
      riskLevel: 'MEDIUM',
      description: `Patient consent ${consentType.toLowerCase()}`,
      requirements: this.getConsentRequirements(),
      metadata: consentDetails,
      evidence: {
        type: 'DOCUMENT',
        location: `consent/${resource.id}/${Date.now()}`,
        timestamp: new Date().toISOString(),
        description: `Consent ${consentType.toLowerCase()} evidence`,
      },
    });
  }

  /**
   * Log data breach
   */
  async logDataBreach(
    actor: AuditActor,
    resource: AuditResource,
    breachDetails: {
      type: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      affectedRecords: number;
      discoveryDate: string;
      description: string;
    }
  ): Promise<void> {
    await this.logEvent({
      framework: this.config.framework,
      eventType: 'BREACH_DETECTED',
      dataClassification: 'RESTRICTED',
      actor,
      resource,
      action: 'BREACH_DETECTED',
      outcome: 'VIOLATION',
      riskLevel: 'CRITICAL',
      description: `Data breach detected: ${breachDetails.description}`,
      requirements: this.getBreachRequirements(),
      metadata: breachDetails,
      remediation: {
        required: true,
        actions: [
          'Contain the breach',
          'Assess the risk',
          'Notify affected individuals',
          'Notify regulatory authorities',
          'Document the incident',
        ],
        deadline: this.calculateBreachNotificationDeadline(),
        status: 'PENDING',
      },
    });

    // Counter is already incremented by updateCounters() in logEvent()
    // Removed duplicate increment: this.breachCount++;
  }

  /**
   * Log policy violation
   */
  async logPolicyViolation(
    actor: AuditActor,
    resource: AuditResource,
    violation: {
      policy: string;
      rule: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      description: string;
    }
  ): Promise<void> {
    await this.logEvent({
      framework: this.config.framework,
      eventType: 'POLICY_VIOLATION',
      dataClassification: 'INTERNAL',
      actor,
      resource,
      action: 'POLICY_VIOLATION',
      outcome: 'VIOLATION',
      riskLevel: violation.severity,
      description: `Policy violation: ${violation.description}`,
      requirements: ['POLICY_COMPLIANCE'],
      metadata: violation,
      remediation: {
        required: violation.severity === 'HIGH' || violation.severity === 'CRITICAL',
        actions: ['Review violation', 'Apply corrective measures', 'Update training'],
        status: 'PENDING',
      },
    });

    // Counter is already incremented by updateCounters() in logEvent()
    // Removed duplicate increment: this.violationCount++;
  }

  /**
   * Log access denied event
   */
  async logAccessDenied(actor: AuditActor, resource: AuditResource, reason: string): Promise<void> {
    await this.logEvent({
      framework: this.config.framework,
      eventType: 'ACCESS_DENIED',
      dataClassification: 'INTERNAL',
      actor,
      resource,
      action: 'ACCESS_DENIED',
      outcome: 'FAILURE',
      riskLevel: 'MEDIUM',
      description: `Access denied: ${reason}`,
      requirements: ['ACCESS_CONTROL'],
      metadata: { reason },
    });

    // Counter is already incremented by updateCounters() in logEvent()
    // Removed duplicate increment: this.accessDeniedCount++;
  }

  /**
   * Build complete compliance event
   */
  private buildComplianceEvent(event: Partial<ComplianceEvent>): ComplianceEvent {
    return {
      eventId: this.generateEventId(),
      timestamp: new Date().toISOString(),
      framework: event.framework || this.config.framework,
      eventType: event.eventType || 'DATA_ACCESS',
      dataClassification: event.dataClassification || 'INTERNAL',
      actor: event.actor || this.getSystemActor(),
      action: event.action || 'UNKNOWN',
      outcome: event.outcome || 'SUCCESS',
      riskLevel: event.riskLevel || 'MEDIUM',
      description: event.description || 'Compliance event',
      requirements: event.requirements || [],
      ...event,
    } as ComplianceEvent;
  }

  /**
   * Update event counters
   */
  private updateCounters(event: ComplianceEvent): void {
    console.log(`[DEBUG] updateCounters: eventType = ${event.eventType}`);
    console.log(
      `[DEBUG] updateCounters: BEFORE - violationCount=${this.violationCount}, breachCount=${this.breachCount}, accessDeniedCount=${this.accessDeniedCount}`
    );

    switch (event.eventType) {
      case 'POLICY_VIOLATION':
        this.violationCount++;
        console.log(`[DEBUG] updateCounters: Incremented violationCount to ${this.violationCount}`);
        break;
      case 'BREACH_DETECTED':
        this.breachCount++;
        console.log(`[DEBUG] updateCounters: Incremented breachCount to ${this.breachCount}`);
        break;
      case 'ACCESS_DENIED':
        this.accessDeniedCount++;
        console.log(
          `[DEBUG] updateCounters: Incremented accessDeniedCount to ${this.accessDeniedCount}`
        );
        break;
    }

    console.log(
      `[DEBUG] updateCounters: AFTER - violationCount=${this.violationCount}, breachCount=${this.breachCount}, accessDeniedCount=${this.accessDeniedCount}`
    );
  }

  /**
   * Check alert thresholds
   */
  private async checkAlertThresholds(event: ComplianceEvent): Promise<void> {
    if (!this.config.realTimeAlerts) {
      return;
    }

    const shouldAlert =
      this.violationCount >= this.config.alertThresholds.violations ||
      this.breachCount >= this.config.alertThresholds.breaches ||
      this.accessDeniedCount >= this.config.alertThresholds.accessDenied ||
      event.riskLevel === 'CRITICAL';

    if (shouldAlert) {
      await this.sendAlert(event);
    }
  }

  /**
   * Send compliance alert
   */
  private async sendAlert(event: ComplianceEvent): Promise<void> {
    this.logger.critical('Compliance alert triggered', {
      eventId: event.eventId,
      framework: event.framework,
      eventType: event.eventType,
      riskLevel: event.riskLevel,
      violationCount: this.violationCount,
      breachCount: this.breachCount,
      accessDeniedCount: this.accessDeniedCount,
    });

    // In a real implementation, this would send alerts via email, SMS, etc.
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `compliance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get system actor
   */
  private getSystemActor(): AuditActor {
    return {
      type: 'SYSTEM',
      id: 'compliance-logger',
      name: 'Compliance Logger System',
    };
  }

  /**
   * Map risk level to audit severity
   */
  private mapRiskLevelToSeverity(riskLevel: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    return riskLevel as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }

  /**
   * Get consent requirements based on framework
   */
  private getConsentRequirements(): string[] {
    switch (this.config.framework) {
      case 'HIPAA':
        return ['164.508']; // Uses and disclosures for which authorization is required
      case 'GDPR':
        return ['Article 7']; // Conditions for consent
      default:
        return ['CONSENT_MANAGEMENT'];
    }
  }

  /**
   * Get breach requirements based on framework
   */
  private getBreachRequirements(): string[] {
    switch (this.config.framework) {
      case 'HIPAA':
        return [
          '164.400', // Notification in the case of breach
          '164.404', // Notification to individuals
          '164.408', // Notification to the Secretary
        ];
      case 'GDPR':
        return [
          'Article 33', // Notification of a personal data breach to the supervisory authority
          'Article 34', // Communication of a personal data breach to the data subject
        ];
      default:
        return ['BREACH_NOTIFICATION'];
    }
  }

  /**
   * Calculate breach notification deadline
   */
  private calculateBreachNotificationDeadline(): string {
    const deadline = new Date();

    switch (this.config.framework) {
      case 'HIPAA':
        deadline.setDate(deadline.getDate() + 60); // 60 days for HIPAA
        break;
      case 'GDPR':
        deadline.setHours(deadline.getHours() + 72); // 72 hours for GDPR
        break;
      default:
        deadline.setDate(deadline.getDate() + 30); // 30 days default
    }

    return deadline.toISOString();
  }

  /**
   * Get compliance statistics
   */
  getStats(): {
    violationCount: number;
    breachCount: number;
    accessDeniedCount: number;
    framework: ComplianceFramework;
    retentionPeriod: number;
  } {
    return {
      violationCount: this.violationCount,
      breachCount: this.breachCount,
      accessDeniedCount: this.accessDeniedCount,
      framework: this.config.framework,
      retentionPeriod: this.config.retentionPeriod,
    };
  }

  /**
   * Reset counters
   */
  resetCounters(): void {
    this.violationCount = 0;
    this.breachCount = 0;
    this.accessDeniedCount = 0;
  }
}

/**
 * Console compliance output
 */
export class ConsoleComplianceOutput implements ComplianceOutput {
  async write(event: ComplianceEvent): Promise<void> {
    console.log(
      `[COMPLIANCE] ${event.timestamp} ${event.framework} ${event.eventType} ${event.riskLevel}`
    );
    console.log(JSON.stringify(event, null, 2));
  }
}

/**
 * Create compliance logger
 */
export function createComplianceLogger(
  config: ComplianceLoggerConfig,
  logger: LoggerInterface,
  auditLogger: AuditLogger
): ComplianceLogger {
  return new ComplianceLogger(config, logger, auditLogger);
}

/**
 * Create HIPAA compliance logger
 */
export function createHIPAAComplianceLogger(
  logger: LoggerInterface,
  auditLogger: AuditLogger
): ComplianceLogger {
  const config: ComplianceLoggerConfig = {
    framework: 'HIPAA',
    enabled: true,
    retentionPeriod: 2555, // 7 years
    encryptLogs: true,
    realTimeAlerts: true,
    alertThresholds: {
      violations: 5,
      breaches: 1,
      accessDenied: 10,
    },
    outputs: [new ConsoleComplianceOutput()],
  };

  return new ComplianceLogger(config, logger, auditLogger);
}

/**
 * Create GDPR compliance logger
 */
export function createGDPRComplianceLogger(
  logger: LoggerInterface,
  auditLogger: AuditLogger
): ComplianceLogger {
  const config: ComplianceLoggerConfig = {
    framework: 'GDPR',
    enabled: true,
    retentionPeriod: 2190, // 6 years
    encryptLogs: true,
    realTimeAlerts: true,
    alertThresholds: {
      violations: 3,
      breaches: 1,
      accessDenied: 5,
    },
    outputs: [new ConsoleComplianceOutput()],
  };

  return new ComplianceLogger(config, logger, auditLogger);
}
