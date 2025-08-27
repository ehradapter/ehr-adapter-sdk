/**
 * Base EHR Adapter Implementation
 *
 * Abstract base class that provides common functionality for all EHR adapters.
 * Handles authentication, HTTP requests, error handling, retries, and logging.
 */

import { EHRAdapter, AuditEntry, AuditQueryOptions } from './EHRAdapter';
import {
  Patient,
  Observation,
  Appointment,
  MedicationRequest,
  CapabilityStatement,
  PatientSearchCriteria,
  QueryOptions,
  HealthStatus,
} from '../types/fhir';
import { AdapterConfig } from '../types/config';
import { AuthProvider } from '../auth/AuthProvider';
import { LoggerInterface } from '../logging/LoggerInterface';
// SecurityProvider is available in the commercial version
// import type { SecurityProvider } from '@ehr-adapter-pro/security';
import type { CustomQuery } from '../plugins/types';
import {
  EHRAdapterError,
  NetworkError,
  TimeoutError,
  RateLimitError,
  AuthenticationError,
  ResourceNotFoundError,
} from '../types/errors';
import { HttpClient, HttpRequestOptions, HttpResponse } from '../utils/http';

/**
 * Abstract base adapter class
 */
export abstract class BaseAdapter implements EHRAdapter {
  // Abstract properties that must be implemented by subclasses
  abstract readonly vendor: string;
  abstract readonly version: string;
  abstract readonly supportedFHIRVersion: string;

  // Protected properties available to subclasses
  protected config: AdapterConfig;
  protected authProvider?: AuthProvider;
  protected logger: LoggerInterface;
  // SecurityProvider is available in the commercial version
  // protected securityProvider: SecurityProvider | undefined;
  protected auditLog: AuditEntry[] = [];
  private httpClient?: HttpClient;

