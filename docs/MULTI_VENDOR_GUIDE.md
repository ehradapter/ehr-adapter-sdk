# Multi-Vendor Integration Guide

## Write Once, Connect to Any EHR

Healthcare software teams spend months building and maintaining direct integrations with each EHR system — different APIs, different auth flows, different data models, different quirks. The EHR Adapter SDK solves this with a single unified interface: write your integration logic once against the `EHRAdapter` interface, then swap in whichever vendor adapter you need.

---

## The Problem

Every major EHR speaks a different dialect:

| System | Auth | API Style | Quirks |
|---|---|---|---|
| Epic | OAuth2 / SMART on FHIR | FHIR R4 | Patient IDs are UUIDs, proprietary extensions |
| Athena | OAuth2 / API keys | Proprietary + FHIR | Practice-level tenant model |
| Cerner | OAuth2 / SMART on FHIR | FHIR R4 + Millennium | Code system variations |
| Health Gorilla | OAuth2 | FHIR R4 | Network-based record aggregation |

Without an abstraction layer, connecting to three EHR systems means writing three separate codebases, maintaining three authentication flows, and handling three different sets of edge cases. When one API changes, you have three places to fix it.

---

## The Solution

The EHR Adapter SDK provides a single `EHRAdapter` interface. All vendor adapters implement it identically. Your application code never touches a vendor-specific API.

```
Your Application Code
         │
         ▼
  EHRAdapter Interface
  ┌────────────────────────────────────────────┐
  │ getPatient(id)                             │
  │ searchPatients(criteria)                   │
  │ getVitals(patientId)                       │
  │ getLabs(patientId)                         │
  │ getMedications(patientId)                  │
  │ getAppointments(patientId)                 │
  │ executeCustomQuery(query)                  │
  └────────────────────────────────────────────┘
         │
         ├── MockAdapter        (@ehradapter/ehr-adapter-sdk — MIT, free)
         ├── EpicAdapter        (@securecloudnetworks/ehr-adapter — commercial)
         ├── AthenaAdapter      (@securecloudnetworks/ehr-adapter — commercial)
         ├── CernerAdapter      (@securecloudnetworks/ehr-adapter — commercial)
         └── HealthGorillaAdapter (@securecloudnetworks/ehr-adapter — commercial)
```

---

## Same Code, Any Vendor

Here's how the same application code runs against every EHR with a configuration swap:

