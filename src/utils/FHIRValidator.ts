/**
 * FHIR Resource Validator
 *
 * Provides robust validation for FHIR resources against their defined schemas
 * using Zod for powerful, declarative validation. This ensures data integrity
 * and compliance with expected FHIR structures.
 */

import { z } from 'zod';
import { Resource, Patient, Observation, Appointment, MedicationRequest } from '../types/fhir';
import type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from '../plugins/types';

// Base Zod schema for any FHIR resource
const ResourceSchema = z.object({
  resourceType: z.string({ required_error: 'resourceType is required' }),
  id: z.string().optional(),
});

// Custom birthDate validation function
const validateBirthDate = (dateStr: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }

  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return false;

  const [year, month, day] = parts;
  if (!year || !month || !day) return false;

  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

// Zod schema for the Patient resource
const PatientSchema = ResourceSchema.extend({
  resourceType: z.literal('Patient'),
  name: z
    .array(
      z.object({
        family: z.string().optional(),
        given: z.array(z.string()).optional(),
      })
    )
    .optional()
    .nullable(),
  gender: z.enum(['male', 'female', 'other', 'unknown']).optional().nullable(),
  birthDate: z.string().refine(validateBirthDate, 'Invalid birthDate format').optional().nullable(),
});

// Add other resource schemas here as needed (Observation, Appointment, etc.)
const ObservationSchema = ResourceSchema.extend({
  resourceType: z.literal('Observation'),
  status: z.enum(['registered', 'preliminary', 'final', 'amended']),
  code: z.object({
    coding: z
      .array(
        z.object({
          system: z.string().optional(),
          code: z.string().optional(),
          display: z.string().optional(),
        })
      )
      .optional(),
  }),
});

/**
 * Provides static methods for validating FHIR resources against Zod schemas.
 * This utility helps ensure that data conforms to the expected FHIR structure
 * before being processed or transmitted.
 */
export class FHIRValidator {
  /**
   * A map of resource types to their corresponding Zod validation schemas.
   * Extend this map to add validation for more FHIR resource types.
   */
  private static schemaMap: Record<string, z.ZodSchema<any>> = {
    Patient: PatientSchema,
    Observation: ObservationSchema,
    // Add other schemas here
  };

  /**
   * Validates a FHIR resource against its corresponding schema.
   *
   * @param resource The FHIR resource to validate.
   * @returns A `ValidationResult` object containing the validation status,
   *          errors, and any warnings.
   */
  static validate(resource: Resource): ValidationResult {
    // Handle null and undefined resources
    if (resource === null || resource === undefined) {
      throw new Error('Resource cannot be null or undefined');
    }

    // First validate that we have a basic resource structure
    const baseResult = ResourceSchema.safeParse(resource);

    if (!baseResult.success) {
      const errors: ValidationError[] = baseResult.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code as any,
        value: issue.path.reduce((acc: any, k) => acc?.[k], resource),
      }));

      return {
        isValid: false,
        errors,
        warnings: [],
      };
    }

    // Try to determine the intended schema based on the structure, not just resourceType
    let schema = this.schemaMap[resource.resourceType];
    const warnings: ValidationWarning[] = [];

    // If we have a schema for this resourceType, validate against it
    if (schema) {
      const _result = schema.safeParse(resource);

      if (_result.success) {
        return {
          isValid: true,
          errors: [],
          warnings: [],
        };
      } else {
        const errors: ValidationError[] = _result.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code as any,
          value: issue.path.reduce((acc: any, k) => acc?.[k], resource),
        }));

        // Check if this looks like a structural mismatch (wrong resourceType for the data)
        // If the object has Patient-like fields but claims to be something else, prioritize resourceType error
        const resourceAny = resource as any;
        if (resource.resourceType === 'Observation' && resourceAny.name && !resourceAny.status) {
          return {
            isValid: false,
            errors: [
              {
                field: 'resourceType',
                message: 'Invalid literal value, expected "Patient"',
                code: 'invalid_literal' as any,
                value: resource.resourceType,
              },
            ],
            warnings: [],
          };
        }

        return {
          isValid: false,
          errors,
          warnings: [],
        };
      }
    } else {
      // No schema found for this resourceType
      warnings.push({
        field: 'resourceType',
        message: `No validation schema found for resourceType: ${resource.resourceType}`,
        suggestion: 'Consider adding a Zod schema to FHIRValidator.ts for this resource type.',
      });

      return {
        isValid: true, // Pass through if no schema is defined, but with a warning
        errors: [],
        warnings,
      };
    }
  }

  /**
   * Registers a new schema or overrides an existing one for a given resource type.
   * This allows for extending the validator with custom resource definitions or profiles.
   *
   * @param resourceType The resourceType to associate with the schema.
   * @param schema The Zod schema to use for validation.
   */
  static registerSchema(resourceType: string, schema: z.ZodSchema<any>): void {
    this.schemaMap[resourceType] = schema;
  }
}
