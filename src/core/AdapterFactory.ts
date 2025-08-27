/**
 * EHR Adapter Factory
 *
 * Factory pattern implementation for creating EHR adapter instances.
 * Supports multi-tenant configurations and plugin management.
 */

import { EHRAdapter } from "./EHRAdapter";
import { TenantAwareAdapter } from "./TenantAwareAdapter";
import { AdapterConfig, TenantAdapterConfig } from "../types/config";
import { EHRAdapterError, ConfigurationError } from "../types/errors";

// Import vendor adapters (will be created later)
import { MockAdapter } from "../vendors/mock/MockAdapter";
// Epic and Athena adapters are available in the commercial version
// import { EpicAdapter } from '../vendors/epic/EpicAdapter';
// import { AthenaAdapter } from '../vendors/athena/AthenaAdapter';

import { BaseAdapter } from "./BaseAdapter";

export type AdapterConstructor = new (config: AdapterConfig) => EHRAdapter;
/**
 * Main factory function for creating EHR adapters
 * @param vendorName - The EHR vendor name
 * @param config - Adapter configuration
 * @returns EHRAdapter instance
 */
export function getAdapter(
  vendorName: string,
  config: AdapterConfig
): EHRAdapter {
  const normalizedVendor = vendorName.toLowerCase().trim();

  // Validate configuration
  validateAdapterConfig(config);

  // Create base adapter
  const adapter = createVendorAdapter(normalizedVendor, config);

  // Return adapter (will be wrapped in TenantAwareAdapter if tenant config exists)
  if (config.tenant) {
    const tenantConfig: TenantAdapterConfig = {
      tenantId: config.tenant.tenantId,
      config,
      plugins: config.plugins || [],
      ...(config.logger && { logger: config.logger }),
      // SecurityProvider is available in the commercial version
      // ...(config.security && { security: config.security }),
    };
    return new TenantAwareAdapter(adapter, tenantConfig);
  }

  return adapter;
}

/**
 * Multi-tenant adapter factory function
 * @param vendorName - The EHR vendor name
 * @param tenantConfig - Tenant-specific configuration
 * @returns EHRAdapter instance with tenant isolation
 */
export function getTenantAdapter(
  vendorName: string,
  tenantConfig: TenantAdapterConfig
): EHRAdapter {
  const normalizedVendor = vendorName.toLowerCase().trim();

  // Validate configuration
  validateAdapterConfig(tenantConfig.config);
  validateTenantConfig(tenantConfig);

  // Create base adapter
  const adapter = createVendorAdapter(normalizedVendor, tenantConfig.config);

  // Wrap in tenant-aware adapter
  return new TenantAwareAdapter(adapter, tenantConfig);
}

/**
 * Create vendor-specific adapter instance
 * @param vendor - Normalized vendor name
 * @param config - Adapter configuration
 * @returns EHRAdapter instance
 */
function createVendorAdapter(
  vendor: string,
  config: AdapterConfig
): EHRAdapter {
  switch (vendor) {
    case "mock":
      return new MockAdapter(config);

    // Epic and Athena adapters are available in the commercial version
    // case "epic":
    //   return new EpicAdapter(config);

    // case "athena":
    //   return new AthenaAdapter(config);

    // Future vendors can be added here
    case "cerner":
      throw new EHRAdapterError(
        "Cerner adapter is not yet implemented",
        "ADAPTER_NOT_IMPLEMENTED",
        "cerner"
      );

    case "healthgorilla":
      throw new EHRAdapterError(
        "HealthGorilla adapter is not yet implemented",
        "ADAPTER_NOT_IMPLEMENTED",
        "healthgorilla"
      );

    default:
      throw new EHRAdapterError(
        `Unsupported EHR vendor: ${vendor}. Supported vendors: mock, epic, athena`,
        "UNSUPPORTED_VENDOR",
        vendor
      );
  }
}

/**
 * Validate adapter configuration
 * @param config - Adapter configuration to validate
 */
function validateAdapterConfig(config: AdapterConfig): void {
  const errors: string[] = [];

  // Required fields
  if (!config.vendor) {
    errors.push("Vendor is required");
  }

  if (!config.baseUrl) {
    errors.push("Base URL is required");
  }

  if (!config.auth) {
    errors.push("Authentication configuration is required");
  }

  // Validate base URL format
  if (config.baseUrl && !isValidUrl(config.baseUrl)) {
    errors.push("Base URL must be a valid URL");
  }

  // Validate vendor-specific requirements
  if (config.vendor) {
    validateVendorSpecificConfig(config, errors);
  }

  // Validate options if provided
  if (config.options) {
    validateAdapterOptions(config.options, errors);
  }

  if (errors.length > 0) {
    throw new ConfigurationError(
      `Invalid adapter configuration: ${errors.join(", ")}`,
      config.vendor || "unknown",
      "config",
      config,
      "adapter_validation"
    );
  }
}

/**
 * Validate tenant configuration
 * @param tenantConfig - Tenant configuration to validate
 */
