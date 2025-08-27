/**
 * Error Types for EHR Adapter SDK
 *
 * Comprehensive error hierarchy for handling various failure scenarios
 * in EHR integrations with proper context and debugging information.
 */

// Base error class for all EHR Adapter errors
export class EHRAdapterError extends Error {
  public readonly code: string;
  public readonly vendor: string;
  public readonly tenantId: string | undefined;
  public readonly context: ErrorContext | undefined;
  public readonly originalError: Error | undefined;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    vendor: string,
    tenantId?: string,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(message);
    this.name = 'EHRAdapterError';
    this.code = code;
    this.vendor = vendor;
    this.tenantId = tenantId;
    this.context = context;
    this.originalError = originalError;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if ('captureStackTrace' in Error) {
      (Error as any).captureStackTrace(this, EHRAdapterError);
    }
  }

  /**
   * Convert error to JSON for logging and serialization
   */
  toJSON(): ErrorJSON {
    const json: ErrorJSON = {
      name: this.name,
      message: this.message,
      code: this.code,
      vendor: this.vendor,
      timestamp: this.timestamp.toISOString(),
    };

    if (this.tenantId) {
      json.tenantId = this.tenantId;
    }
    if (this.context) {
      json.context = this.context;
    }
    if (this.stack) {
      json.stack = this.stack;
    }
    if (this.originalError) {
      json.originalError = {
        name: this.originalError.name,
        message: this.originalError.message,
      };
      if (this.originalError.stack) {
        json.originalError.stack = this.originalError.stack;
      }
    }

    return json;
  }
}

// Authentication-related errors
export class AuthenticationError extends EHRAdapterError {
  constructor(
    message: string,
    vendor: string,
    tenantId?: string,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(message, 'AUTH_ERROR', vendor, tenantId, context, originalError);
    this.name = 'AuthenticationError';
  }
}

export class TokenExpiredError extends AuthenticationError {
  constructor(vendor: string, tenantId?: string, context?: ErrorContext, originalError?: Error) {
    super('Authentication token has expired', vendor, tenantId, context, originalError);
    this.name = 'TokenExpiredError';
  }
}

export class InvalidCredentialsError extends AuthenticationError {
  constructor(vendor: string, tenantId?: string, context?: ErrorContext, originalError?: Error) {
    super('Invalid authentication credentials provided', vendor, tenantId, context, originalError);
    this.name = 'InvalidCredentialsError';
  }
}

// Rate limiting errors
export class RateLimitError extends EHRAdapterError {
  public readonly retryAfter: number | undefined;
  public readonly limit: number | undefined;
  public readonly remaining: number | undefined;
  public readonly resetTime: Date | undefined;

  constructor(
    message: string,
    vendor: string,
    tenantId?: string,
    context?: ErrorContext,
    rateLimitInfo?: RateLimitInfo,
    originalError?: Error
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', vendor, tenantId, context, originalError);
    this.name = 'RateLimitError';
    this.retryAfter = rateLimitInfo?.retryAfter;
    this.limit = rateLimitInfo?.limit;
    this.remaining = rateLimitInfo?.remaining;
    this.resetTime = rateLimitInfo?.resetTime;
  }
}

// Resource not found errors
export class ResourceNotFoundError extends EHRAdapterError {
  public readonly resourceType: string | undefined;
  public readonly resourceId: string | undefined;

