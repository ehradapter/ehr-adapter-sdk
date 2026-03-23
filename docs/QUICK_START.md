# Quick Start — Zero to Working FHIR Query in 5 Minutes

This guide takes you from a blank project to real FHIR R4 data using the EHR Adapter SDK's MockAdapter. No EHR credentials required.

---

## Prerequisites

- Node.js 16+
- TypeScript 4.5+
- npm or yarn

---

## Step 1: Install

> **Note:** The npm package `@ehradapter/ehr-adapter-sdk` is not yet published to npm. Clone the repo and build locally:

```bash
# Clone and build
git clone https://github.com/ehradapter/ehr-adapter-sdk.git
cd ehr-adapter-sdk
npm install
npm run build
```

Once published, installation will be:

```bash
npm install @ehradapter/ehr-adapter-sdk
```

---

## Step 2: Create Your First Adapter

Create `index.ts` in your project:

```typescript
import { MockAdapter } from "@ehradapter/ehr-adapter-sdk";

const adapter = new MockAdapter({
  vendor: "mock",
  baseUrl: "http://localhost:3001",
  auth: {
    type: "apikey",
    apiKey: "dev-key",
  },
});

await adapter.connect();
console.log("Adapter ready:", adapter.vendor, adapter.version);
```

Run it:

```bash
npx tsx index.ts
# → Adapter ready: mock 1.0.0
```

---

## Step 3: Get a Patient

```typescript
const patient = await adapter.getPatient("patient-001");

const firstName = patient.name?.[0]?.given?.[0];
const lastName  = patient.name?.[0]?.family;
const dob       = patient.birthDate;
const gender    = patient.gender;

console.log(`${firstName} ${lastName} | DOB: ${dob} | Gender: ${gender}`);
// → James Smith | DOB: 1985-03-15 | Gender: male
```

`getPatient` returns a full FHIR R4 `Patient` resource — all fields are typed.

---

## Step 4: Search Patients

```typescript
// Search by name
const smiths = await adapter.searchPatients({ name: "Smith" });
console.log(`Found ${smiths.length} patients named Smith`);

// Filter by gender
const femalePatients = await adapter.searchPatients({ gender: "female" });

// Paginate results
const page2 = await adapter.searchPatients(
  { name: "Smith" },
  { _offset: 10, _count: 10 }
);
```

Supported search criteria: `name`, `family`, `given`, `birthdate`, `gender`, `identifier`.

---

## Step 5: Get Clinical Data

### Vital Signs

```typescript
const vitals = await adapter.getVitals("patient-001");

for (const obs of vitals) {
  const display = obs.code.coding?.[0]?.display;
  const value   = obs.valueQuantity?.value;
  const unit    = obs.valueQuantity?.unit;
  console.log(`${display}: ${value} ${unit}`);
}
// → Heart rate: 72 beats/minute
// → Blood pressure systolic: 118 mmHg
// → Body temperature: 98.6 degF
```

Filter by date range:

```typescript
const recentVitals = await adapter.getVitals("patient-001", {
  dateRange: {
    start: "2024-01-01",
    end: "2024-12-31",
  },
  _count: 20,
});
```

### Lab Results

```typescript
const labs = await adapter.getLabs("patient-001");

for (const lab of labs) {
  const test  = lab.code.coding?.[0]?.display;
  const value = lab.valueQuantity?.value;
  const unit  = lab.valueQuantity?.unit;
  console.log(`${test}: ${value} ${unit}`);
}
// → Hemoglobin A1c: 5.7 %
// → Glucose: 95 mg/dL
```

### Medications

```typescript
const meds = await adapter.getMedications("patient-001");

for (const med of meds) {
  const name   = med.medicationCodeableConcept?.coding?.[0]?.display;
  const status = med.status;
  console.log(`${name} — ${status}`);
}
// → Lisinopril 10mg — active
// → Metformin 500mg — active
```

Filter by status:

```typescript
const activeMeds = await adapter.getMedications("patient-001", {
  status: ["active"],
});
```

### Appointments