```typescript
import { MockAdapter } from "@ehradapter/ehr-adapter-sdk";
// import { EpicAdapter, AthenaAdapter, CernerAdapter } from "@securecloudnetworks/ehr-adapter";
import type { EHRAdapter } from "@ehradapter/ehr-adapter-sdk";

// ── ADAPTER CONFIGURATIONS ──────────────────────────────────────

const MOCK_CONFIG = {
  vendor: "mock",
  baseUrl: "http://localhost:3001",
  auth: { type: "apikey" as const, apiKey: process.env.MOCK_API_KEY },
  delay: 100,
  dataSet: "comprehensive" as const,
};

// const EPIC_CONFIG = {
//   vendor: "epic",
//   baseUrl: process.env.EPIC_FHIR_BASE_URL,
//   auth: {
//     type: "oauth2",
//     clientId: process.env.EPIC_CLIENT_ID,
//     clientSecret: process.env.EPIC_CLIENT_SECRET,
//     tokenUrl: process.env.EPIC_TOKEN_URL,
//     scope: "launch/patient openid fhirUser patient/*.read",
//   },
// };

// const ATHENA_CONFIG = {
//   vendor: "athena",
//   baseUrl: process.env.ATHENA_BASE_URL,
//   auth: {
//     type: "oauth2",
//     clientId: process.env.ATHENA_CLIENT_ID,
//     clientSecret: process.env.ATHENA_CLIENT_SECRET,
//     tokenUrl: process.env.ATHENA_TOKEN_URL,
//   },
//   practiceId: process.env.ATHENA_PRACTICE_ID,
// };

// const CERNER_CONFIG = {
//   vendor: "cerner",
//   baseUrl: process.env.CERNER_FHIR_BASE_URL,
//   auth: {
//     type: "oauth2",
//     clientId: process.env.CERNER_CLIENT_ID,
//     clientSecret: process.env.CERNER_CLIENT_SECRET,
//     tokenUrl: process.env.CERNER_TOKEN_URL,
//     scope: "system/Patient.read system/Observation.read",
//   },
// };

// ── ADAPTER FACTORY ──────────────────────────────────────────────

function createAdapter(vendor: string): EHRAdapter {
  switch (vendor) {
    case "mock":
      return new MockAdapter(MOCK_CONFIG);
    // case "epic":
    //   return new EpicAdapter(EPIC_CONFIG);
    // case "athena":
    //   return new AthenaAdapter(ATHENA_CONFIG);
    // case "cerner":
    //   return new CernerAdapter(CERNER_CONFIG);
    default:
      throw new Error(`Unknown vendor: ${vendor}`);
  }
}

// ── YOUR APPLICATION LOGIC (never changes) ───────────────────────

async function getDashboardData(patientId: string, vendor = "mock") {
  const adapter = createAdapter(vendor);
  await adapter.connect();

  const [patient, vitals, medications, appointments] = await Promise.all([
    adapter.getPatient(patientId),
    adapter.getVitals(patientId, { _count: 10 }),
    adapter.getMedications(patientId, { status: ["active"] }),
    adapter.getAppointments(patientId, {
      dateRange: { start: new Date().toISOString() },
    }),
  ]);

  await adapter.disconnect();

  return { patient, vitals, medications, appointments };
}

// Same function call — different vendor, same result shape
const mockData  = await getDashboardData("patient-001", "mock");
// const epicData  = await getDashboardData("e3mNRvXLKCnkqp9nFYCdQCA3", "epic");
// const athenaData = await getDashboardData("E-12345", "athena");
```

---

## Vendor Capabilities

| Capability | Mock | Epic | Athena | Cerner | Health Gorilla |
|---|:---:|:---:|:---:|:---:|:---:|
| Patient search | ✅ | ✅ | ✅ | ✅ | ✅ |
| Vital signs | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lab results | ✅ | ✅ | ✅ | ✅ | ✅ |
| Medications | ✅ | ✅ | ✅ | ✅ | ✅ |
| Appointments | ✅ | ✅ | ✅ | ✅ | ❌ |
| Allergies | ✅ | ✅ | ✅ | ✅ | ✅ |
| Conditions | ✅ | ✅ | ✅ | ✅ | ✅ |
| Immunizations | ✅ | ✅ | ✅ | ✅ | ✅ |
| Procedures | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create appointments | ❌ | ✅ | ✅ | ✅ | ❌ |
| Bulk export | ❌ | ✅ | ✅ | ✅ | ❌ |
| SMART on FHIR | ❌ | ✅ | ✅ | ✅ | ❌ |

Mock, Epic, Athena, and Cerner are available on the Developer tier ($99/mo). Health Gorilla requires Professional ($299/mo).

---

## Multi-Tenant Architecture for SaaS Platforms

If you're building a SaaS healthcare platform that serves multiple customers — each potentially on a different EHR — `TenantAwareAdapter` is your tool. It wraps any adapter with per-tenant isolation, logging, and transformation pipelines.

### Basic Multi-Tenant Setup

