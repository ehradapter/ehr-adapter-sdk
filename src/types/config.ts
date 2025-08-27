/**
 * Configuration Types for EHR Adapter SDK
 *
 * Defines configuration interfaces for adapters, plugins, logging,
 * security, and multi-tenant setups.
 */

import { AuthConfig, TenantContext } from './auth';
import { LoggerInterface } from '../logging/LoggerInterface';
// SecurityProvider is available in the commercial version
// import type { SecurityProvider } from '@ehr-adapter-pro/security';
import type { AdapterPlugin } from '../plugins/types';

// Main adapter configuration
export interface AdapterConfig {
  vendor: string;
  baseUrl: string;
  auth: AuthConfig;
  options?: AdapterOptions;
  tenant?: TenantConfig;
  // SecurityProvider is available in the commercial version
  // security?: SecurityProvider;
  plugins?: AdapterPlugin[];
  logger?: LoggerInterface;
  // Additional properties for adapter.config.ts compatibility
  environment?: 'development' | 'staging' | 'production' | 'testing' | 'preview' | 'sandbox';
  vendors?: Record<string, VendorConfig>;
  retry?: RetryConfig;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  timeout?: number;
  cache?: CacheConfig;
  tenants?: Record<string, Partial<AdapterConfig>>;
}

// Adapter options and settings
export interface AdapterOptions {
  timeout?: number; // Request timeout in milliseconds
  retries?: number; // Number of retry attempts
  retryDelay?: number; // Base retry delay in milliseconds
  rateLimit?: RateLimitConfig;
  headers?: Record<string, string>; // Default headers
  userAgent?: string;
  validateSSL?: boolean;
  followRedirects?: boolean;
  maxRedirects?: number;
  compression?: boolean;
  keepAlive?: boolean;
  maxSockets?: number;
  debug?: boolean;
  dryRun?: boolean; // For testing without making actual requests
}

// Rate limiting configuration
export interface RateLimitConfig {
  requests: number; // Number of requests
  window: number; // Time window in milliseconds
  burst?: number; // Burst allowance
  strategy?: 'fixed' | 'sliding' | 'token-bucket';
}

// Tenant-specific configuration
export interface TenantConfig {
  tenantId: string;
  isolationLevel: 'strict' | 'shared';
  customFields?: Record<string, any>;
  overrides?: Partial<AdapterConfig>; // Tenant-specific overrides
  metadata?: TenantMetadata;
}

export interface TenantMetadata {
  name?: string;
  description?: string;
  environment?: 'sandbox' | 'production' | 'staging' | 'development';
  region?: string;
  timezone?: string;
  locale?: string;
  features?: string[]; // Enabled features for this tenant
  limits?: TenantLimits;
  contacts?: TenantContact[];
  tags?: Record<string, string>;
}

export interface TenantLimits {
  maxRequestsPerMinute?: number;
  maxRequestsPerHour?: number;
  maxRequestsPerDay?: number;
  maxConcurrentRequests?: number;
  maxDataRetentionDays?: number;
  maxPlugins?: number;
}

export interface TenantContact {
  type: 'technical' | 'business' | 'billing' | 'security';
  name: string;
  email: string;
  phone?: string;
  role?: string;
}

// Multi-tenant adapter configuration
export interface TenantAdapterConfig {
  tenantId: string;
  config: AdapterConfig;
  plugins?: AdapterPlugin[];
  logger?: LoggerInterface;
  // SecurityProvider is available in the commercial version
  // security?: SecurityProvider;
  transformationPipeline?: TransformationPipeline;
  context?: TenantContext;
}

// Transformation pipeline configuration
export interface TransformationPipeline {
  preProcessors: DataProcessor[];
  postProcessors: DataProcessor[];
  options?: TransformationOptions;
}

export interface DataProcessor {
  name: string;
  version: string;
  enabled?: boolean;
  config?: Record<string, any>;
  process<T>(data: T, _context: ProcessingContext): Promise<T>;
}

export interface ProcessingContext {
  vendor: string;
  tenantId: string;
  resourceType: string;
  operation: string;
  logger: LoggerInterface;
  // SecurityProvider is available in the commercial version
  // security?: SecurityProvider;
  metadata?: Record<string, any>;
}