  constructor(
    message: string,
    vendor: string,
    resourceType?: string,
    resourceId?: string,
    tenantId?: string,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(message, 'RESOURCE_NOT_FOUND', vendor, tenantId, context, originalError);
    this.name = 'ResourceNotFoundError';
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

// Multi-tenant related errors
export class TenantIsolationError extends EHRAdapterError {
  public readonly violationType: 'DATA_LEAK' | 'CONFIG_LEAK' | 'AUTH_LEAK' | 'PLUGIN_LEAK';

  constructor(
    message: string,
    vendor: string,
    violationType: 'DATA_LEAK' | 'CONFIG_LEAK' | 'AUTH_LEAK' | 'PLUGIN_LEAK',
    tenantId?: string,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(message, 'TENANT_ISOLATION_VIOLATION', vendor, tenantId, context, originalError);
    this.name = 'TenantIsolationError';
    this.violationType = violationType;
  }
}

// Plugin execution errors
export class PluginExecutionError extends EHRAdapterError {
  public readonly pluginName: string;
  public readonly pluginVersion: string | undefined;
  public readonly phase: 'PRE_PROCESS' | 'POST_PROCESS' | 'EXTENSION' | 'QUERY_HANDLER';

  constructor(
    message: string,
    vendor: string,
    pluginName: string,
    phase: 'PRE_PROCESS' | 'POST_PROCESS' | 'EXTENSION' | 'QUERY_HANDLER',
    pluginVersion?: string,
    tenantId?: string,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(message, 'PLUGIN_EXECUTION_ERROR', vendor, tenantId, context, originalError);
    this.name = 'PluginExecutionError';
    this.pluginName = pluginName;
    this.pluginVersion = pluginVersion;
    this.phase = phase;
  }
}

// Data transformation errors
export class DataTransformationError extends EHRAdapterError {
  public readonly transformationType:
    | 'LOINC_MAPPING'
    | 'SNOMED_MAPPING'
    | 'CUSTOM_MAPPING'
    | 'VALIDATION'
    | 'SERIALIZATION';
  public readonly inputData: unknown;
  public readonly expectedFormat: string | undefined;

  constructor(
    message: string,
    vendor: string,
    transformationType:
      | 'LOINC_MAPPING'
      | 'SNOMED_MAPPING'
      | 'CUSTOM_MAPPING'
      | 'VALIDATION'
      | 'SERIALIZATION',
    tenantId?: string,
    context?: ErrorContext,
    inputData?: unknown,
    expectedFormat?: string,
    originalError?: Error
  ) {
    super(message, 'DATA_TRANSFORMATION_ERROR', vendor, tenantId, context, originalError);
    this.name = 'DataTransformationError';
    this.transformationType = transformationType;
    this.inputData = inputData;
    this.expectedFormat = expectedFormat;
  }
}

// Security validation errors
export class SecurityValidationError extends EHRAdapterError {
  public readonly securityType:
    | 'HMAC_VALIDATION'
    | 'JWT_VALIDATION'
    | 'COMPLIANCE_CHECK'
    | 'ENCRYPTION'
    | 'SIGNATURE';
  public readonly securityEvent: SecurityEvent | undefined;

  constructor(
    message: string,
    vendor: string,
    securityType:
      | 'HMAC_VALIDATION'
      | 'JWT_VALIDATION'
      | 'COMPLIANCE_CHECK'
      | 'ENCRYPTION'
      | 'SIGNATURE',
    tenantId?: string,
    context?: ErrorContext,
    securityEvent?: SecurityEvent,
    originalError?: Error
  ) {
    super(message, 'SECURITY_VALIDATION_ERROR', vendor, tenantId, context, originalError);
    this.name = 'SecurityValidationError';
    this.securityType = securityType;
    this.securityEvent = securityEvent;
  }
}

// Network and HTTP errors
export class NetworkError extends EHRAdapterError {
  public readonly statusCode: number | undefined;
  public readonly responseBody: string | undefined;
  public readonly requestUrl: string | undefined;
  public readonly requestMethod: string | undefined;

  constructor(
    message: string,
    vendor: string,
    statusCode?: number,
    tenantId?: string,
    context?: ErrorContext,
    networkInfo?: NetworkErrorInfo,
    originalError?: Error
  ) {
    super(message, 'NETWORK_ERROR', vendor, tenantId, context, originalError);
    this.name = 'NetworkError';
    this.statusCode = statusCode;
    this.responseBody = networkInfo?.responseBody;
    this.requestUrl = networkInfo?.requestUrl;
    this.requestMethod = networkInfo?.requestMethod;
  }
}

// Timeout errors
export class TimeoutError extends EHRAdapterError {
  public readonly timeoutMs: number;
  public readonly operation: string;

  constructor(
    message: string,
    vendor: string,
    operation: string,
    timeoutMs: number,
    tenantId?: string,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(message, 'TIMEOUT_ERROR', vendor, tenantId, context, originalError);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    this.operation = operation;
  }
}

// Configuration errors
export class ConfigurationError extends EHRAdapterError {
  public readonly configField: string | undefined;
  public readonly configValue: unknown;
  public readonly validationRule: string | undefined;

  constructor(
    message: string,
    vendor: string,
    configField?: string,
    configValue?: unknown,
    validationRule?: string,
    tenantId?: string,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(message, 'CONFIGURATION_ERROR', vendor, tenantId, context, originalError);
    this.name = 'ConfigurationError';
    this.configField = configField;
    this.configValue = configValue;
    this.validationRule = validationRule;
  }
}

// FHIR validation errors
export class FHIRValidationError extends EHRAdapterError {
  public readonly resourceType: string | undefined;
  public readonly validationErrors: ValidationError[];

  constructor(
    message: string,
    vendor: string,
    resourceType: string,
    validationErrors: ValidationError[],
    tenantId?: string,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(message, 'FHIR_VALIDATION_ERROR', vendor, tenantId, context, originalError);
    this.name = 'FHIRValidationError';
    this.resourceType = resourceType;
    this.validationErrors = validationErrors;
  }
}

// Supporting interfaces and types
export interface ErrorContext {
  operation: string;
  resourceType?: string;
  resourceId?: string;
  patientId?: string;
  requestId?: string;
  retryAttempt?: number;
  securityEvent?: SecurityEvent;
  metadata?: Record<string, any>;
}

export interface SecurityEvent {
  type:
    | 'REQUEST_SIGNED'
    | 'RESPONSE_VALIDATED'
    | 'COMPLIANCE_CHECK'
    | 'SECURITY_VIOLATION'
    | 'ENCRYPTION_FAILED'
    | 'SIGNATURE_INVALID';
  details: Record<string, any>;
  timestamp: Date;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface RateLimitInfo {
  retryAfter?: number; // seconds
  limit?: number;
  remaining?: number;
  resetTime?: Date;
}

export interface NetworkErrorInfo {
  responseBody?: string;
  requestUrl?: string;
  requestMethod?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: unknown;
  constraint?: string;
}

export interface ErrorJSON {
  name: string;
  message: string;
  code: string;
  vendor: string;
  tenantId?: string;
  context?: ErrorContext;
  timestamp: string;
  stack?: string;
  originalError?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// Error factory functions for common scenarios
export class ErrorFactory {
  static createAuthenticationError(
    vendor: string,
    message?: string,
    tenantId?: string,
    originalError?: Error
  ): AuthenticationError {
    return new AuthenticationError(
      message || 'Authentication failed',
      vendor,
      tenantId,
      { operation: 'authenticate' },
      originalError
    );
  }

  static createTokenExpiredError(
    vendor: string,
    tenantId?: string,
    originalError?: Error
  ): TokenExpiredError {
    return new TokenExpiredError(
      vendor,
      tenantId,
      { operation: 'token_validation' },
      originalError
    );
  }

  static createRateLimitError(
    vendor: string,
    rateLimitInfo: RateLimitInfo,
    tenantId?: string,
    originalError?: Error
  ): RateLimitError {
    const message = `Rate limit exceeded. ${rateLimitInfo.retryAfter ? `Retry after ${rateLimitInfo.retryAfter} seconds.` : ''}`;
    return new RateLimitError(
      message,
      vendor,
      tenantId,
      { operation: 'api_request' },
      rateLimitInfo,
      originalError
    );
  }

  static createResourceNotFoundError(
    vendor: string,
    resourceType: string,
    resourceId: string,
    tenantId?: string,
    originalError?: Error
  ): ResourceNotFoundError {
    return new ResourceNotFoundError(
      `${resourceType} with ID ${resourceId} not found`,
      vendor,
      resourceType,
      resourceId,
      tenantId,
      { operation: 'resource_fetch', resourceType, resourceId },
      originalError
    );
  }

  static createNetworkError(
    vendor: string,
    statusCode: number,
    networkInfo: NetworkErrorInfo,
    tenantId?: string,
    originalError?: Error
  ): NetworkError {
    const message = `Network request failed with status ${statusCode}`;
    return new NetworkError(
      message,
      vendor,
      statusCode,
      tenantId,
      { operation: 'http_request' },
      networkInfo,
      originalError
    );
  }

  static createTimeoutError(
    vendor: string,
    operation: string,
    timeoutMs: number,
    tenantId?: string,
    originalError?: Error
  ): TimeoutError {
    return new TimeoutError(
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      vendor,
      operation,
      timeoutMs,
      tenantId,
      { operation },
      originalError
    );
  }

  static createPluginError(
    vendor: string,
    pluginName: string,
    phase: 'PRE_PROCESS' | 'POST_PROCESS' | 'EXTENSION' | 'QUERY_HANDLER',
    message?: string,
    pluginVersion?: string,
    tenantId?: string,
    originalError?: Error
  ): PluginExecutionError {
    return new PluginExecutionError(
      message || `Plugin '${pluginName}' execution failed during ${phase}`,
      vendor,
      pluginName,
      phase,
      pluginVersion,
      tenantId,
      { operation: 'plugin_execution' },
      originalError
    );
  }
}
