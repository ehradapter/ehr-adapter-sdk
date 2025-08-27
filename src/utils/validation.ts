import { LoggerInterface } from '../logging/LoggerInterface';

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: unknown;
  constraint?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Validation rule
 */
export interface ValidationRule<T = any> {
  name: string;
  validate: (value: T, context?: unknown) => boolean | Promise<boolean>;
  message: string;
  code: string;
  severity?: 'error' | 'warning';
}

/**
 * Schema validation options
 */
export interface SchemaValidationOptions {
  allowUnknownFields?: boolean;
  stripUnknownFields?: boolean;
  abortEarly?: boolean;
  context?: unknown;
}

/**
 * Field schema definition
 */
export interface FieldSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date' | 'email' | 'url' | 'uuid';
  required?: boolean;
  nullable?: boolean;
  rules?: ValidationRule[];
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  items?: FieldSchema; // For arrays
  properties?: Record<string, FieldSchema>; // For objects
  custom?: (value: unknown, context?: unknown) => boolean | Promise<boolean>;
  transform?: (value: unknown) => any;
}

/**
 * Object schema definition
 */
export type ObjectSchema = Record<string, FieldSchema>;

/**
 * Data validator class
 */
export class DataValidator {
  private logger: LoggerInterface;

  constructor(logger: LoggerInterface) {
    this.logger = logger;
  }

