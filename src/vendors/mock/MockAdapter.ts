/**
 * Mock EHR Adapter
 *
 * Mock implementation for development, testing, and demonstration purposes.
 * Provides realistic sample data and configurable behavior for testing scenarios.
 */

import { BaseAdapter } from '../../core/BaseAdapter';
import {
  Patient,
  Observation,
  Appointment,
  MedicationRequest,
  CapabilityStatement,
  PatientSearchCriteria,
  QueryOptions,
  HealthStatus,
  HealthCheck,
} from '../../types/fhir';
import { AdapterConfig, MockConfig } from '../../types/config';
import type { CustomQuery } from '../../plugins/types';
import { EHRAdapterError, ResourceNotFoundError } from '../../types/errors';
import {
  samplePatients,
  sampleObservations,
  sampleAppointments,
  sampleMedications,
} from './sampleData';

export class MockAdapter extends BaseAdapter {
  readonly vendor = 'mock';
  readonly version = '1.0.0';
  readonly supportedFHIRVersion = 'R4';

  private delay: number;
  private errorRate: number;
  private dataSet: 'minimal' | 'standard' | 'comprehensive';
  private connected = false;

  constructor(config: AdapterConfig) {
    super(config);
    if (config.auth.type === 'apikey' && !config.auth.apiKey) {
      throw new EHRAdapterError(
        'API key is required for mock adapter',
        'CONFIGURATION_ERROR',
        'mock'
      );
    }
    // Extract mock-specific configuration
    const mockConfig = config as MockConfig;
    this.delay = mockConfig.delay ?? 100;
    this.errorRate = mockConfig.errorRate ?? 0;
    this.dataSet = mockConfig.dataSet ?? 'standard';
  }

  async getPatient(patientId: string, _options?: QueryOptions): Promise<Patient> {
    await this.simulateDelay();
    this.simulateError('getPatient');

    const patient = samplePatients.find(p => p.id === patientId);
    if (!patient) {
      throw new ResourceNotFoundError(
        `Patient with ID ${patientId} not found`,
        this.vendor,
        'Patient',
        patientId
      );
    }

    await this.logAuditEntry({
      operation: 'getPatient',
      resourceType: 'Patient',
      resourceId: patientId,
      patientId: patientId,
      success: true,
      duration: this.delay,
    });

    return {
      ...patient,
      _vendorSpecific: {
        mock: {
          simulationMode: true,
        },
      },
    };
  }

  async searchPatients(
    criteria: PatientSearchCriteria,
    options?: QueryOptions
  ): Promise<Patient[]> {
    await this.simulateDelay();
    this.simulateError('searchPatients');

    let results = [...samplePatients];

    // Apply search criteria
    if (criteria.name) {
      const searchName = criteria.name.toLowerCase();
      results = results.filter(patient =>
        patient.name?.some(name => {
          const fullName = `${name.given?.join(' ')} ${name.family}`.toLowerCase();
          return fullName.includes(searchName);
        })
      );
    }

    if (criteria.family) {
      const searchFamily = criteria.family.toLowerCase();
      results = results.filter(patient =>
        patient.name?.some(name => name.family?.toLowerCase().includes(searchFamily))
      );
    }

    if (criteria.given) {
      const searchGiven = criteria.given.toLowerCase();
      results = results.filter(patient =>
        patient.name?.some(name =>
          name.given?.some(given => given.toLowerCase().includes(searchGiven))
        )
      );
    }

    if (criteria.birthdate) {
      results = results.filter(patient => patient.birthDate === criteria.birthdate);
    }

    if (criteria.gender) {
      results = results.filter(patient => patient.gender === criteria.gender);
    }

    if (criteria.identifier) {
      results = results.filter(patient =>
        patient.identifier?.some(id => id.value === criteria.identifier)
      );
    }

    // Apply pagination
    const offset = options?._offset ?? criteria._offset ?? 0;
    const count = options?._count ?? criteria._count ?? 20;
    results = results.slice(offset, offset + count);

    await this.logAuditEntry({
      operation: 'searchPatients',
      resourceType: 'Patient',
      success: true,
      duration: this.delay,
      metadata: { resultCount: results.length, criteria },
    });

    return results;
  }

