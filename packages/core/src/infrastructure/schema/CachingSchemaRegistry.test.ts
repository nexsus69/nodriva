import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { CachingSchemaRegistry } from './CachingSchemaRegistry.js';
import { FieldSchemaCompiler } from './FieldSchemaCompiler.js';
import { TypeDefinitionReader } from '../../application/ports/TypeDefinitionReader.js';
import {
  TypeDefinition,
  TypeFieldDefinition,
  TypeFieldConstraint,
} from '../../application/dto/TypeFieldDefinition.js';

describe('CachingSchemaRegistry', () => {
  let registry: CachingSchemaRegistry;
  let mockReader: TypeDefinitionReader;
  let compiler: FieldSchemaCompiler;

  const deviceDefinition = new TypeDefinition(
    'type-id-1',
    'entity',
    'device',
    'Device',
    'A device type',
    1,
    [
      new TypeFieldDefinition('serial_number', 'string', true, [
        new TypeFieldConstraint('min_length', '5'),
      ]),
      new TypeFieldDefinition('firmware', 'string', false, []),
    ]
  );

  beforeEach(() => {
    mockReader = {
      readDefinition: vi.fn().mockResolvedValue(deviceDefinition),
    };
    compiler = new FieldSchemaCompiler();
    registry = new CachingSchemaRegistry(mockReader, compiler);
  });

  it('should compile and return a schema on first call', async () => {
    const schema = await registry.getSchema('entity', 'device');

    expect(schema).not.toBeNull();
    expect(schema!.parse({ serial_number: 'SN-12345' })).toEqual({ serial_number: 'SN-12345' });
    expect(mockReader.readDefinition).toHaveBeenCalledWith('entity', 'device');
  });

  it('should return cached schema on subsequent calls without re-reading', async () => {
    const schema1 = await registry.getSchema('entity', 'device');
    const schema2 = await registry.getSchema('entity', 'device');

    expect(schema1).toBe(schema2); // stessa referenza — cache hit
    expect(mockReader.readDefinition).toHaveBeenCalledTimes(1);
  });

  it('should return null for a type that does not exist', async () => {
    mockReader.readDefinition = vi.fn().mockResolvedValue(null);

    const schema = await registry.getSchema('node', 'nonexistent');

    expect(schema).toBeNull();
  });

  it('should re-read after invalidation', async () => {
    await registry.getSchema('entity', 'device');
    expect(mockReader.readDefinition).toHaveBeenCalledTimes(1);

    registry.invalidate('entity', 'device');

    await registry.getSchema('entity', 'device');
    expect(mockReader.readDefinition).toHaveBeenCalledTimes(2);
  });

  it('should re-read all after clear', async () => {
    await registry.getSchema('entity', 'device');

    registry.clear();

    await registry.getSchema('entity', 'device');
    expect(mockReader.readDefinition).toHaveBeenCalledTimes(2);
  });

  it('should cache different domains independently', async () => {
    const nodeDefinition = new TypeDefinition(
      'type-id-2',
      'node',
      'device',
      'Device Node',
      'Node type for devices',
      1,
      [new TypeFieldDefinition('location', 'string', true, [])]
    );

    mockReader.readDefinition = vi.fn().mockImplementation(async (domain, typeKey) => {
      if (domain === 'entity' && typeKey === 'device') return deviceDefinition;
      if (domain === 'node' && typeKey === 'device') return nodeDefinition;
      return null;
    });

    const entitySchema = await registry.getSchema('entity', 'device');
    const nodeSchema = await registry.getSchema('node', 'device');

    expect(entitySchema).not.toBe(nodeSchema);
    expect(mockReader.readDefinition).toHaveBeenCalledTimes(2);

    // Invalida solo entity — node resta in cache
    registry.invalidate('entity', 'device');
    await registry.getSchema('entity', 'device');
    await registry.getSchema('node', 'device');
    expect(mockReader.readDefinition).toHaveBeenCalledTimes(3); // solo entity riletta
  });
});
