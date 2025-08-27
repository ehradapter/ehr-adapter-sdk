# Environment Configuration Setup Plan

## EHR Adapter SDK - MIT Edition

This document outlines the complete plan for adding environment configuration support to the MIT SDK.

## Files to Create/Modify

### 1. Create `.env.example` file

**Path:** `ehr-adapter-sdk/.env.example`

**Content:**

```bash
# ======================================
# EHR Adapter SDK - .env.example
# MIT Edition (Open Source)
# ======================================
# Copy this file to `.env` and configure as needed for local development

# Environment Configuration
NODE_ENV=development
LOG_LEVEL=info

# Mock Adapter Configuration
MOCK_API_KEY=test-api-key
MOCK_BASE_URL=http://localhost:3001
MOCK_DELAY=100
MOCK_ERROR_RATE=0
MOCK_DATA_SET=standard

# Sample Data Configuration
TENANT_ID=demo-tenant
PATIENT_ID=example-patient-id

# Optional Mock Extensions
MOCK_SIMULATE_RATE_LIMIT=false
MOCK_SIMULATE_NETWORK_ERRORS=false
MOCK_SIMULATE_AUTH_ERRORS=false

# Adapter Options
ADAPTER_TIMEOUT=30000
ADAPTER_RETRIES=3
ADAPTER_RETRY_DELAY=1000

# Development Settings
DEBUG_MODE=false
VERBOSE_LOGGING=false
```

### 2. Update README.md

**Section to Add:** After the existing "🔧 Development Setup" section (around line 125)

**New Section:**

````markdown
## ⚙️ Environment Configuration

To run examples and configure the MockAdapter, copy the environment template:

```bash
cp .env.example .env
```
````

Then update the values as needed for your development environment.

### Environment Variables

| Variable          | Description                            | Default                 | Example                                |
| ----------------- | -------------------------------------- | ----------------------- | -------------------------------------- |
| `NODE_ENV`        | Application environment                | `development`           | `development`, `testing`, `production` |
| `LOG_LEVEL`       | Logging verbosity                      | `info`                  | `debug`, `info`, `warn`, `error`       |
| `MOCK_API_KEY`    | API key for MockAdapter authentication | `test-api-key`          | Any string value                       |
| `MOCK_BASE_URL`   | Base URL for mock services             | `http://localhost:3001` | Any valid URL                          |
| `MOCK_DELAY`      | Simulated response delay (ms)          | `100`                   | `0-5000`                               |
| `MOCK_ERROR_RATE` | Percentage of requests that fail       | `0`                     | `0-100`                                |
| `MOCK_DATA_SET`   | Sample data complexity                 | `standard`              | `minimal`, `standard`, `comprehensive` |
| `TENANT_ID`       | Demo tenant identifier                 | `demo-tenant`           | Any string                             |
| `PATIENT_ID`      | Example patient ID for testing         | `example-patient-id`    | Any valid patient ID                   |

### Using Environment Variables

The SDK automatically reads environment variables when creating adapters:

```typescript
import { MockAdapter } from "@securecloudnetworks/ehr-adapter";

// Environment variables are automatically used
const adapter = new MockAdapter({
  vendor: "mock",
  baseUrl: process.env.MOCK_BASE_URL || "http://localhost:3001",
  auth: {
    type: "apikey",
    apiKey: process.env.MOCK_API_KEY || "test-api-key",
  },
  delay: parseInt(process.env.MOCK_DELAY || "100"),
  errorRate: parseFloat(process.env.MOCK_ERROR_RATE || "0"),
  dataSet: (process.env.MOCK_DATA_SET as any) || "standard",
});
```

````

### 3. Verify .gitignore

**Action:** Confirm `.env` is already present in `.gitignore` (it is, on line 67)

### 4. Create Environment Helper Utility

**Path:** `ehr-adapter-sdk/src/utils/environment.ts`