  // Request statistics
  protected stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalResponseTime: 0,
    lastActivity: new Date(),
  };

  constructor(config: AdapterConfig) {
    this.config = config;
    this.logger = config.logger || this.createDefaultLogger();
    // SecurityProvider is available in the commercial version
    // this.securityProvider = config.security;
    this.initialize();
  }

  /**
   * Create default logger if none provided
   */
  private createDefaultLogger(): LoggerInterface {
    const { ConsoleLogger } = require('../logging/LoggerInterface');
    return new ConsoleLogger();
  }

  /**
   * Initialize the adapter
   */
  protected initialize(): void {
    this.log('info', `Initializing ${this.vendor} adapter`, {
      vendor: this.vendor,
      version: this.version,
      baseUrl: this.config.baseUrl,
    });
  }

  // Abstract methods that must be implemented by subclasses
  abstract getPatient(patientId: string, options?: QueryOptions): Promise<Patient>;
  abstract searchPatients(
    criteria: PatientSearchCriteria,
    options?: QueryOptions
  ): Promise<Patient[]>;
  abstract getVitals(patientId: string, options?: QueryOptions): Promise<Observation[]>;
  abstract getLabs(patientId: string, options?: QueryOptions): Promise<Observation[]>;
  abstract getMedications(patientId: string, options?: QueryOptions): Promise<MedicationRequest[]>;
  abstract getAppointments(patientId: string, options?: QueryOptions): Promise<Appointment[]>;
  abstract getCapabilities(): Promise<CapabilityStatement>;
  abstract healthCheck(): Promise<HealthStatus>;

  /**
   * Execute a custom query (default implementation throws error)
   */
  async executeCustomQuery<T>(_query: CustomQuery): Promise<T> {
    throw new EHRAdapterError(
      `Custom queries not supported by ${this.vendor} adapter`,
      'CUSTOM_QUERY_NOT_SUPPORTED',
      this.vendor
    );
  }

  /**
   * Get audit log entries
   */
  async getAuditLog(options?: AuditQueryOptions): Promise<AuditEntry[]> {
    let filteredLog = [...this.auditLog];

    if (options) {
      if (options.startDate) {
        filteredLog = filteredLog.filter(entry => entry.timestamp >= (options.startDate ?? ''));
      }
      if (options.endDate) {
        filteredLog = filteredLog.filter(entry => entry.timestamp <= (options.endDate ?? ''));
      }
      if (options.operation) {
        filteredLog = filteredLog.filter(entry => entry.operation === options.operation);
      }
      if (options.resourceType) {
        filteredLog = filteredLog.filter(entry => entry.resourceType === options.resourceType);
      }
      if (options.patientId) {
        filteredLog = filteredLog.filter(entry => entry.patientId === options.patientId);
      }
      if (options.success !== undefined) {
        filteredLog = filteredLog.filter(entry => entry.success === options.success);
      }
      if (options.tenantId) {
        filteredLog = filteredLog.filter(entry => entry.tenantId === options.tenantId);
      }
      if (options.userId) {
        filteredLog = filteredLog.filter(entry => entry.userId === options.userId);
      }
    }

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;

    return filteredLog
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) // Most recent first
      .slice(offset, offset + limit);
  }

  /**
   * Protected method to make HTTP requests with error handling and retries
   */
  protected async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpoint: string,
    options: HttpRequestOptions = {}
  ): Promise<T> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    this.stats.totalRequests++;
    this.stats.lastActivity = new Date();

    try {
      // Build full URL
      const url = this.buildUrl(endpoint);

      // Prepare headers
      const headers = await this.prepareHeaders(options.headers);

      // Apply security if configured
      let body = options.body;
      // SecurityProvider request signing is available in the commercial version
      // if (this.securityProvider?.signRequest && options.body) {
      //   const request = { method, url, body: options.body, headers };
      //   const signedRequest = await this.securityProvider.signRequest(request as any);
      //   body = signedRequest.body;
      //   Object.assign(headers, signedRequest.headers);
      // }

      // Log request
      this.log('debug', `Making ${method} request to ${endpoint}`, {
        requestId,
        method,
        url,
        headers: this.sanitizeHeaders(headers),
      });

      // Make the actual HTTP request with retries
      const response = await this.executeRequestWithRetries(
        {
          method,
          headers,
          body,
          timeout: options.timeout || this.config.options?.timeout || 30000,
        },
        url
      );

      // Validate response with security provider
      // SecurityProvider response validation is available in the commercial version
      // if (this.securityProvider?.validateResponse) {
      //   await this.securityProvider.validateResponse(response as any);
      // }

      const duration = Date.now() - startTime;
      this.stats.successfulRequests++;
      this.stats.totalResponseTime += duration;

      // Log successful response
      this.log('debug', `Request completed successfully`, {
        requestId,
        statusCode: response.status,
        duration,
      });

      // Log audit entry
      await this.logAuditEntry({
        id: requestId,
        timestamp: new Date(),
        operation: `${method} ${endpoint}`,
        success: true,
        duration,
      });

      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.stats.failedRequests++;

      // Log error
      this.log('error', `Request failed`, {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      // Log audit entry for failure
      await this.logAuditEntry({
        id: requestId,
        timestamp: new Date(),
        operation: `${method} ${endpoint}`,
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Transform and re-throw error
      throw this.transformError(error, endpoint);
    }
  }

  /**
   * Execute HTTP request with retry logic
   */
  private async executeRequestWithRetries(
    request: HttpRequestOptions,
    url: string
  ): Promise<HttpResponse> {
    const maxRetries = this.config.options?.retries || 3;
    const baseDelay = this.config.options?.retryDelay || 1000;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await this.executeHttpRequest(request, url);
      } catch (error) {
        lastError = error as Error;

        // Don't retry on the last attempt
        if (attempt > maxRetries) {
          break;
        }

        // Check if error is retryable
        if (!this.isRetryableError(lastError)) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);

        this.log('warn', `Request failed, retrying in ${delay}ms`, {
          attempt,
          maxRetries,
          error: lastError.message,
        });

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Execute the actual HTTP request using the standardized HTTP client
   */
  protected async executeHttpRequest(
    request: HttpRequestOptions,
    url: string
  ): Promise<HttpResponse> {
    const { createHttpClient } = await import('../utils/http');

    if (!this.httpClient) {
      this.httpClient = createHttpClient(this.logger);
    }

    try {
      const response = await this.httpClient.request(url, {
        method: request.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
        headers: request.headers || {},
        body: request.body,
        ...(request.timeout && { timeout: request.timeout }),
      });

      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        config: request,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new NetworkError(
          `HTTP request failed: ${error.message}`,
          this.vendor,
          undefined,
          undefined,
          { operation: `${request.method} ${url}` }
        );
      }
      throw error;
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    if (error instanceof NetworkError) {
      // Retry on 5xx errors and 429 (rate limit)
      return error.statusCode ? error.statusCode >= 500 || error.statusCode === 429 : true;
    }

    if (error instanceof TimeoutError) {
      return true;
    }

    if (error instanceof RateLimitError) {
      return true;
    }

    // Don't retry authentication errors
    if (error instanceof AuthenticationError) {
      return false;
    }

    return false;
  }

  /**
   * Transform generic errors into specific EHR adapter errors
   */
  private transformError(error: unknown, endpoint: string): EHRAdapterError {
    if (error instanceof EHRAdapterError) {
      return error;
    }

    if (typeof error === 'object' && error !== null) {
      if (
        ('code' in error && (error as any).code === 'ECONNABORTED') ||
        (error as any).code === 'ETIMEDOUT'
      ) {
        return new TimeoutError(
          `Request to ${endpoint} timed out`,
          this.vendor,
          endpoint,
          this.config.options?.timeout || 30000
        );
      }

      if ('response' in error && (error as any).response) {
        const response = (error as any).response;
        const statusCode = response.status;
        const responseBody = response.data;
        const headers = response.headers;

        if (statusCode === 401 || statusCode === 403) {
          return new AuthenticationError(
            `Authentication failed for ${endpoint}`,
            this.vendor,
            undefined,
            { operation: endpoint }
          );
        }

        if (statusCode === 404) {
          return new ResourceNotFoundError(
            `Resource not found: ${endpoint}`,
            this.vendor,
            undefined,
            undefined,
            undefined,
            { operation: endpoint }
          );
        }

        if (statusCode === 429) {
          const retryAfter = headers['retry-after'];
          const rateLimitInfo: import('../types/errors').RateLimitInfo = {};
          if (retryAfter) {
            rateLimitInfo.retryAfter = parseInt(retryAfter);
          }
          if (headers['x-ratelimit-limit']) {
            rateLimitInfo.limit = parseInt(headers['x-ratelimit-limit']);
          }
          if (headers['x-ratelimit-remaining']) {
            rateLimitInfo.remaining = parseInt(headers['x-ratelimit-remaining']);
          }

          return new RateLimitError(
            `Rate limit exceeded for ${endpoint}`,
            this.vendor,
            undefined,
            { operation: endpoint },
            rateLimitInfo
          );
        }

        return new NetworkError(
          `HTTP ${statusCode} error for ${endpoint}`,
          this.vendor,
          statusCode,
          undefined,
          { operation: endpoint },
          {
            responseBody:
              typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody),
            requestUrl: endpoint,
            requestMethod: 'GET', // This should be passed from the actual request
          }
        );
      }
    }

    // Generic network error
    const message = error instanceof Error ? error.message : 'Unknown network error';
    return new NetworkError(
      `Network error for ${endpoint}: ${message}`,
      this.vendor,
      undefined,
      undefined,
      { operation: endpoint }
    );
  }

  /**
   * Build full URL from endpoint
   */
  protected buildUrl(endpoint: string): string {
    const baseUrl = this.config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${baseUrl}${cleanEndpoint}`;
  }

  /**
   * Prepare request headers including authentication
   */
  protected async prepareHeaders(
    additionalHeaders: Record<string, string> = {}
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': this.config.options?.userAgent || `EHR-Adapter-SDK/${this.version}`,
      ...this.config.options?.headers,
      ...additionalHeaders,
    };

    // Add authentication headers
    if (this.authProvider) {
      const authHeaders = this.authProvider.getHeaders();
      Object.assign(headers, authHeaders);
    }

    return headers;
  }

  /**
   * Sanitize headers for logging (remove sensitive information)
   */
  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie'];

    for (const key in sanitized) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${this.vendor}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log audit entry
   */
  protected async logAuditEntry(entry: Partial<AuditEntry>): Promise<void> {
    const auditEntry: AuditEntry = {
      id: entry.id || this.generateRequestId(),
      timestamp: entry.timestamp || new Date(),
      operation: entry.operation || 'unknown',
      success: entry.success ?? false,
      duration: entry.duration || 0,
      ...(entry.tenantId && { tenantId: entry.tenantId }),
      ...(entry.userId && { userId: entry.userId }),
      ...(entry.resourceType && { resourceType: entry.resourceType }),
      ...(entry.resourceId && { resourceId: entry.resourceId }),
      ...(entry.patientId && { patientId: entry.patientId }),
      ...(entry.ipAddress && { ipAddress: entry.ipAddress }),
      ...(entry.error && { error: entry.error }),
    };
    this.auditLog.push(auditEntry);
  }

  /**
   * Standardized logging method
   */
  protected log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: unknown
  ): void {
    if (this.logger) {
      const logContext = {
        vendor: this.vendor,
        adapterVersion: this.version,
        ...(context && typeof context === 'object' ? context : {}),
      };
      switch (level) {
        case 'debug':
          this.logger.debug(message, logContext);
          break;
        case 'info':
          this.logger.info(message, logContext);
          break;
        case 'warn':
          this.logger.warn(message, logContext);
          break;
        case 'error':
          this.logger.error(message, logContext);
          break;
      }
    }
  }

  /**
   * Sleep for a given duration
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get adapter statistics
   */
  getStatistics(): AdapterStatistics {
    return {
      ...this.stats,
      averageResponseTime:
        this.stats.totalRequests > 0 ? this.stats.totalResponseTime / this.stats.totalRequests : 0,
    };
  }
}

interface RequestOptions {
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

interface AdapterStatistics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalResponseTime: number;
  averageResponseTime: number;
  lastActivity: Date;
}
