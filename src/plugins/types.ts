/**
 * Plugin Types for EHR Adapter SDK
 *
 * Defines interfaces and types for the extensible plugin system
 * that allows custom data transformations, FHIR extensions, and vendor-specific customizations.
 */

import { LoggerInterface } from '../../src/logging/LoggerInterface';
// SecurityProvider is available in the commercial version
// import type { SecurityProvider } from '@ehr-adapter-pro/security';

// Base plugin interface
export interface AdapterPlugin {
  name: string;
  version: string;
  vendor?: string; // Optional vendor-specific plugin
  description?: string;
  author?: string;
  license?: string;
  dependencies?: PluginDependency[];

  // Plugin capabilities
  capabilities?: PluginCapabilities;

  // FHIR Resource Extensions
  extendResource?(resourceType: string, resource: any, context: PluginContext): any;

  // Custom Data Processors
  processors?: DataProcessor[];

  // Custom Query Handlers
  queryHandlers?: Record<string, QueryHandler>;

  // Security Extensions
  // SecurityProvider is available in the commercial version
  // securityProviders?: SecurityProvider[];

  // Lifecycle Hooks
  onInitialize?(context: PluginContext): Promise<void>;
  onBeforeRequest?(context: RequestContext): Promise<void>;
  onAfterResponse?(context: ResponseContext): Promise<void>;
  onError?(error: Error, context: ErrorContext): Promise<void>;
  onDestroy?(context: PluginContext): Promise<void>;

  // Configuration
  configure?(config: PluginConfig): Promise<void>;
  validate?(config: PluginConfig): Promise<PluginValidationResult>;
}

// Plugin dependency specification
export interface PluginDependency {
  name: string;
  version: string;
  optional?: boolean;
  reason?: string;
}

// Plugin capabilities declaration
export interface PluginCapabilities {
  resourceExtensions?: string[]; // FHIR resource types this plugin can extend
  dataProcessing?: DataProcessingCapability[];
  queryHandling?: QueryHandlingCapability[];
  security?: SecurityCapability[];
  vendors?: string[]; // Supported vendors
  environments?: ('development' | 'staging' | 'production')[];
}

export interface DataProcessingCapability {
  type: 'PRE_PROCESS' | 'POST_PROCESS' | 'TRANSFORM' | 'VALIDATE';
  resourceTypes?: string[];
  operations?: string[];
  description?: string;
}

export interface QueryHandlingCapability {
  queryType: string;
  description?: string;
  parameters?: QueryParameter[];
}

export interface QueryParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  description?: string;
  defaultValue?: any;
}

export interface SecurityCapability {
  type: 'ENCRYPTION' | 'SIGNING' | 'VALIDATION' | 'COMPLIANCE';
  algorithms?: string[];
  description?: string;
}

// Plugin context interfaces
export interface PluginContext {
  tenantId: string;
  vendor: string;
  logger: LoggerInterface;
  config?: PluginConfig;
  metadata?: Record<string, any>;
}

export interface RequestContext extends PluginContext {
  operation: string;
  resourceType?: string;
  resourceId?: string;
  patientId?: string;
  requestId: string;
  headers: Record<string, string>;
  body?: any;
  query?: Record<string, any>;
  timestamp: Date;
}

export interface ResponseContext extends PluginContext {
  operation: string;
  resourceType?: string;
  resourceId?: string;
  patientId?: string;
  requestId: string;
  statusCode: number;
  headers: Record<string, string>;
  body?: any;
  responseTime: number;
  timestamp: Date;
}

export interface ErrorContext extends PluginContext {
  operation: string;
  resourceType?: string;
  resourceId?: string;
  patientId?: string;
  requestId?: string;
  error: Error;
  retryAttempt?: number;
  timestamp: Date;
}

// Data processor interface
export interface DataProcessor {
  name: string;
  version: string;
  type: 'PRE_PROCESS' | 'POST_PROCESS' | 'TRANSFORM' | 'VALIDATE';
  enabled?: boolean;
  priority?: number; // Lower numbers run first
  config?: Record<string, any>;

  process<T>(data: T, context: ProcessingContext): Promise<T>;
  validate?(data: any, context: ProcessingContext): Promise<ValidationResult>;
}

export interface ProcessingContext {
  vendor: string;
  tenantId: string;
  resourceType: string;
  operation: string;
  logger: LoggerInterface;
  // SecurityProvider is available in the commercial version
  // security?: SecurityProvider;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

// Query handler interface
export interface QueryHandler {
  name: string;
  version: string;
  description?: string;
  parameters?: QueryParameter[];

