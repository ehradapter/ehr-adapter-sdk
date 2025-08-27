# EHR Adapter SDK

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/ehradapter/ehr-adapter-sdk/blob/main/LICENSE.md)
[![npm version](https://badge.fury.io/js/%40ehradapter%2Fehr-adapter-sdk.svg)](https://badge.fury.io/js/%40ehradapter%2Fehr-adapter-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![FHIR R4](https://img.shields.io/badge/FHIR-R4-green.svg)](https://hl7.org/fhir/R4/)

> **Open-source TypeScript SDK for EHR integrations with FHIR 4.0.1 compatibility**

This is the **MIT-licensed** version of the EHR Adapter SDK, perfect for development, testing, and learning. It includes a fully functional Mock adapter and core SDK functionality.

## 🚀 Quick Start

```bash
npm install @ehradapter/ehr-adapter-sdk
```

```typescript
import { MockAdapter } from "@ehradapter/ehr-adapter-sdk";

// Initialize Mock Adapter for development/testing
const adapter = new MockAdapter({
  vendor: "mock",
  baseUrl: "http://localhost:3001",
  auth: { type: "apikey", apiKey: "mock-key" },
});

// Get patient data
const patient = await adapter.getPatient("patient-001");
console.log(
  `Patient: ${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family}`
);

// Search patients
const patients = await adapter.searchPatients({ name: "Smith" });
console.log(`Found ${patients.length} patients`);

// Get vital signs
const vitals = await adapter.getVitals("patient-001");
console.log(`Found ${vitals.length} vital sign observations`);
```

## 📦 What's Included (MIT License)

### ✅ Core SDK Components

- **EHRAdapter Interface** - Standardized API for all EHR systems
- **BaseAdapter** - Common functionality and error handling
- **AdapterFactory** - Easy adapter instantiation
- **TenantAwareAdapter** - Multi-tenant support framework

### ✅ Type Definitions

- **FHIR R4 Types** - Complete TypeScript definitions
- **Configuration Types** - Adapter and auth configuration
- **Error Types** - Comprehensive error handling

### ✅ Authentication (Basic)

- **ApiKeyProvider** - API key authentication
- **BearerTokenProvider** - Bearer token authentication

### ✅ Plugin System

- **PluginManager** - Extensible plugin architecture
- **TransformationPipeline** - Data transformation framework

### ✅ Mock Adapter

- **MockAdapter** - Full-featured mock EHR for development
- **MockDataGenerator** - Realistic test data generation
- **Configurable Behavior** - Simulate delays, errors, different datasets

### ✅ Utilities

- **HTTP Client** - Robust HTTP handling with retries
- **FHIR Validator** - Data validation utilities
- **Logging System** - Structured logging with multiple outputs

## 🏥 Mock Adapter Features

The included Mock Adapter provides a complete EHR simulation:

```typescript
const mockAdapter = new MockAdapter({
  vendor: "mock",
  baseUrl: "http://localhost:3001",
  auth: { type: "apikey", apiKey: "mock-key" },
  delay: 100, // Simulate network delay
  errorRate: 0.05, // 5% random error rate
  dataSet: "large", // Use large dataset
});

// All standard operations work
const patient = await mockAdapter.getPatient("patient-001");
const vitals = await mockAdapter.getVitals("patient-001");
const appointments = await mockAdapter.getAppointments("patient-001");
const medications = await mockAdapter.getMedications("patient-001");

// Custom queries
const summary = await mockAdapter.executeCustomQuery({
  type: "patient-summary",
  parameters: { patientId: "patient-001" },
});
```

## 📚 Examples

Check out the `/examples/mock/` directory for comprehensive examples:

- **basic-usage.ts** - Getting started with the Mock Adapter
- **patient-search.ts** - Advanced patient search capabilities
- **vitals-monitoring.ts** - Working with vital signs and observations

## 🔧 Development Setup

```bash
# Clone the repository
git clone https://github.com/ehradapter/ehr-adapter-sdk.git
cd ehr-adapter-sdk

# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build

# Run examples
npm run dev examples/mock/basic-usage.ts
```

## ⚙️ Environment Configuration

To run examples and configure the MockAdapter, copy the environment template:

```bash
cp .env.example .env
```

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
import { MockAdapter } from "@ehradapter/ehr-adapter-sdk";

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

## 📖 Documentation

- **[API Documentation](./docs/api/)** - Complete API reference
- **[Examples](./examples/)** - Working code examples
- **[Contributing Guide](./CONTRIBUTING.md)** - How to contribute

## 🏢 Commercial License Available

This open-source version is perfect for development and testing, but **production EHR integrations require our commercial license**.

### 🚀 Commercial Features

| Feature                         | MIT (Open Source) | Commercial License |
| ------------------------------- | :---------------: | :----------------: |
| Mock Adapter                    |        ✅         |         ✅         |
| Core SDK                        |        ✅         |         ✅         |
| Epic MyChart Integration        |        ❌         |         ✅         |
| Athena Health Integration       |        ❌         |         ✅         |
| Cerner PowerChart Integration   |        ❌         |         ✅         |
| OAuth2 Authentication           |        ❌         |         ✅         |
| Advanced Security (JWT, HMAC)   |        ❌         |         ✅         |
| Premium Plugins                 |        ❌         |         ✅         |
| LOINC/SNOMED Mapping            |        ❌         |         ✅         |
| AI Analytics                    |        ❌         |         ✅         |
| Compliance Logging (HIPAA/GDPR) |        ❌         |         ✅         |
| Multi-tenant Architecture       |       Basic       |      Advanced      |
| Priority Support                |        ❌         |         ✅         |

### 💰 Pricing

- **Starter**: $99/month - Single EHR integration
- **Professional**: $299/month - Multiple EHR integrations + premium plugins
- **Enterprise**: Custom pricing - Full feature set + dedicated support

**[View Pricing Details →](https://ehradapter.com/pricing)**

## 🤝 Support & Community

- **Documentation**: https://docs.ehradapter.com
- **GitHub Issues**: https://github.com/ehradapter/ehr-adapter-sdk/issues
- **Discord Community**: https://discord.gg/ehradapter
- **Commercial Support**: hello@ehradapter.com

## 📄 License

This project is dual-licensed:

- **MIT License** - For this open-source version
- **Commercial License** - For production EHR integrations

See [LICENSE.md](./LICENSE.md) for full details.

## 🙏 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

## ⭐ Star Us!

If you find this project useful, please give it a star on GitHub! It helps us understand the community interest and prioritize development.

---

**Made with ❤️ by the [EHR Adapter Organization](https://github.com/ehradapter)**
