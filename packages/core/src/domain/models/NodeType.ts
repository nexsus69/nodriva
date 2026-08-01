export class NodeType {
  constructor(
    public readonly id: string,
    public readonly typeKey: string,
    public readonly name: string,
    public readonly description: string,
    public readonly currentSchemaVersion: number = 1
  ) {}
}