**Content:**
```typescript
/**
 * Environment configuration utilities
 * Helps load and validate environment variables for the EHR Adapter SDK
 */

export interface EnvironmentConfig {
  nodeEnv: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  mockApiKey: string;
  mockBaseUrl: string;
  mockDelay: number;
  mockErrorRate: number;
  mockDataSet: 'minimal' | 'standard' | 'comprehensive';
  tenantId?: string;
  patientId?: string;
  adapterTimeout: number;
  adapterRetries: number;
  adapterRetryDelay: number;
}

/**
 * Load environment configuration with defaults
 */
export function loadEnvironmentConfig(): EnvironmentConfig {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: (process.env.LOG_LEVEL as any) || 'info',
    mockApiKey: process.env.MOCK_API_KEY || 'test-api-key',
    mockBaseUrl: process.env.MOCK_BASE_URL || 'http://localhost:3001',
    mockDelay: parseInt(process.env.MOCK_DELAY || '100'),
    mockErrorRate: parseFloat(process.env.MOCK_ERROR_RATE || '0'),
    mockDataSet: (process.env.MOCK_DATA_SET as any) || 'standard',
    tenantId: process.env.TENANT_ID,
    patientId: process.env.PATIENT_ID,
    adapterTimeout: parseInt(process.env.ADAPTER_TIMEOUT || '30000'),
    adapterRetries: parseInt(process.env.ADAPTER_RETRIES || '3'),
    adapterRetryDelay: parseInt(process.env.ADAPTER_RETRY_DELAY || '1000'),
  };
}

/**
 * Create MockAdapter configuration from environment
 */
export function createMockConfigFromEnv() {
  const env = loadEnvironmentConfig();

  return {
    vendor: 'mock' as const,
    baseUrl: env.mockBaseUrl,
    auth: {
      type: 'apikey' as const,
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
````

### 5. Update Example Files

**Path:** `ehr-adapter-sdk/examples/mock/environment-usage.ts`

**Content:**

```typescript
/**
 * Environment Configuration Example
 *
 * This example demonstrates how to use environment variables
 * to configure the MockAdapter for different environments.
 */

import { MockAdapter } from "../../src";
import { createMockConfigFromEnv } from "../../src/utils/environment";

async function environmentExample() {
  console.log("🌍 Environment Configuration Example");
  console.log("=====================================");

  // Method 1: Use environment helper utility
  const config = createMockConfigFromEnv();
  const adapter = new MockAdapter(config);

  console.log(`Environment: ${config.environment}`);
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Mock Delay: ${config.delay}ms`);
  console.log(`Error Rate: ${config.errorRate}%`);
  console.log(`Data Set: ${config.dataSet}`);

  // Test the adapter
  try {
    const patient = await adapter.getPatient(
      process.env.PATIENT_ID || "patient-001"
    );
    console.log(
      `✅ Retrieved patient: ${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family}`
    );
  } catch (error) {
    console.error("❌ Error retrieving patient:", error);
  }

  // Method 2: Manual environment variable usage
  const manualAdapter = new MockAdapter({
    vendor: "mock",
    baseUrl: process.env.MOCK_BASE_URL || "http://localhost:3001",
    auth: {
      type: "apikey",
      apiKey: process.env.MOCK_API_KEY || "test-api-key",
    },
    delay: parseInt(process.env.MOCK_DELAY || "100"),
    errorRate: parseFloat(process.env.MOCK_ERROR_RATE || "0"),
    dataSet: (process.env.MOCK_DATA_SET as any) || "standard",
  });

  console.log("\n📋 Available environment variables:");
  console.log("- NODE_ENV:", process.env.NODE_ENV || "not set");
  console.log("- LOG_LEVEL:", process.env.LOG_LEVEL || "not set");
  console.log("- MOCK_API_KEY:", process.env.MOCK_API_KEY ? "***" : "not set");
  console.log("- TENANT_ID:", process.env.TENANT_ID || "not set");
  console.log("- PATIENT_ID:", process.env.PATIENT_ID || "not set");
}

// Run the example
if (require.main === module) {
  environmentExample().catch(console.error);
}

export { environmentExample };
```

## Implementation Steps

1. **Switch to Code mode** to implement file creation and modifications
2. **Create `.env.example`** with comprehensive configuration options
3. **Update README.md** with the Environment Configuration section
4. **Create environment utility** for easier configuration management
5. **Add example file** demonstrating environment variable usage
6. **Test the implementation** to ensure everything works correctly
7. **Validate MIT compliance** - ensure no commercial features are referenced

## Success Criteria

- ✅ `.env.example` file created with all relevant configuration options
- ✅ `.env` properly excluded in `.gitignore` (already present)
- ✅ README.md updated with clear environment configuration instructions
- ✅ Environment utility created for easier configuration management
- ✅ Example demonstrating environment variable usage
- ✅ All changes align with MIT license requirements
- ✅ No references to commercial features or CLI functionality

## Benefits

1. **Improved Developer Onboarding** - Clear environment setup instructions
2. **Flexible Configuration** - Easy to switch between development/testing environments
3. **Consistent Setup** - Standardized environment variable names and defaults
4. **Better Examples** - Practical demonstrations of environment usage
5. **Production Ready** - Clear separation of configuration from code
