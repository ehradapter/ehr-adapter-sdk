# Epic Integration Guide

## From MockAdapter to Epic Production

You've built your integration with the MockAdapter. Your code is clean, tested, and handling every edge case. This guide shows you exactly what changes when you go live with Epic — which is less than you'd expect.

> **Requires:** EHR Adapter commercial license ([ehradapter.com/pricing](https://ehradapter.com/pricing))

---

## The Big Picture

The EHR Adapter SDK is designed so that switching from mock to production is a configuration change, not a code change. Here's the before and after:

**Development (MockAdapter — free MIT)**
```typescript
import { MockAdapter } from "@ehradapter/ehr-adapter-sdk";

const adapter = new MockAdapter({
  vendor: "mock",
  baseUrl: "http://localhost:3001",
  auth: {
    type: "apikey",
    apiKey: process.env.MOCK_API_KEY,
  },
  delay: 100,
  errorRate: 0,
  dataSet: "comprehensive",
});
```

**Production (EpicAdapter — commercial)**
```typescript
import { EpicAdapter } from "@securecloudnetworks/ehr-adapter";

const adapter = new EpicAdapter({
  vendor: "epic",
  baseUrl: process.env.EPIC_FHIR_BASE_URL,   // e.g. https://fhir.epic.com/interconnect-fhir-oauth
  auth: {
    type: "oauth2",
    clientId: process.env.EPIC_CLIENT_ID,
    clientSecret: process.env.EPIC_CLIENT_SECRET,
    tokenUrl: process.env.EPIC_TOKEN_URL,
    scope: "launch/patient openid fhirUser patient/*.read",
  },
});
```

**Every line of application code below this stays the same.**

```typescript
// This code works identically with MockAdapter or EpicAdapter
await adapter.connect();

const patient      = await adapter.getPatient(patientId);
const vitals       = await adapter.getVitals(patientId);
const labs         = await adapter.getLabs(patientId);
const medications  = await adapter.getMedications(patientId);
const appointments = await adapter.getAppointments(patientId);
```

---

## What Changes

| | MockAdapter | EpicAdapter |
|---|---|---|
| **Package** | `@ehradapter/ehr-adapter-sdk` | `@securecloudnetworks/ehr-adapter` |
| **Auth type** | `apikey` (simple string) | `oauth2` (full OAuth2/SMART flow) |
| **Base URL** | `http://localhost:3001` | Your Epic FHIR endpoint |
| **Patient IDs** | `patient-001`, `patient-002` | Epic FHIR patient IDs (UUIDs) |
| **Data** | Sample data | Real patient records |
| **Credentials** | Any string | Epic-registered app credentials |

## What Stays the Same

- All method signatures: `getPatient`, `getVitals`, `getLabs`, `getMedications`, `getAppointments`, `searchPatients`, `executeCustomQuery`, `healthCheck`
- All return types: FHIR R4 `Patient`, `Observation`, `MedicationRequest`, `Appointment`
- All error types: `ResourceNotFoundError`, `AuthenticationError`, `RateLimitError`, etc.
- All query options: `dateRange`, `_count`, `_offset`, `status`, `code`
- Your error handling, retry logic, and business logic

---

## Step-by-Step Migration

### Step 1: Purchase a Commercial License

Go to [ehradapter.com/pricing](https://ehradapter.com/pricing). After checkout, you'll receive your license key by email and access to the `@securecloudnetworks/ehr-adapter` package.

### Step 2: Install the Commercial Package

```bash
# Remove the MIT package
npm uninstall @ehradapter/ehr-adapter-sdk

# Install the commercial package
npm install @securecloudnetworks/ehr-adapter
```

### Step 3: Register Your App with Epic

Before you can use the EpicAdapter, Epic must approve your application. The process differs by environment:

**Epic Sandbox (FHIR Sandbox / Open Endpoint)**  
Epic provides a publicly accessible sandbox environment. Go to [fhir.epic.com](https://fhir.epic.com) and create a developer account. No approval required for sandbox access.

**Epic Production (MyChart / Interconnect)**  
Production access requires registering through your customer's Epic instance. The health system's IT team must provision your app credentials. Allow 2–8 weeks for this process.

You'll receive:
- `clientId` — your application's OAuth2 client ID
- `clientSecret` — your client secret (keep this out of source control)
- `tokenUrl` — the token endpoint for your OAuth2 flow
- `fhirBaseUrl` — your Epic FHIR R4 base URL

### Step 4: Configure OAuth2/SMART on FHIR

Epic uses OAuth2 with SMART on FHIR extensions. The commercial SDK handles the full OAuth2 flow:

```typescript
import { EpicAdapter } from "@securecloudnetworks/ehr-adapter";

const adapter = new EpicAdapter({
  vendor: "epic",
  baseUrl: process.env.EPIC_FHIR_BASE_URL,
  auth: {
    type: "oauth2",
    clientId: process.env.EPIC_CLIENT_ID,
    clientSecret: process.env.EPIC_CLIENT_SECRET,
    tokenUrl: process.env.EPIC_TOKEN_URL,
    scope: "launch/patient openid fhirUser patient/*.read",
    grantType: "client_credentials",  // for backend/system apps
  },
  timeout: 30000,
  retry: {
    maxAttempts: 3,
    backoffMs: 1000,
  },
});
```

For patient-context (EHR launch) flows, use `SmartOnFhirProvider` included in the commercial SDK:

```typescript
import { EpicAdapter, SmartOnFhirProvider } from "@securecloudnetworks/ehr-adapter";

const smartAuth = new SmartOnFhirProvider({
  clientId: process.env.EPIC_CLIENT_ID,
  redirectUri: process.env.EPIC_REDIRECT_URI,
  scope: "launch/patient openid fhirUser patient/*.read",
  issuer: process.env.EPIC_ISSUER_URL,
});

const adapter = new EpicAdapter({
  vendor: "epic",
  baseUrl: process.env.EPIC_FHIR_BASE_URL,
  authProvider: smartAuth,
});
```

### Step 5: Update Environment Variables

```env
# Remove mock variables
# MOCK_API_KEY=...
# MOCK_BASE_URL=...

# Add Epic variables
EPIC_FHIR_BASE_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
EPIC_CLIENT_ID=your-client-id
EPIC_CLIENT_SECRET=your-client-secret
EPIC_TOKEN_URL=https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token
```

### Step 6: Update Your Import

```typescript
// Before
import { MockAdapter } from "@ehradapter/ehr-adapter-sdk";
const adapter = new MockAdapter({ vendor: "mock", ... });

// After
import { EpicAdapter } from "@securecloudnetworks/ehr-adapter";
const adapter = new EpicAdapter({ vendor: "epic", ... });
```

Everything else in your codebase stays the same.

---

## Environment-Aware Adapter Selection

A common pattern is to use the MockAdapter in development and the EpicAdapter in production, driven by an environment variable:

```typescript
import type { EHRAdapter } from "@ehradapter/ehr-adapter-sdk";

async function createAdapter(): Promise<EHRAdapter> {
  if (process.env.NODE_ENV === "production" || process.env.EHR_VENDOR === "epic") {
    // Dynamic import — only loads in production
    const { EpicAdapter } = await import("@securecloudnetworks/ehr-adapter");
    return new EpicAdapter({
      vendor: "epic",
      baseUrl: process.env.EPIC_FHIR_BASE_URL!,
      auth: {
        type: "oauth2",
        clientId: process.env.EPIC_CLIENT_ID!,
        clientSecret: process.env.EPIC_CLIENT_SECRET!,
        tokenUrl: process.env.EPIC_TOKEN_URL!,
        scope: "launch/patient openid fhirUser patient/*.read",
      },
    });
  }

  // Default: MockAdapter for local development
  const { MockAdapter } = await import("@ehradapter/ehr-adapter-sdk");
  return new MockAdapter({
    vendor: "mock",
    baseUrl: process.env.MOCK_BASE_URL || "http://localhost:3001",
    auth: { type: "apikey", apiKey: process.env.MOCK_API_KEY || "dev-key" },
    delay: parseInt(process.env.MOCK_DELAY || "100"),
  });
}

// Usage — same in dev and production
const adapter = await createAdapter();
const patient = await adapter.getPatient(patientId);  // works identically in both
```

---

## Epic-Specific Considerations

### Patient ID Format

Epic uses UUID-format FHIR IDs, not simple strings:

```typescript
// MockAdapter — simple IDs
const patient = await mockAdapter.getPatient("patient-001");

// EpicAdapter — UUID format
const patient = await epicAdapter.getPatient("e3mNRvXLKCnkqp9nFYCdQCA3");
```

You'll get these IDs from Epic's patient search or from your SMART launch context.

### Search by MRN

Epic patients can be found by their Medical Record Number using the identifier search parameter:

```typescript
const patients = await adapter.searchPatients({
  identifier: "MRN|1234567",  // Epic MRN format
});
```

### Observation Codes

Epic returns LOINC-coded observations. The commercial SDK includes a LOINC Mapper plugin (Professional tier) for normalized code lookups:

```typescript
import { LOINCMapper } from "@securecloudnetworks/ehr-adapter/plugins";

const mapper = new LOINCMapper();
const vitals = await adapter.getVitals(patientId);
const normalized = mapper.normalize(vitals);
// → Consistently labeled regardless of Epic instance version
```

### Rate Limits

Epic production environments enforce rate limits. The SDK handles retry with backoff automatically, but for high-volume workloads configure your retry settings:

```typescript
const adapter = new EpicAdapter({
  vendor: "epic",
  baseUrl: process.env.EPIC_FHIR_BASE_URL!,
  auth: { ... },
  retry: {
    maxAttempts: 5,
    backoffMs: 2000,
    backoffMultiplier: 1.5,
  },
  rateLimit: {
    requestsPerSecond: 10,
    burstLimit: 50,
  },
});
```

---

## Going Live Checklist

Before switching to production traffic:

- [ ] App registered and approved by Epic (production instance)
- [ ] OAuth2 credentials secured in environment variables (not source code)
- [ ] All FHIR operations tested in Epic sandbox with real patient IDs
- [ ] Error handling tested for `AuthenticationError` and `RateLimitError`
- [ ] Audit logging configured and HIPAA compliance verified
- [ ] Token refresh handling tested (OAuth2 tokens expire)
- [ ] Timeout and retry configuration tuned for your Epic instance
- [ ] Business Associate Agreement (BAA) signed with Epic if applicable

---

## Need Help?

Commercial license holders get priority support.  
Contact: [cortez@ehradapter.com](mailto:cortez@ehradapter.com)

For Enterprise deployments (multi-site Epic, custom contract terms, dedicated onboarding), reach out directly for a scoping call.

**[Purchase a license →](https://ehradapter.com/pricing)**

---

*See also: [Multi-Vendor Guide](./MULTI_VENDOR_GUIDE.md) — connect to Athena, Cerner, and Health Gorilla with the same pattern*
