/**
 * Plugin System Types for EHR Adapter SDK
 * 
 * Defines interfaces for the extensible plugin architecture supporting
 * custom data transformations, FHIR extensions, and vendor-specific customizations.
 */

import { LoggerInterface } from '../logging/LoggerInterface';

// Re-export from plugins/types for backwards compatibility
export * from '../plugins/types';

// Additional types specific to core SDK
export interface PluginConfig {
  enabled: boolean;
  priority?: number;
  settings?: Record<string, any>;
  overrides?: Record<string, any>;
  environment?: 'development' | 'staging' | 'production';
  debug?: boolean;
}

export interface AdapterPlugin {
  name: string;
  version: string;
  vendor?: string;
  description?: string;
  
  // Lifecycle hooks
  onInitialize?(context: PluginContext): Promise<void>;
  onBeforeRequest?(context: RequestContext): Promise<void>;
  onAfterResponse?(context: ResponseContext): Promise<void>;
  onError?(error: Error, context: ErrorContext): Promise<void>;
  onDestroy?(context: PluginContext): Promise<void>;
  
  // Configuration
  configure?(config: PluginConfig): Promise<void>;
}

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