  execute(query: CustomQuery, context: QueryContext): Promise<any>;
  validate?(query: CustomQuery): Promise<QueryValidationResult>;
}

export interface CustomQuery {
  type: string;
  parameters: Record<string, any>;
  options?: QueryOptions;
}

export interface QueryOptions {
  timeout?: number;
  retries?: number;
  cache?: boolean;
  cacheTTL?: number;
  metadata?: Record<string, any>;
}

export interface QueryContext {
  vendor: string;
  tenantId: string;
  logger: LoggerInterface;
  // SecurityProvider is available in the commercial version
  // security?: SecurityProvider;
  requestId?: string;
}

export interface QueryValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Plugin configuration
export interface PluginConfig {
  enabled: boolean;
  priority?: number;
  settings?: Record<string, any>;
  overrides?: Record<string, any>; // Tenant-specific overrides
  environment?: 'development' | 'staging' | 'production';
  debug?: boolean;
}

export interface PluginValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredSettings?: string[];
}

// Plugin manager interface
export interface PluginManager {
  /**
   * Register a plugin
   */
  register(plugin: AdapterPlugin, config?: PluginConfig): Promise<void>;

  /**
   * Unregister a plugin
   */
  unregister(pluginName: string): Promise<void>;

  /**
   * Get a registered plugin
   */
  getPlugin(pluginName: string): AdapterPlugin | null;

  /**
   * Get all registered plugins
   */
  getPlugins(): AdapterPlugin[];

  /**
   * Get plugins by vendor
   */
  getPluginsByVendor(vendor: string): AdapterPlugin[];

  /**
   * Get plugins by capability
   */
  getPluginsByCapability(capability: string): AdapterPlugin[];

  /**
   * Execute resource extensions
   */
  executeResourceExtensions(
    resourceType: string,
    resource: any,
    context: PluginContext
  ): Promise<any>;

  /**
   * Execute data processors
   */
  executeProcessors(
    type: 'PRE_PROCESS' | 'POST_PROCESS',
    data: any,
    context: ProcessingContext
  ): Promise<any>;

  /**
   * Execute query handlers
   */
  executeQueryHandler(query: CustomQuery, context: QueryContext): Promise<any>;

  /**
   * Execute lifecycle hooks
   */
  executeLifecycleHook(
    hook: 'onInitialize' | 'onBeforeRequest' | 'onAfterResponse' | 'onError' | 'onDestroy',
    context: any
  ): Promise<void>;
}

// Built-in plugin types
export interface LOINCMappingPlugin extends AdapterPlugin {
  name: 'loinc-mapper';
  mapToLOINC(coding: any[]): Promise<any[]>;
  getLOINCCode(localCode: string, system: string): Promise<string | null>;
}

export interface SNOMEDMappingPlugin extends AdapterPlugin {
  name: 'snomed-mapper';
  mapToSNOMED(data: any): Promise<any>;
  getSNOMEDCode(localCode: string, system: string): Promise<string | null>;
}

export interface CompliancePlugin extends AdapterPlugin {
  name: 'compliance-auditor';
  auditAccess(resource: string, action: string, context: PluginContext): Promise<void>;
  validateCompliance(data: any, rules: ComplianceRule[]): Promise<ComplianceResult>;
}

export interface ComplianceRule {
  name: string;
  description: string;
  type: 'HIPAA' | 'GDPR' | 'SOC2' | 'CUSTOM';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  validate(data: any, context: any): Promise<boolean>;
}

export interface ComplianceResult {
  compliant: boolean;
  violations: ComplianceViolation[];
  score?: number; // 0-100
}

export interface ComplianceViolation {
  rule: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  field?: string;
  value?: any;
  remediation?: string;
}

// Vendor-specific plugin interfaces
export interface EpicPlugin extends AdapterPlugin {
  vendor: 'epic';
  extendPatient?(patient: any): any;
  extendObservation?(observation: any): any;
  extendAppointment?(appointment: any): any;
  handleMyChartData?(data: any): any;
}

export interface AthenaPlugin extends AdapterPlugin {
  vendor: 'athena';
  extendPatient?(patient: any): any;
  extendAppointment?(appointment: any): any;
  handleInsuranceData?(data: any): any;
  handlePracticeData?(data: any): any;
}

export interface CernerPlugin extends AdapterPlugin {
  vendor: 'cerner';
  extendPatient?(patient: any): any;
  extendObservation?(observation: any): any;
  handlePowerChartData?(data: any): any;
}

// Plugin registry and discovery
export interface PluginRegistry {
  /**
   * Discover available plugins
   */
  discover(): Promise<PluginDescriptor[]>;

  /**
   * Install a plugin
   */
  install(descriptor: PluginDescriptor): Promise<AdapterPlugin>;

  /**
   * Uninstall a plugin
   */
  uninstall(pluginName: string): Promise<void>;

  /**
   * Update a plugin
   */
  update(pluginName: string, version?: string): Promise<AdapterPlugin>;

  /**
   * Get plugin metadata
   */
  getMetadata(pluginName: string): Promise<PluginMetadata | null>;
}

