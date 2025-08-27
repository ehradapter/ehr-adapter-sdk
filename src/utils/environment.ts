/**
 * Environment configuration utilities
 * Helps load and validate environment variables for the EHR Adapter SDK
 */

export interface EnvironmentConfig {
  nodeEnv: string;
  logLevel: "debug" | "info" | "warn" | "error";
  mockApiKey: string;
  mockBaseUrl: string;
  mockDelay: number;
  mockErrorRate: number;
  mockDataSet: "minimal" | "standard" | "comprehensive";
  tenantId: string | undefined;
  patientId: string | undefined;
  adapterTimeout: number;
  adapterRetries: number;
  adapterRetryDelay: number;
  debugMode: boolean;
  verboseLogging: boolean;
}

/**
 * Load environment configuration with defaults
 */
export function loadEnvironmentConfig(): EnvironmentConfig {
  return {
    nodeEnv: process.env.NODE_ENV || "development",
    logLevel: (process.env.LOG_LEVEL as any) || "info",
    mockApiKey: process.env.MOCK_API_KEY || "test-api-key",
    mockBaseUrl: process.env.MOCK_BASE_URL || "http://localhost:3001",
    mockDelay: parseInt(process.env.MOCK_DELAY || "100"),
    mockErrorRate: parseFloat(process.env.MOCK_ERROR_RATE || "0"),
    mockDataSet: (process.env.MOCK_DATA_SET as any) || "standard",
    tenantId: process.env.TENANT_ID,
    patientId: process.env.PATIENT_ID,
    adapterTimeout: parseInt(process.env.ADAPTER_TIMEOUT || "30000"),
    adapterRetries: parseInt(process.env.ADAPTER_RETRIES || "3"),
    adapterRetryDelay: parseInt(process.env.ADAPTER_RETRY_DELAY || "1000"),
    debugMode: process.env.DEBUG_MODE === "true",
    verboseLogging: process.env.VERBOSE_LOGGING === "true",
  };
}

/**
 * Create MockAdapter configuration from environment
 */
export function createMockConfigFromEnv() {
  const env = loadEnvironmentConfig();

  return {
    vendor: "mock" as const,
    baseUrl: env.mockBaseUrl,
    auth: {
      type: "apikey" as const,
      apiKey: env.mockApiKey,
    },
    delay: env.mockDelay,
    errorRate: env.mockErrorRate,
    dataSet: env.mockDataSet,
    options: {
      timeout: env.adapterTimeout,
      retries: env.adapterRetries,
      retryDelay: env.adapterRetryDelay,
    },
    environment: env.nodeEnv as any,
    logLevel: env.logLevel,
  };
}

/**
 * Validate environment configuration
 */
export function validateEnvironmentConfig(config: EnvironmentConfig): string[] {
  const errors: string[] = [];

  if (!config.mockApiKey) {
    errors.push("MOCK_API_KEY is required");
  }

  if (!config.mockBaseUrl) {
    errors.push("MOCK_BASE_URL is required");
  }

  if (config.mockDelay < 0 || config.mockDelay > 10000) {
    errors.push("MOCK_DELAY must be between 0 and 10000 milliseconds");
  }

  if (config.mockErrorRate < 0 || config.mockErrorRate > 100) {
    errors.push("MOCK_ERROR_RATE must be between 0 and 100");
  }

  if (!["minimal", "standard", "comprehensive"].includes(config.mockDataSet)) {
    errors.push(
      "MOCK_DATA_SET must be one of: minimal, standard, comprehensive"
    );
  }

  if (!["debug", "info", "warn", "error"].includes(config.logLevel)) {
    errors.push("LOG_LEVEL must be one of: debug, info, warn, error");
  }

  if (config.adapterTimeout < 1000 || config.adapterTimeout > 300000) {
    errors.push("ADAPTER_TIMEOUT must be between 1000 and 300000 milliseconds");
  }

  if (config.adapterRetries < 0 || config.adapterRetries > 10) {
    errors.push("ADAPTER_RETRIES must be between 0 and 10");
  }

  return errors;
}

/**
 * Print environment configuration summary
 */
export function printEnvironmentSummary(config?: EnvironmentConfig): void {
  const env = config || loadEnvironmentConfig();

  console.log("🌍 Environment Configuration Summary");
  console.log("=====================================");
  console.log(`Environment: ${env.nodeEnv}`);
  console.log(`Log Level: ${env.logLevel}`);
  console.log(`Mock Base URL: ${env.mockBaseUrl}`);
  console.log(`Mock API Key: ${env.mockApiKey ? "***" : "not set"}`);
  console.log(`Mock Delay: ${env.mockDelay}ms`);
  console.log(`Mock Error Rate: ${env.mockErrorRate}%`);
  console.log(`Mock Data Set: ${env.mockDataSet}`);
  console.log(`Adapter Timeout: ${env.adapterTimeout}ms`);
  console.log(`Adapter Retries: ${env.adapterRetries}`);

  if (env.tenantId) {
    console.log(`Tenant ID: ${env.tenantId}`);
  }

  if (env.patientId) {
    console.log(`Patient ID: ${env.patientId}`);
  }

  console.log(`Debug Mode: ${env.debugMode ? "enabled" : "disabled"}`);
  console.log(
    `Verbose Logging: ${env.verboseLogging ? "enabled" : "disabled"}`
  );
  console.log("=====================================\n");
}
