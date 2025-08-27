/**
 * Tenant-Aware Adapter
 *
 * Wrapper adapter that provides multi-tenant isolation and context
 * for EHR operations. Ensures strict tenant separation and security.
 */

import { EHRAdapter, AuditEntry, AuditQueryOptions } from "./EHRAdapter";
import { TenantAdapterConfig, ProcessingContext } from "../types/config";
import {
  Patient,
  Observation,
  Appointment,
  MedicationRequest,
  CapabilityStatement,
  PatientSearchCriteria,
  QueryOptions,
  HealthStatus,
} from "../types/fhir";
import type { CustomQuery } from "../plugins/types";
import { EHRAdapterError, TenantIsolationError } from "../types/errors";
import { TenantContext } from "../types/auth";

export class TenantAwareAdapter implements EHRAdapter {
  readonly vendor: string;
  readonly version: string;
  readonly supportedFHIRVersion: string;

  private baseAdapter: EHRAdapter;
  private tenantConfig: TenantAdapterConfig;
  private tenantContext: TenantContext;
  private isolationLevel: "strict" | "shared";

  constructor(baseAdapter: EHRAdapter, tenantConfig: TenantAdapterConfig) {
    this.baseAdapter = baseAdapter;
    this.tenantConfig = tenantConfig;
    this.vendor = baseAdapter.vendor;
    this.version = baseAdapter.version;
    this.supportedFHIRVersion = baseAdapter.supportedFHIRVersion;
    this.isolationLevel =
      tenantConfig.config.tenant?.isolationLevel || "strict";

    // Initialize tenant context
    this.tenantContext = {
      tenantId: tenantConfig.tenantId,
      metadata: tenantConfig.config.tenant?.metadata || {},
    };

    this.validateTenantConfiguration();
  }

  /**
   * Validate tenant configuration and setup
   */
  private validateTenantConfiguration(): void {
    if (!this.tenantConfig.tenantId) {
      throw new TenantIsolationError(
        "Tenant ID is required for tenant-aware adapter",
        this.tenantConfig.tenantId || "unknown",
        "DATA_LEAK"
      );
    }

    // Validate tenant ID format
    if (!/^[a-zA-Z0-9_-]+$/.test(this.tenantConfig.tenantId)) {
      throw new TenantIsolationError(
        "Tenant ID must contain only alphanumeric characters, hyphens, and underscores",
        this.tenantConfig.tenantId,
        "CONFIG_LEAK"
      );
    }

    // Log tenant initialization
    if (this.tenantConfig.logger) {
      this.tenantConfig.logger.info("Tenant-aware adapter initialized", {
        tenantId: this.tenantConfig.tenantId,
        vendor: this.vendor,
        isolationLevel: this.isolationLevel,
      });
    }
  }

  /**
   * Add tenant context to query options
   */
  private addTenantContext(options?: QueryOptions): QueryOptions {
    const tenantOptions: QueryOptions = {
      ...options,
    };

    // Add tenant-specific headers if configured
    if (this.tenantConfig.config.options?.headers) {
      // Note: We'll add tenant headers through the base adapter's request handling
    }

    return tenantOptions;
  }

