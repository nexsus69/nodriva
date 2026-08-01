export class EntityType {
  constructor(
    public readonly id: string,
    public readonly typeKey: string,
    public readonly name: string,
    public readonly description: string,
    public readonly storageTable: string,
    public readonly currentSchemaVersion: number,
    public readonly isActive: boolean
  ) {}
}