export interface TransformationOptions {
  parallel?: boolean; // Process transformations in parallel
  failFast?: boolean; // Stop on first transformation error
  timeout?: number; // Transformation timeout in milliseconds
  retries?: number; // Retry failed transformations
}

// Vendor-specific configurations
export interface EpicConfig extends AdapterConfig {
  vendor: 'epic';
  sandboxMode?: boolean;
  fhirVersion?: 'R4' | 'STU3' | 'DSTU2';
  smartLaunch?: boolean;
  patientContext?: string;
  encounterContext?: string;
  extensions?: EpicExtensions;
}

export interface EpicExtensions {
  myChart?: boolean;
  haiku?: boolean;
  canto?: boolean;
  hyperspace?: boolean;
  welcomeExtensions?: boolean;
}

export interface AthenaConfig extends AdapterConfig {
  vendor: 'athena';
  practiceId: string;
  version?: string; // API version
  environment?: 'preview' | 'production';
  extensions?: AthenaExtensions;
}

export interface AthenaExtensions {
  patientEngagement?: boolean;
  careManagement?: boolean;
  populationHealth?: boolean;
  qualityReporting?: boolean;
  financialManagement?: boolean;
}

export interface CernerConfig extends AdapterConfig {
  vendor: 'cerner';
  tenantId?: string;
  environment?: 'sandbox' | 'production';
  fhirVersion?: 'R4' | 'STU3';
  extensions?: CernerExtensions;
}

export interface CernerExtensions {
  powerChart?: boolean;
  healtheLife?: boolean;
  realTime?: boolean;
  smartOnFhir?: boolean;
}

export interface MockConfig extends AdapterConfig {
  vendor: 'mock';
  delay?: number; // Simulated response delay in milliseconds
  errorRate?: number; // Percentage of requests that should fail (0-100)
  dataSet?: 'minimal' | 'standard' | 'comprehensive';
  patientCount?: number;
  randomSeed?: string; // For reproducible test data
  extensions?: MockExtensions;
}

export interface MockExtensions {
  simulateRateLimit?: boolean;
  simulateNetworkErrors?: boolean;
  simulateAuthErrors?: boolean;
  simulateDataInconsistencies?: boolean;
}

// Logging configuration
export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text' | 'structured';
  destination?: 'console' | 'file' | 'remote';
  file?: LogFileConfig;
  remote?: RemoteLogConfig;
  audit?: AuditLogConfig;
  performance?: PerformanceLogConfig;
  filters?: LogFilter[];
}

export interface LogFileConfig {
  path: string;
  maxSize?: number; // Max file size in bytes
  maxFiles?: number; // Max number of log files to keep
  compress?: boolean;
  datePattern?: string; // For log rotation
}

export interface RemoteLogConfig {
  endpoint: string;
  apiKey?: string;
  batchSize?: number;
  flushInterval?: number; // milliseconds
  compression?: boolean;
  retries?: number;
}

export interface AuditLogConfig {
  enabled: boolean;
  includeRequestBody?: boolean;
  includeResponseBody?: boolean;
  maskSensitiveData?: boolean;
  sensitiveFields?: string[];
  retention?: number; // days
  complianceLevel?: 'HIPAA' | 'GDPR' | 'SOC2' | 'CUSTOM';
}

export interface PerformanceLogConfig {
  enabled: boolean;
  threshold?: number; // Log requests slower than this (ms)
  includeStackTrace?: boolean;
  sampleRate?: number; // Percentage of requests to log (0-100)
}

export interface LogFilter {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex';
  value: string;
  action: 'include' | 'exclude' | 'mask';
}

// Security configuration
export interface SecurityConfig {
  encryption?: EncryptionConfig;
  signing?: SigningConfig;
  compliance?: ComplianceConfig;
  monitoring?: SecurityMonitoringConfig;
}

export interface EncryptionConfig {
  algorithm: 'AES-256-GCM' | 'AES-256-CBC' | 'ChaCha20-Poly1305';
  keyDerivation: 'PBKDF2' | 'scrypt' | 'Argon2';
  keyRotation?: KeyRotationConfig;
}

export interface KeyRotationConfig {
  enabled: boolean;
  interval: number; // days
  retainOldKeys: number; // number of old keys to retain
}

export interface SigningConfig {
  algorithm: 'HMAC-SHA256' | 'HMAC-SHA512' | 'RSA-SHA256' | 'ECDSA-SHA256';
  keyId?: string;
  includeTimestamp?: boolean;
  includeNonce?: boolean;
}