function validateTenantConfig(tenantConfig: TenantAdapterConfig): void {
  const errors: string[] = [];

  if (!tenantConfig.tenantId) {
    errors.push("Tenant ID is required");
  }

  if (!tenantConfig.config) {
    errors.push("Adapter configuration is required");
  }

  // Validate tenant ID format (alphanumeric, hyphens, underscores)
  if (
    tenantConfig.tenantId &&
    !/^[a-zA-Z0-9_-]+$/.test(tenantConfig.tenantId)
  ) {
    errors.push(
      "Tenant ID must contain only alphanumeric characters, hyphens, and underscores"
    );
  }

  if (errors.length > 0) {
    throw new ConfigurationError(
      `Invalid tenant configuration: ${errors.join(", ")}`,
      tenantConfig.config?.vendor || "unknown",
      "tenantConfig",
      tenantConfig as any,
      "tenant_validation"
    );
  }
}

/**
 * Validate vendor-specific configuration requirements
 * @param config - Adapter configuration
 * @param errors - Array to collect validation errors
 */
function validateVendorSpecificConfig(
  config: AdapterConfig,
  errors: string[]
): void {
  const vendor = config.vendor.toLowerCase();

  switch (vendor) {
    case "epic":
      if (config.auth.type === "oauth2") {
        if (!config.auth.clientId) {
          errors.push("Epic requires OAuth2 client ID");
        }
        if (!config.auth.clientSecret) {
          errors.push("Epic requires OAuth2 client secret");
        }
      }
      break;

    case "athena":
      if (config.auth.type === "apikey") {
        if (!config.auth.apiKey) {
          errors.push("Athena requires API key");
        }
      }
      // Check for practice ID in config or auth
      if (isAthenaConfig(config)) {
        if (!config.practiceId) {
          errors.push("Athena requires practice ID");
        }
      } else {
        errors.push("Invalid configuration for Athena adapter.");
      }
      break;

    case "mock":
      // Mock adapter has no specific requirements
      break;

    default:
      // No specific validation for unknown vendors
      break;
  }
}

/**
 * Type guard for AthenaConfig
 */
function isAthenaConfig(
  config: AdapterConfig
): config is import("../types/config").AthenaConfig {
  return config.vendor === "athena" && "practiceId" in config;
}

/**
 * Validate adapter options
 * @param options - Adapter options to validate
 * @param errors - Array to collect validation errors
 */
function validateAdapterOptions(
  options: import("../types/config").AdapterOptions,
  errors: string[]
): void {
  if (
    options.timeout &&
    (typeof options.timeout !== "number" || options.timeout <= 0)
  ) {
    errors.push("Timeout must be a positive number");
  }

  if (
    options.retries &&
    (typeof options.retries !== "number" || options.retries < 0)
  ) {
    errors.push("Retries must be a non-negative number");
  }

  if (
    options.retryDelay &&
    (typeof options.retryDelay !== "number" || options.retryDelay < 0)
  ) {
    errors.push("Retry delay must be a non-negative number");
  }

  if (options.rateLimit) {
    if (
      !options.rateLimit.requests ||
      typeof options.rateLimit.requests !== "number" ||
      options.rateLimit.requests <= 0
    ) {
      errors.push("Rate limit requests must be a positive number");
    }
    if (
      !options.rateLimit.window ||
      typeof options.rateLimit.window !== "number" ||
      options.rateLimit.window <= 0
    ) {
      errors.push("Rate limit window must be a positive number");
    }
  }
}

/**
 * Check if a string is a valid URL
 * @param url - URL string to validate
 * @returns true if valid URL
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * EHR Adapter Factory class for more advanced usage
 */
export class EHRAdapterFactory {
  private static registeredAdapters = new Map<string, any>();
  private static defaultConfigs = new Map<string, Partial<AdapterConfig>>();

  /**
   * Register a custom adapter class
   * @param vendor - Vendor name
   * @param adapterClass - Adapter class constructor
   */
  static registerAdapter(
    vendor: string,
    adapterClass: AdapterConstructor
  ): void {
    const normalizedVendor = vendor.toLowerCase().trim();
    this.registeredAdapters.set(normalizedVendor, adapterClass);
  }

  /**
   * Unregister an adapter class
   * @param vendor - Vendor name
   */
  static unregisterAdapter(vendor: string): void {
    const normalizedVendor = vendor.toLowerCase().trim();
    this.registeredAdapters.delete(normalizedVendor);
  }

  /**
   * Set default configuration for a vendor
   * @param vendor - Vendor name
   * @param config - Default configuration
   */
  static setDefaultConfig(
    vendor: string,
    config: Partial<AdapterConfig>
  ): void {
    const normalizedVendor = vendor.toLowerCase().trim();
    this.defaultConfigs.set(normalizedVendor, config);
  }

