# EHR Adapter SDK

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/ehradapter/ehr-adapter-sdk/blob/main/LICENSE.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-3178C6.svg)](https://www.typescriptlang.org/)
[![FHIR R4](https://img.shields.io/badge/FHIR-R4-brightgreen.svg)](https://hl7.org/fhir/R4/)
[![Tests](https://img.shields.io/badge/tests-986%2F986%20passing-brightgreen.svg)](https://github.com/ehradapter/ehr-adapter-sdk/actions)
[![Node](https://img.shields.io/badge/node-%3E%3D16-brightgreen.svg)](https://nodejs.org)

> **Ship EHR integrations in days, not months.**  
> Production-ready TypeScript SDK for multi-vendor FHIR R4 integration. Start free with MockAdapter — go live with Epic, Athena, Cerner, and Health Gorilla on a commercial license.

---

## Quick Start

> **Note:** The npm package `@ehradapter/ehr-adapter-sdk` is not yet published. Until it is, clone the repo and use it directly:

```bash
# Option 1 — npm install (once published)
npm install @ehradapter/ehr-adapter-sdk

# Option 2 — clone and link locally (available now)
git clone https://github.com/ehradapter/ehr-adapter-sdk.git
cd ehr-adapter-sdk && npm install && npm run build
```

```typescript
import { MockAdapter } from "@ehradapter/ehr-adapter-sdk";

const adapter = new MockAdapter({
  vendor: "mock",
  baseUrl: "http://localhost:3001",
  auth: { type: "apikey", apiKey: "dev-key" },
});

const patient   = await adapter.getPatient("patient-001");
const vitals    = await adapter.getVitals("patient-001");
const meds      = await adapter.getMedications("patient-001");
const schedule  = await adapter.getAppointments("patient-001");

console.log(`${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family}`);
// → "James Smith"
```

That's it. No EHR credentials, no sandbox accounts, no NDAs — just working FHIR data in your local environment.

---

## What's Included (MIT — Free)

**Core Architecture**
- `EHRAdapter` interface — the unified contract all adapters implement
- `BaseAdapter` — HTTP client, automatic retries, circuit breaker, audit logging
- `AdapterFactory` — create adapters by vendor name
- `TenantAwareAdapter` — multi-tenant isolation wrapper for SaaS platforms

**Authentication**
- `ApiKeyProvider` — API key auth (header, query param, or cookie)
- `BearerTokenProvider` — JWT/Bearer token auth with validation

**Type System**
- Complete FHIR R4 TypeScript types: Patient, Observation, Appointment, MedicationRequest, AllergyIntolerance, Condition, Procedure, Immunization, Practitioner, Organization, Bundle, CapabilityStatement
- Full error hierarchy: `AuthError`, `RateLimitError`, `ResourceNotFoundError`, `TenantIsolationError`, `FHIRValidationError`, and more
- Builder-pattern config types for adapters and tenants

**Plugin System**
- `PluginManager` — register/unregister plugins, lifecycle hooks
- `TransformationPipeline` — pre/post processors and validation pipeline

**MockAdapter**
- Full EHR simulation with realistic FHIR data (patients, vitals, labs, medications, appointments)
- Configurable delay, error rate, and dataset size for testing every scenario
- No external dependencies — works offline

**Utilities**
- HTTP client with retries, timeout, and circuit breaker
- Zod-based FHIR resource validator
- AES-256-GCM encryption, HMAC, key derivation
- HIPAA-compliant structured and audit logging
- HIPAA/GDPR compliance event logging with breach detection
- Environment config loader

**Tests:** 986/986 passing.

---

## Feature Comparison

| Feature | MIT (Free) | Developer<br>$99/mo | Professional<br>$299/mo | Enterprise |
|---|:---:|:---:|:---:|:---:|
| MockAdapter | ✅ | ✅ | ✅ | ✅ |
| Core SDK + Types | ✅ | ✅ | ✅ | ✅ |
| Plugin System | ✅ | ✅ | ✅ | ✅ |
| HIPAA Audit Logging | ✅ | ✅ | ✅ | ✅ |
| Epic MyChart (FHIR R4) | ❌ | ✅ | ✅ | ✅ |
| Athena Health | ❌ | ✅ | ✅ | ✅ |
| Cerner PowerChart | ❌ | ✅ | ✅ | ✅ |
| Health Gorilla | ❌ | ❌ | ✅ | ✅ |
| OAuth2 / SMART on FHIR | ❌ | ✅ | ✅ | ✅ |
| LOINC / SNOMED Mapper | ❌ | ❌ | ✅ | ✅ |
| AI Analytics Plugin | ❌ | ❌ | ✅ | ✅ |
| GraphQL API Layer | ❌ | ❌ | ✅ | ✅ |
| CLI Tools | ❌ | ❌ | ✅ | ✅ |
| Advanced Security (JWT/HMAC) | ❌ | ✅ | ✅ | ✅ |
| Priority Support | ❌ | ✅ | ✅ | ✅ |
| SLA | ❌ | ❌ | ❌ | ✅ |
| Dedicated Success Engineer | ❌ | ❌ | ❌ | ✅ |

**[View full pricing →](https://ehradapter.com/pricing)**

---

## MockAdapter Deep Dive

The MockAdapter is the free entry point — and it's not a toy. It simulates a real EHR with full FHIR R4 data so you can build your entire integration before touching a production system.

```typescript
import { MockAdapter } from "@ehradapter/ehr-adapter-sdk";

const adapter = new MockAdapter({
  vendor: "mock",
  baseUrl: "http://localhost:3001",
  auth: { type: "apikey", apiKey: "dev-key" },
  delay: 150,        // simulate real network latency (ms)
  errorRate: 5,      // simulate 5% of requests failing
  dataSet: "comprehensive",  // "minimal" | "standard" | "comprehensive"
});

await adapter.connect();

// Patient operations
const patient     = await adapter.getPatient("patient-001");
const results     = await adapter.searchPatients({ name: "Smith", gender: "female" });

// Clinical data
const vitals      = await adapter.getVitals("patient-001", {
  dateRange: { start: "2024-01-01", end: "2024-12-31" },
  _count: 10,
});
const labs        = await adapter.getLabs("patient-001");
const meds        = await adapter.getMedications("patient-001");
const allergies   = await adapter.getAllergies?.("patient-001");

// Scheduling
const upcoming    = await adapter.getAppointments("patient-001", {
  status: ["booked", "pending"],
});

// Custom queries
const summary = await adapter.executeCustomQuery({
  type: "patient-summary",
  parameters: { patientId: "patient-001" },
});

// System
const caps        = await adapter.getCapabilities();
const health      = await adapter.healthCheck();

await adapter.disconnect();
```

### Simulate failure scenarios

```typescript
// Test your error handling before going to production
const flakyAdapter = new MockAdapter({
  vendor: "mock",
  baseUrl: "http://localhost:3001",
  auth: { type: "apikey", apiKey: "dev-key" },
  errorRate: 30,    // 30% failure rate — stress test your retry logic
  delay: 2000,      // 2s latency — test your timeout handling
});

// Update config without re-instantiating
flakyAdapter.updateMockConfig({ errorRate: 0, delay: 50 });
```

---

## Architecture Overview

The SDK uses an adapter pattern: your application code talks to the `EHRAdapter` interface, and the adapter handles all vendor-specific logic. Switching vendors is a one-line config change.

```
Your Application
      │
      ▼
 EHRAdapter (interface)
      │
      ├── MockAdapter        (free, MIT)
      ├── EpicAdapter        (commercial)
      ├── AthenaAdapter      (commercial)
      ├── CernerAdapter      (commercial)
      └── HealthGorillaAdapter (commercial)
```

Every adapter returns the same FHIR R4 types. Every error is the same `EHRAdapterError` hierarchy. Your integration code stays the same — you swap the adapter config when you're ready for production.

**Multi-tenant SaaS:** Wrap any adapter in `TenantAwareAdapter` for per-tenant isolation, config, and audit logging.

---

## Environment Configuration

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `MOCK_API_KEY` | API key for MockAdapter | `test-api-key` |
| `MOCK_BASE_URL` | Base URL | `http://localhost:3001` |
| `MOCK_DELAY` | Simulated latency (ms) | `100` |
| `MOCK_ERROR_RATE` | % of requests that fail | `0` |
| `MOCK_DATA_SET` | Dataset size | `standard` |
| `NODE_ENV` | Environment | `development` |
| `LOG_LEVEL` | Log verbosity | `info` |
| `TENANT_ID` | Demo tenant ID | `demo-tenant` |

```typescript
const adapter = new MockAdapter({
  vendor: "mock",
  baseUrl: process.env.MOCK_BASE_URL || "http://localhost:3001",
  auth: {
    type: "apikey",
    apiKey: process.env.MOCK_API_KEY || "dev-key",
  },
  delay: parseInt(process.env.MOCK_DELAY || "100"),
  errorRate: parseFloat(process.env.MOCK_ERROR_RATE || "0"),
  dataSet: (process.env.MOCK_DATA_SET as "minimal" | "standard" | "comprehensive") || "standard",
});
```

---

## Development

```bash
git clone https://github.com/ehradapter/ehr-adapter-sdk.git
cd ehr-adapter-sdk
npm install

npm test                              # run 986 tests
npm run test:coverage                 # coverage report
npm run build                         # compile to lib/
npx tsx examples/mock/basic-usage.ts  # run an example
```

---

## Examples

See [`/examples/mock/`](./examples/mock/) for runnable code:

- [`basic-usage.ts`](./examples/mock/basic-usage.ts) — getting started, all core operations
- [`patient-search.ts`](./examples/mock/patient-search.ts) — search filters, pagination
- [`environment-usage.ts`](./examples/mock/environment-usage.ts) — env-based configuration

---

## API Reference

Full API docs: **[docs.ehradapter.com](https://docs.ehradapter.com)**  
Integration guides: [`/docs`](./docs/)

- [Quick Start](./docs/QUICK_START.md) — zero to working FHIR query in 5 minutes
- [Epic Integration Guide](./docs/INTEGRATION_GUIDE_EPIC.md) — MockAdapter → Epic production
- [Multi-Vendor Guide](./docs/MULTI_VENDOR_GUIDE.md) — write once, run on any EHR

---

## Commercial License

The MIT version is the complete SDK minus vendor adapters. When you're ready to connect to real EHRs, purchase a commercial license and switch packages:

```bash
# Free MIT version (this repo)
npm install @ehradapter/ehr-adapter-sdk

# Commercial version (after license purchase)
npm install @securecloudnetworks/ehr-adapter
```

The commercial SDK (`@securecloudnetworks/ehr-adapter`) is a drop-in replacement — same API, same types, same method signatures. You get Epic, Athena, Cerner, Health Gorilla, OAuth2/SMART on FHIR, premium plugins, and priority support.

**[Purchase a license →](https://ehradapter.com/pricing)**

---

## Support

| Channel | Details |
|---|---|
| GitHub Issues | [github.com/ehradapter/ehr-adapter-sdk/issues](https://github.com/ehradapter/ehr-adapter-sdk/issues) |
| Commercial Support | [cortez@ehradapter.com](mailto:cortez@ehradapter.com) |
| Documentation | [docs.ehradapter.com](https://docs.ehradapter.com) |
| Pricing | [ehradapter.com/pricing](https://ehradapter.com/pricing) |

---

## License & Contributing

This project is [MIT licensed](./LICENSE.md) — free for any use including commercial products, as long as you're using the MockAdapter and core SDK. Production integrations with real EHR vendors require a [commercial license](https://ehradapter.com/pricing).

Contributions welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).

---

*Built by [EHR Adapter](https://ehradapter.com) · Maintained by Aether Origins Solutions LLC*