export interface ComplianceConfig {
  level: 'HIPAA' | 'GDPR' | 'SOC2' | 'CUSTOM';
  dataClassification?: DataClassificationConfig;
  accessControl?: AccessControlConfig;
  auditRequirements?: AuditRequirements;
}

export interface DataClassificationConfig {
  enabled: boolean;
  levels: ('public' | 'internal' | 'confidential' | 'restricted')[];
  defaultLevel: 'public' | 'internal' | 'confidential' | 'restricted';
  fieldMappings?: Record<string, string>;
}

export interface AccessControlConfig {
  enabled: boolean;
  defaultPolicy: 'allow' | 'deny';
  roles?: string[];
  permissions?: Permission[];
}

export interface Permission {
  resource: string;
  actions: string[];
  conditions?: Record<string, any>;
}

export interface AuditRequirements {
  logAllAccess: boolean;
  logDataChanges: boolean;
  logAuthEvents: boolean;
  logSecurityEvents: boolean;
  retentionPeriod: number; // days
}

export interface SecurityMonitoringConfig {
  enabled: boolean;
  alertThresholds?: AlertThresholds;
  notifications?: NotificationConfig[];
}

export interface AlertThresholds {
  failedAuthAttempts?: number;
  suspiciousActivity?: number;
  dataAccessVolume?: number;
  errorRate?: number; // percentage
}

export interface NotificationConfig {
  type: 'email' | 'webhook' | 'sms' | 'slack';
  endpoint: string;
  events: string[];
  severity: ('low' | 'medium' | 'high' | 'critical')[];
}

// Environment configuration
export interface EnvironmentConfig {
  name: string;
  type: 'development' | 'staging' | 'production' | 'testing';
  region?: string;
  endpoints?: Record<string, string>;
  features?: FeatureFlags;
  limits?: EnvironmentLimits;
  monitoring?: MonitoringConfig;
}

export interface FeatureFlags {
  [featureName: string]: boolean | FeatureFlagConfig;
}

export interface FeatureFlagConfig {
  enabled: boolean;
  rolloutPercentage?: number;
  conditions?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface EnvironmentLimits {
  maxTenants?: number;
  maxRequestsPerSecond?: number;
  maxConcurrentConnections?: number;
  maxMemoryUsage?: number; // MB
  maxCpuUsage?: number; // percentage
}

export interface MonitoringConfig {
  enabled: boolean;
  metrics?: MetricsConfig;
  tracing?: TracingConfig;
  healthChecks?: HealthCheckConfig[];
}

export interface MetricsConfig {
  provider: 'prometheus' | 'datadog' | 'newrelic' | 'custom';
  endpoint?: string;
  interval?: number; // seconds
  labels?: Record<string, string>;
}

export interface TracingConfig {
  provider: 'jaeger' | 'zipkin' | 'datadog' | 'custom';
  endpoint?: string;
  sampleRate?: number; // 0-1
  serviceName?: string;
}

export interface HealthCheckConfig {
  name: string;
  endpoint?: string;
  interval?: number; // seconds
  timeout?: number; // seconds
  retries?: number;
  expectedStatus?: number;
  expectedResponse?: string;
}

// Configuration validation and utilities
export interface ConfigValidationResult {
  isValid: boolean;
  errors: ConfigValidationError[];
  warnings: ConfigValidationWarning[];
}

export interface ConfigValidationError {
  field: string;
  message: string;
  code: string;
  value?: unknown;
}

export interface ConfigValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

// Configuration factory and builder
export class ConfigBuilder {
  private config: Partial<AdapterConfig> = {};

  static create(): ConfigBuilder {
    return new ConfigBuilder();
  }

  vendor(vendor: string): ConfigBuilder {
    this.config.vendor = vendor;
    return this;
  }

  baseUrl(url: string): ConfigBuilder {
    this.config.baseUrl = url;
    return this;
  }

  auth(authConfig: AuthConfig): ConfigBuilder {
    this.config.auth = authConfig;
    return this;
  }

  options(options: AdapterOptions): ConfigBuilder {
    this.config.options = { ...this.config.options, ...options };
    return this;
  }

  tenant(tenantConfig: TenantConfig): ConfigBuilder {
    this.config.tenant = tenantConfig;
    return this;
  }