  async getVitals(patientId: string, options?: QueryOptions): Promise<Observation[]> {
    await this.simulateDelay();
    this.simulateError('getVitals');

    // Verify patient exists
    await this.getPatient(patientId);

    let vitals = sampleObservations.filter(
      obs =>
        obs.subject?.reference === `Patient/${patientId}` &&
        obs.category?.some(cat => cat.coding?.some(code => code.code === 'vital-signs'))
    );

    // Apply date filtering
    if (options?.dateRange) {
      if (options.dateRange.start) {
        const startDate = new Date(options.dateRange.start).getTime();
        vitals = vitals.filter(
          obs => obs.effectiveDateTime && new Date(obs.effectiveDateTime).getTime() >= startDate
        );
      }
      if (options.dateRange.end) {
        const endDate = new Date(options.dateRange.end).getTime();
        vitals = vitals.filter(
          obs => obs.effectiveDateTime && new Date(obs.effectiveDateTime).getTime() <= endDate
        );
      }
    }

    // Apply code filtering
    if (options?.code) {
      vitals = vitals.filter(obs =>
        obs.code.coding?.some(coding => options.code?.includes(coding.code ?? ''))
      );
    }

    // Apply pagination
    const offset = options?._offset ?? 0;
    const count = options?._count ?? 50;
    vitals = vitals.slice(offset, offset + count);

    await this.logAuditEntry({
      operation: 'getVitals',
      resourceType: 'Observation',
      patientId: patientId,
      success: true,
      duration: this.delay,
      metadata: { resultCount: vitals.length },
    });

    return vitals;
  }

  async getLabs(patientId: string, options?: QueryOptions): Promise<Observation[]> {
    await this.simulateDelay();
    this.simulateError('getLabs');

    // Verify patient exists
    await this.getPatient(patientId);

    let labs = sampleObservations.filter(
      obs =>
        obs.subject?.reference === `Patient/${patientId}` &&
        obs.category?.some(cat => cat.coding?.some(code => code.code === 'laboratory'))
    );

    // Apply date filtering
    if (options?.dateRange) {
      if (options.dateRange.start) {
        const startDate = new Date(options.dateRange.start);
        labs = labs.filter(
          obs => obs.effectiveDateTime && new Date(obs.effectiveDateTime) >= startDate
        );
      }
      if (options.dateRange.end) {
        const endDate = new Date(options.dateRange.end);
        labs = labs.filter(
          obs => obs.effectiveDateTime && new Date(obs.effectiveDateTime) <= endDate
        );
      }
    }

    // Apply pagination
    const offset = options?._offset ?? 0;
    const count = options?._count ?? 50;
    labs = labs.slice(offset, offset + count);

    await this.logAuditEntry({
      operation: 'getLabs',
      resourceType: 'Observation',
      patientId: patientId,
      success: true,
      duration: this.delay,
      metadata: { resultCount: labs.length },
    });

    return labs;
  }

  async getMedications(patientId: string, options?: QueryOptions): Promise<MedicationRequest[]> {
    await this.simulateDelay();
    this.simulateError('getMedications');

    // Verify patient exists
    await this.getPatient(patientId);

    let medications = sampleMedications.filter(
      med => med.subject?.reference === `Patient/${patientId}`
    );

    // Apply status filtering
    if (options?.status) {
      medications = medications.filter(med => options.status?.includes(med.status));
    }

    // Apply pagination
    const offset = options?._offset ?? 0;
    const count = options?._count ?? 50;
    medications = medications.slice(offset, offset + count);

    await this.logAuditEntry({
      operation: 'getMedications',
      resourceType: 'MedicationRequest',
      patientId: patientId,
      success: true,
      duration: this.delay,
      metadata: { resultCount: medications.length },
    });

    return medications;
  }

