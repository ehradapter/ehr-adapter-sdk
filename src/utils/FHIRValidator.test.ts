import { FHIRValidator } from './FHIRValidator';
import { Patient, Observation } from '../types/fhir';
import { z } from 'zod';

describe('FHIRValidator', () => {
  describe('Patient validation', () => {
    it('should validate a complete valid Patient resource', () => {
      const patient: Patient = {
        resourceType: 'Patient',
        id: '123',
        name: [{ family: 'Doe', given: ['John', 'William'] }],
        gender: 'male',
        birthDate: '1990-01-01',
      };
      const result = FHIRValidator.validate(patient);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should validate a minimal valid Patient resource', () => {
      const patient: Patient = {
        resourceType: 'Patient',
      };
      const result = FHIRValidator.validate(patient);
      expect(result.isValid).toBe(true);
    });

    it('should validate Patient with only family name', () => {
      const patient: Patient = {
        resourceType: 'Patient',
        name: [{ family: 'Doe' }],
      };
      const result = FHIRValidator.validate(patient);
      expect(result.isValid).toBe(true);
    });

    it('should validate Patient with only given names', () => {
      const patient: Patient = {
        resourceType: 'Patient',
        name: [{ given: ['John', 'William'] }],
      };
      const result = FHIRValidator.validate(patient);
      expect(result.isValid).toBe(true);
    });

    it('should validate all valid gender values', () => {
      const genders: Array<'male' | 'female' | 'other' | 'unknown'> = [
        'male',
        'female',
        'other',
        'unknown',
      ];

      genders.forEach(gender => {
        const patient: Patient = {
          resourceType: 'Patient',
          gender,
        };
        const result = FHIRValidator.validate(patient);
        expect(result.isValid).toBe(true);
      });
    });

    it('should invalidate Patient with invalid gender', () => {
      const patient: any = {
        resourceType: 'Patient',
        gender: 'invalid-gender',
      };
      const result = FHIRValidator.validate(patient);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.field).toBe('gender');
      expect(result.errors[0]?.code).toBe('invalid_enum_value');
    });

    it('should invalidate Patient with invalid birthDate format', () => {
      const invalidDates = [
        'invalid-date',
        '1990-1-1',
        '90-01-01',
        '1990/01/01',
        '01-01-1990',
        '1990-13-01',
        '1990-01-32',
      ];

      invalidDates.forEach(birthDate => {
        const patient: any = {
          resourceType: 'Patient',
          birthDate,
        };
        const result = FHIRValidator.validate(patient);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]?.field).toBe('birthDate');
        expect(result.errors[0]?.message).toBe('Invalid birthDate format');
      });
    });

    it('should validate valid birthDate formats', () => {
      const validDates = ['1990-01-01', '2000-12-31', '1985-06-15', '2023-02-28'];

      validDates.forEach(birthDate => {
        const patient: Patient = {
          resourceType: 'Patient',
          birthDate,
        };
        const result = FHIRValidator.validate(patient);
        expect(result.isValid).toBe(true);
      });
    });

    it('should handle multiple names', () => {
      const patient: Patient = {
        resourceType: 'Patient',
        name: [
          { family: 'Doe', given: ['John'] },
          { family: 'Smith', given: ['Jane'] },
        ],
      };
      const result = FHIRValidator.validate(patient);
      expect(result.isValid).toBe(true);
    });

    it('should handle empty name array', () => {
      const patient: Patient = {
        resourceType: 'Patient',
        name: [],
      };
      const result = FHIRValidator.validate(patient);
      expect(result.isValid).toBe(true);
    });

    it('should invalidate Patient with wrong resourceType', () => {
      const patient: any = {
        resourceType: 'Observation',
        name: [{ family: 'Doe', given: ['John'] }],
      };
      const result = FHIRValidator.validate(patient);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.field).toBe('resourceType');
    });

    it('should handle null and undefined values', () => {
      const patientWithNulls: any = {
        resourceType: 'Patient',
        name: null,
        gender: null,
        birthDate: null,
      };
      const result = FHIRValidator.validate(patientWithNulls);
      expect(result.isValid).toBe(true); // Optional fields can be null
    });
  });

  describe('Observation validation', () => {
    it('should validate a complete valid Observation resource', () => {
      const observation: Observation = {
        resourceType: 'Observation',
        status: 'final',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '8310-5',
              display: 'Body temperature',
            },
          ],
        },
      };
      const result = FHIRValidator.validate(observation);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate all valid status values', () => {
      const statuses: Array<'registered' | 'preliminary' | 'final' | 'amended'> = [
        'registered',
        'preliminary',
        'final',
        'amended',
      ];

      statuses.forEach(status => {
        const observation: Observation = {
          resourceType: 'Observation',
          status,
          code: { coding: [{ system: 'http://loinc.org', code: '8310-5' }] },
        };
        const result = FHIRValidator.validate(observation);
        expect(result.isValid).toBe(true);
      });
    });

    it('should invalidate Observation with invalid status', () => {
      const observation: any = {
        resourceType: 'Observation',
        status: 'invalid-status',
        code: { coding: [{ system: 'http://loinc.org', code: '8310-5' }] },
      };
      const result = FHIRValidator.validate(observation);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.field).toBe('status');
      expect(result.errors[0]?.code).toBe('invalid_enum_value');
    });

    it('should invalidate Observation without status', () => {
      const observation: any = {
        resourceType: 'Observation',
        code: { coding: [{ system: 'http://loinc.org', code: '8310-5' }] },
      };
      const result = FHIRValidator.validate(observation);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.field).toBe('status');
      expect(result.errors[0]?.code).toBe('invalid_type');
    });

    it('should invalidate Observation without code', () => {
      const observation: any = {
        resourceType: 'Observation',
        status: 'final',
      };
      const result = FHIRValidator.validate(observation);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.field).toBe('code');
      expect(result.errors[0]?.code).toBe('invalid_type');
    });

    it('should validate Observation with minimal code structure', () => {
      const observation: Observation = {
        resourceType: 'Observation',
        status: 'final',
        code: {},
      };
      const result = FHIRValidator.validate(observation);
      expect(result.isValid).toBe(true);
    });

    it('should validate Observation with empty coding array', () => {
      const observation: Observation = {
        resourceType: 'Observation',
        status: 'final',
        code: { coding: [] },
      };
      const result = FHIRValidator.validate(observation);
      expect(result.isValid).toBe(true);
    });

    it('should validate Observation with multiple codings', () => {
      const observation: Observation = {
        resourceType: 'Observation',
        status: 'final',
        code: {
          coding: [
            { system: 'http://loinc.org', code: '8310-5', display: 'Body temperature' },
            { system: 'http://snomed.info/sct', code: '386725007', display: 'Body temperature' },
          ],
        },
      };
      const result = FHIRValidator.validate(observation);
      expect(result.isValid).toBe(true);
    });

    it('should handle partial coding information', () => {
      const observation: Observation = {
        resourceType: 'Observation',
        status: 'final',
        code: {
          coding: [
            { code: '8310-5' },
            { system: 'http://loinc.org' },
            { display: 'Body temperature' },
          ],
        },
      };
      const result = FHIRValidator.validate(observation);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Unknown resource types', () => {
    it('should return warning for unknown resource type', () => {
      const resource: any = { resourceType: 'MedicationRequest' };
      const result = FHIRValidator.validate(resource);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.field).toBe('resourceType');
      expect(result.warnings[0]?.message).toBe(
        'No validation schema found for resourceType: MedicationRequest'
      );
      expect(result.warnings[0]?.suggestion).toBe(
        'Consider adding a Zod schema to FHIRValidator.ts for this resource type.'
      );
    });

    it('should handle multiple unknown resource types', () => {
      const unknownTypes = ['MedicationRequest', 'Appointment', 'Practitioner', 'Organization'];

      unknownTypes.forEach(resourceType => {
        const resource: any = { resourceType };
        const result = FHIRValidator.validate(resource);
        expect(result.isValid).toBe(true);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]?.field).toBe('resourceType');
        expect(result.warnings[0]?.message).toContain(resourceType);
      });
    });

    it('should handle resource with additional unknown properties', () => {
      const resource: any = {
        resourceType: 'UnknownResource',
        customProperty: 'value',
        nestedObject: { prop: 'value' },
        arrayProperty: [1, 2, 3],
      };
      const result = FHIRValidator.validate(resource);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
    });
  });

  describe('Schema registration', () => {
    it('should register and use a new schema', () => {
      const customSchema = z.object({
        resourceType: z.literal('CustomResource'),
        customField: z.string(),
      });
      FHIRValidator.registerSchema('CustomResource', customSchema);

      const resource: any = { resourceType: 'CustomResource', customField: 'test' };
      const result = FHIRValidator.validate(resource);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should validate against registered schema', () => {
      const customSchema = z.object({
        resourceType: z.literal('TestResource'),
        requiredField: z.string(),
        optionalField: z.number().optional(),
      });
      FHIRValidator.registerSchema('TestResource', customSchema);

      const validResource: any = {
        resourceType: 'TestResource',
        requiredField: 'test',
        optionalField: 42,
      };
      const result = FHIRValidator.validate(validResource);
      expect(result.isValid).toBe(true);
    });

    it('should invalidate against registered schema when required field is missing', () => {
      const customSchema = z.object({
        resourceType: z.literal('TestResource2'),
        requiredField: z.string(),
      });
      FHIRValidator.registerSchema('TestResource2', customSchema);

      const invalidResource: any = {
        resourceType: 'TestResource2',
      };
      const result = FHIRValidator.validate(invalidResource);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.field).toBe('requiredField');
    });

    it('should override existing schema when registering same resource type', () => {
      const schema1 = z.object({
        resourceType: z.literal('OverrideTest'),
        field1: z.string(),
      });
      const schema2 = z.object({
        resourceType: z.literal('OverrideTest'),
        field2: z.number(),
      });

      FHIRValidator.registerSchema('OverrideTest', schema1);
      FHIRValidator.registerSchema('OverrideTest', schema2);

      const resource: any = {
        resourceType: 'OverrideTest',
        field2: 42,
      };
      const result = FHIRValidator.validate(resource);
      expect(result.isValid).toBe(true);
    });

    it('should handle complex nested schemas', () => {
      const complexSchema = z.object({
        resourceType: z.literal('ComplexResource'),
        nested: z.object({
          array: z.array(
            z.object({
              id: z.string(),
              value: z.number(),
            })
          ),
          optional: z.string().optional(),
        }),
      });
      FHIRValidator.registerSchema('ComplexResource', complexSchema);

      const validResource: any = {
        resourceType: 'ComplexResource',
        nested: {
          array: [
            { id: 'item1', value: 10 },
            { id: 'item2', value: 20 },
          ],
          optional: 'test',
        },
      };
      const result = FHIRValidator.validate(validResource);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle missing resourceType', () => {
      const resource: any = {
        id: '123',
        name: 'test',
      };
      const result = FHIRValidator.validate(resource);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.field).toBe('resourceType');
      expect(result.errors[0]?.code).toBe('invalid_type');
    });

    it('should handle null resource', () => {
      const resource: any = null;
      expect(() => {
        FHIRValidator.validate(resource);
      }).toThrow();
    });

    it('should handle undefined resource', () => {
      const resource: any = undefined;
      expect(() => {
        FHIRValidator.validate(resource);
      }).toThrow();
    });

    it('should handle empty object', () => {
      const resource: any = {};
      const result = FHIRValidator.validate(resource);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.field).toBe('resourceType');
    });

    it('should provide detailed error information', () => {
      const invalidPatient: any = {
        resourceType: 'Patient',
        birthDate: 'invalid-date',
        gender: 'invalid-gender',
      };
      const result = FHIRValidator.validate(invalidPatient);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);

      const birthDateError = result.errors.find(e => e.field === 'birthDate');
      const genderError = result.errors.find(e => e.field === 'gender');

      expect(birthDateError?.message).toBe('Invalid birthDate format');
      expect(birthDateError?.value).toBe('invalid-date');
      expect(genderError?.code).toBe('invalid_enum_value');
    });

    it('should handle very large resources', () => {
      const largePatient: Patient = {
        resourceType: 'Patient',
        name: Array(1000)
          .fill(0)
          .map((_, i) => ({
            family: `Family${i}`,
            given: [`Given${i}`],
          })),
      };
      const result = FHIRValidator.validate(largePatient);
      expect(result.isValid).toBe(true);
    });

    it('should handle resources with circular references gracefully', () => {
      const resource: any = {
        resourceType: 'Patient',
      };
      resource.self = resource; // Create circular reference

      // Should not throw or hang
      const result = FHIRValidator.validate(resource);
      expect(result.isValid).toBe(true);
    });
  });
});
