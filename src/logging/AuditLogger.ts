import { LoggerInterface } from './LoggerInterface';

/**
 * Audit event types
 */
export type AuditEventType =
  | 'DATA_ACCESS'
  | 'DATA_MODIFICATION'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'CONFIGURATION_CHANGE'
  | 'SYSTEM_EVENT'
  | 'SECURITY_EVENT'
  | 'COMPLIANCE_EVENT';

/**
 * Audit event severity levels
 */
export type AuditSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Audit event outcome
 */
export type AuditOutcome = 'SUCCESS' | 'FAILURE' | 'PARTIAL' | 'UNKNOWN';

/**
 * Audit event interface
 */
export interface AuditEvent {
  eventId: string;
  eventType: AuditEventType;
  timestamp: string;
  severity: AuditSeverity;
  outcome: AuditOutcome;
  actor: AuditActor;
  resource?: AuditResource;
  action: string;
  description: string;
  source: AuditSource;
  metadata?: Record<string, any>;
  compliance?: ComplianceInfo;
}

/**
 * Audit actor (who performed the action)
 */
export interface AuditActor {
  type: 'USER' | 'SYSTEM' | 'APPLICATION' | 'SERVICE';
  id: string;
  name?: string;
  role?: string;
  tenantId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Audit resource (what was accessed/modified)
 */
export interface AuditResource {
  type:
    | 'PATIENT'
    | 'OBSERVATION'
    | 'MEDICATION'
    | 'APPOINTMENT'
    | 'USER'
    | 'CONFIGURATION'
    | 'SYSTEM';
  id: string;
  identifier?: string;
  patientId?: string;
  attributes?: Record<string, any>;
}

/**
 * Audit source (where the event originated)
 */
export interface AuditSource {
  system: string;
  component: string;
  version?: string;
  environment?: string;
  requestId?: string;
  correlationId?: string;
}

/**
 * Compliance information
 */
export interface ComplianceInfo {
  framework: 'HIPAA' | 'GDPR' | 'SOC2' | 'HITECH' | 'CUSTOM';
  requirements: string[];
  dataClassification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  retentionPeriod?: number; // days
  encryptionRequired?: boolean;
}

/**
 * Audit logger configuration
 */
export interface AuditLoggerConfig {
  enabled: boolean;
  includeRequestBody?: boolean;
  includeResponseBody?: boolean;
  maskSensitiveData?: boolean;
  sensitiveFields?: string[];
  retention?: number; // days
  complianceLevel?: 'HIPAA' | 'GDPR' | 'SOC2' | 'CUSTOM';
  outputs?: AuditOutput[];
}

/**
 * Audit output interface
 */
export interface AuditOutput {
  write(event: AuditEvent): Promise<void>;
  flush?(): Promise<void>;
  close?(): Promise<void>;
}

/**
 * Audit logger implementation
 */
export class AuditLogger {
  private config: AuditLoggerConfig;
  private logger: LoggerInterface;
  private outputs: AuditOutput[];
  private sensitiveFieldPatterns: RegExp[];

  constructor(config: AuditLoggerConfig, logger: LoggerInterface) {
    this.config = config;
    this.logger = logger;
    this.outputs = config.outputs || [];
    this.sensitiveFieldPatterns = this.compileSensitiveFieldPatterns(config.sensitiveFields || []);
  }

  /**
   * Log audit event
   */
  async logEvent(event: Partial<AuditEvent>): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      const auditEvent = this.buildAuditEvent(event);

      // Mask sensitive data if configured
      if (this.config.maskSensitiveData) {
        this.maskSensitiveData(auditEvent);
      }

      // Write to all outputs
      await Promise.all(this.outputs.map(output => output.write(auditEvent)));