```typescript
const appointments = await adapter.getAppointments("patient-001");

for (const appt of appointments) {
  const start       = appt.start;
  const status      = appt.status;
  const description = appt.description;
  console.log(`${start} — ${description} (${status})`);
}
```

Filter upcoming appointments:

```typescript
const upcoming = await adapter.getAppointments("patient-001", {
  dateRange: { start: new Date().toISOString() },
  status: ["booked", "pending"],
});
```

---

## Step 6: Custom Queries

The SDK supports custom query types for compound operations:

```typescript
// Patient summary — patient + recent vitals + meds + appointments in one call
const result = await adapter.executeCustomQuery<{
  patientId: string;
  summary: {
    patient: Patient;
    recentVitals: Observation[];
    currentMedications: MedicationRequest[];
    upcomingAppointments: Appointment[];
  };
}>({
  type: "patient-summary",
  parameters: { patientId: "patient-001" },
});

console.log("Patient:", result.summary.patient.name?.[0]?.family);
console.log("Recent vitals:", result.summary.recentVitals.length);
console.log("Active meds:", result.summary.currentMedications.length);
```

---

## Step 7: Environment Configuration

Rather than hardcoding values, use environment variables. Copy the example file:

```bash
cp .env.example .env
```

Then update `.env`:

```env
MOCK_API_KEY=my-dev-key
MOCK_BASE_URL=http://localhost:3001
MOCK_DELAY=100
MOCK_ERROR_RATE=0
MOCK_DATA_SET=standard
```

Use in code:

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

## Step 8: Handle Errors

The SDK has a typed error hierarchy so you can handle errors precisely:

```typescript
import {
  MockAdapter,
  EHRAdapterError,
  ResourceNotFoundError,
  AuthenticationError,
  RateLimitError,
} from "@ehradapter/ehr-adapter-sdk";

try {
  const patient = await adapter.getPatient("nonexistent-id");
} catch (error) {
  if (error instanceof ResourceNotFoundError) {
    console.log(`Patient not found: ${error.resourceId}`);
  } else if (error instanceof AuthenticationError) {
    console.log("Authentication failed — check your API key");
  } else if (error instanceof RateLimitError) {
    console.log(`Rate limited — retry after ${error.retryAfter}ms`);
  } else if (error instanceof EHRAdapterError) {
    console.log(`EHR error [${error.code}]: ${error.message}`);
  } else {
    throw error;
  }
}
```

---

## Simulate Real-World Conditions

Before going to production, test your error handling with the MockAdapter:

```typescript
// High-latency environment
const slowAdapter = new MockAdapter({
  vendor: "mock",
  baseUrl: "http://localhost:3001",
  auth: { type: "apikey", apiKey: "dev-key" },
  delay: 3000,      // 3 second latency
  errorRate: 0,
});

// Flaky network
const flakyAdapter = new MockAdapter({
  vendor: "mock",
  baseUrl: "http://localhost:3001",
  auth: { type: "apikey", apiKey: "dev-key" },
  delay: 500,
  errorRate: 20,    // 20% failure rate
});

// Update config at runtime without re-instantiating
flakyAdapter.updateMockConfig({ errorRate: 0 });
```

---

## Next Steps

**More examples:** see [`/examples/mock/`](../examples/mock/) in the repo for patient search, environment configuration, and more.

**API Reference:** [docs.ehradapter.com](https://docs.ehradapter.com)

**Integration Guides:**
- [Epic Integration Guide](./INTEGRATION_GUIDE_EPIC.md) — move from MockAdapter to Epic production
- [Multi-Vendor Guide](./MULTI_VENDOR_GUIDE.md) — run the same code against multiple EHR systems

**Go to production:** The MockAdapter is MIT-licensed and free forever. When you're ready to connect to a real EHR, purchase a commercial license at [ehradapter.com/pricing](https://ehradapter.com/pricing) and switch to `@securecloudnetworks/ehr-adapter`. Same API — your code doesn't change.

---

*Questions? [cortez@ehradapter.com](mailto:cortez@ehradapter.com)*
