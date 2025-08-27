/**
 * Core EHR Adapter Interface
 *
 * Defines the main interface that all EHR vendor adapters must implement.
 * Provides a unified API for accessing patient data, clinical information,
 * appointments, and other healthcare resources across different EHR systems.
 */

import { Patient, Observation, Appointment, MedicationRequest, CapabilityStatement, Bundle, PatientSearchCriteria, QueryOptions, HealthStatus, AllergyIntolerance, Condition, Procedure, Immunization, Practitioner, Organization } from '../types/fhir';
import type { CustomQuery } from '../plugins/types';

// Audit log entry interface
export interface AuditEntry {
  id: string;
  timestamp: Date;
  tenantId?: string;
  userId?: string;
  operation: string;
  resourceType?: string;
  resourceId?: string;
  patientId?: string;
  success: boolean;
  duration: number; // milliseconds
  ipAddress?: string;
  userAgent?: string;
  error?: string;
  metadata?: Record<string, any>;
}

// Audit query options
export interface AuditQueryOptions {
  startDate?: Date;
  endDate?: Date;
  tenantId?: string;
  userId?: string;
  operation?: string;
  resourceType?: string;
  patientId?: string;
  success?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Main EHR Adapter Interface
 *
 * All vendor-specific adapters must implement this interface to ensure
 * consistent behavior across different EHR systems.
 */
export interface EHRAdapter {
  // Metadata
  readonly vendor: string;
  readonly version: string;
  readonly supportedFHIRVersion: string;

  // Patient Operations
  /**
   * Retrieve a patient by ID
   * @param patientId - The patient identifier
   * @param options - Query options for customization
   * @returns Promise resolving to Patient resource
   */
  getPatient(patientId: string, options?: QueryOptions): Promise<Patient>;

  /**
   * Search for patients based on criteria
   * @param criteria - Search criteria for finding patients
   * @param options - Query options for pagination and filtering
   * @returns Promise resolving to array of Patient resources
   */
  searchPatients(criteria: PatientSearchCriteria, options?: QueryOptions): Promise<Patient[]>;

  /**
   * Get patient demographics summary
   * @param patientId - The patient identifier
   * @returns Promise resolving to patient demographics
   */
  getPatientDemographics?(patientId: string): Promise<PatientDemographics>;

  // Clinical Data Operations
  /**
   * Retrieve vital signs for a patient
   * @param patientId - The patient identifier
   * @param options - Query options for date range and filtering
   * @returns Promise resolving to array of Observation resources
   */
  getVitals(patientId: string, options?: QueryOptions): Promise<Observation[]>;

  /**
   * Retrieve laboratory results for a patient
   * @param patientId - The patient identifier
   * @param options - Query options for date range and filtering
   * @returns Promise resolving to array of Observation resources
   */
  getLabs(patientId: string, options?: QueryOptions): Promise<Observation[]>;

  /**
   * Retrieve medications for a patient
   * @param patientId - The patient identifier
   * @param options - Query options for date range and filtering
   * @returns Promise resolving to array of MedicationRequest resources
   */
  getMedications(patientId: string, options?: QueryOptions): Promise<MedicationRequest[]>;

  /**
   * Retrieve allergies for a patient
   * @param patientId - The patient identifier
   * @param options - Query options for filtering
   * @returns Promise resolving to array of AllergyIntolerance resources
   */
  getAllergies?(patientId: string, options?: QueryOptions): Promise<AllergyIntolerance[]>;

  /**
   * Retrieve conditions/diagnoses for a patient
   * @param patientId - The patient identifier
   * @param options - Query options for date range and filtering
   * @returns Promise resolving to array of Condition resources
   */
  getConditions?(patientId: string, options?: QueryOptions): Promise<Condition[]>;

  /**
   * Retrieve procedures for a patient
   * @param patientId - The patient identifier
   * @param options - Query options for date range and filtering
   * @returns Promise resolving to array of Procedure resources
   */
  getProcedures?(patientId: string, options?: QueryOptions): Promise<Procedure[]>;

  /**
   * Retrieve immunizations for a patient
   * @param patientId - The patient identifier
   * @param options - Query options for date range and filtering
   * @returns Promise resolving to array of Immunization resources
   */
  getImmunizations?(patientId: string, options?: QueryOptions): Promise<Immunization[]>;

  // Scheduling Operations
  /**
   * Retrieve appointments for a patient
   * @param patientId - The patient identifier
   * @param options - Query options for date range and filtering
   * @returns Promise resolving to array of Appointment resources
   */
  getAppointments(patientId: string, options?: QueryOptions): Promise<Appointment[]>;