      // Also log to standard logger
      this.logger.info('Audit event logged', {
        eventId: auditEvent.eventId,
        eventType: auditEvent.eventType,
        actor: auditEvent.actor.id,
        action: auditEvent.action,
        outcome: auditEvent.outcome,
      });
    } catch (error) {
      this.logger.error('Failed to log audit event', { error, event });
    }
  }

  /**
   * Log data access event
   */
  async logDataAccess(
    actor: AuditActor,
    resource: AuditResource,
    action: string,
    outcome: AuditOutcome = 'SUCCESS',
    metadata?: Record<string, any>
  ): Promise<void> {
    const event: Partial<AuditEvent> = {
      eventType: 'DATA_ACCESS',
      severity: 'MEDIUM',
      actor,
      resource,
      action,
      outcome,
      description: `Data access: ${action} on ${resource.type}`,
      compliance: {
        framework: this.config.complianceLevel || 'HIPAA',
        requirements: ['ACCESS_LOGGING', 'AUDIT_TRAIL'],
        dataClassification: 'CONFIDENTIAL',
      },
    };
    if (metadata) {
      event.metadata = metadata;
    }
    await this.logEvent(event);
  }

  /**
   * Log data modification event
   */
  async logDataModification(
    actor: AuditActor,
    resource: AuditResource,
    action: string,
    outcome: AuditOutcome = 'SUCCESS',
    changes?: Record<string, any>
  ): Promise<void> {
    const event: Partial<AuditEvent> = {
      eventType: 'DATA_MODIFICATION',
      severity: 'HIGH',
      actor,
      resource,
      action,
      outcome,
      description: `Data modification: ${action} on ${resource.type}`,
      compliance: {
        framework: this.config.complianceLevel || 'HIPAA',
        requirements: ['CHANGE_LOGGING', 'DATA_INTEGRITY'],
        dataClassification: 'CONFIDENTIAL',
      },
    };
    if (changes) {
      event.metadata = { changes };
    }
    await this.logEvent(event);
  }

  /**
   * Log authentication event
   */
  async logAuthentication(
    actor: AuditActor,
    action: string,
    outcome: AuditOutcome,
    metadata?: Record<string, any>
  ): Promise<void> {
    const event: Partial<AuditEvent> = {
      eventType: 'AUTHENTICATION',
      severity: outcome === 'FAILURE' ? 'HIGH' : 'LOW',
      actor,
      action,
      outcome,
      description: `Authentication: ${action}`,
      compliance: {
        framework: this.config.complianceLevel || 'HIPAA',
        requirements: ['AUTH_LOGGING', 'ACCESS_CONTROL'],
        dataClassification: 'INTERNAL',
      },
    };
    if (metadata) {
      event.metadata = metadata;
    }
    await this.logEvent(event);
  }

  /**
   * Log authorization event
   */
  async logAuthorization(
    actor: AuditActor,
    resource: AuditResource,
    action: string,
    outcome: AuditOutcome,
    metadata?: Record<string, any>
  ): Promise<void> {
    const event: Partial<AuditEvent> = {
      eventType: 'AUTHORIZATION',
      severity: outcome === 'FAILURE' ? 'HIGH' : 'LOW',
      actor,
      resource,
      action,
      outcome,
      description: `Authorization: ${action} on ${resource.type}`,
      compliance: {
        framework: this.config.complianceLevel || 'HIPAA',
        requirements: ['AUTHZ_LOGGING', 'ACCESS_CONTROL'],
        dataClassification: 'INTERNAL',
      },
    };
    if (metadata) {
      event.metadata = metadata;
    }
    await this.logEvent(event);
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    eventType: string,
    severity: AuditSeverity,
    actor: AuditActor,
    description: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const event: Partial<AuditEvent> = {
      eventType: 'SECURITY_EVENT',
      severity,
      actor,
      action: eventType,
      outcome: 'SUCCESS',
      description,
      compliance: {
        framework: this.config.complianceLevel || 'HIPAA',
        requirements: ['SECURITY_LOGGING', 'INCIDENT_RESPONSE'],
        dataClassification: 'RESTRICTED',
      },
    };
    if (metadata) {
      event.metadata = metadata;
    }
    await this.logEvent(event);
  }

  /**
   * Log configuration change event
   */
  async logConfigurationChange(
    actor: AuditActor,
    configType: string,
    changes: Record<string, any>,
    outcome: AuditOutcome = 'SUCCESS'
  ): Promise<void> {
    await this.logEvent({
      eventType: 'CONFIGURATION_CHANGE',
      severity: 'MEDIUM',
      actor,
      action: 'MODIFY_CONFIGURATION',
      outcome,
      description: `Configuration change: ${configType}`,
      metadata: { configType, changes },
      compliance: {
        framework: this.config.complianceLevel || 'HIPAA',
        requirements: ['CONFIG_LOGGING', 'CHANGE_MANAGEMENT'],
        dataClassification: 'INTERNAL',
      },
    });
  }

  /**
   * Build complete audit event
   */
  private buildAuditEvent(event: Partial<AuditEvent>): AuditEvent {
    const finalEvent: AuditEvent = {
      eventId: this.generateEventId(),
      timestamp: new Date().toISOString(),
      severity: event.severity || 'MEDIUM',
      outcome: event.outcome || 'SUCCESS',
      source: event.source || this.getDefaultSource(),
      eventType: event.eventType || 'SYSTEM_EVENT',
      actor: event.actor || this.getSystemActor(),
      action: event.action || 'UNKNOWN',
      description: event.description || 'Audit event',
    };
    if (event.resource) {
      finalEvent.resource = event.resource;
    }
    if (event.metadata) {
      finalEvent.metadata = event.metadata;
    }
    if (event.compliance) {
      finalEvent.compliance = event.compliance;
    }

    return finalEvent;
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get default audit source
   */
  private getDefaultSource(): AuditSource {
    return {
      system: 'ehr-adapter',
      component: 'audit-logger',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
  }

  /**
   * Get system actor for system-generated events
   */
  private getSystemActor(): AuditActor {
    return {
      type: 'SYSTEM',
      id: 'ehr-adapter-system',
      name: 'EHR Adapter System',
    };
  }

  /**
   * Compile sensitive field patterns
   */
  private compileSensitiveFieldPatterns(fields: string[]): RegExp[] {
    return fields.map(field => {
      // Convert field names to regex patterns
      const pattern = field.replace(/\*/g, '.*').replace(/\?/g, '.').toLowerCase();
      return new RegExp(pattern, 'i');
    });
  }

  /**
   * Mask sensitive data in audit event
   */
  private maskSensitiveData(event: AuditEvent): void {
    if (event.metadata) {
      event.metadata = this.maskObject(event.metadata);
    }

    if (event.resource?.attributes) {
      event.resource.attributes = this.maskObject(event.resource.attributes);
    }
  }

  /**
   * Mask sensitive fields in object
   */
  private maskObject(obj: Record<string, any>): Record<string, any> {
    const masked = { ...obj };

    for (const [key, value] of Object.entries(masked)) {
      if (this.isSensitiveField(key)) {
        masked[key] = this.maskValue(value);
      } else if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          masked[key] = value.map(item =>
            typeof item === 'object' ? this.maskObject(item) : item
          );
        } else {
          masked[key] = this.maskObject(value);
        }
      }
    }

    return masked;
  }

  /**
   * Check if field is sensitive
   */
  private isSensitiveField(fieldName: string): boolean {
    return this.sensitiveFieldPatterns.some(pattern => pattern.test(fieldName));
  }

  /**
   * Mask sensitive value
   */
  private maskValue(value: unknown): string {
    if (typeof value === 'string') {
      if (value.length <= 4) {
        return '***';
      }
      return (
        value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2)
      );
    }
    return '***MASKED***';
  }

  /**
   * Add audit output
   */
  addOutput(output: AuditOutput): void {
    this.outputs.push(output);
  }

  /**
   * Remove audit output
   */
  removeOutput(output: AuditOutput): void {
    const index = this.outputs.indexOf(output);
    if (index >= 0) {
      this.outputs.splice(index, 1);
    }
  }

  /**
   * Flush all outputs
   */
  async flush(): Promise<void> {
    await Promise.all(this.outputs.map(output => output.flush?.()));
  }

  /**
   * Close all outputs
   */
  async close(): Promise<void> {
    await Promise.all(this.outputs.map(output => output.close?.()));
  }
}