  async getAppointments(patientId: string, options?: QueryOptions): Promise<Appointment[]> {
    await this.simulateDelay();
    this.simulateError('getAppointments');

    // Verify patient exists
    await this.getPatient(patientId);

    let appointments = sampleAppointments.filter(apt =>
      apt.participant?.some(p => p.actor?.reference === `Patient/${patientId}`)
    );

    // Apply date filtering
    if (options?.dateRange) {
      if (options.dateRange.start) {
        const startDate = new Date(options.dateRange.start);
        appointments = appointments.filter(apt => apt.start && new Date(apt.start) >= startDate);
      }
      if (options.dateRange.end) {
        const endDate = new Date(options.dateRange.end);
        appointments = appointments.filter(apt => apt.start && new Date(apt.start) <= endDate);
      }
    }

    // Apply status filtering
    if (options?.status) {
      appointments = appointments.filter(apt => options.status?.includes(apt.status));
    }

    // Apply pagination
    const offset = options?._offset ?? 0;
    const count = options?._count ?? 50;
    appointments = appointments.slice(offset, offset + count);

    await this.logAuditEntry({
      operation: 'getAppointments',
      resourceType: 'Appointment',
      patientId: patientId,
      success: true,
      duration: this.delay,
      metadata: { resultCount: appointments.length },
    });

    return appointments;
  }

  async getCapabilities(): Promise<CapabilityStatement> {
    await this.simulateDelay();
    this.simulateError('getCapabilities');

    const capabilities: CapabilityStatement = {
      resourceType: 'CapabilityStatement',
      id: 'mock-ehr-capabilities',
      status: 'active',
      date: new Date().toISOString(),
      publisher: 'Mock EHR Adapter',
      kind: 'instance',
      fhirVersion: 'R4',
      format: ['application/fhir+json', 'application/fhir+xml'],
      rest: [
        {
          mode: 'server',
          resource: [
            {
              type: 'Patient',
              interaction: [{ code: 'read' }, { code: 'search-type' }],
              searchParam: [
                { name: 'identifier', type: 'token' },
                { name: 'name', type: 'string' },
                { name: 'family', type: 'string' },
                { name: 'given', type: 'string' },
                { name: 'birthdate', type: 'date' },
                { name: 'gender', type: 'token' },
              ],
            },
            {
              type: 'Observation',
              interaction: [{ code: 'read' }, { code: 'search-type' }],
              searchParam: [
                { name: 'patient', type: 'reference' },
                { name: 'category', type: 'token' },
                { name: 'code', type: 'token' },
                { name: 'date', type: 'date' },
              ],
            },
            {
              type: 'Appointment',
              interaction: [{ code: 'read' }, { code: 'search-type' }],
              searchParam: [
                { name: 'patient', type: 'reference' },
                { name: 'date', type: 'date' },
                { name: 'status', type: 'token' },
              ],
            },
            {
              type: 'MedicationRequest',
              interaction: [{ code: 'read' }, { code: 'search-type' }],
              searchParam: [
                { name: 'patient', type: 'reference' },
                { name: 'status', type: 'token' },
              ],
            },
          ],
        },
      ],
    };

    await this.logAuditEntry({
      operation: 'getCapabilities',
      resourceType: 'CapabilityStatement',
      success: true,
      duration: this.delay,
    });

    return capabilities;
  }

