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

## Multi-Tenant Support (Commercial Feature)

**Multi-tenant isolation is not available in the MIT package.** This SDK
builds single-tenant adapters only. Per-tenant isolation, per-tenant audit
separation, and per-tenant transformation pipelines ship in the commercial
package, `@securecloudnetworks/ehr-adapter`.

### What happens if you ask for it

Setting `tenant` on an adapter config, or calling `getTenantAdapter()`, fails
immediately:

```typescript
import { EHRAdapterFactory } from "@securecloudnetworks/ehr-adapter-sdk";

EHRAdapterFactory.create("mock", {
  vendor: "mock",
  baseUrl: "http://localhost:3001",
  auth: { type: "apikey", apiKey: "dev-key" },
  tenant: { tenantId: "hospital-network-a", isolationLevel: "strict" },
});
// throws EHRAdapterError
//   code:    "COMMERCIAL_LICENSE_REQUIRED"
//   message: "Multi-tenant support requires a commercial license
//             — see https://ehradapter.com/pricing"
```

The error carries the standard `EHRAdapterError` shape, so you can branch on
`error.code` the same way you handle any other SDK failure:

```typescript
import { EHRAdapterFactory } from "@securecloudnetworks/ehr-adapter-sdk";
import { EHRAdapterError } from "@securecloudnetworks/ehr-adapter-sdk";

try {
  const adapter = EHRAdapterFactory.create(vendor, config);
  await adapter.connect();
} catch (error) {
  if (
    error instanceof EHRAdapterError &&
    error.code === "COMMERCIAL_LICENSE_REQUIRED"
  ) {
    // Surface an upgrade path rather than a stack trace
    return showUpgradePrompt("https://ehradapter.com/pricing");
  }
  throw error;
}
```

### Why it throws instead of falling back

The SDK could ignore `tenant` and hand back a plain adapter. It deliberately
does not. A non-isolated adapter returned from a call that requested isolation
looks like isolation is in effect when it is not — and in a healthcare context
that is how one customer ends up reading another customer's PHI. A loud
failure at construction time is recoverable; a silent one is a breach.

### Building a multi-customer platform on the MIT package

You can still serve multiple customers with this package, but the separation
is **yours to enforce** — the SDK provides no tenant guarantees. In practice
that means one adapter instance per customer, with separate credentials and
separate storage, and your own authorization check on every request:

```typescript
import { EHRAdapterFactory } from "@securecloudnetworks/ehr-adapter-sdk";
import type { EHRAdapter } from "@securecloudnetworks/ehr-adapter-sdk";

// One adapter per customer. No `tenant` key — that would throw.
const adapters = new Map<string, EHRAdapter>();

function adapterForCustomer(customerId: string): EHRAdapter {
  let adapter = adapters.get(customerId);
  if (!adapter) {
    adapter = EHRAdapterFactory.create("mock", loadConfigFor(customerId));
    adapters.set(customerId, adapter);
  }
  return adapter;
}

// Your application layer is the only thing keeping customers apart:
// the SDK will not stop customer A's session from using customer B's adapter.
async function getPatientFor(customerId: string, patientId: string) {
  assertCallerBelongsTo(customerId);            // you must write this
  assertPatientBelongsTo(customerId, patientId); // and this
  return adapterForCustomer(customerId).getPatient(patientId);
}
```

What you do **not** get here, and what the commercial package adds:

| Capability | MIT (this package) | Commercial |
|---|:---:|:---:|
| Adapter-level tenant isolation enforcement | ❌ | ✅ |
| Per-tenant audit log separation | ❌ | ✅ |
| Per-tenant transformation pipelines | ❌ | ✅ |
| Per-tenant config, headers, and metadata | ❌ | ✅ |
| Cross-tenant access errors (`TenantIsolationError`) | ❌ | ✅ |

If you are storing PHI for more than one customer, enforce separation in the
SDK rather than in application code you have to remember to write correctly
every time — **[see pricing](https://ehradapter.com/pricing)**.

---

## Connecting Multiple EHRs in One Platform

A common scenario: your platform serves clinics that use different EHR systems, and you want to aggregate data across all of them.

```typescript
import { MockAdapter } from "@ehradapter/ehr-adapter-sdk";
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