/**
 * Console audit output
 */
export class ConsoleAuditOutput implements AuditOutput {
  async write(event: AuditEvent): Promise<void> {
    console.log(
      `[AUDIT] ${event.timestamp} ${event.eventType} ${event.severity} - ${event.description}`
    );
    console.log(JSON.stringify(event, null, 2));
  }
}

/**
 * File audit output
 */
export class FileAuditOutput implements AuditOutput {
  private filePath: string;
  private buffer: AuditEvent[] = [];
  private bufferSize = 50;

  constructor(filePath: string, bufferSize = 50) {
    this.filePath = filePath;
    this.bufferSize = bufferSize;
  }

  async write(event: AuditEvent): Promise<void> {
    this.buffer.push(event);
    if (this.buffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const data = this.buffer.map(event => JSON.stringify(event)).join('\n') + '\n';
    this.buffer = [];

    // In a real implementation, you would use fs.appendFile
    console.log(`--- Writing to ${this.filePath} ---\n${data}`);
  }

  async close(): Promise<void> {
    await this.flush();
  }
}

/**
 * Factory for creating a HIPAA-compliant audit logger
 */
export function createHIPAAAuditLogger(logger: LoggerInterface): AuditLogger {
  return new AuditLogger(
    {
      enabled: true,
      maskSensitiveData: true,
      sensitiveFields: [
        'password',
        'apiKey',
        'token',
        'secret',
        'patient.name',
        'patient.address',
        'patient.telecom',
        'patient.birthDate',
        'patient.identifier.value',
      ],
      complianceLevel: 'HIPAA',
    },
    logger
  );
}
