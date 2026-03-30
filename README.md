# EHR Adapter SDK

[![npm version](https://img.shields.io/npm/v/@securecloudnetworks/ehr-adapter-sdk)](https://www.npmjs.com/package/@securecloudnetworks/ehr-adapter-sdk)
[![npm downloads](https://img.shields.io/npm/dm/@securecloudnetworks/ehr-adapter-sdk)](https://www.npmjs.com/package/@securecloudnetworks/ehr-adapter-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![FHIR R4](https://img.shields.io/badge/FHIR-R4-orange)](https://hl7.org/fhir/R4/)

**FHIR-compliant EHR integrations in days, not months.**

The TypeScript SDK that connects your applications to Epic, Athena, Cerner, and 15+ EHR systems — multi-vendor, multi-tenant, HIPAA-ready, with built-in AI capabilities for clinical data processing.

---

## Why EHR Adapter SDK?

Building EHR integrations from scratch takes 6–12 months and $200K+ in engineering time. EHR Adapter SDK gives you a production-ready adapter factory, unified FHIR R4 interface, and AI-powered clinical data tools out of the box.

| | Build from Scratch | EHR Adapter SDK |
|---|---|---|
| Time to first patient data | 6–12 months | 2–4 days |
| Vendors supported | 1 (maybe) | Epic, Athena, Cerner + more |
| FHIR normalization | You write it | ✅ Included |
| Multi-tenant isolation | You architect it | ✅ Included |
| AI clinical insights | You build it | ✅ Included (Pro) |
| HIPAA compliance layer | You implement it | ✅ Included (Pro) |

---

## Quick Start (Zero Config)

The open-source SDK ships with a `MockAdapter` — no credentials, no EHR sandbox, no configuration needed. Start building your integration logic today.

```bash
npm install @securecloudnetworks/ehr-adapter-sdk
```

```typescript
import { AdapterFactory } from '@securecloudnetworks/ehr-adapter-sdk';

// MockAdapter works with no license key — perfect for development
const adapter = AdapterFactory.create('mock');

// Query patient data using the unified FHIR R4 interface
const patient = await adapter.getPatient('patient-123');
console.log(patient.name, patient.birthDate);

// Fetch observations — same API regardless of EHR vendor
const observations = await adapter.getObservations('patient-123', {
  category: 'laboratory',
  dateRange: { start: '2024-01-01', end: '2024-12-31' }
});

console.log(`Found ${observations.length} lab results`);
```

Your integration logic works identically against MockAdapter in dev and EpicAdapter in production — just swap the adapter type and set your license key.

---

## Switching to a Real EHR

When you're ready for production, swap the adapter type. The rest of your code stays the same.

```typescript
import { AdapterFactory } from '@securecloudnetworks/ehr-adapter-sdk';

// Set your license key (from ehradapter.com/pricing)
// EHR_ADAPTER_LICENSE_KEY=DEV-2026-XXXX-XXXX

const adapter = AdapterFactory.create('epic', {
  baseUrl: process.env.EPIC_FHIR_BASE_URL,
  clientId: process.env.EPIC_CLIENT_ID,
  privateKey: process.env.EPIC_PRIVATE_KEY,
});

// Same API — no code changes needed
const patient = await adapter.getPatient('patient-123');
```

---

## Feature Tiers

| Feature | Community (Free) | Developer | Professional | Enterprise |
|---|---|---|---|---|
| MockAdapter (dev/test) | ✅ | ✅ | ✅ | ✅ |
| EpicAdapter | ❌ | ✅ | ✅ | ✅ |
| AthenaAdapter | ❌ | ✅ | ✅ | ✅ |
| CernerAdapter | ❌ | ❌ | ❌ | ✅ |
| HealthGorillaAdapter | ❌ | ❌ | ❌ | ✅ |
| LOINC Mapper | ❌ | ❌ | ✅ | ✅ |
| SNOMED Mapper | ❌ | ❌ | ✅ | ✅ |
| Advanced Security Plugin | ❌ | ❌ | ✅ | ✅ |
| AI Analytics Plugin | ❌ | ❌ | ❌ | ✅ |
| Multi-tenant isolation | ❌ | ✅ | ✅ | ✅ |
| HIPAA compliance layer | ❌ | ❌ | ✅ | ✅ |
| SLA + support | ❌ | Email | Priority | Dedicated |
| **Pricing** | **Free** | **$99/mo** | **$299/mo** | **Custom** |

> **Need Epic, Athena, or Cerner?** [Get a license key at ehradapter.com →](https://ehradapter.com/pricing)

---

## Core Concepts

### Adapter Factory

The factory routes to the correct vendor adapter based on type. Feature gates are enforced at the factory level — no license key, no real EHR access.

```typescript
// Community — always works, no key needed
const mock = AdapterFactory.create('mock');

// Developer tier and above
const epic = AdapterFactory.create('epic', config);
const athena = AdapterFactory.create('athena', config);

// Enterprise tier
const cerner = AdapterFactory.create('cerner', config);
```

### Unified FHIR R4 Interface

Every adapter implements the same interface. Write once, run against any EHR.

```typescript
// Works on MockAdapter, EpicAdapter, AthenaAdapter — identical API
await adapter.getPatient(patientId);
await adapter.getObservations(patientId, filters);
await adapter.getMedications(patientId);
await adapter.getConditions(patientId);
await adapter.getEncounters(patientId, dateRange);
await adapter.createObservation(patientId, observation);
```

### Multi-Tenant Isolation (Developer+)

Each tenant gets isolated credentials, rate limiting, and audit logging.

```typescript
const adapter = AdapterFactory.create('epic', {
  tenantId: 'org-abc-123',   // Isolates credentials + audit trail
  baseUrl: process.env.EPIC_FHIR_BASE_URL,
  clientId: process.env.EPIC_CLIENT_ID_ORG_ABC,
  privateKey: process.env.EPIC_PRIVATE_KEY_ORG_ABC,
});
```

### License Key Setup

```bash
# .env
EHR_ADAPTER_LICENSE_KEY=DEV-2026-XXXX-XXXX
```

The SDK reads the key at runtime. No server calls — pure offline prefix validation. Upgrade your key to unlock higher tiers instantly.

---

## What Happens Without a License Key

```
Error: "Epic Adapter" requires Developer tier ($99/mo or $999/yr).
Current tier: community
Purchase or upgrade at: https://ehradapter.com/pricing
After purchase, set: EHR_ADAPTER_LICENSE_KEY=<your-key>
```

MockAdapter always works — build your entire integration before purchasing.

---

## Commercial Package

The open-source SDK (`@securecloudnetworks/ehr-adapter-sdk`) is the foundation. The commercial package (`@securecloudnetworks/ehr-adapter`) includes:

- Epic, Athena, Cerner, Health Gorilla adapters
- LOINC + SNOMED terminology mappers
- Advanced Security Plugin (AES-256-GCM, HMAC signing, compliance engine)
- AI Analytics Plugin (clinical summarization, anomaly detection)
- Multi-tenant SLA guarantees

```bash
npm install @securecloudnetworks/ehr-adapter
```

[Compare tiers and get a license key →](https://ehradapter.com/pricing)

---

## TypeScript Support

Full TypeScript types shipped. No `@types` package needed.

```typescript
import type {
  Patient,
  Observation,
  Medication,
  Condition,
  Encounter,
  AdapterConfig,
  FHIRBundle,
} from '@securecloudnetworks/ehr-adapter-sdk';
```

---

## Contributing

This repository is the open-source foundation of EHR Adapter SDK. Contributions welcome.

```bash
git clone https://github.com/ehradapter/ehr-adapter-sdk.git
cd ehr-adapter-sdk
npm install
npm test
```

Please open an issue before submitting a PR for significant changes.

---

## License

MIT © [Aether Origins Solutions LLC](https://aetherorigins.com)

---

## Links

- 🌐 Website: [ehradapter.com](https://ehradapter.com)
- 📦 npm: [@securecloudnetworks/ehr-adapter-sdk](https://www.npmjs.com/package/@securecloudnetworks/ehr-adapter-sdk)
- 📖 Docs: [docs.ehradapter.com](https://docs.ehradapter.com)
- 💼 Commercial: [@securecloudnetworks/ehr-adapter](https://www.npmjs.com/package/@securecloudnetworks/ehr-adapter)
- 🏢 Company: [aetherorigins.com](https://aetherorigins.com)