  async healthCheck(): Promise<HealthStatus> {
    await this.simulateDelay();

    const isConnected = this.connected;

    const healthCheck: HealthCheck = {
      name: 'external_api',
      status: isConnected ? 'healthy' : 'unhealthy',
      description: 'Mock external API dependency',
    };
    if (isConnected) {
      healthCheck.responseTime = 50;
    } else {
      healthCheck.error = 'Connection timeout';
    }

    const status: HealthStatus = {
      status: isConnected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: this.version,
      checks: [
        {
          name: 'database',
          status: isConnected ? 'healthy' : 'unhealthy',
          description: 'Mock database connection',
          responseTime: this.delay,
        },
        {
          name: 'authentication',
          status: 'healthy',
          description: 'Mock authentication service',
          responseTime: 10,
        },
        healthCheck,
      ],
    };

    await this.logAuditEntry({
      operation: 'healthCheck',
      success: isConnected,
      duration: this.delay,
      metadata: { healthStatus: status.status },
    });

    return status;
  }

  async executeCustomQuery<T>(query: CustomQuery): Promise<T> {
    await this.simulateDelay();
    this.simulateError('executeCustomQuery');

    // Mock implementation for custom queries
    switch (query.type) {
      case 'patient-summary': {
        const patientId = query.parameters.patientId as string;
        if (!patientId) {
          throw new EHRAdapterError(
            'Patient ID is required for patient-summary query',
            'INVALID_QUERY_PARAMETERS',
            this.vendor
          );
        }

        const patient = await this.getPatient(patientId);
        const vitals = await this.getVitals(patientId, { _count: 5 });
        const medications = await this.getMedications(patientId, { _count: 10 });
        const appointments = await this.getAppointments(patientId, { _count: 5 });

        return {
          patientId: patient.id,
          summary: {
            patient,
            recentVitals: vitals,
            currentMedications: medications,
            upcomingAppointments: appointments,
          },
        } as T;
      }
      case 'statistics':
        return {
          exportId: 'export-123',
          status: 'in-progress',
          totalPatients: samplePatients.length,
          totalObservations: sampleObservations.length,
          totalAppointments: sampleAppointments.length,
          totalMedications: sampleMedications.length,
          lastUpdated: new Date().toISOString(),
        } as T;

      default:
        throw new EHRAdapterError(
          `Unsupported custom query type: ${query.type}`,
          'UNSUPPORTED_QUERY_TYPE',
          this.vendor
        );
    }
  }

  /**
   * Simulate network delay
   */
  private async simulateDelay(): Promise<void> {
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }
  }

  /**
   * Simulate random errors based on configured error rate
   */
  private simulateError(operation: string): void {
    if (this.errorRate > 0 && Math.random() < this.errorRate / 100) {
      const errorTypes = [
        'NETWORK_ERROR',
        'AUTHENTICATION_ERROR',
        'TIMEOUT_ERROR',
        'SERVER_ERROR',
        'UNKNOWN_ERROR',
      ];
      const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
      if (errorType) {
        throw new EHRAdapterError(
          `Simulated ${errorType} for operation: ${operation}`,
          errorType,
          this.vendor
        );
      }
    }
  }

  /**
   * Get mock adapter configuration
   */
  getMockConfig(): {
    delay: number;
    errorRate: number;
    dataSet: 'minimal' | 'standard' | 'comprehensive';
  } {
    return {
      delay: this.delay,
      errorRate: this.errorRate,
      dataSet: this.dataSet,
    };
  }

  /**
   * Update mock adapter configuration
   */
  updateMockConfig(config: {
    delay?: number;
    errorRate?: number;
    dataSet?: 'minimal' | 'standard' | 'comprehensive';
  }): void {
    if (config.delay !== undefined) {
      this.delay = config.delay;
    }
    if (config.errorRate !== undefined) {
      this.errorRate = config.errorRate;
    }
    if (config.dataSet !== undefined) {
      this.dataSet = config.dataSet;
    }
    this.log('info', 'Mock adapter configuration updated', config);
  }

  public async connect(): Promise<void> {
    if (!this.connected) {
      this.connected = true;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.connected) {
      this.connected = false;
    }
  }

  public async getConfig() {
    return {
      vendor: this.config.vendor,
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      hasAuth: !!this.config.auth,
      authType: this.config.auth?.type,
    };
  }

  public isConnected(): boolean {
    return this.connected;
  }
}
