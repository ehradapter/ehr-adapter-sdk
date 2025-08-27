import { Patient, Observation, Appointment, MedicationRequest } from '../../types/fhir';

export const samplePatients: Patient[] = [
  {
    resourceType: 'Patient',
    id: 'patient-1',
    name: [{ family: 'Smith', given: ['John'] }],
    gender: 'male',
    birthDate: '1980-01-01',
  },
  {
    resourceType: 'Patient',
    id: 'patient-2',
    name: [{ family: 'Doe', given: ['Jane'] }],
    gender: 'female',
    birthDate: '1990-02-02',
  },
  {
    resourceType: 'Patient',
    id: 'patient-3',
    name: [{ family: 'Johnson', given: ['Jim'] }],
    gender: 'male',
    birthDate: '1985-03-15',
  },
  {
    resourceType: 'Patient',
    id: 'patient-no-vitals',
    name: [{ family: 'NoVitals', given: ['Test'] }],
    gender: 'other',
    birthDate: '1970-01-01',
  },
];

export const sampleObservations: Observation[] = [
  // Vitals for patient-1
  {
    resourceType: 'Observation',
    id: 'obs-1-temp',
    status: 'final',
    subject: { reference: 'Patient/patient-1' },
    category: [{ coding: [{ code: 'vital-signs' }] }],
    code: { coding: [{ code: '8310-5', display: 'Body temperature' }] },
    valueQuantity: { value: 37, unit: 'C' },
    effectiveDateTime: '2024-05-01T10:00:00Z',
  },
  {
    resourceType: 'Observation',
    id: 'obs-1-hr',
    status: 'final',
    subject: { reference: 'Patient/patient-1' },
    category: [{ coding: [{ code: 'vital-signs' }] }],
    code: { coding: [{ code: '8867-4', display: 'Heart rate' }] },
    valueQuantity: { value: 72, unit: '/min' },
    effectiveDateTime: '2024-05-01T10:00:00Z',
  },
  {
    resourceType: 'Observation',
    id: 'obs-1-bp',
    status: 'final',
    subject: { reference: 'Patient/patient-1' },
    category: [{ coding: [{ code: 'vital-signs' }] }],
    code: { coding: [{ code: '85354-9', display: 'Blood Pressure' }] },
    component: [
      {
        code: { coding: [{ code: '8480-6', display: 'Systolic' }] },
        valueQuantity: { value: 120, unit: 'mmHg' },
      },
      {
        code: { coding: [{ code: '8462-4', display: 'Diastolic' }] },
        valueQuantity: { value: 80, unit: 'mmHg' },
      },
    ],
    effectiveDateTime: '2024-05-01T10:00:00Z',
  },
  // Labs for patient-1
  {
    resourceType: 'Observation',
    id: 'obs-2-hemo',
    status: 'final',
    subject: { reference: 'Patient/patient-1' },
    category: [{ coding: [{ code: 'laboratory' }] }],
    code: { coding: [{ code: '718-7', display: 'Hemoglobin' }] },
    valueQuantity: { value: 14, unit: 'g/dL' },
    referenceRange: [{ low: { value: 13.5 }, high: { value: 17.5 } }],
    effectiveDateTime: '2023-01-02T11:00:00Z',
  },
  {
    resourceType: 'Observation',
    id: 'obs-2-chol',
    status: 'final',
    subject: { reference: 'Patient/patient-1' },
    category: [{ coding: [{ code: 'laboratory' }] }],
    code: { coding: [{ code: '2093-3', display: 'Cholesterol' }] },
    valueQuantity: { value: 200, unit: 'mg/dL' },
    referenceRange: [{ high: { value: 200 } }],
    effectiveDateTime: '2023-01-02T11:00:00Z',
  },
];

export const sampleAppointments: Appointment[] = [
  {
    resourceType: 'Appointment',
    id: 'appt-1',
    status: 'booked',
    participant: [{ actor: { reference: 'Patient/patient-1' }, status: 'accepted' }],
    start: '2024-10-26T10:00:00Z',
  },
  {
    resourceType: 'Appointment',
    id: 'appt-2',
    status: 'booked',
    participant: [{ actor: { reference: 'Patient/patient-1' }, status: 'accepted' }],
    start: '2024-11-15T14:00:00Z',
  },
];

export const sampleMedications: MedicationRequest[] = [
  {
    resourceType: 'MedicationRequest',
    id: 'med-1',
    status: 'active',
    intent: 'order',
    subject: { reference: 'Patient/patient-1' },
    medicationCodeableConcept: { text: 'Lisinopril' },
    dosageInstruction: [{ text: 'Take one tablet daily' }],
  },
  {
    resourceType: 'MedicationRequest',
    id: 'med-2',
    status: 'active',
    intent: 'order',
    subject: { reference: 'Patient/patient-1' },
    medicationCodeableConcept: { text: 'Atorvastatin' },
    dosageInstruction: [{ text: 'Take one tablet at bedtime' }],
  },
];
