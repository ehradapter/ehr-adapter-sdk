/**
 * Mock Data Generator
 *
 * Provides functions for generating realistic mock FHIR resources for testing
 * and development. This allows for the creation of a varied and dynamic
 * dataset for the MockAdapter.
 */

import { Patient, Observation, Appointment, MedicationRequest } from '../../types/fhir';

export class MockDataGenerator {
  /**
   * Generates a specified number of mock patients.
   * @param count The number of patients to generate.
   * @returns An array of mock Patient resources.
   */
  static generatePatients(count: number): Patient[] {
    const patients: Patient[] = [];
    for (let i = 0; i < count; i++) {
      const patient: Patient = {
        resourceType: 'Patient',
        id: `patient-gen-${i}`,
        active: true,
        name: [
          {
            family: `LastName${i}`,
            given: [`FirstName${i}`],
          },
        ],
        gender: i % 2 === 0 ? 'male' : 'female',
        birthDate: '1980-01-01',
      };
      patients.push(patient);
    }
    return patients;
  }

  /**
   * Generates a specified number of mock observations for a patient.
   * @param patientId The ID of the patient.
   * @param count The number of observations to generate.
   * @returns An array of mock Observation resources.
   */
  static generateObservations(patientId: string, count: number): Observation[] {
    const observations: Observation[] = [];
    for (let i = 0; i < count; i++) {
      const observation: Observation = {
        resourceType: 'Observation',
        id: `obs-gen-${patientId}-${i}`,
        status: 'final',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '8302-2',
              display: 'Body Height',
            },
          ],
        },
        subject: {
          reference: `Patient/${patientId}`,
        },
        valueQuantity: {
          value: 175 + i,
          unit: 'cm',
        },
      };
      observations.push(observation);
    }
    return observations;
  }
}
