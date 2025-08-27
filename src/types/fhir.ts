/**
 * FHIR 4.0.1 Types - Hybrid Approach
 *
 * Custom lightweight types that extend standard FHIR where needed.
 * Focuses on core resources used by the EHR Adapter SDK.
 */

// Base FHIR types
export interface Resource {
  resourceType: string;
  id?: string;
  meta?: Meta;
  implicitRules?: string;
  language?: string;
}

export interface Meta {
  versionId?: string;
  lastUpdated?: string;
  source?: string;
  profile?: string[];
  security?: Coding[];
  tag?: Coding[];
}

export interface Extension {
  url: string;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueDecimal?: number;
  valueDateTime?: string;
  valueCode?: string;
  valueCoding?: Coding;
  valueQuantity?: Quantity;
  valueReference?: Reference;
}

export interface Coding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}

export interface CodeableConcept {
  coding?: Coding[];
  text?: string;
}

export interface Identifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: CodeableConcept;
  system?: string;
  value?: string;
  period?: Period;
  assigner?: Reference;
}

export interface Reference {
  reference?: string;
  type?: string;
  identifier?: Identifier;
  display?: string;
}

export interface Period {
  start?: string;
  end?: string;
}

export interface Quantity {
  value?: number;
  comparator?: '<' | '<=' | '>=' | '>';
  unit?: string;
  system?: string;
  code?: string;
}

export interface HumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  period?: Period;
}

export interface ContactPoint {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  rank?: number;
  period?: Period;
}

export interface Address {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  type?: 'postal' | 'physical' | 'both';
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  period?: Period;
}

// Base extensible resource
export interface ExtensibleResource extends Resource {
  extension?: Extension[];
  _extensions?: Record<string, any>; // Plugin-added extensions
}

