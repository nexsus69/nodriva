import { describe, it, expect } from 'vitest';
import {
  CreateTypeAdminCommandSchema,
  UpdateTypeAdminCommandSchema,
  DisableTypeAdminCommandSchema,
  CreateFieldAdminCommandSchema,
  UpdateFieldAdminCommandSchema,
  DeleteFieldAdminCommandSchema,
  ReorderFieldsCommandSchema,
} from '../../index.js';

describe('AdminContractDtos', () => {
  it('should validate CreateTypeAdminCommandSchema correctly', () => {
    const valid = CreateTypeAdminCommandSchema.parse({
      kind: 'entity',
      typeKey: 'device_sensor',
      name: 'Device Sensor',
      storageTable: 'entity_device_sensor',
    });
    expect(valid.kind).toBe('entity');
    expect(valid.typeKey).toBe('device_sensor');

    expect(() =>
      CreateTypeAdminCommandSchema.parse({
        kind: 'invalid_kind',
        typeKey: 'INVALID KEY',
        name: 'A',
      })
    ).toThrow();
  });

  it('should validate UpdateTypeAdminCommandSchema correctly', () => {
    const valid = UpdateTypeAdminCommandSchema.parse({
      name: 'Updated Name',
      description: 'Updated Description',
      expectedRowVersion: 2,
    });
    expect(valid.expectedRowVersion).toBe(2);

    expect(() =>
      UpdateTypeAdminCommandSchema.parse({
        name: 'Name',
        description: 'Desc',
        expectedRowVersion: -1,
      })
    ).toThrow();
  });

  it('should validate DisableTypeAdminCommandSchema correctly', () => {
    const valid = DisableTypeAdminCommandSchema.parse({
      expectedRowVersion: 5,
    });
    expect(valid.expectedRowVersion).toBe(5);
  });

  it('should validate CreateFieldAdminCommandSchema correctly', () => {
    const valid = CreateFieldAdminCommandSchema.parse({
      fieldKey: 'temperature',
      label: 'Temperature °C',
      columnName: 'temperature',
      dataType: 'number',
      expectedTypeRowVersion: 1,
    });
    expect(valid.dataType).toBe('number');
    expect(valid.expectedTypeRowVersion).toBe(1);
  });

  it('should validate UpdateFieldAdminCommandSchema correctly', () => {
    const valid = UpdateFieldAdminCommandSchema.parse({
      fieldId: 'a0000000-0000-0000-0000-000000000001',
      label: 'New Label',
      expectedTypeRowVersion: 3,
    });
    expect(valid.fieldId).toBe('a0000000-0000-0000-0000-000000000001');
    expect(valid.expectedTypeRowVersion).toBe(3);
  });

  it('should validate DeleteFieldAdminCommandSchema correctly', () => {
    const valid = DeleteFieldAdminCommandSchema.parse({
      fieldId: 'a0000000-0000-0000-0000-000000000001',
      expectedTypeRowVersion: 3,
    });
    expect(valid.expectedTypeRowVersion).toBe(3);
  });

  it('should validate ReorderFieldsCommandSchema correctly', () => {
    const valid = ReorderFieldsCommandSchema.parse({
      orderedFieldIds: [
        'a0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000002',
      ],
      expectedTypeRowVersion: 4,
    });
    expect(valid.orderedFieldIds.length).toBe(2);
    expect(valid.expectedTypeRowVersion).toBe(4);

    expect(() =>
      ReorderFieldsCommandSchema.parse({
        orderedFieldIds: [],
        expectedTypeRowVersion: 4,
      })
    ).toThrow();
  });
});