  /**
   * Get default configuration for a vendor
   * @param vendor - Vendor name
   * @returns Default configuration or undefined
   */
  static getDefaultConfig(vendor: string): Partial<AdapterConfig> | undefined {
    const normalizedVendor = vendor.toLowerCase().trim();
    return this.defaultConfigs.get(normalizedVendor);
  }

  /**
   * Create adapter with default configuration merged
   * @param vendor - Vendor name
   * @param config - Adapter configuration
   * @returns EHRAdapter instance
   */
  static createWithDefaults(
    vendor: string,
    config: Partial<AdapterConfig>
  ): EHRAdapter {
    const normalizedVendor = vendor.toLowerCase().trim();
    const defaultConfig = this.getDefaultConfig(normalizedVendor) || {};

    // Merge default config with provided config
    const mergedConfig: AdapterConfig = {
      vendor: normalizedVendor,
      baseUrl: "",
      auth: { type: "apikey", apiKey: "" },
      ...defaultConfig,
      ...config,
      options: {
        ...defaultConfig.options,
        ...config.options,
      },
    } as AdapterConfig;

    return getAdapter(normalizedVendor, mergedConfig);
  }

  /**
   * Get list of supported vendors
   * @returns Array of supported vendor names
   */
  static getSupportedVendors(): string[] {
    const builtInVendors = ["mock", "epic", "athena"];
    const customVendors = Array.from(this.registeredAdapters.keys());
    return [...builtInVendors, ...customVendors];
  }

  /**
   * Check if a vendor is supported
   * @param vendor - Vendor name
   * @returns true if vendor is supported
   */
  static isVendorSupported(vendor: string): boolean {
    const normalizedVendor = vendor.toLowerCase().trim();
    return this.getSupportedVendors().includes(normalizedVendor);
  }

  /**
   * Create adapter using registered custom adapter if available
   * @param vendor - Vendor name
   * @param config - Adapter configuration
   * @returns EHRAdapter instance
   */
  static create(vendor: string, config: AdapterConfig): EHRAdapter {
    const normalizedVendor = vendor.toLowerCase().trim();

    // Check for custom registered adapter first
    const CustomAdapter = this.registeredAdapters.get(normalizedVendor);
    if (CustomAdapter) {
      return new CustomAdapter(config);
    }

    // Fall back to built-in factory
    return getAdapter(normalizedVendor, config);
  }
}

/**
 * Utility functions for adapter management
 */
export class AdapterUtils {
  /**
   * Test adapter configuration without creating an instance
   * @param vendor - Vendor name
   * @param config - Adapter configuration
   * @returns Validation result
   */
  static validateConfig(
    _vendor: string,
    config: AdapterConfig
  ): { isValid: boolean; errors: string[] } {
    try {
      validateAdapterConfig(config);
      return { isValid: true, errors: [] };
    } catch (error) {
      if (error instanceof ConfigurationError) {
        return { isValid: false, errors: [error.message] };
      }
      return { isValid: false, errors: ["Unknown validation error"] };
    }
  }

  /**
   * Get adapter metadata without creating an instance
   * @param vendor - Vendor name
   * @returns Adapter metadata
   */
  static getAdapterMetadata(vendor: string): AdapterMetadata | null {
    const normalizedVendor = vendor.toLowerCase().trim();

    switch (normalizedVendor) {
      case "mock":
        return {
          vendor: "mock",
          name: "Mock EHR Adapter",
          description: "Mock adapter for testing and development",
          version: "1.0.0",
          fhirVersions: ["R4"],
          authTypes: ["apikey", "bearer", "basic"],
          capabilities: ["read", "search"],
          documentation: "https://docs.ehradapter.com/mock",
        };

      case "epic":
        return {
          vendor: "epic",
          name: "Epic EHR Adapter",
          description: "Adapter for Epic EHR systems with FHIR R4 support",
          version: "1.0.0",
          fhirVersions: ["R4", "STU3"],
          authTypes: ["oauth2"],
          capabilities: ["read", "search", "write"],
          documentation: "https://docs.ehradapter.com/epic",
        };

      case "athena":
        return {
          vendor: "athena",
          name: "Athena EHR Adapter",
          description: "Adapter for Athena practice management and EHR",
          version: "1.0.0",
          fhirVersions: ["R4"],
          authTypes: ["apikey"],
          capabilities: ["read", "search", "write"],
          documentation: "https://docs.ehradapter.com/athena",
        };

      default:
        return null;
    }
  }

  /**
   * Get all available adapter metadata
   * @returns Array of adapter metadata
   */
  static getAllAdapterMetadata(): AdapterMetadata[] {
    const vendors = EHRAdapterFactory.getSupportedVendors();
    return vendors
      .map((vendor) => this.getAdapterMetadata(vendor))
      .filter((metadata): metadata is AdapterMetadata => metadata !== null);
  }
}

// Supporting interfaces
export interface AdapterMetadata {
  vendor: string;
  name: string;
  description: string;
  version: string;
  fhirVersions: string[];
  authTypes: string[];
  capabilities: string[];
  documentation: string;
}