// Patient Resource
export interface Patient extends ExtensibleResource {
  resourceType: 'Patient';
  identifier?: Identifier[];
  active?: boolean;
  name?: HumanName[];
  telecom?: ContactPoint[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
  address?: Address[];
  maritalStatus?: CodeableConcept;
  multipleBirthBoolean?: boolean;
  multipleBirthInteger?: number;
  photo?: Attachment[];
  contact?: PatientContact[];
  communication?: PatientCommunication[];
  generalPractitioner?: Reference[];
  managingOrganization?: Reference;
  link?: PatientLink[];

  // Plugin-extensible fields
  _vendorSpecific?: {
    epic?: EpicPatientExtensions;
    athena?: AthenaPatientExtensions;
    [vendor: string]: unknown;
  };
}

export interface PatientContact {
  relationship?: CodeableConcept[];
  name?: HumanName;
  telecom?: ContactPoint[];
  address?: Address;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  organization?: Reference;
  period?: Period;
}

export interface PatientCommunication {
  language: CodeableConcept;
  preferred?: boolean;
}

export interface PatientLink {
  other: Reference;
  type: 'replaced-by' | 'replaces' | 'refer' | 'seealso';
}

export interface Attachment {
  contentType?: string;
  language?: string;
  data?: string;
  url?: string;
  size?: number;
  hash?: string;
  title?: string;
  creation?: string;
}

export interface Encounter extends ExtensibleResource {
  resourceType: 'Encounter';
  identifier?: Identifier[];
  status:
    | 'planned'
    | 'arrived'
    | 'triaged'
    | 'in-progress'
    | 'onleave'
    | 'finished'
    | 'cancelled'
    | 'entered-in-error'
    | 'unknown';
  statusHistory?: {
    status:
      | 'planned'
      | 'arrived'
      | 'triaged'
      | 'in-progress'
      | 'onleave'
      | 'finished'
      | 'cancelled'
      | 'entered-in-error'
      | 'unknown';
    period: Period;
  }[];
  class: Coding;
  classHistory?: {
    class: Coding;
    period: Period;
  }[];
  type?: CodeableConcept[];
  serviceType?: CodeableConcept;
  priority?: CodeableConcept;
  subject?: Reference;
  episodeOfCare?: Reference[];
  basedOn?: Reference[];
  participant?: {
    type?: CodeableConcept[];
    period?: Period;
    individual?: Reference;
  }[];
  appointment?: Reference[];
  period?: Period;
  length?: Duration;
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  diagnosis?: {
    condition: Reference;
    use?: CodeableConcept;
    rank?: number;
  }[];
  account?: Reference[];
  hospitalization?: {
    preAdmissionIdentifier?: Identifier;
    origin?: Reference;
    admitSource?: CodeableConcept;
    reAdmission?: CodeableConcept;
    dietPreference?: CodeableConcept[];
    specialCourtesy?: CodeableConcept[];
    specialArrangement?: CodeableConcept[];
    destination?: Reference;
    dischargeDisposition?: CodeableConcept;
  };
  location?: {
    location: Reference;
    status?: 'planned' | 'active' | 'reserved' | 'completed';
    physicalType?: CodeableConcept;
    period?: Period;
  }[];
  serviceProvider?: Reference;
  partOf?: Reference;
}

// Observation Resource (for vitals, labs, etc.)
export interface Observation extends ExtensibleResource {
  resourceType: 'Observation';
  identifier?: Identifier[];
  basedOn?: Reference[];
  partOf?: Reference[];
  status:
    | 'registered'
    | 'preliminary'
    | 'final'
    | 'amended'
    | 'corrected'
    | 'cancelled'
    | 'entered-in-error'
    | 'unknown';
  category?: CodeableConcept[];
  code: CodeableConcept;
  subject?: Reference;
  focus?: Reference[];
  encounter?: Reference;
  effectiveDateTime?: string;
  effectivePeriod?: Period;
  effectiveTiming?: Timing;
  effectiveInstant?: string;
  issued?: string;
  performer?: Reference[];
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: Range;
  valueRatio?: Ratio;
  valueSampledData?: SampledData;
  valueTime?: string;
  valueDateTime?: string;
  valuePeriod?: Period;
  dataAbsentReason?: CodeableConcept;
  interpretation?: CodeableConcept[];
  note?: Annotation[];
  bodySite?: CodeableConcept;
  method?: CodeableConcept;
  specimen?: Reference;
  device?: Reference;
  referenceRange?: ObservationReferenceRange[];
  hasMember?: Reference[];
  derivedFrom?: Reference[];
  component?: ObservationComponent[];
}

export interface Timing {
  event?: string[];
  repeat?: TimingRepeat;
  code?: CodeableConcept;
}

export interface TimingRepeat {
  boundsDuration?: Duration;
  boundsRange?: Range;
  boundsPeriod?: Period;
  count?: number;
  countMax?: number;
  duration?: number;
  durationMax?: number;
  durationUnit?: 's' | 'min' | 'h' | 'd' | 'wk' | 'mo' | 'a';
  frequency?: number;
  frequencyMax?: number;
  period?: number;
  periodMax?: number;
  periodUnit?: 's' | 'min' | 'h' | 'd' | 'wk' | 'mo' | 'a';
  dayOfWeek?: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[];
  timeOfDay?: string[];
  when?: (
    | 'MORN'
    | 'MORN.early'
    | 'MORN.late'
    | 'NOON'
    | 'AFT'
    | 'AFT.early'
    | 'AFT.late'
    | 'EVE'
    | 'EVE.early'
    | 'EVE.late'
    | 'NIGHT'
    | 'PHS'
    | 'HS'
    | 'WAKE'
    | 'C'
    | 'CM'
    | 'CD'
    | 'CV'
    | 'AC'
    | 'ACM'
    | 'ACD'
    | 'ACV'
    | 'PC'
    | 'PCM'
    | 'PCD'
    | 'PCV'
  )[];
  offset?: number;
}

export interface Duration {
  value?: number;
  comparator?: '<' | '<=' | '>=' | '>';
  unit?: string;
  system?: string;
  code?: string;
}

export interface Range {
  low?: Quantity;
  high?: Quantity;
}

export interface Ratio {
  numerator?: Quantity;
  denominator?: Quantity;
}

export interface SampledData {
  origin: Quantity;
  period: number;
  factor?: number;
  lowerLimit?: number;
  upperLimit?: number;
  dimensions: number;
  data?: string;
}

export interface Annotation {
  authorReference?: Reference;
  authorString?: string;
  time?: string;
  text: string;
}

export interface ObservationReferenceRange {
  low?: Quantity;
  high?: Quantity;
  type?: CodeableConcept;
  appliesTo?: CodeableConcept[];
  age?: Range;
  text?: string;
}

export interface ObservationComponent {
  code: CodeableConcept;
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: Range;
  valueRatio?: Ratio;
  valueSampledData?: SampledData;
  valueTime?: string;
  valueDateTime?: string;
  valuePeriod?: Period;
  dataAbsentReason?: CodeableConcept;
  interpretation?: CodeableConcept[];
  referenceRange?: ObservationReferenceRange[];
}

// Appointment Resource
export interface Appointment extends ExtensibleResource {
  resourceType: 'Appointment';
  identifier?: Identifier[];
  status:
    | 'proposed'
    | 'pending'
    | 'booked'
    | 'arrived'
    | 'fulfilled'
    | 'cancelled'
    | 'noshow'
    | 'entered-in-error'
    | 'checked-in'
    | 'waitlist';
  cancelationReason?: CodeableConcept;
  serviceCategory?: CodeableConcept[];
  serviceType?: CodeableConcept[];
  specialty?: CodeableConcept[];
  appointmentType?: CodeableConcept;
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  priority?: number;
  description?: string;
  supportingInformation?: Reference[];
  start?: string;
  end?: string;
  minutesDuration?: number;
  slot?: Reference[];
  created?: string;
  comment?: string;
  patientInstruction?: string;
  basedOn?: Reference[];
  participant: AppointmentParticipant[];
  requestedPeriod?: Period[];
}

export interface AppointmentParticipant {
  type?: CodeableConcept[];
  actor?: Reference;
  required?: 'required' | 'optional' | 'information-only';
  status: 'accepted' | 'declined' | 'tentative' | 'needs-action';
  period?: Period;
}

// MedicationRequest Resource
export interface MedicationRequest extends ExtensibleResource {
  resourceType: 'MedicationRequest';
  identifier?: Identifier[];
  status:
    | 'active'
    | 'on-hold'
    | 'cancelled'
    | 'completed'
    | 'entered-in-error'
    | 'stopped'
    | 'draft'
    | 'unknown';
  statusReason?: CodeableConcept;
  intent:
    | 'proposal'
    | 'plan'
    | 'order'
    | 'original-order'
    | 'reflex-order'
    | 'filler-order'
    | 'instance-order'
    | 'option';
  category?: CodeableConcept[];
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  doNotPerform?: boolean;
  reportedBoolean?: boolean;
  reportedReference?: Reference;
  medicationCodeableConcept?: CodeableConcept;
  medicationReference?: Reference;
  subject: Reference;
  encounter?: Reference;
  supportingInformation?: Reference[];
  authoredOn?: string;
  requester?: Reference;
  performer?: Reference;
  performerType?: CodeableConcept;
  recorder?: Reference;
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  basedOn?: Reference[];
  groupIdentifier?: Identifier;
  courseOfTherapyType?: CodeableConcept;
  insurance?: Reference[];
  note?: Annotation[];
  dosageInstruction?: Dosage[];
  dispenseRequest?: MedicationRequestDispenseRequest;
  substitution?: MedicationRequestSubstitution;
  priorPrescription?: Reference;
  detectedIssue?: Reference[];
  eventHistory?: Reference[];
}

export interface Dosage {
  sequence?: number;
  text?: string;
  additionalInstruction?: CodeableConcept[];
  patientInstruction?: string;
  timing?: Timing;
  asNeededBoolean?: boolean;
  asNeededCodeableConcept?: CodeableConcept;
  site?: CodeableConcept;
  route?: CodeableConcept;
  method?: CodeableConcept;
  doseAndRate?: DosageDoseAndRate[];
  maxDosePerPeriod?: Ratio;
  maxDosePerAdministration?: Quantity;
  maxDosePerLifetime?: Quantity;
}

export interface DosageDoseAndRate {
  type?: CodeableConcept;
  doseRange?: Range;
  doseQuantity?: Quantity;
  rateRatio?: Ratio;
  rateRange?: Range;
  rateQuantity?: Quantity;
}

export interface MedicationRequestDispenseRequest {
  initialFill?: MedicationRequestDispenseRequestInitialFill;
  dispenseInterval?: Duration;
  validityPeriod?: Period;
  numberOfRepeatsAllowed?: number;
  quantity?: Quantity;
  expectedSupplyDuration?: Duration;
  performer?: Reference;
}

export interface MedicationRequestDispenseRequestInitialFill {
  quantity?: Quantity;
  duration?: Duration;
}

export interface MedicationRequestSubstitution {
  allowedBoolean?: boolean;
  allowedCodeableConcept?: CodeableConcept;
  reason?: CodeableConcept;
}

// CapabilityStatement Resource
export interface CapabilityStatement extends ExtensibleResource {
  resourceType: 'CapabilityStatement';
  url?: string;
  version?: string;
  name?: string;
  title?: string;
  status: 'draft' | 'active' | 'retired' | 'unknown';
  experimental?: boolean;
  date: string;
  publisher?: string;
  contact?: ContactDetail[];
  description?: string;
  useContext?: UsageContext[];
  jurisdiction?: CodeableConcept[];
  purpose?: string;
  copyright?: string;
  kind: 'instance' | 'capability' | 'requirements';
  instantiates?: string[];
  imports?: string[];
  software?: CapabilityStatementSoftware;
  implementation?: CapabilityStatementImplementation;
  fhirVersion: string;
  format: string[];
  patchFormat?: string[];
  implementationGuide?: string[];
  rest?: CapabilityStatementRest[];
  messaging?: CapabilityStatementMessaging[];
  document?: CapabilityStatementDocument[];
}

export interface ContactDetail {
  name?: string;
  telecom?: ContactPoint[];
}

export interface UsageContext {
  code: Coding;
  valueCodeableConcept?: CodeableConcept;
  valueQuantity?: Quantity;
  valueRange?: Range;
  valueReference?: Reference;
}

export interface CapabilityStatementSoftware {
  name: string;
  version?: string;
  releaseDate?: string;
}

export interface CapabilityStatementImplementation {
  description: string;
  url?: string;
  custodian?: Reference;
}

export interface CapabilityStatementRest {
  mode: 'client' | 'server';
  documentation?: string;
  security?: CapabilityStatementRestSecurity;
  resource?: CapabilityStatementRestResource[];
  interaction?: CapabilityStatementRestInteraction[];
  operation?: CapabilityStatementRestResourceOperation[];
  compartment?: string[];
}

export interface CapabilityStatementRestSecurity {
  cors?: boolean;
  service?: CodeableConcept[];
  description?: string;
}

export interface CapabilityStatementRestResource {
  type: string;
  profile?: string;
  supportedProfile?: string[];
  documentation?: string;
  interaction?: CapabilityStatementRestResourceInteraction[];
  versioning?: 'no-version' | 'versioned' | 'versioned-update';
  readHistory?: boolean;
  updateCreate?: boolean;
  conditionalCreate?: boolean;
  conditionalRead?: 'not-supported' | 'modified-since' | 'not-match' | 'full-support';
  conditionalUpdate?: boolean;
  conditionalDelete?: 'not-supported' | 'single' | 'multiple';
  referencePolicy?: ('literal' | 'logical' | 'resolves' | 'enforced' | 'local')[];
  searchInclude?: string[];
  searchRevInclude?: string[];
  searchParam?: CapabilityStatementRestResourceSearchParam[];
  operation?: CapabilityStatementRestResourceOperation[];
}

export interface CapabilityStatementRestResourceInteraction {
  code:
    | 'read'
    | 'vread'
    | 'update'
    | 'patch'
    | 'delete'
    | 'history-instance'
    | 'history-type'
    | 'create'
    | 'search-type';
  documentation?: string;
}

export interface CapabilityStatementRestResourceSearchParam {
  name: string;
  definition?: string;
  type:
    | 'number'
    | 'date'
    | 'string'
    | 'token'
    | 'reference'
    | 'composite'
    | 'quantity'
    | 'uri'
    | 'special';
  documentation?: string;
}

export interface CapabilityStatementRestResourceOperation {
  name: string;
  definition: string;
  documentation?: string;
}

export interface CapabilityStatementRestInteraction {
  code: 'transaction' | 'batch' | 'search-system' | 'history-system';
  documentation?: string;
}

export interface CapabilityStatementMessaging {
  endpoint?: CapabilityStatementMessagingEndpoint[];
  reliableCache?: number;
  documentation?: string;
  supportedMessage?: CapabilityStatementMessagingSupportedMessage[];
}

export interface CapabilityStatementMessagingEndpoint {
  protocol: Coding;
  address: string;
}

export interface CapabilityStatementMessagingSupportedMessage {
  mode: 'sender' | 'receiver';
  definition: string;
}

export interface CapabilityStatementDocument {
  mode: 'producer' | 'consumer';
  documentation?: string;
  profile: string;
}

// Vendor-specific extensions
export interface EpicPatientExtensions {
  myChartId?: string;
  portalAccess?: boolean;
  preferredLanguage?: string;
  primaryCareProvider?: Reference;
  insuranceInfo?: EpicInsuranceInfo[];
}

export interface EpicInsuranceInfo {
  planName?: string;
  memberId?: string;
  groupNumber?: string;
  effectiveDate?: string;
  terminationDate?: string;
}

export interface AthenaPatientExtensions {
  practiceId?: string;
  chartNumber?: string;
  insuranceInfo?: AthenaInsuranceDetails[];
  primaryProvider?: Reference;
  preferredPharmacy?: Reference;
}

export interface AthenaInsuranceDetails {
  insuranceId?: string;
  planName?: string;
  memberId?: string;
  groupNumber?: string;
  copay?: number;
  deductible?: number;
  effectiveDate?: string;
  terminationDate?: string;
}

// Bundle Resource for search results
export interface Bundle extends ExtensibleResource {
  resourceType: 'Bundle';
  identifier?: Identifier;
  type:
    | 'document'
    | 'message'
    | 'transaction'
    | 'transaction-response'
    | 'batch'
    | 'batch-response'
    | 'history'
    | 'searchset'
    | 'collection';
  timestamp?: string;
  total?: number;
  link?: BundleLink[];
  entry?: BundleEntry[];
  signature?: Signature;
}

export interface BundleLink {
  relation: string;
  url: string;
}

export interface BundleEntry {
  link?: BundleLink[];
  fullUrl?: string;
  resource?: Resource;
  search?: BundleEntrySearch;
  request?: BundleEntryRequest;
  response?: BundleEntryResponse;
}

export interface BundleEntrySearch {
  mode?: 'match' | 'include' | 'outcome';
  score?: number;
}

export interface BundleEntryRequest {
  method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  ifNoneMatch?: string;
  ifModifiedSince?: string;
  ifMatch?: string;
  ifNoneExist?: string;
}

export interface BundleEntryResponse {
  status: string;
  location?: string;
  etag?: string;
  lastModified?: string;
  outcome?: Resource;
}

export interface Signature {
  type: Coding[];
  when: string;
  who: Reference;
  onBehalfOf?: Reference;
  targetFormat?: string;
  sigFormat?: string;
  data?: string;
}

// AllergyIntolerance Resource
export interface AllergyIntolerance extends ExtensibleResource {
  resourceType: 'AllergyIntolerance';
  clinicalStatus?: CodeableConcept;
  verificationStatus?: CodeableConcept;
  type?: 'allergy' | 'intolerance';
  category?: ('food' | 'medication' | 'environment' | 'biologic')[];
  criticality?: 'low' | 'high' | 'unable-to-assess';
  code?: CodeableConcept;
  patient: Reference;
  onsetDateTime?: string;
  onsetAge?: Quantity;
  onsetPeriod?: Period;
  onsetString?: string;
  recordedDate?: string;
  recorder?: Reference;
  asserter?: Reference;
  lastOccurrence?: string;
  note?: Annotation[];
  reaction?: AllergyIntoleranceReaction[];
}

export interface AllergyIntoleranceReaction {
  substance?: CodeableConcept;
  manifestation: CodeableConcept[];
  description?: string;
  onset?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  exposureRoute?: CodeableConcept;
  note?: Annotation[];
}

// Condition Resource
export interface Condition extends ExtensibleResource {
  resourceType: 'Condition';
  clinicalStatus?: CodeableConcept;
  verificationStatus?: CodeableConcept;
  category?: CodeableConcept[];
  severity?: CodeableConcept;
  code?: CodeableConcept;
  bodySite?: CodeableConcept[];
  subject: Reference;
  encounter?: Reference;
  onsetDateTime?: string;
  onsetAge?: Quantity;
  onsetPeriod?: Period;
  onsetString?: string;
  abatementDateTime?: string;
  abatementAge?: Quantity;
  abatementPeriod?: Period;
  abatementString?: string;
  recordedDate?: string;
  recorder?: Reference;
  asserter?: Reference;
  stage?: ConditionStage[];
  evidence?: ConditionEvidence[];
  note?: Annotation[];
}

export interface ConditionStage {
  summary?: CodeableConcept;
  assessment?: Reference[];
  type?: CodeableConcept;
}

export interface ConditionEvidence {
  code?: CodeableConcept[];
  detail?: Reference[];
}

// Procedure Resource
export interface Procedure extends ExtensibleResource {
  resourceType: 'Procedure';
  status:
    | 'preparation'
    | 'in-progress'
    | 'not-done'
    | 'on-hold'
    | 'stopped'
    | 'completed'
    | 'entered-in-error'
    | 'unknown';
  statusReason?: CodeableConcept;
  category?: CodeableConcept;
  code?: CodeableConcept;
  subject: Reference;
  encounter?: Reference;
  performedDateTime?: string;
  performedPeriod?: Period;
  performer?: ProcedurePerformer[];
  location?: Reference;
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  bodySite?: CodeableConcept[];
  outcome?: CodeableConcept;
  report?: Reference[];
  complication?: CodeableConcept[];
  complicationDetail?: Reference[];
  followUp?: CodeableConcept[];
  note?: Annotation[];
}

export interface ProcedurePerformer {
  function?: CodeableConcept;
  actor: Reference;
  onBehalfOf?: Reference;
}

// Immunization Resource
export interface Immunization extends ExtensibleResource {
  resourceType: 'Immunization';
  status: 'completed' | 'entered-in-error' | 'not-done';
  statusReason?: CodeableConcept;
  vaccineCode: CodeableConcept;
  patient: Reference;
  encounter?: Reference;
  occurrenceDateTime: string;
  primarySource: boolean;
  location?: Reference;
  manufacturer?: Reference;
  lotNumber?: string;
  expirationDate?: string;
  site?: CodeableConcept;
  route?: CodeableConcept;
  doseQuantity?: Quantity;
  performer?: ImmunizationPerformer[];
  note?: Annotation[];
}

export interface ImmunizationPerformer {
  function?: CodeableConcept;
  actor: Reference;
}

// Practitioner Resource
export interface Practitioner extends ExtensibleResource {
  resourceType: 'Practitioner';
  identifier?: Identifier[];
  active?: boolean;
  name?: HumanName[];
  telecom?: ContactPoint[];
  address?: Address[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  qualification?: PractitionerQualification[];
}

export interface PractitionerQualification {
  identifier?: Identifier[];
  code: CodeableConcept;
  period?: Period;
  issuer?: Reference;
}

// Organization Resource
export interface Organization extends ExtensibleResource {
  resourceType: 'Organization';
  identifier?: Identifier[];
  active?: boolean;
  type?: CodeableConcept[];
  name?: string;
  alias?: string[];
  telecom?: ContactPoint[];
  address?: Address[];
  partOf?: Reference;
  contact?: OrganizationContact[];
}

export interface OrganizationContact {
  purpose?: CodeableConcept;
  name?: HumanName;
  telecom?: ContactPoint[];
  address?: Address;
}
// Common search and query types
export interface PatientSearchCriteria {
  identifier?: string;
  name?: string;
  family?: string;
  given?: string;
  birthdate?: string;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  phone?: string;
  email?: string;
  address?: string;
  organization?: string;
  _count?: number;
  _offset?: number;
}

export interface QueryOptions {
  _count?: number;
  _offset?: number;
  _sort?: string;
  _include?: string[];
  _revinclude?: string[];
  date?: string;
  dateRange?: {
    start?: string;
    end?: string;
  };
  category?: string[];
  code?: string[];
  status?: string[];
}

// Health status for health checks
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version?: string;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  description?: string;
  responseTime?: number;
  error?: string;
}