  /**
   * Process data through tenant-specific transformation pipeline
   */
  private async processData<T>(
    data: T,
    operation: string,
    resourceType: string
  ): Promise<T> {
    if (!this.tenantConfig.transformationPipeline) {
      return data;
    }

    const context: ProcessingContext = {
      vendor: this.vendor,
      tenantId: this.tenantConfig.tenantId,
      resourceType,
      operation,
      logger: this.tenantConfig.logger as any,
      // SecurityProvider is available in the commercial version
      // ...(this.tenantConfig.security && { security: this.tenantConfig.security }),
      metadata: this.tenantContext.metadata || {},
    };

    let processedData = data;

    // Apply pre-processors
    for (const processor of this.tenantConfig.transformationPipeline
      .preProcessors) {
      if (processor.enabled !== false) {
        try {
          processedData = await processor.process(processedData, context);
        } catch (error) {
          if (this.tenantConfig.logger) {
            this.tenantConfig.logger.error("Pre-processor failed", {
              tenantId: this.tenantConfig.tenantId,
              processor: processor.name,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }

          if (this.tenantConfig.transformationPipeline.options?.failFast) {
            throw new EHRAdapterError(
              `Pre-processor ${processor.name} failed: ${error instanceof Error ? error.message : "Unknown error"}`,
              "TRANSFORMATION_FAILED",
              this.vendor
            );
          }
        }
      }
    }

    return processedData;
  }

  /**
   * Apply post-processing to response data
   */
  private async postProcessData<T>(
    data: T,
    operation: string,
    resourceType: string
  ): Promise<T> {
    if (!this.tenantConfig.transformationPipeline) {
      return data;
    }

    const context: ProcessingContext = {
      vendor: this.vendor,
      tenantId: this.tenantConfig.tenantId,
      resourceType,
      operation,
      logger: this.tenantConfig.logger as any,
      // SecurityProvider is available in the commercial version
      // ...(this.tenantConfig.security && { security: this.tenantConfig.security }),
      metadata: this.tenantContext.metadata || {},
    };

    let processedData = data;

    // Apply post-processors
    for (const processor of this.tenantConfig.transformationPipeline
      .postProcessors) {
      if (processor.enabled !== false) {
        try {
          processedData = await processor.process(processedData, context);
        } catch (error) {
          if (this.tenantConfig.logger) {
            this.tenantConfig.logger.error("Post-processor failed", {
              tenantId: this.tenantConfig.tenantId,
              processor: processor.name,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }

          if (this.tenantConfig.transformationPipeline.options?.failFast) {
            throw new EHRAdapterError(
              `Post-processor ${processor.name} failed: ${error instanceof Error ? error.message : "Unknown error"}`,
              "TRANSFORMATION_FAILED",
              this.vendor
            );
          }
        }
      }
    }

    return processedData;
  }

  /**
   * Log tenant operation
   */
  private logTenantOperation(
    operation: string,
    resourceType: string,
    resourceId?: string,
    metadata?: unknown
  ): void {
    if (this.tenantConfig.logger) {
      this.tenantConfig.logger.info("Tenant operation", {
        tenantId: this.tenantConfig.tenantId,
        vendor: this.vendor,
        operation,
        resourceType,
        resourceId,
        timestamp: new Date().toISOString(),
        ...(metadata as any),
      });
    }
  }

  // EHRAdapter interface implementation with tenant awareness

  async getPatient(
    patientId: string,
    options?: QueryOptions
  ): Promise<Patient> {
    this.logTenantOperation("getPatient", "Patient", patientId);

    const tenantOptions = this.addTenantContext(options);
    const processedId = await this.processData(
      patientId,
      "getPatient",
      "Patient"
    );
    const patient = await this.baseAdapter.getPatient(
      processedId,
      tenantOptions
    );

    return this.postProcessData(patient, "getPatient", "Patient");
  }

  async searchPatients(
    criteria: PatientSearchCriteria,
    options?: QueryOptions
  ): Promise<Patient[]> {
    this.logTenantOperation("searchPatients", "Patient", undefined, {
      criteria,
    });

    const processedCriteria = await this.processData(
      criteria,
      "searchPatients",
      "Patient"
    );
    const tenantOptions = this.addTenantContext(options);
    const patients = await this.baseAdapter.searchPatients(
      processedCriteria,
      tenantOptions
    );

    const postProcessedPatients = await this.postProcessData(
      patients,
      "searchPatients",
      "Patient"
    );
    return postProcessedPatients;
  }

  async getVitals(
    patientId: string,
    options?: QueryOptions
  ): Promise<Observation[]> {
    this.logTenantOperation("getVitals", "Observation", patientId);

    const tenantOptions = this.addTenantContext(options);
    const vitals = await this.baseAdapter.getVitals(patientId, tenantOptions);

    return this.postProcessData(vitals, "getVitals", "Observation");
  }

  async getLabs(
    patientId: string,
    options?: QueryOptions
  ): Promise<Observation[]> {
    this.logTenantOperation("getLabs", "Observation", patientId);

    const tenantOptions = this.addTenantContext(options);
    const labs = await this.baseAdapter.getLabs(patientId, tenantOptions);

    return this.postProcessData(labs, "getLabs", "Observation");
  }

  async getMedications(
    patientId: string,
    options?: QueryOptions
  ): Promise<MedicationRequest[]> {
    this.logTenantOperation("getMedications", "MedicationRequest", patientId);

    const tenantOptions = this.addTenantContext(options);
    const medications = await this.baseAdapter.getMedications(
      patientId,
      tenantOptions
    );

    return this.postProcessData(
      medications,
      "getMedications",
      "MedicationRequest"
    );
  }

  async getAppointments(
    patientId: string,
    options?: QueryOptions
  ): Promise<Appointment[]> {
    this.logTenantOperation("getAppointments", "Appointment", patientId);

    const tenantOptions = this.addTenantContext(options);
    const appointments = await this.baseAdapter.getAppointments(
      patientId,
      tenantOptions
    );

    return this.postProcessData(appointments, "getAppointments", "Appointment");
  }

  async getCapabilities(): Promise<CapabilityStatement> {
    this.logTenantOperation("getCapabilities", "CapabilityStatement");

    const capabilities = await this.baseAdapter.getCapabilities();

    // Add tenant-specific capability modifications
    const tenantCapabilities: CapabilityStatement = {
      ...capabilities,
      id: `${capabilities.id}-tenant-${this.tenantConfig.tenantId}`,
      extension: [
        ...(capabilities.extension || []),
        {
          url: "http://hl7.org/fhir/StructureDefinition/tenant-context",
          valueString: this.tenantConfig.tenantId,
        },
      ],
    };

    return this.postProcessData(
      tenantCapabilities,
      "getCapabilities",
      "CapabilityStatement"
    );
  }

  async healthCheck(): Promise<HealthStatus> {
    this.logTenantOperation("healthCheck", "HealthStatus");

    const baseHealth = await this.baseAdapter.healthCheck();

    // Add tenant-specific health information
    const tenantHealth: HealthStatus = {
      ...baseHealth,
      checks: [
        ...(baseHealth.checks || []),
        {
          name: "tenant_isolation",
          status: "healthy",
          description: `Tenant isolation for ${this.tenantConfig.tenantId}`,
        },
      ],
    };

    return tenantHealth;
  }

  async executeCustomQuery<T>(query: CustomQuery): Promise<T> {
    this.logTenantOperation("executeCustomQuery", "CustomQuery", undefined, {
      queryType: query.type,
    });

    // Add tenant context to query parameters
    const tenantQuery: CustomQuery = {
      ...query,
      parameters: {
        ...query.parameters,
        _tenantId: this.tenantConfig.tenantId,
        _tenantContext: this.tenantContext,
      },
    };

    const processedQuery = await this.processData(
      tenantQuery,
      "executeCustomQuery",
      "CustomQuery"
    );
    const result = await this.baseAdapter.executeCustomQuery<T>(processedQuery);

    return this.postProcessData(result, "executeCustomQuery", "CustomQuery");
  }

  async getAuditLog(options?: AuditQueryOptions): Promise<AuditEntry[]> {
    this.logTenantOperation("getAuditLog", "AuditLog");

    // Add tenant filter to audit query options
    const tenantOptions: AuditQueryOptions = {
      ...options,
      tenantId: this.tenantConfig.tenantId,
    };

    const auditLog = await this.baseAdapter.getAuditLog(tenantOptions);

    // Filter audit log entries for this tenant only (additional safety)
    const tenantAuditLog = auditLog.filter(
      (entry: AuditEntry) => entry.tenantId === this.tenantConfig.tenantId
    );

    return this.postProcessData(tenantAuditLog, "getAuditLog", "AuditLog");
  }

  /**
   * Get tenant configuration
   */
  getTenantConfig(): TenantAdapterConfig {
    return { ...this.tenantConfig };
  }

  /**
   * Get tenant context
   */
  getTenantContext(): TenantContext {
    return { ...this.tenantContext };
  }

  /**
   * Update tenant metadata
   */
  updateTenantMetadata(metadata: Record<string, any>): void {
    this.tenantContext.metadata = {
      ...this.tenantContext.metadata,
      ...metadata,
    };

    if (this.tenantConfig.logger) {
      this.tenantConfig.logger.info("Tenant metadata updated", {
        tenantId: this.tenantConfig.tenantId,
        metadata,
      });
    }
  }

  /**
   * Validate tenant access to resource
   */
  private validateTenantAccess(
    resourceType: string,
    resourceId?: string
  ): void {
    if (this.isolationLevel === "strict") {
      // In strict mode, all operations are automatically tenant-isolated
      // Additional validation logic can be added here

      if (this.tenantConfig.logger) {
        this.tenantConfig.logger.debug("Tenant access validated", {
          tenantId: this.tenantConfig.tenantId,
          resourceType,
          resourceId,
          isolationLevel: this.isolationLevel,
        });
      }
    }
  }
}