export interface PluginDescriptor {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  repository?: string;
  homepage?: string;
  keywords?: string[];
  dependencies?: PluginDependency[];
  capabilities?: PluginCapabilities;
  installSize?: number;
  downloadCount?: number;
  rating?: number;
  lastUpdated?: Date;
}

export interface PluginMetadata {
  name: string;
  version: string;
  installedAt: Date;
  lastUsed?: Date;
  usageCount?: number;
  performance?: PluginPerformanceMetrics;
  errors?: PluginErrorMetrics;
}

export interface PluginPerformanceMetrics {
  averageExecutionTime: number; // milliseconds
  totalExecutions: number;
  slowestExecution: number;
  fastestExecution: number;
  memoryUsage?: number; // bytes
}

export interface PluginErrorMetrics {
  totalErrors: number;
  errorRate: number; // percentage
  lastError?: Date;
  commonErrors: Record<string, number>;
}

// Plugin development utilities
export interface PluginBuilder {
  name(name: string): PluginBuilder;
  version(version: string): PluginBuilder;
  vendor(vendor: string): PluginBuilder;
  description(description: string): PluginBuilder;
  author(author: string): PluginBuilder;
  license(license: string): PluginBuilder;
  dependency(name: string, version: string, optional?: boolean): PluginBuilder;
  capability(capability: PluginCapabilities): PluginBuilder;
  processor(processor: DataProcessor): PluginBuilder;
  queryHandler(name: string, handler: QueryHandler): PluginBuilder;
  resourceExtension(
    resourceType: string,
    extender: (resource: any, context: PluginContext) => any
  ): PluginBuilder;
  lifecycleHook(hook: string, handler: (context: any) => Promise<void>): PluginBuilder;
  build(): AdapterPlugin;
}

// Plugin testing utilities
export interface PluginTestSuite {
  /**
   * Test plugin initialization
   */
  testInitialization(plugin: AdapterPlugin, config?: PluginConfig): Promise<TestResult>;

  /**
   * Test resource extensions
   */
  testResourceExtensions(
    plugin: AdapterPlugin,
    testCases: ResourceExtensionTestCase[]
  ): Promise<TestResult>;

  /**
   * Test data processors
   */
  testDataProcessors(
    plugin: AdapterPlugin,
    testCases: DataProcessorTestCase[]
  ): Promise<TestResult>;

  /**
   * Test query handlers
   */
  testQueryHandlers(plugin: AdapterPlugin, testCases: QueryHandlerTestCase[]): Promise<TestResult>;

  /**
   * Test lifecycle hooks
   */
  testLifecycleHooks(
    plugin: AdapterPlugin,
    testCases: LifecycleHookTestCase[]
  ): Promise<TestResult>;

  /**
   * Run full plugin test suite
   */
  runFullSuite(plugin: AdapterPlugin): Promise<PluginTestReport>;
}

export interface TestResult {
  passed: boolean;
  message?: string;
  details?: any;
}

export interface ResourceExtensionTestCase {
  resourceType: string;
  input: any;
  expected: any;
  context?: PluginContext;
}

export interface DataProcessorTestCase {
  type: 'PRE_PROCESS' | 'POST_PROCESS' | 'TRANSFORM' | 'VALIDATE';
  input: any;
  expected: any;
  context: ProcessingContext;
}

export interface QueryHandlerTestCase {
  query: CustomQuery;
  expected: any;
  context: QueryContext;
}

export interface LifecycleHookTestCase {
  hook: 'onInitialize' | 'onBeforeRequest' | 'onAfterResponse' | 'onError' | 'onDestroy';
  context: any;
  expectedError?: boolean;
}

export interface PluginTestReport {
  pluginName: string;
  pluginVersion: string;
  results: {
    initialization: TestResult;
    resourceExtensions: TestResult;
    dataProcessors: TestResult;
    queryHandlers: TestResult;
    lifecycleHooks: TestResult;
  };
  coverage?: number; // Optional code coverage
}

// Marketplace related types
export interface PluginMarketplace {
  search(query: string, filters?: PluginSearchFilters): Promise<PluginDescriptor[]>;
  getPluginDetails(name: string): Promise<PluginDescriptor>;
  getFeaturedPlugins(): Promise<PluginDescriptor[]>;
  getPopularPlugins(): Promise<PluginDescriptor[]>;
  submitPlugin(descriptor: PluginDescriptor, packageUrl: string): Promise<void>;
}

export interface PluginSearchFilters {
  category?: string;
  vendor?: string;
  rating?: number;
  sort?: 'popularity' | 'rating' | 'updated';
}

export interface PluginLicense {
  type: 'MIT' | 'Apache-2.0' | 'GPL-3.0' | 'Proprietary' | 'Custom';
  url?: string;
  price?: number;
  tier?: 'Free' | 'Pro' | 'Enterprise';
}
