/**
 * Environment Configuration Example
 *
 * This example demonstrates how to use environment variables
 * to configure the MockAdapter for different environments.
 */

import { MockAdapter } from "../../src";
import {
  createMockConfigFromEnv,
  loadEnvironmentConfig,
  printEnvironmentSummary,
  validateEnvironmentConfig,
} from "../../src/utils/environment";

async function environmentExample() {
  console.log("🌍 Environment Configuration Example");
  console.log("=====================================\n");

  // Print current environment configuration
  printEnvironmentSummary();

  // Method 1: Use environment helper utility (recommended)
  console.log("📋 Method 1: Using Environment Helper Utility");
  console.log("----------------------------------------------");

  const config = createMockConfigFromEnv();
  const adapter = new MockAdapter(config);

  console.log(`✅ Created MockAdapter with environment configuration`);
  console.log(`   - Environment: ${config.environment}`);
  console.log(`   - Base URL: ${config.baseUrl}`);
  console.log(`   - Mock Delay: ${config.delay}ms`);
  console.log(`   - Error Rate: ${config.errorRate}%`);
  console.log(`   - Data Set: ${config.dataSet}\n`);

  // Test the adapter with environment-configured patient ID
  try {
    const env = loadEnvironmentConfig();
    const patientId = env.patientId || "patient-001";

    console.log(`🔍 Retrieving patient: ${patientId}`);
    const patient = await adapter.getPatient(patientId);
    console.log(
      `✅ Retrieved patient: ${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family}`
    );

    // Search for patients if tenant ID is configured
    if (env.tenantId) {
      console.log(`🏢 Using tenant context: ${env.tenantId}`);
      const patients = await adapter.searchPatients({ name: "Smith" });
      console.log(`✅ Found ${patients.length} patients with name 'Smith'`);
    }
  } catch (error) {
    console.error("❌ Error retrieving patient:", error);
  }

  console.log("\n📋 Method 2: Manual Environment Variable Usage");
  console.log("-----------------------------------------------");

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
    options: {
      timeout: parseInt(process.env.ADAPTER_TIMEOUT || "30000"),
      retries: parseInt(process.env.ADAPTER_RETRIES || "3"),
      retryDelay: parseInt(process.env.ADAPTER_RETRY_DELAY || "1000"),
    },
  } as any);

  console.log("✅ Created MockAdapter with manual environment configuration");

  // Test different data sets based on environment
  console.log("\n📊 Testing Different Data Sets");
  console.log("-------------------------------");

  const dataSetExamples = ["minimal", "standard", "comprehensive"] as const;

  for (const dataSet of dataSetExamples) {
    const testAdapter = new MockAdapter({
      vendor: "mock",
      baseUrl: process.env.MOCK_BASE_URL || "http://localhost:3001",
      auth: {
        type: "apikey",
        apiKey: process.env.MOCK_API_KEY || "test-api-key",
      },
      dataSet,
      delay: 0, // No delay for testing
      errorRate: 0, // No errors for testing
    } as any);

    try {
      const patients = await testAdapter.searchPatients({});
      console.log(
        `📈 ${dataSet.padEnd(13)} dataset: ${patients.length} patients`
      );
    } catch (error) {
      console.error(`❌ Error with ${dataSet} dataset:`, error);
    }
  }

  // Demonstrate environment validation
  console.log("\n🔍 Environment Validation");
  console.log("-------------------------");

  const envConfig = loadEnvironmentConfig();
  const validationErrors = validateEnvironmentConfig(envConfig);

  if (validationErrors.length === 0) {
    console.log("✅ Environment configuration is valid");
  } else {
    console.log("❌ Environment configuration has errors:");
    validationErrors.forEach((error) => console.log(`   - ${error}`));
  }

  console.log("\n📋 Available Environment Variables");
  console.log("----------------------------------");
  console.log("Core Configuration:");
  console.log(`  NODE_ENV: ${process.env.NODE_ENV || "not set"}`);
  console.log(`  LOG_LEVEL: ${process.env.LOG_LEVEL || "not set"}`);
  console.log("\nMock Adapter Configuration:");
  console.log(
    `  MOCK_API_KEY: ${process.env.MOCK_API_KEY ? "***" : "not set"}`
  );
  console.log(`  MOCK_BASE_URL: ${process.env.MOCK_BASE_URL || "not set"}`);
  console.log(`  MOCK_DELAY: ${process.env.MOCK_DELAY || "not set"}`);
  console.log(`  MOCK_ERROR_RATE: ${process.env.MOCK_ERROR_RATE || "not set"}`);
  console.log(`  MOCK_DATA_SET: ${process.env.MOCK_DATA_SET || "not set"}`);
  console.log("\nSample Data Configuration:");
  console.log(`  TENANT_ID: ${process.env.TENANT_ID || "not set"}`);
  console.log(`  PATIENT_ID: ${process.env.PATIENT_ID || "not set"}`);
  console.log("\nAdapter Options:");
  console.log(`  ADAPTER_TIMEOUT: ${process.env.ADAPTER_TIMEOUT || "not set"}`);
  console.log(`  ADAPTER_RETRIES: ${process.env.ADAPTER_RETRIES || "not set"}`);
  console.log(
    `  ADAPTER_RETRY_DELAY: ${process.env.ADAPTER_RETRY_DELAY || "not set"}`
  );

  console.log("\n💡 Tips:");
  console.log("--------");
  console.log("1. Copy .env.example to .env and customize values");
  console.log("2. Use different .env files for different environments");
  console.log("3. Set NODE_ENV=production for production-like behavior");
  console.log("4. Increase MOCK_DELAY to simulate real network conditions");
  console.log("5. Set MOCK_ERROR_RATE > 0 to test error handling");
  console.log("6. Use LOG_LEVEL=debug for detailed logging");
}

// Run the example
if (require.main === module) {
  environmentExample().catch(console.error);
}

export { environmentExample };
