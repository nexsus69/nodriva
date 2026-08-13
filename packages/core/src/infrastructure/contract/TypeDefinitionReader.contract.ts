import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TypeDefinitionReader } from '../../application/ports/TypeDefinitionReader.js';

export interface TypeDefinitionReaderContractFixture {
  readonly reader: TypeDefinitionReader;
  deactivateType(): Promise<void>;
  dispose(): Promise<void>;
}

/** Runs the same observable runtime-schema assertions against every adapter. */
export function registerTypeDefinitionReaderContract(
  adapterName: string,
  createFixture: () => Promise<TypeDefinitionReaderContractFixture>,
): void {
  describe(`${adapterName} TypeDefinitionReader contract`, () => {
    let fixture: TypeDefinitionReaderContractFixture;

    beforeEach(async () => { fixture = await createFixture(); });
    afterEach(async () => { if (fixture) await fixture.dispose(); });

    it('preserves field order, constraints, managed enum options, and encryption metadata', async () => {
      const definition = await fixture.reader.readDefinition('node', 'contract_device');
      expect(definition?.fields.map((field) => field.fieldKey)).toEqual(['status', 'serial_number']);
      expect(definition?.fields[0]).toMatchObject({
        enumMode: 'managed',
        enumOptions: [{ value: 'active', label: 'Active', isActive: true, position: 0 }],
      });
      expect(definition?.fields[1]).toMatchObject({
        encryptionMode: 'encrypted',
        constraints: [{ constraintType: 'regex', value: '^[A-Z0-9]+$' }],
      });
    });

    it('does not expose inactive types to runtime schema resolution', async () => {
      await fixture.deactivateType();
      await expect(fixture.reader.readDefinition('node', 'contract_device')).resolves.toBeNull();
    });
  });
}