```typescript
import { MockAdapter, TenantAwareAdapter } from "@ehradapter/ehr-adapter-sdk";
import type { TenantAdapterConfig } from "@ehradapter/ehr-adapter-sdk";

// Base adapter — one per EHR vendor
const mockAdapter = new MockAdapter({
  vendor: "mock",
  baseUrl: "http://localhost:3001",
  auth: { type: "apikey", apiKey: "dev-key" },
});

// Tenant A — hospital network
const tenantAConfig: TenantAdapterConfig = {
  tenantId: "hospital-network-a",
  config: {
    vendor: "mock",
    baseUrl: "http://localhost:3001",
    auth: { type: "apikey", apiKey: "dev-key" },
    options: {
      headers: {
        "X-Tenant-ID": "hospital-network-a",
        "X-Org-Code": "HNA-001",
      },
    },
    tenant: {
      isolationLevel: "strict",
      metadata: {
        orgName: "Hospital Network A",
        tier: "enterprise",
        region: "us-east-1",
      },
    },
  },
};

const tenantAAdapter = new TenantAwareAdapter(mockAdapter, tenantAConfig);

// Tenant B — clinic group (completely isolated)
const tenantBAdapter = new TenantAwareAdapter(mockAdapter, {
  tenantId: "clinic-group-b",
  config: {
    vendor: "mock",
    baseUrl: "http://localhost:3001",
    auth: { type: "apikey", apiKey: "dev-key" },
    tenant: {
      isolationLevel: "strict",
      metadata: { orgName: "Clinic Group B", tier: "professional" },
    },
  },
});

// Data for Tenant A is invisible to Tenant B — enforced at the adapter level
const patientA = await tenantAAdapter.getPatient("patient-001");
const auditA   = await tenantAAdapter.getAuditLog();  // only Tenant A's logs
const auditB   = await tenantBAdapter.getAuditLog();  // only Tenant B's logs
```

### Dynamic Tenant Routing

For platforms with many tenants, route to the right adapter at request time:

```typescript
import type { EHRAdapter } from "@ehradapter/ehr-adapter-sdk";

// Tenant registry — in production, load from your database
const tenantRegistry: Record<string, { vendor: string; config: any }> = {
  "org-001": { vendor: "mock",  config: { /* mock config */   } },
  "org-002": { vendor: "epic",  config: { /* epic config */   } },  // commercial
  "org-003": { vendor: "athena",config: { /* athena config */ } },  // commercial
};

class MultiTenantAdapterRouter {
  private adapters = new Map<string, EHRAdapter>();

  async getAdapter(tenantId: string): Promise<EHRAdapter> {
    if (!this.adapters.has(tenantId)) {
      const tenantDef = tenantRegistry[tenantId];
      if (!tenantDef) throw new Error(`Unknown tenant: ${tenantId}`);

      const adapter = await this.createAdapter(tenantDef.vendor, tenantDef.config);
      this.adapters.set(tenantId, adapter);
    }

    return this.adapters.get(tenantId)!;
  }

  private async createAdapter(vendor: string, config: any): Promise<EHRAdapter> {
    switch (vendor) {
      case "mock": {
        const { MockAdapter, TenantAwareAdapter } = await import("@ehradapter/ehr-adapter-sdk");
        const base = new MockAdapter(config);
        return new TenantAwareAdapter(base, config.tenantConfig);
      }
      // case "epic": {
      //   const { EpicAdapter, TenantAwareAdapter } = await import("@securecloudnetworks/ehr-adapter");
      //   const base = new EpicAdapter(config);
      //   return new TenantAwareAdapter(base, config.tenantConfig);
      // }
      default:
        throw new Error(`Unknown vendor: ${vendor}`);
    }
  }
}

// Usage
const router = new MultiTenantAdapterRouter();

// Route org-001's request to their configured EHR
const adapter = await router.getAdapter("org-001");
const patient = await adapter.getPatient(patientId);
```

### Tenant-Specific Data Transformations

`TenantAwareAdapter` supports per-tenant transformation pipelines — useful when different customers need data in different formats or have custom field requirements:

```typescript
import { TenantAwareAdapter } from "@ehradapter/ehr-adapter-sdk";
import type { TransformationPipeline, DataProcessor } from "@ehradapter/ehr-adapter-sdk";

// Custom processor: add organization branding to patient records
const addOrgMetadata: DataProcessor = {
  name: "add-org-metadata",
  enabled: true,
  process: async (data: any, context) => {
    if (Array.isArray(data)) {
      return data.map(item => ({
        ...item,
        _orgContext: { tenantId: context.tenantId, processedAt: new Date().toISOString() },
      }));
    }
    return {
      ...data,
      _orgContext: { tenantId: context.tenantId, processedAt: new Date().toISOString() },
    };
  },
};

const pipeline: TransformationPipeline = {
  preProcessors: [],
  postProcessors: [addOrgMetadata],
  options: { failFast: false },
};

const tenantAdapter = new TenantAwareAdapter(baseAdapter, {
  tenantId: "org-with-custom-transform",
  config: { /* ... */ },
  transformationPipeline: pipeline,
});
```

---

## Connecting Multiple EHRs in One Platform

A common scenario: your platform serves clinics that use different EHR systems, and you want to aggregate data across all of them.

```typescript
import { MockAdapter, TenantAwareAdapter } from "@ehradapter/ehr-adapter-sdk";
// import { EpicAdapter, AthenaAdapter } from "@securecloudnetworks/ehr-adapter";

interface PatientRecord {
  source: string;
  patientId: string;
  data: Awaited<ReturnType<typeof adapter.getPatient>>;
}

async function aggregatePatientData(
  patientIds: Record<string, string>  // { vendor: patientId }
): Promise<PatientRecord[]> {
  const results: PatientRecord[] = [];

  for (const [vendor, patientId] of Object.entries(patientIds)) {
    const adapter = createAdapter(vendor);
    await adapter.connect();

    try {
      const patient = await adapter.getPatient(patientId);
      results.push({ source: vendor, patientId, data: patient });
    } catch (err) {
      // Continue collecting from other sources even if one fails
      console.warn(`Failed to fetch from ${vendor}:`, err);
    } finally {
      await adapter.disconnect?.();
    }
  }

  return results;
}

// Fetch the same patient across multiple EHRs
const records = await aggregatePatientData({
  mock:   "patient-001",
  // epic:   "e3mNRvXLKCnkqp9nFYCdQCA3",   // requires commercial license
  // athena: "E-12345",                       // requires commercial license
});
```

---

## Upgrade Path

| What you need | Package | License |
|---|---|---|
| Development, testing, CI | `@ehradapter/ehr-adapter-sdk` | MIT (free) |
| Epic, Athena, or Cerner | `@securecloudnetworks/ehr-adapter` | Developer ($99/mo) |
| All vendors + LOINC/SNOMED mapping + GraphQL + CLI | `@securecloudnetworks/ehr-adapter` | Professional ($299/mo) |
| Multi-site, custom SLA, dedicated engineer | `@securecloudnetworks/ehr-adapter` | Enterprise (custom) |

The commercial package is a drop-in replacement:

```bash
# Start free
npm install @ehradapter/ehr-adapter-sdk

# Upgrade when you need real EHRs
npm install @securecloudnetworks/ehr-adapter
```

Same imports pattern. Same types. Same error handling. Your application code doesn't change — only the adapter instantiation and the npm package.

**[View pricing →](https://ehradapter.com/pricing)**  
**[Start the Epic upgrade →](./INTEGRATION_GUIDE_EPIC.md)**

---

## Questions & Support

| Channel | Contact |
|---|---|
| Commercial licensing & sales | [cortez@ehradapter.com](mailto:cortez@ehradapter.com) |
| GitHub Issues (MIT/open source) | [github.com/ehradapter/ehr-adapter-sdk/issues](https://github.com/ehradapter/ehr-adapter-sdk/issues) |
| Documentation | [docs.ehradapter.com](https://docs.ehradapter.com) |

---

*See also: [Quick Start](./QUICK_START.md) · [Epic Integration Guide](./INTEGRATION_GUIDE_EPIC.md)*
