import { describe, it, expect } from 'vitest';
import { FieldSchemaCompiler } from './FieldSchemaCompiler.js';
import { TypeFieldDefinition, TypeFieldConstraint } from '../../application/dto/TypeFieldDefinition.js';
import { UnsupportedFieldDataTypeError } from '../../domain/errors/SchemaErrors.js';

describe('FieldSchemaCompiler', () => {
  const compiler = new FieldSchemaCompiler();
  const TYPE_KEY = 'test_type';

  describe('string fields', () => {
    it('should compile a required string field', () => {
      const fields = [new TypeFieldDefinition('label', 'string', true, [])];
      const schema = compiler.compile(fields, TYPE_KEY);

      expect(schema.parse({ label: 'hello' })).toEqual({ label: 'hello' });
      expect(() => schema.parse({ label: 123 })).toThrow();
      expect(() => schema.parse({})).toThrow();
    });

    it('should compile a string field with min_length and max_length constraints', () => {
      const fields = [
        new TypeFieldDefinition('code', 'varchar', true, [
          new TypeFieldConstraint('min_length', '2'),
          new TypeFieldConstraint('max_length', '10'),
        ]),
      ];
      const schema = compiler.compile(fields, TYPE_KEY);

      expect(schema.parse({ code: 'AB' })).toEqual({ code: 'AB' });
      expect(() => schema.parse({ code: 'A' })).toThrow();
      expect(() => schema.parse({ code: 'A'.repeat(11) })).toThrow();
    });

    it('should compile a string field with regex constraint', () => {
      const fields = [
        new TypeFieldDefinition('slug', 'text', true, [
          new TypeFieldConstraint('regex', '^[a-z0-9_]+$'),
        ]),
      ];
      const schema = compiler.compile(fields, TYPE_KEY);

      expect(schema.parse({ slug: 'hello_world_42' })).toEqual({ slug: 'hello_world_42' });
      expect(() => schema.parse({ slug: 'Hello World!' })).toThrow();
    });

    it('should compile a string field with enum constraint', () => {
      const fields = [
        new TypeFieldDefinition('status', 'string', true, [
          new TypeFieldConstraint('enum', 'active, inactive, archived'),
        ]),
      ];
      const schema = compiler.compile(fields, TYPE_KEY);

      expect(schema.parse({ status: 'active' })).toEqual({ status: 'active' });
      expect(schema.parse({ status: 'archived' })).toEqual({ status: 'archived' });
      expect(() => schema.parse({ status: 'deleted' })).toThrow();
    });

    it('should prefer enum over min_length/max_length if both are present', () => {
      const fields = [
        new TypeFieldDefinition('priority', 'string', true, [
          new TypeFieldConstraint('min_length', '1'),
          new TypeFieldConstraint('enum', 'low,medium,high'),
        ]),
      ];
      const schema = compiler.compile(fields, TYPE_KEY);

      // Enum ha precedenza — 'low' è valido anche se non rispetta eventuali vincoli di lunghezza
      expect(schema.parse({ priority: 'low' })).toEqual({ priority: 'low' });
      expect(() => schema.parse({ priority: 'critical' })).toThrow();
    });
  });

  describe('number fields', () => {
    it('should compile a required number field', () => {
      const fields = [new TypeFieldDefinition('count', 'integer', true, [])];
      const schema = compiler.compile(fields, TYPE_KEY);

      expect(schema.parse({ count: 42 })).toEqual({ count: 42 });
      expect(() => schema.parse({ count: 'abc' })).toThrow();
    });

    it('should compile a number field with min and max constraints', () => {
      const fields = [
        new TypeFieldDefinition('temperature', 'decimal', true, [
          new TypeFieldConstraint('min', '-40'),
          new TypeFieldConstraint('max', '85.5'),
        ]),
      ];
      const schema = compiler.compile(fields, TYPE_KEY);

      expect(schema.parse({ temperature: 20 })).toEqual({ temperature: 20 });
      expect(schema.parse({ temperature: -40 })).toEqual({ temperature: -40 });
      expect(schema.parse({ temperature: 85.5 })).toEqual({ temperature: 85.5 });
      expect(() => schema.parse({ temperature: -41 })).toThrow();
      expect(() => schema.parse({ temperature: 86 })).toThrow();
    });

    it('should support all numeric type aliases', () => {
      const numericTypes = ['number', 'integer', 'decimal', 'numeric', 'float', 'double'];
      for (const dt of numericTypes) {
        const fields = [new TypeFieldDefinition('val', dt, true, [])];
        const schema = compiler.compile(fields, TYPE_KEY);
        expect(schema.parse({ val: 3.14 })).toEqual({ val: 3.14 });
      }
    });
  });

  describe('boolean fields', () => {
    it('should compile a required boolean field', () => {
      const fields = [new TypeFieldDefinition('isActive', 'boolean', true, [])];
      const schema = compiler.compile(fields, TYPE_KEY);

      expect(schema.parse({ isActive: true })).toEqual({ isActive: true });
      expect(schema.parse({ isActive: false })).toEqual({ isActive: false });
      expect(() => schema.parse({ isActive: 'yes' })).toThrow();
    });
  });

  describe('date fields', () => {
    it('should compile a required date field with coercion', () => {
      const fields = [new TypeFieldDefinition('createdAt', 'timestamp', true, [])];
      const schema = compiler.compile(fields, TYPE_KEY);

      const result = schema.parse({ createdAt: '2024-01-15T10:30:00Z' });
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should support all date type aliases', () => {
      const dateTypes = ['date', 'datetime', 'timestamp'];
      for (const dt of dateTypes) {
        const fields = [new TypeFieldDefinition('d', dt, true, [])];
        const schema = compiler.compile(fields, TYPE_KEY);
        const result = schema.parse({ d: '2024-06-01' });
        expect(result.d).toBeInstanceOf(Date);
      }
    });
  });

  describe('uuid fields', () => {
    it('should compile a required uuid field', () => {
      const fields = [new TypeFieldDefinition('refId', 'uuid', true, [])];
      const schema = compiler.compile(fields, TYPE_KEY);

      expect(schema.parse({ refId: '550e8400-e29b-41d4-a716-446655440000' }))
        .toEqual({ refId: '550e8400-e29b-41d4-a716-446655440000' });
      expect(() => schema.parse({ refId: 'not-a-uuid' })).toThrow();
    });
  });

  describe('optional/nullable fields', () => {
    it('should make non-required fields optional and nullable', () => {
      const fields = [
        new TypeFieldDefinition('notes', 'string', false, []),
        new TypeFieldDefinition('count', 'integer', false, []),
      ];
      const schema = compiler.compile(fields, TYPE_KEY);

      expect(schema.parse({})).toEqual({});
      expect(schema.parse({ notes: null, count: null })).toEqual({ notes: null, count: null });
      expect(schema.parse({ notes: 'hello' })).toEqual({ notes: 'hello' });
    });
  });

  describe('edge cases', () => {
    it('should return an empty z.object({}) for zero fields', () => {
      const schema = compiler.compile([], TYPE_KEY);
      expect(schema.parse({})).toEqual({});
    });

    it('should compile multiple fields of different types', () => {
      const fields = [
        new TypeFieldDefinition('name', 'string', true, [new TypeFieldConstraint('min_length', '1')]),
        new TypeFieldDefinition('age', 'integer', true, [new TypeFieldConstraint('min', '0')]),
        new TypeFieldDefinition('active', 'boolean', true, []),
        new TypeFieldDefinition('email', 'varchar', false, []),
      ];
      const schema = compiler.compile(fields, TYPE_KEY);

      const valid = { name: 'Alice', age: 30, active: true };
      expect(schema.parse(valid)).toEqual(valid);

      const withOptional = { ...valid, email: 'alice@example.com' };
      expect(schema.parse(withOptional)).toEqual(withOptional);
    });

    it('should be case-insensitive on data_type', () => {
      const fields = [new TypeFieldDefinition('val', 'STRING', true, [])];
      const schema = compiler.compile(fields, TYPE_KEY);
      expect(schema.parse({ val: 'hello' })).toEqual({ val: 'hello' });
    });
  });

  describe('unsupported data types', () => {
    it('should throw UnsupportedFieldDataTypeError for unknown data_type', () => {
      const fields = [new TypeFieldDefinition('weird', 'binary_blob', true, [])];

      expect(() => compiler.compile(fields, TYPE_KEY)).toThrow(UnsupportedFieldDataTypeError);
    });

    it('should include field key, data type and type key in the error', () => {
      const fields = [new TypeFieldDefinition('myField', 'custom_type', true, [])];

      try {
        compiler.compile(fields, 'my_entity_type');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(UnsupportedFieldDataTypeError);
        const error = err as UnsupportedFieldDataTypeError;
        expect(error.code).toBe('UNSUPPORTED_FIELD_DATA_TYPE');
        expect(error.details).toEqual({
          fieldKey: 'myField',
          dataType: 'custom_type',
          typeKey: 'my_entity_type',
        });
      }
    });

    it('should fail on first unsupported field, not silently skip it', () => {
      const fields = [
        new TypeFieldDefinition('good', 'string', true, []),
        new TypeFieldDefinition('bad', 'xml', true, []),
        new TypeFieldDefinition('alsoGood', 'integer', true, []),
      ];

      expect(() => compiler.compile(fields, TYPE_KEY)).toThrow(UnsupportedFieldDataTypeError);
    });
  });
});
