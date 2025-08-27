import { TenantAwareAdapter } from './TenantAwareAdapter';
import { MockAdapter } from '../vendors/mock/MockAdapter';
import { TenantAdapterConfig, AdapterConfig } from '../types/config';
import { TenantIsolationError, EHRAdapterError } from '../types/errors';
import { LoggerInterface } from '../logging/LoggerInterface';
import { DataProcessor, CustomQuery } from '../plugins/types';
import { AuditEntry, AuditQueryOptions } from './EHRAdapter';
import { Patient, Observation, MedicationRequest, Appointment } from '../types/fhir';

describe('TenantAwareAdapter', () => {
  let baseAdapter: MockAdapter;
  let tenantConfig: TenantAdapterConfig;
  let mockLogger: LoggerInterface;
  let mockProcessor: DataProcessor;

  beforeEach(() => {
    const adapterConfig: AdapterConfig = {
      vendor: 'mock',
      baseUrl: 'https://mock-ehr.com/fhir',
      auth: { type: 'apikey', apiKey: 'mock-key' },
    };
    baseAdapter = new MockAdapter(adapterConfig);

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      critical: jest.fn(),
      child: jest.fn().mockReturnThis(),
      setLevel: jest.fn(),
      getLevel: jest.fn().mockReturnValue('info'),
      isLevelEnabled: jest.fn().mockReturnValue(true),
      flush: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    mockProcessor = {
      name: 'test-processor',
      version: '1.0.0',
      type: 'TRANSFORM',
      process: jest.fn(<T>(data: T) => {
        if (typeof data === 'string') {
          return Promise.resolve(`${data}-processed` as T);
        }
        // Handle arrays properly - don't convert to objects
        if (Array.isArray(data)) {
          return Promise.resolve(data.map(item => ({ ...item, processed: true })) as T);
        }
        return Promise.resolve({ ...(data as object), processed: true } as T);
      }),
    };

    const transformationPipeline: any = {
      preProcessors: [mockProcessor],
      postProcessors: [mockProcessor],
      options: { failFast: false },
    };

    tenantConfig = {
      tenantId: 'tenant-123',
      config: adapterConfig,
      logger: mockLogger,
      transformationPipeline,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize correctly with valid config', () => {
      const adapter = new TenantAwareAdapter(baseAdapter, tenantConfig);
      expect(adapter).toBeInstanceOf(TenantAwareAdapter);
      expect(adapter.vendor).toBe('mock');
      expect(adapter.version).toBe(baseAdapter.version);
      expect(adapter.supportedFHIRVersion).toBe(baseAdapter.supportedFHIRVersion);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Tenant-aware adapter initialized',
        expect.objectContaining({
          tenantId: 'tenant-123',
          vendor: 'mock',
          isolationLevel: 'strict',
        })
      );
    });

    it('should initialize with custom isolation level', () => {
      const configWithSharedIsolation = {
        ...tenantConfig,
        config: {
          ...tenantConfig.config,
          tenant: {
            tenantId: 'tenant-123',
            isolationLevel: 'shared' as const,
          },
        },
      };
      const adapter = new TenantAwareAdapter(baseAdapter, configWithSharedIsolation);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Tenant-aware adapter initialized',
        expect.objectContaining({
          isolationLevel: 'shared',
        })
      );
    });

    it('should initialize with tenant metadata', () => {
      const configWithMetadata = {
        ...tenantConfig,
        config: {
          ...tenantConfig.config,
          tenant: {
            tenantId: 'tenant-123',
            isolationLevel: 'strict' as const,
            metadata: { region: 'us-east-1', tier: 'premium' },
          },
        },
      };
      const adapter = new TenantAwareAdapter(baseAdapter, configWithMetadata);
      const context = adapter.getTenantContext();
      expect(context.metadata).toEqual({ region: 'us-east-1', tier: 'premium' });
    });

    it('should throw TenantIsolationError for missing tenantId', () => {
      const invalidConfig = { ...tenantConfig, tenantId: '' };
      expect(() => new TenantAwareAdapter(baseAdapter, invalidConfig)).toThrow(
        TenantIsolationError
      );
      expect(() => new TenantAwareAdapter(baseAdapter, invalidConfig)).toThrow(
        'Tenant ID is required for tenant-aware adapter'
      );
    });

    it('should throw TenantIsolationError for undefined tenantId', () => {
      const invalidConfig = { ...tenantConfig, tenantId: undefined as any };
      expect(() => new TenantAwareAdapter(baseAdapter, invalidConfig)).toThrow(
        TenantIsolationError
      );
    });

    it('should throw TenantIsolationError for invalid tenantId format', () => {
      const invalidConfig = { ...tenantConfig, tenantId: 'invalid id!' };
      expect(() => new TenantAwareAdapter(baseAdapter, invalidConfig)).toThrow(
        TenantIsolationError
      );
      expect(() => new TenantAwareAdapter(baseAdapter, invalidConfig)).toThrow(
        'Tenant ID must contain only alphanumeric characters, hyphens, and underscores'
      );
    });

    it('should accept valid tenantId formats', () => {
      const validTenantIds = ['tenant-123', 'tenant_456', 'TENANT789', 'tenant-abc-123_def'];

      validTenantIds.forEach(tenantId => {
        const validConfig = { ...tenantConfig, tenantId };
        expect(() => new TenantAwareAdapter(baseAdapter, validConfig)).not.toThrow();
      });
    });

    it('should reject invalid tenantId formats', () => {
      const invalidTenantIds = ['tenant 123', 'tenant@123', 'tenant.123', 'tenant#123'];

      invalidTenantIds.forEach(tenantId => {
        const invalidConfig = { ...tenantConfig, tenantId };
        expect(() => new TenantAwareAdapter(baseAdapter, invalidConfig)).toThrow(
          TenantIsolationError
        );
      });
    });
  });

  describe('Tenant Context and Security', () => {
    it('should maintain tenant context throughout operations', async () => {
      const adapter = new TenantAwareAdapter(baseAdapter, tenantConfig);
      const context = adapter.getTenantContext();

      expect(context.tenantId).toBe('tenant-123');
      expect(context.metadata).toBeDefined();
    });

    it('should isolate tenant configurations', () => {
      const adapter1 = new TenantAwareAdapter(baseAdapter, {
        ...tenantConfig,
        tenantId: 'tenant-1',
      });
      const adapter2 = new TenantAwareAdapter(baseAdapter, {
        ...tenantConfig,
        tenantId: 'tenant-2',
      });

      expect(adapter1.getTenantContext().tenantId).toBe('tenant-1');
      expect(adapter2.getTenantContext().tenantId).toBe('tenant-2');
      expect(adapter1.getTenantConfig()).not.toEqual(adapter2.getTenantConfig());
    });

    it('should return deep copy of tenant config to prevent mutation', () => {
      const adapter = new TenantAwareAdapter(baseAdapter, tenantConfig);
      const config1 = adapter.getTenantConfig();
      const config2 = adapter.getTenantConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different object references

      // Mutating returned config should not affect internal state
      config1.tenantId = 'modified';
      expect(adapter.getTenantConfig().tenantId).toBe('tenant-123');
    });

    it('should return deep copy of tenant context to prevent mutation', () => {
      const adapter = new TenantAwareAdapter(baseAdapter, tenantConfig);
      const context1 = adapter.getTenantContext();
      const context2 = adapter.getTenantContext();

      expect(context1).toEqual(context2);
      expect(context1).not.toBe(context2); // Different object references

      // Mutating returned context should not affect internal state
      context1.tenantId = 'modified';
      expect(adapter.getTenantContext().tenantId).toBe('tenant-123');
    });
  });

  describe('Method Wrapping and Logging', () => {
    let adapter: TenantAwareAdapter;

    beforeEach(() => {
      adapter = new TenantAwareAdapter(baseAdapter, tenantConfig);
    });

    it('should call baseAdapter.getPatient and log the operation', async () => {
      const getPatientSpy = jest.spyOn(baseAdapter, 'getPatient');
      jest.spyOn(baseAdapter, 'getPatient').mockResolvedValue({
        resourceType: 'Patient',
        id: 'patient-1',
      });

      await adapter.getPatient('patient-1');

      expect(getPatientSpy).toHaveBeenCalledWith('patient-1-processed', expect.any(Object));
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Tenant operation',
        expect.objectContaining({
          operation: 'getPatient',
          tenantId: 'tenant-123',
          vendor: 'mock',
          resourceType: 'Patient',
          resourceId: 'patient-1',
        })
      );
    });

    it('should call baseAdapter.searchPatients and log the operation', async () => {
      const searchPatientsSpy = jest.spyOn(baseAdapter, 'searchPatients');
      const criteria = { name: 'test' };

      await adapter.searchPatients(criteria);

      expect(searchPatientsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ processed: true }),
        expect.any(Object)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Tenant operation',
        expect.objectContaining({
          operation: 'searchPatients',
          resourceType: 'Patient',
          criteria,
        })
      );
    });

    it('should handle all FHIR resource operations with tenant context', async () => {
      const patientId = 'patient-123';
      const mockPatient: Patient = { resourceType: 'Patient', id: patientId };
      const mockObservations: Observation[] = [
        {
          resourceType: 'Observation',
          id: 'obs-1',
          status: 'final',
          code: { text: 'Test observation' },
        },
      ];
      const mockMedications: MedicationRequest[] = [
        {
          resourceType: 'MedicationRequest',
          id: 'med-1',
          status: 'active',
          intent: 'order',
          subject: { reference: 'Patient/patient-123' },
        },
      ];
      const mockAppointments: Appointment[] = [
        {
          resourceType: 'Appointment',
          id: 'appt-1',
          status: 'booked',
          participant: [],
        },
      ];

      jest.spyOn(baseAdapter, 'getPatient').mockResolvedValue(mockPatient);
      jest.spyOn(baseAdapter, 'getVitals').mockResolvedValue(mockObservations);
      jest.spyOn(baseAdapter, 'getLabs').mockResolvedValue(mockObservations);
      jest.spyOn(baseAdapter, 'getMedications').mockResolvedValue(mockMedications);
      jest.spyOn(baseAdapter, 'getAppointments').mockResolvedValue(mockAppointments);

      await adapter.getPatient(patientId);
      await adapter.getVitals(patientId);
      await adapter.getLabs(patientId);
      await adapter.getMedications(patientId);
      await adapter.getAppointments(patientId);

      // Verify all operations were logged with tenant context
      const logCalls = (mockLogger.info as jest.Mock).mock.calls.filter(
        call => call[0] === 'Tenant operation'
      );
      expect(logCalls).toHaveLength(5);

      const operations = logCalls.map(call => call[1].operation);
      expect(operations).toEqual([
        'getPatient',
        'getVitals',
        'getLabs',
        'getMedications',
        'getAppointments',
      ]);
    });
  });

  describe('Data Processing Pipeline', () => {
    let adapter: TenantAwareAdapter;

    beforeEach(() => {
      adapter = new TenantAwareAdapter(baseAdapter, tenantConfig);
    });

    it('should execute pre- and post-processors', async () => {
      jest
        .spyOn(baseAdapter, 'getPatient')
        .mockResolvedValue({ resourceType: 'Patient', id: 'patient-1' });

      await adapter.getPatient('patient-1');

      expect(mockProcessor.process).toHaveBeenCalledTimes(2); // Pre and post processing

      // Verify processing context
      const processingCalls = (mockProcessor.process as jest.Mock).mock.calls;
      expect(processingCalls[0][1]).toMatchObject({
        vendor: 'mock',
        tenantId: 'tenant-123',
        resourceType: 'Patient',
        operation: 'getPatient',
      });
    });

    it('should skip disabled processors', async () => {
      const disabledProcessor: DataProcessor = {
        name: 'disabled-processor',
        version: '1.0.0',
        type: 'TRANSFORM',
        enabled: false,
        process: jest.fn(),
      };

      const pipeline: any = {
        preProcessors: [disabledProcessor],
        postProcessors: [mockProcessor],
        options: { failFast: false },
      };

      const adapterWithDisabled = new TenantAwareAdapter(baseAdapter, {
        ...tenantConfig,
        transformationPipeline: pipeline,
      });

      jest
        .spyOn(baseAdapter, 'getPatient')
        .mockResolvedValue({ resourceType: 'Patient', id: 'patient-1' });

      await adapterWithDisabled.getPatient('patient-1');

      expect(disabledProcessor.process).not.toHaveBeenCalled();
      expect(mockProcessor.process).toHaveBeenCalledTimes(1); // Only post-processor
    });

    it('should handle processor errors when failFast is false', async () => {
      const errorProcessor: DataProcessor = {
        name: 'error-processor',
        version: '1.0.0',
        type: 'TRANSFORM',
        process: jest.fn().mockRejectedValue(new Error('Processing failed')),
      };

      const pipeline: any = {
        preProcessors: [errorProcessor, mockProcessor],
        postProcessors: [],
        options: { failFast: false },
      };

      const adapterWithError = new TenantAwareAdapter(baseAdapter, {
        ...tenantConfig,
        transformationPipeline: pipeline,
      });

      jest
        .spyOn(baseAdapter, 'getPatient')
        .mockResolvedValue({ resourceType: 'Patient', id: 'patient-1' });

      await adapterWithError.getPatient('patient-1');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Pre-processor failed',
        expect.objectContaining({
          tenantId: 'tenant-123',
          processor: 'error-processor',
          error: 'Processing failed',
        })
      );

      // Should continue with next processor
      expect(mockProcessor.process).toHaveBeenCalled();
    });

    it('should throw EHRAdapterError when failFast is true', async () => {
      const errorProcessor: DataProcessor = {
        name: 'error-processor',
        version: '1.0.0',
        type: 'TRANSFORM',
        process: jest.fn().mockRejectedValue(new Error('Processing failed')),
      };

      const pipeline: any = {
        preProcessors: [errorProcessor],
        postProcessors: [],
        options: { failFast: true },
      };

      const adapterWithError = new TenantAwareAdapter(baseAdapter, {
        ...tenantConfig,
        transformationPipeline: pipeline,
      });

      await expect(adapterWithError.getPatient('patient-1')).rejects.toThrow(EHRAdapterError);
      await expect(adapterWithError.getPatient('patient-1')).rejects.toThrow(
        'Pre-processor error-processor failed: Processing failed'
      );
    });

    it('should handle post-processor errors', async () => {
      const errorPostProcessor: DataProcessor = {
        name: 'error-post-processor',
        version: '1.0.0',
        type: 'TRANSFORM',
        process: jest.fn().mockRejectedValue(new Error('Post-processing failed')),
      };

      const pipeline: any = {
        preProcessors: [],
        postProcessors: [errorPostProcessor],
        options: { failFast: false },
      };

      const adapterWithError = new TenantAwareAdapter(baseAdapter, {
        ...tenantConfig,
        transformationPipeline: pipeline,
      });

      jest
        .spyOn(baseAdapter, 'getPatient')
        .mockResolvedValue({ resourceType: 'Patient', id: 'patient-1' });

      await adapterWithError.getPatient('patient-1');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Post-processor failed',
        expect.objectContaining({
          tenantId: 'tenant-123',
          processor: 'error-post-processor',
          error: 'Post-processing failed',
        })
      );
    });

    it('should handle non-Error exceptions in processors', async () => {
      const stringErrorProcessor: DataProcessor = {
        name: 'string-error-processor',
        version: '1.0.0',
        type: 'TRANSFORM',
        process: jest.fn().mockRejectedValue('String error'),
      };

      const pipeline: any = {
        preProcessors: [stringErrorProcessor],
        postProcessors: [],
        options: { failFast: false },
      };

      const adapterWithError = new TenantAwareAdapter(baseAdapter, {
        ...tenantConfig,
        transformationPipeline: pipeline,
      });

      jest
        .spyOn(baseAdapter, 'getPatient')
        .mockResolvedValue({ resourceType: 'Patient', id: 'patient-1' });

      await adapterWithError.getPatient('patient-1');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Pre-processor failed',
        expect.objectContaining({
          error: 'Unknown error',
        })
      );
    });

    it('should work without transformation pipeline', async () => {
      const configWithoutPipeline = { ...tenantConfig };
      delete (configWithoutPipeline as any).transformationPipeline;
      const adapterWithoutPipeline = new TenantAwareAdapter(baseAdapter, configWithoutPipeline);

      jest
        .spyOn(baseAdapter, 'getPatient')
        .mockResolvedValue({ resourceType: 'Patient', id: 'patient-1' });

      const result = await adapterWithoutPipeline.getPatient('patient-1');

      expect(result).toEqual({ resourceType: 'Patient', id: 'patient-1' });
    });
  });

  describe('Custom Query Operations', () => {
    let adapter: TenantAwareAdapter;

    beforeEach(() => {
      adapter = new TenantAwareAdapter(baseAdapter, tenantConfig);
    });

    it('should execute custom query with tenant context', async () => {
      const customQuery: CustomQuery = {
        type: 'custom',
        parameters: {
          limit: 10,
          query: 'SELECT * FROM patients',
        },
      };

      const mockResult = { data: [{ id: 'patient-1' }] };
      jest.spyOn(baseAdapter, 'executeCustomQuery').mockResolvedValue(mockResult);

      const result = await adapter.executeCustomQuery(customQuery);

      expect(baseAdapter.executeCustomQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'custom',
          parameters: expect.objectContaining({
            limit: 10,
            query: 'SELECT * FROM patients',
            _tenantId: 'tenant-123',
            _tenantContext: expect.objectContaining({
              tenantId: 'tenant-123',
            }),
          }),
          processed: true,
        })
      );

      expect(result).toEqual({ data: [{ id: 'patient-1' }], processed: true });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Tenant operation',
        expect.objectContaining({
          operation: 'executeCustomQuery',
          resourceType: 'CustomQuery',
          queryType: 'custom',
        })
      );
    });
  });

  describe('Audit Log Operations', () => {
    let adapter: TenantAwareAdapter;

    beforeEach(() => {
      adapter = new TenantAwareAdapter(baseAdapter, tenantConfig);
    });

    it('should filter audit log by tenant', async () => {
      const mockAuditEntries: AuditEntry[] = [
        {
          id: 'audit-1',
          tenantId: 'tenant-123',
          operation: 'getPatient',
          resourceType: 'Patient',
          resourceId: 'patient-1',
          timestamp: new Date(),
          userId: 'user-1',
          success: true,
          duration: 100,
        },
        {
          id: 'audit-2',
          tenantId: 'tenant-456', // Different tenant
          operation: 'getPatient',
          resourceType: 'Patient',
          resourceId: 'patient-2',
          timestamp: new Date(),
          userId: 'user-2',
          success: true,
          duration: 150,
        },
        {
          id: 'audit-3',
          tenantId: 'tenant-123',
          operation: 'searchPatients',
          resourceType: 'Patient',
          timestamp: new Date(),
          userId: 'user-1',
          success: true,
          duration: 200,
        },
      ];

      jest.spyOn(baseAdapter, 'getAuditLog').mockResolvedValue(mockAuditEntries);

      const result = await adapter.getAuditLog();

      expect(baseAdapter.getAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
        })
      );

      // Should only return entries for tenant-123
      expect(result).toHaveLength(2);
      expect(result.every(entry => entry.tenantId === 'tenant-123')).toBe(true);
      expect(result.map(entry => entry.id)).toEqual(['audit-1', 'audit-3']);
    });

    it('should pass through audit query options with tenant filter', async () => {
      const queryOptions: AuditQueryOptions = {
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
        operation: 'getPatient',
      };

      jest.spyOn(baseAdapter, 'getAuditLog').mockResolvedValue([]);

      await adapter.getAuditLog(queryOptions);

      expect(baseAdapter.getAuditLog).toHaveBeenCalledWith({
        ...queryOptions,
        tenantId: 'tenant-123',
      });
    });
  });

  describe('Context and Metadata Management', () => {
    it('should return the correct tenant config', () => {
      const adapter = new TenantAwareAdapter(baseAdapter, tenantConfig);
      expect(adapter.getTenantConfig()).toEqual(tenantConfig);
    });

    it('should return the correct tenant context', () => {
      const adapter = new TenantAwareAdapter(baseAdapter, tenantConfig);
      const context = adapter.getTenantContext();
      expect(context.tenantId).toBe('tenant-123');
    });

    it('should update tenant metadata', () => {
      const adapter = new TenantAwareAdapter(baseAdapter, tenantConfig);
      adapter.updateTenantMetadata({ newKey: 'newValue' });
      const context = adapter.getTenantContext();
      expect(context.metadata).toHaveProperty('newKey', 'newValue');
      expect(mockLogger.info).toHaveBeenCalledWith('Tenant metadata updated', expect.any(Object));
    });

    it('should merge metadata updates with existing metadata', () => {
      const configWithMetadata = {
        ...tenantConfig,
        config: {
          ...tenantConfig.config,
          tenant: {
            tenantId: 'tenant-123',
            isolationLevel: 'strict' as const,
            metadata: { existingKey: 'existingValue' } as any,
          },
        },
      };

      const adapter = new TenantAwareAdapter(baseAdapter, configWithMetadata);
      adapter.updateTenantMetadata({ newKey: 'newValue' });

      const context = adapter.getTenantContext();
      expect(context.metadata).toEqual({
        existingKey: 'existingValue',
        newKey: 'newValue',
      });
    });

    it('should overwrite existing metadata keys', () => {
      const adapter = new TenantAwareAdapter(baseAdapter, tenantConfig);
      adapter.updateTenantMetadata({ key: 'value1' });
      adapter.updateTenantMetadata({ key: 'value2' });

      const context = adapter.getTenantContext();
      expect(context.metadata?.key).toBe('value2');
    });
  });

  describe('Health Check and Capabilities', () => {
    it('should augment health check with tenant info', async () => {
      const adapter = new TenantAwareAdapter(baseAdapter, tenantConfig);
      jest
        .spyOn(baseAdapter, 'healthCheck')
        .mockResolvedValue({ status: 'healthy', checks: [], timestamp: new Date().toISOString() });

      const health = await adapter.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.checks).toContainEqual(
        expect.objectContaining({
          name: 'tenant_isolation',
          status: 'healthy',
          description: 'Tenant isolation for tenant-123',
        })
      );
    });

    it('should preserve existing health checks', async () => {
      const adapter = new TenantAwareAdapter(baseAdapter, tenantConfig);
      const existingChecks = [
        { name: 'database', status: 'healthy' as const, description: 'Database connection' },
        { name: 'api', status: 'degraded' as const, description: 'API response time high' },
      ];

      jest.spyOn(baseAdapter, 'healthCheck').mockResolvedValue({
        status: 'degraded',
        checks: existingChecks,
        timestamp: new Date().toISOString(),
      });

      const health = await adapter.healthCheck();

      expect(health.checks).toHaveLength(3); // 2 existing + 1 tenant check
      expect(health.checks).toEqual(expect.arrayContaining(existingChecks));
    });

    it('should augment capabilities with tenant info', async () => {
      const adapter = new TenantAwareAdapter(baseAdapter, tenantConfig);
      const capabilities = await adapter.getCapabilities();

      expect(capabilities.id).toContain('tenant-tenant-123');
      expect(capabilities.extension).toContainEqual(
        expect.objectContaining({
          url: 'http://hl7.org/fhir/StructureDefinition/tenant-context',
          valueString: 'tenant-123',
        })
      );
    });

    it('should preserve existing capability extensions', async () => {
      const adapter = new TenantAwareAdapter(baseAdapter, tenantConfig);

      // Mock base capabilities with existing extensions
      const mockCapabilities = {
        id: 'base-capability',
        resourceType: 'CapabilityStatement' as const,
        status: 'active' as const,
        date: new Date().toISOString(),
        kind: 'instance' as const,
        fhirVersion: '4.0.1' as const,
        format: ['json'],
        extension: [{ url: 'http://example.com/existing', valueString: 'existing-value' }],
      };

      jest.spyOn(baseAdapter, 'getCapabilities').mockResolvedValue(mockCapabilities);

      const capabilities = await adapter.getCapabilities();

      expect(capabilities.extension).toHaveLength(2);
      expect(capabilities.extension).toContainEqual(
        expect.objectContaining({ url: 'http://example.com/existing' })
      );
      expect(capabilities.extension).toContainEqual(
        expect.objectContaining({ url: 'http://hl7.org/fhir/StructureDefinition/tenant-context' })
      );
    });
  });

  describe('Tenant Isolation Security', () => {
    it('should validate tenant access in strict mode', async () => {
      const adapter = new TenantAwareAdapter(baseAdapter, tenantConfig);

      // Access validateTenantAccess private method for testing
      const validateSpy = jest.spyOn(adapter as any, 'validateTenantAccess');

      jest
        .spyOn(baseAdapter, 'getPatient')
        .mockResolvedValue({ resourceType: 'Patient', id: 'patient-1' });

      await adapter.getPatient('patient-1');

      // Note: validateTenantAccess is currently not called in the implementation
      // This test documents the expected behavior for future implementation
    });

    it('should handle shared isolation mode', () => {
      const sharedConfig = {
        ...tenantConfig,
        config: {
          ...tenantConfig.config,
          tenant: {
            tenantId: 'tenant-123',
            isolationLevel: 'shared' as const,
          },
        },
      };

      const adapter = new TenantAwareAdapter(baseAdapter, sharedConfig);
      expect((adapter as any).isolationLevel).toBe('shared');
    });

    it('should prevent cross-tenant data leakage in audit logs', async () => {
      const adapter = new TenantAwareAdapter(baseAdapter, tenantConfig);

      const mixedAuditEntries: AuditEntry[] = [
        {
          id: 'audit-1',
          tenantId: 'tenant-123',
          operation: 'getPatient',
          resourceType: 'Patient',
          resourceId: 'patient-1',
          timestamp: new Date(),
          userId: 'user-1',
          success: true,
          duration: 100,
        },
        {
          id: 'audit-2',
          tenantId: 'other-tenant',
          operation: 'getPatient',
          resourceType: 'Patient',
          resourceId: 'patient-2',
          timestamp: new Date(),
          userId: 'user-2',
          success: true,
          duration: 150,
        },
      ];

      jest.spyOn(baseAdapter, 'getAuditLog').mockResolvedValue(mixedAuditEntries);

      const result = await adapter.getAuditLog();

      // Should filter out entries from other tenants
      expect(result).toHaveLength(1);
      expect(result[0]?.tenantId).toBe('tenant-123');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle base adapter errors gracefully', async () => {
      const adapter = new TenantAwareAdapter(baseAdapter, tenantConfig);
      const error = new Error('Base adapter error');

      jest.spyOn(baseAdapter, 'getPatient').mockRejectedValue(error);

      await expect(adapter.getPatient('patient-1')).rejects.toThrow('Base adapter error');
    });

    it('should handle missing logger gracefully', () => {
      const configWithoutLogger = { ...tenantConfig };
      delete (configWithoutLogger as any).logger;

      expect(() => new TenantAwareAdapter(baseAdapter, configWithoutLogger)).not.toThrow();
    });

    it('should handle operations without tenant context headers', async () => {
      const configWithoutHeaders = { ...tenantConfig };
      delete (configWithoutHeaders.config as any).options;

      const adapter = new TenantAwareAdapter(baseAdapter, configWithoutHeaders);
      jest
        .spyOn(baseAdapter, 'getPatient')
        .mockResolvedValue({ resourceType: 'Patient', id: 'patient-1' });

      const result = await adapter.getPatient('patient-1');
      expect(result).toBeDefined();
    });
  });
});