  /**
   * Validate data against schema
   */
  async validateSchema(
    data: unknown,
    schema: ObjectSchema,
    options: SchemaValidationOptions = {}
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const opts = {
      allowUnknownFields: false,
      stripUnknownFields: false,
      abortEarly: false,
      ...options,
    };

    this.logger.debug('Starting schema validation', {
      schemaFields: Object.keys(schema).length,
      allowUnknownFields: opts.allowUnknownFields,
      abortEarly: opts.abortEarly,
    });

    try {
      // Validate each field in schema
      for (const [fieldName, fieldSchema] of Object.entries(schema)) {
        const fieldValue = (data as any)?.[fieldName];
        const fieldErrors = await this.validateField(
          fieldName,
          fieldValue,
          fieldSchema,
          opts.context
        );

        fieldErrors.forEach(error => {
          if (error.code.includes('WARNING')) {
            warnings.push(error);
          } else {
            errors.push(error);
          }
        });

        if (opts.abortEarly && errors.length > 0) {
          break;
        }
      }

      // Check for unknown fields
      if (data && typeof data === 'object' && !opts.allowUnknownFields) {
        const schemaFields = new Set(Object.keys(schema));
        const dataFields = Object.keys(data);

        for (const field of dataFields) {
          if (!schemaFields.has(field)) {
            const _error: ValidationError = {
              field,
              message: `Unknown field '${field}' is not allowed`,
              code: 'UNKNOWN_FIELD',
              value: (data as any)[field],
            };

            if (opts.stripUnknownFields) {
              warnings.push(_error);
              delete (data as any)[field];
            } else {
              errors.push(_error);
            }
          }
        }
      }

      const result: ValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings,
      };

      this.logger.debug('Schema validation completed', {
        isValid: result.isValid,
        errorCount: errors.length,
        warningCount: warnings.length,
      });

      return result;
    } catch (error) {
      this.logger.error('Schema validation failed', { error });
      throw error;
    }
  }

  /**
   * Validate individual field
   */
  private async validateField(
    fieldName: string,
    value: unknown,
    schema: FieldSchema,
    context?: unknown
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Check required
    if (schema.required && (value === undefined || value === null)) {
      errors.push({
        field: fieldName,
        message: `Field '${fieldName}' is required`,
        code: 'REQUIRED',
        value,
      });
      return errors; // Don't continue validation if required field is missing
    }

    // Skip validation if value is null/undefined and field is not required
    if ((value === null || value === undefined) && !schema.required) {
      return errors;
    }

    // Check nullable
    if (value === null && !schema.nullable) {
      errors.push({
        field: fieldName,
        message: `Field '${fieldName}' cannot be null`,
        code: 'NOT_NULLABLE',
        value,
      });
      return errors;
    }

    // Skip further validation if value is null and nullable
    if (value === null && schema.nullable) {
      return errors;
    }

    // Transform value if transformer provided
    if (schema.transform) {
      try {
        value = schema.transform(value);
      } catch (error) {
        errors.push({
          field: fieldName,
          message: `Field '${fieldName}' transformation failed: ${error}`,
          code: 'TRANSFORM_ERROR',
          value,
        });
        return errors;
      }
    }

    // Type validation
    const typeError = this.validateType(fieldName, value, schema.type);
    if (typeError) {
      errors.push(typeError);
      return errors; // Don't continue if type is wrong
    }

    // Length/size validation
    if (schema.min !== undefined || schema.max !== undefined) {
      const lengthError = this.validateLength(
        fieldName,
        value,
        schema.min,
        schema.max,
        schema.type
      );
      if (lengthError) {
        errors.push(lengthError);
      }
    }

    // Pattern validation
    if (schema.pattern && typeof value === 'string') {
      if (!schema.pattern.test(value)) {
        errors.push({
          field: fieldName,
          message: `Field '${fieldName}' does not match required pattern`,
          code: 'PATTERN_MISMATCH',
          value,
          constraint: schema.pattern.toString(),
        });
      }
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({
        field: fieldName,
        message: `Field '${fieldName}' must be one of: ${schema.enum.join(', ')}`,
        code: 'ENUM_VIOLATION',
        value,
        constraint: schema.enum.join(', '),
      });
    }

    // Array items validation
    if (schema.type === 'array' && schema.items && Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const itemErrors = await this.validateField(
          `${fieldName}[${i}]`,
          value[i],
          schema.items,
          context
        );
        errors.push(...itemErrors);
      }
    }

    // Object properties validation
    if (
      schema.type === 'object' &&
      schema.properties &&
      typeof value === 'object' &&
      value !== null
    ) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const propErrors = await this.validateField(
          `${fieldName}.${propName}`,
          (value as any)[propName],
          propSchema,
          context
        );
        errors.push(...propErrors);
      }
    }

    // Custom validation rules
    if (schema.rules) {
      for (const rule of schema.rules) {
        try {
          const isValid = await rule.validate(value, context);
          if (!isValid) {
            errors.push({
              field: fieldName,
              message: rule.message,
              code: rule.severity === 'warning' ? `${rule.code}_WARNING` : rule.code,
              value,
            });
          }
        } catch (error) {
          errors.push({
            field: fieldName,
            message: `Validation rule '${rule.name}' failed: ${error}`,
            code: 'RULE_ERROR',
            value,
          });
        }
      }
    }

    // Custom validation function
    if (schema.custom) {
      try {
        const isValid = await schema.custom(value, context);
        if (!isValid) {
          errors.push({
            field: fieldName,
            message: `Field '${fieldName}' failed custom validation`,
            code: 'CUSTOM_VALIDATION',
            value,
          });
        }
      } catch (error) {
        errors.push({
          field: fieldName,
          message: `Custom validation failed: ${error}`,
          code: 'CUSTOM_ERROR',
          value,
        });
      }
    }

    return errors;
  }

  /**
   * Validate field type
   */
  private validateType(
    fieldName: string,
    value: unknown,
    expectedType: FieldSchema['type']
  ): ValidationError | null {
    const actualType = this.getValueType(value);

    if (actualType !== expectedType) {
      return {
        field: fieldName,
        message: `Field '${fieldName}' must be of type '${expectedType}', got '${actualType}'`,
        code: 'TYPE_MISMATCH',
        value,
        constraint: expectedType,
      };
    }

    return null;
  }

  /**
   * Validate field length/size
   */
  private validateLength(
    fieldName: string,
    value: unknown,
    min?: number,
    max?: number,
    type?: FieldSchema['type']
  ): ValidationError | null {
    let length: number;

    switch (type) {
      case 'string':
        length = (value as string).length;
        break;
      case 'array':
        length = (value as unknown[]).length;
        break;
      case 'number':
        length = value as number;
        break;
      default:
        return null;
    }

    if (min !== undefined && length < min) {
      return {
        field: fieldName,
        message: `Field '${fieldName}' must be at least ${min}${type === 'string' ? ' characters' : type === 'array' ? ' items' : ''}`,
        code: 'MIN_LENGTH',
        value,
        constraint: min.toString(),
      };
    }

    if (max !== undefined && length > max) {
      return {
        field: fieldName,
        message: `Field '${fieldName}' must be at most ${max}${type === 'string' ? ' characters' : type === 'array' ? ' items' : ''}`,
        code: 'MAX_LENGTH',
        value,
        constraint: max.toString(),
      };
    }

    return null;
  }

  /**
   * Get value type
   */
  private getValueType(value: unknown): string {
    if (value === null) {
      return 'null';
    }
    if (Array.isArray(value)) {
      return 'array';
    }
    if (value instanceof Date) {
      return 'date';
    }

    const type = typeof value;

    if (type === 'string') {
      // Check for special string types
      if (this.isEmail(value as string)) {
        return 'email';
      }
      if (this.isUrl(value as string)) {
        return 'url';
      }
      if (this.isUuid(value as string)) {
        return 'uuid';
      }
    }

    return type;
  }

  /**
   * Check if string is email
   */
  private isEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  /**
   * Check if string is URL
   */
  private isUrl(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if string is UUID
   */
  private isUuid(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  /**
   * Validate FHIR resource
   */
  async validateFHIRResource(resource: unknown): Promise<ValidationResult> {
    const schema: ObjectSchema = {
      resourceType: {
        type: 'string',
        required: true,
        enum: [
          'Patient',
          'Observation',
          'Condition',
          'Medication',
          'Appointment',
          'Practitioner',
          'Organization',
        ],
      },
      id: {
        type: 'uuid',
        required: false,
      },
      meta: {
        type: 'object',
        required: false,
        properties: {
          versionId: { type: 'string', required: false },
          lastUpdated: { type: 'date', required: false },
        },
      },
    };

    return this.validateSchema(resource, schema, {
      allowUnknownFields: true, // FHIR resources can have many fields
    });
  }

  /**
   * Create common validation rules
   */
  static createCommonRules() {
    return {
      notEmpty: (message = 'Value cannot be empty'): ValidationRule<string> => ({
        name: 'notEmpty',
        validate: (value: string) => value.trim().length > 0,
        message,
        code: 'NOT_EMPTY',
      }),

      minLength: (min: number, message?: string): ValidationRule<string> => ({
        name: 'minLength',
        validate: (value: string) => value.length >= min,
        message: message || `Must be at least ${min} characters`,
        code: 'MIN_LENGTH',
      }),

      maxLength: (max: number, message?: string): ValidationRule<string> => ({
        name: 'maxLength',
        validate: (value: string) => value.length <= max,
        message: message || `Must be at most ${max} characters`,
        code: 'MAX_LENGTH',
      }),

      isPositive: (message = 'Value must be positive'): ValidationRule<number> => ({
        name: 'isPositive',
        validate: (value: number) => value > 0,
        message,
        code: 'POSITIVE',
      }),

      isInRange: (min: number, max: number, message?: string): ValidationRule<number> => ({
        name: 'isInRange',
        validate: (value: number) => value >= min && value <= max,
        message: message || `Value must be between ${min} and ${max}`,
        code: 'IN_RANGE',
      }),

      matchesPattern: (pattern: RegExp, message?: string): ValidationRule<string> => ({
        name: 'matchesPattern',
        validate: (value: string) => pattern.test(value),
        message: message || `Value does not match required pattern`,
        code: 'PATTERN_MATCH',
      }),
    };
  }
}

/**
 * Create data validator instance
 */
export function createDataValidator(logger: LoggerInterface): DataValidator {
  return new DataValidator(logger);
}