  // SecurityProvider is available in the commercial version
  // security(securityProvider: SecurityProvider): ConfigBuilder {
  //   this.config.security = securityProvider;
  //   return this;
  // }

  plugins(plugins: AdapterPlugin[]): ConfigBuilder {
    this.config.plugins = plugins;
    return this;
  }

  logger(logger: LoggerInterface): ConfigBuilder {
    this.config.logger = logger;
    return this;
  }

  build(): AdapterConfig {
    if (!this.config.vendor) {
      throw new Error('Vendor is required');
    }
    if (!this.config.baseUrl) {
      throw new Error('Base URL is required');
    }
    if (!this.config.auth) {
      throw new Error('Authentication configuration is required');
    }

    return this.config as AdapterConfig;
  }
}

// Default configurations for common scenarios
export const DefaultConfigs = {
  development: {
    options: {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      debug: true,
      validateSSL: false,
    },
    logging: {
      level: 'debug' as const,
      format: 'text' as const,
      destination: 'console' as const,
    },
  },

  production: {
    options: {
      timeout: 15000,
      retries: 2,
      retryDelay: 2000,
      debug: false,
      validateSSL: true,
    },
    logging: {
      level: 'info' as const,
      format: 'json' as const,
      destination: 'file' as const,
    },
  },

  testing: {
    options: {
      timeout: 5000,
      retries: 0,
      retryDelay: 0,
      debug: true,
      dryRun: true,
    },
    logging: {
      level: 'warn' as const,
      format: 'text' as const,
      destination: 'console' as const,
    },
  },
};

// Additional configuration types for adapter.config.ts compatibility
export interface VendorConfig {
  name?: string;
  baseUrl?: string;
  version?: string;
  auth?: AuthConfig;
  endpoints?: Record<string, string>;
  capabilities?: string[];
  extensions?: Record<string, any>;
  rateLimit?: RateLimitConfig;
  timeout?: number;
  retries?: number;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  initialDelay?: number; // For backward compatibility
  jitter?: boolean;
  retryableErrors?: string[];
  nonRetryableErrors?: string[];
}

// Cache configuration interface
export interface CacheConfig {
  enabled: boolean;
  ttl?: number; // Time to live in seconds
  maxSize?: number; // Maximum cache size
  strategy?: 'lru' | 'fifo' | 'lfu';
  redis?: RedisConfig;
  memory?: MemoryCacheConfig;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export interface MemoryCacheConfig {
  maxSize: number;
  checkPeriod?: number; // Cleanup period in seconds
}

// Export all vendor-specific configs as union type
export type VendorSpecificConfig = EpicConfig | AthenaConfig | CernerConfig | MockConfig;

// Configuration presets for common scenarios
export const ConfigPresets = {
  epic: {
    sandbox: {
      vendor: 'epic',
      baseUrl: 'https://fhir.epic.com/interconnect-fhir-oauth',
      fhirVersion: 'R4' as const,
      sandboxMode: true,
      smartLaunch: true,
    },
    production: {
      vendor: 'epic',
      fhirVersion: 'R4' as const,
      sandboxMode: false,
      smartLaunch: true,
    },
  },
  athena: {
    preview: {
      vendor: 'athena',
      baseUrl: 'https://api.preview.platform.athenahealth.com',
      environment: 'preview' as const,
      version: 'v1',
    },
    production: {
      vendor: 'athena',
      baseUrl: 'https://api.platform.athenahealth.com',
      environment: 'production' as const,
      version: 'v1',
    },
  },
  cerner: {
    sandbox: {
      vendor: 'cerner',
      baseUrl: 'https://fhir-open.cerner.com',
      environment: 'sandbox' as const,
      fhirVersion: 'R4' as const,
    },
    production: {
      vendor: 'cerner',
      environment: 'production' as const,
      fhirVersion: 'R4' as const,
    },
  },
  mock: {
    development: {
      vendor: 'mock',
      baseUrl: 'http://localhost:3000',
      delay: 100,
      errorRate: 0,
      dataSet: 'standard' as const,
      patientCount: 100,
    },
    testing: {
      vendor: 'mock',
      baseUrl: 'http://localhost:3000',
      delay: 0,
      errorRate: 5,
      dataSet: 'comprehensive' as const,
      patientCount: 1000,
    },
  },
} as const;