  /**
   * Create a new appointment
   * @param appointment - The appointment data
   * @returns Promise resolving to created Appointment resource
   */
  createAppointment?(appointment: Partial<Appointment>): Promise<Appointment>;

  /**
   * Update an existing appointment
   * @param appointmentId - The appointment identifier
   * @param updates - The appointment updates
   * @returns Promise resolving to updated Appointment resource
   */
  updateAppointment?(appointmentId: string, updates: Partial<Appointment>): Promise<Appointment>;

  /**
   * Cancel an appointment
   * @param appointmentId - The appointment identifier
   * @param reason - Cancellation reason
   * @returns Promise resolving to cancelled Appointment resource
   */
  cancelAppointment?(appointmentId: string, reason?: string): Promise<Appointment>;

  /**
   * Get available appointment slots
   * @param criteria - Search criteria for available slots
   * @returns Promise resolving to available slots
   */
  getAvailableSlots?(criteria: SlotSearchCriteria): Promise<AppointmentSlot[]>;

  // Provider Operations
  /**
   * Retrieve provider information
   * @param providerId - The provider identifier
   * @returns Promise resolving to Practitioner resource
   */
  getProvider?(providerId: string): Promise<Practitioner>;

  /**
   * Search for providers
   * @param criteria - Search criteria for providers
   * @returns Promise resolving to array of Practitioner resources
   */
  searchProviders?(criteria: ProviderSearchCriteria): Promise<Practitioner[]>;

  // Organization Operations
  /**
   * Retrieve organization information
   * @param organizationId - The organization identifier
   * @returns Promise resolving to Organization resource
   */
  getOrganization?(organizationId: string): Promise<Organization>;

  // Bulk Data Operations
  /**
   * Export patient data in bulk
   * @param criteria - Export criteria
   * @returns Promise resolving to export job information
   */
  exportPatientData?(criteria: BulkExportCriteria): Promise<BulkExportJob>;

  /**
   * Get bulk export job status
   * @param jobId - The export job identifier
   * @returns Promise resolving to job status
   */
  getBulkExportStatus?(jobId: string): Promise<BulkExportStatus>;

  // System Operations
  /**
   * Get EHR system capabilities
   * @returns Promise resolving to CapabilityStatement
   */
  getCapabilities(): Promise<CapabilityStatement>;

  /**
   * Perform health check on the EHR system
   * @returns Promise resolving to health status
   */
  healthCheck(): Promise<HealthStatus>;

  /**
   * Get system metadata and version information
   * @returns Promise resolving to system metadata
   */
  getMetadata?(): Promise<SystemMetadata>;

  // Advanced Operations
  /**
   * Execute a custom query
   * @param query - The custom query to execute
   * @returns Promise resolving to query results
   */
  executeCustomQuery<T>(query: CustomQuery): Promise<T>;

  /**
   * Perform a FHIR search operation
   * @param resourceType - The FHIR resource type to search
   * @param searchParams - Search parameters
   * @returns Promise resolving to Bundle with search results
   */
  search?(resourceType: string, searchParams: Record<string, any>): Promise<Bundle>;

  /**
   * Create a FHIR resource
   * @param resourceType - The FHIR resource type
   * @param resource - The resource data
   * @returns Promise resolving to created resource
   */
  create?<T>(resourceType: string, resource: T): Promise<T>;

  /**
   * Update a FHIR resource
   * @param resourceType - The FHIR resource type
   * @param resourceId - The resource identifier
   * @param resource - The updated resource data
   * @returns Promise resolving to updated resource
   */
  update?<T>(resourceType: string, resourceId: string, resource: T): Promise<T>;

  /**
   * Delete a FHIR resource
   * @param resourceType - The FHIR resource type
   * @param resourceId - The resource identifier
   * @returns Promise resolving to operation outcome
   */
  delete?(resourceType: string, resourceId: string): Promise<void>;

  // Audit and Logging
  /**
   * Retrieve audit log entries
   * @param options - Query options for filtering audit logs
   * @returns Promise resolving to array of audit entries
   */
  getAuditLog(options?: AuditQueryOptions): Promise<AuditEntry[]>;

  /**
   * Log an audit event
   * @param entry - The audit entry to log
   * @returns Promise resolving when audit is logged
   */
  logAuditEvent?(entry: Partial<AuditEntry>): Promise<void>;

  // Connection Management
  /**
   * Test connection to the EHR system
   * @returns Promise resolving to connection status
   */
  testConnection?(): Promise<ConnectionStatus>;

