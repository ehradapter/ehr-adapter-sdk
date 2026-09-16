/**
 * EHR Adapter SDK - MIT Licensed Components
 *
 * This is the open-source version of the EHR Adapter SDK.
 * For advanced features like Epic, Athena, and Cerner integrations,
 * please see our commercial license at https://ehradapter.com
 */

// Core exports
export type { EHRAdapter } from "./core/EHRAdapter";
export { BaseAdapter } from "./core/BaseAdapter";
export { EHRAdapterFactory } from "./core/AdapterFactory";
// TenantAwareAdapter is intentionally not exported. Multi-tenant isolation is a
// commercial feature; see https://ehradapter.com/pricing

// Type exports
export * from "./types/fhir";
export * from "./types/config";
export * from "./types/errors";
export * from "./types/auth";

// Auth provider exports (MIT only)
export type { AuthProvider } from "./auth/AuthProvider";
export { ApiKeyProvider } from "./auth/ApiKeyProvider";
export { BearerTokenProvider } from "./auth/BearerTokenProvider";
export { AuthenticationError } from "./auth/AuthenticationError";

// Plugin system exports
// PluginManager is internal-only; it is not part of the supported public API.
export { TransformationPipeline } from "./plugins/TransformationPipeline";

// Mock vendor adapter (for development and testing)
export { MockAdapter } from "./vendors/mock/MockAdapter";
export { MockDataGenerator } from "./vendors/mock/MockDataGenerator";

// Utility exports
export { HttpClient } from "./utils/http";
export { FHIRValidator } from "./utils/FHIRValidator";
export {
  loadEnvironmentConfig,
  createMockConfigFromEnv,
  validateEnvironmentConfig,
  printEnvironmentSummary,
} from "./utils/environment";
export type { EnvironmentConfig as EnvConfig } from "./utils/environment";
export { RetryManager, CircuitBreaker } from "./utils/retry";

// Logging exports
export type { LoggerInterface } from "./logging/LoggerInterface";
export { StructuredLogger } from "./logging/StructuredLogger";
export { AuditLogger } from "./logging/AuditLogger";
export { ComplianceLogger } from "./logging/ComplianceLogger";
