# Changelog

All notable changes to the EHR Adapter SDK are documented here.

---

## [1.1.0] — 2026-03-23

### Commercial Infrastructure Launch

#### Added — Commercial Platform

- **Stripe Checkout live** — Developer ($99/mo) and Professional ($299/mo) plans processing real payments at [ehradapter.com/pricing](https://ehradapter.com/pricing)
- **Licensing backend** — Railway-hosted API at `api.ehradapter.com` for license key issuance and validation
- **Supabase licensing database** — `ehr-adapter-licensing` database managing active commercial licenses under Secure Cloud Networks Pro organization
- **License delivery** — Automated license key emails via Resend from `cortez@ehradapter.com` on purchase
- **Landing page** — [ehradapter.com](https://ehradapter.com) live on Vercel with product overview and pricing
- **Dual npm package model** — open-source `@ehradapter/ehr-adapter-sdk` (MIT) and commercial `@securecloudnetworks/ehr-adapter` clearly separated

#### Added — Documentation

- `docs/QUICK_START.md` — zero-to-FHIR-query in 5 minutes guide
- `docs/INTEGRATION_GUIDE_EPIC.md` — MockAdapter to Epic production migration walkthrough
- `docs/MULTI_VENDOR_GUIDE.md` — multi-vendor and multi-tenant architecture guide
- Rewritten `README.md` — conversion-focused developer landing page with feature comparison table, architecture overview, and dual-package upgrade path

#### Commercial SDK (Private)

- Epic Adapter — full Epic MyChart / FHIR R4 integration via `@securecloudnetworks/ehr-adapter`
- Athena Adapter — Athena Health practice management + FHIR
- Cerner Adapter — Cerner PowerChart integration
- Health Gorilla Adapter — Health Gorilla network aggregation
- OAuth2Provider — full OAuth2 authorization code and client credentials flows
- SmartOnFhirProvider — SMART launch context handling for EHR-embedded apps
- Security Package — HMAC signing, JWT validation, compliance auth providers
- LOINC Mapper plugin — normalized lab and vital code lookup
- SNOMED Mapper plugin — diagnosis and procedure code normalization
- AI Analytics plugin — clinical insights and anomaly detection
- GraphQL API layer — GraphQL interface over all FHIR operations
- CLI Tools — command-line adapter management and testing utilities

---

## [1.0.0] — 2025-08-26

### Initial Public Release

- Vendor-agnostic core adapter framework (`EHRAdapter` interface, `BaseAdapter`, `AdapterFactory`, `TenantAwareAdapter`)
- MockAdapter — full FHIR R4 EHR simulation with configurable delay, error rate, and dataset size
- MockDataGenerator and sample datasets (patients, observations, appointments, medications)
- Complete FHIR R4 TypeScript type system (Patient, Observation, Appointment, MedicationRequest, AllergyIntolerance, Condition, Procedure, Immunization, Practitioner, Organization, Bundle, CapabilityStatement)
- Authentication providers: `ApiKeyProvider`, `BearerTokenProvider`
- Plugin system: `PluginManager`, `TransformationPipeline`
- HTTP client with retries, timeout, and circuit breaker
- Zod-based FHIR resource validator
- AES-256-GCM encryption, HMAC, key derivation utilities
- Structured logger with console, file, and remote outputs
- HIPAA-compliant audit logger with sensitive data masking
- HIPAA/GDPR compliance event logger with breach detection
- Environment configuration loader with validation
- Full Jest test suite — 986/986 tests passing
- Examples: `basic-usage.ts`, `patient-search.ts`, `environment-usage.ts`
- GitHub CI workflow for type-checking and tests
- MIT license with commercial upgrade path noted in `LICENSE.md`

---

*Commercial changelog entries reflect the live production infrastructure. The MIT open-source SDK remains free for all uses. See [ehradapter.com/pricing](https://ehradapter.com/pricing) for commercial feature access.*