  /**
   * Disconnect from the EHR system
   * @returns Promise resolving when disconnected
   */
  disconnect?(): Promise<void>;

  /**
   * Reconnect to the EHR system
   * @returns Promise resolving when reconnected
   */
  reconnect?(): Promise<void>;
}

// Supporting interfaces
export interface PatientDemographics {
  id: string;
  name: string;
  dateOfBirth: string;
  gender: string;
  address?: string;
  phone?: string;
  email?: string;
  emergencyContact?: EmergencyContact;
  insurance?: InsuranceInfo[];
  primaryCareProvider?: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

export interface InsuranceInfo {
  planName: string;
  memberId: string;
  groupNumber?: string;
  effectiveDate?: string;
  terminationDate?: string;
  copay?: number;
  deductible?: number;
}

export interface SlotSearchCriteria {
  providerId?: string;
  serviceType?: string;
  startDate: Date;
  endDate: Date;
  duration?: number; // minutes
  location?: string;
}

export interface AppointmentSlot {
  id: string;
  start: Date;
  end: Date;
  duration: number; // minutes
  providerId: string;
  providerName: string;
  serviceType?: string;
  location?: string;
  available: boolean;
}

export interface ProviderSearchCriteria {
  name?: string;
  specialty?: string;
  location?: string;
  organization?: string;
  active?: boolean;
}

export interface BulkExportCriteria {
  resourceTypes?: string[];
  since?: Date;
  patientIds?: string[];
  groupId?: string;
  format?: 'ndjson' | 'json' | 'csv';
}

export interface BulkExportJob {
  id: string;
  status: 'queued' | 'in-progress' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  resourceCount?: number;
  downloadUrls?: string[];
  error?: string;
}

export interface BulkExportStatus {
  id: string;
  status: 'queued' | 'in-progress' | 'completed' | 'failed';
  progress?: number; // 0-100
  estimatedCompletion?: Date;
  resourcesProcessed?: number;
  totalResources?: number;
  error?: string;
}

export interface SystemMetadata {
  vendor: string;
  version: string;
  fhirVersion: string;
  implementation: string;
  capabilities: string[];
  endpoints: Record<string, string>;
  lastUpdated: Date;
  supportContact?: string;
  documentation?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  latency?: number; // milliseconds
  lastChecked: Date;
  error?: string;
  metadata?: Record<string, any>;
}

// Adapter lifecycle interface
export interface AdapterLifecycle {
  /**
   * Initialize the adapter
   * @param config - Adapter configuration
   * @returns Promise resolving when initialized
   */
  initialize?(config: unknown): Promise<void>;

  /**
   * Start the adapter
   * @returns Promise resolving when started
   */
  start?(): Promise<void>;

  /**
   * Stop the adapter
   * @returns Promise resolving when stopped
   */
  stop?(): Promise<void>;

  /**
   * Destroy the adapter and clean up resources
   * @returns Promise resolving when destroyed
   */
  destroy?(): Promise<void>;
}

// Adapter events interface
export interface AdapterEvents {
  /**
   * Emitted when a request is made
   */
  onRequest?(_event: RequestEvent): void;

  /**
   * Emitted when a response is received
   */
  onResponse?(_event: ResponseEvent): void;

  /**
   * Emitted when an error occurs
   */
  onError?(_event: ErrorEvent): void;

  /**
   * Emitted when authentication is required
   */
  onAuthRequired?(_event: AuthEvent): void;

  /**
   * Emitted when rate limit is hit
   */
  onRateLimit?(_event: RateLimitEvent): void;
}

export interface RequestEvent {
  requestId: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  timestamp: Date;
  tenantId?: string;
  userId?: string;
}

export interface ResponseEvent {
  requestId: string;
  statusCode: number;
  headers: Record<string, string>;
  body?: unknown;
  duration: number; // milliseconds
  timestamp: Date;
  cached?: boolean;
}

export interface ErrorEvent {
  requestId?: string;
  error: Error;
  context?: Record<string, any>;
  timestamp: Date;
  retryAttempt?: number;
}

export interface AuthEvent {
  type: 'token_expired' | 'invalid_credentials' | 'auth_required';
  timestamp: Date;
  tenantId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface RateLimitEvent {
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
  timestamp: Date;
}

// Adapter statistics interface
export interface AdapterStatistics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number; // milliseconds
  totalDataTransferred: number; // bytes
  cacheHitRate?: number; // percentage
  uptime: number; // milliseconds
  lastActivity: Date;
  errorsByType: Record<string, number>;
  requestsByEndpoint: Record<string, number>;
}
