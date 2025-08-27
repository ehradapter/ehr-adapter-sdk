import { DataValidator, ObjectSchema } from './validation';
import { StructuredLogger } from '../logging/StructuredLogger';

describe('DataValidator', () => {
  let validator: DataValidator;

  beforeEach(() => {
    const logger = new StructuredLogger('info');
    validator = new DataValidator(logger);
  });

  const schema: ObjectSchema = {
    name: { type: 'string', required: true, min: 2 },
    age: { type: 'number', required: true, min: 18 },
    email: { type: 'email', required: true },
    isActive: { type: 'boolean' },
  };

  it('should validate a valid object', async () => {
    const data = { name: 'John Doe', age: 30, email: 'john.doe@example.com' };
    const result = await validator.validateSchema(data, schema);
    expect(result.isValid).toBe(true);
  });

  it('should invalidate an object with missing required fields', async () => {
    const data = { name: 'John Doe' };
    const result = await validator.validateSchema(data, schema);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]?.field).toBe('age');
  });

  it('should invalidate an object with a field that is too short', async () => {
    const data = { name: 'J', age: 30, email: 'john.doe@example.com' };
    const result = await validator.validateSchema(data, schema);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]?.field).toBe('name');
  });

  it('should handle unknown fields', async () => {
    const data = { name: 'John Doe', age: 30, email: 'john.doe@example.com', extra: 'field' };
    const result = await validator.validateSchema(data, schema);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]?.field).toBe('extra');
  });
});
