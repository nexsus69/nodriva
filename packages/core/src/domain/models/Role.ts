export class Role {
  constructor(
    public readonly id: string,
    public readonly roleKey: string,
    public readonly name: string,
    public readonly description: string,
    public readonly isSystem: boolean,
    public readonly rowVersion: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null = null
  ) {}

  static create(id: string, roleKey: string, name: string, description: string = ''): Role {
    const now = new Date();
    return new Role(
      id,
      roleKey.trim(),
      name.trim(),
      description.trim(),
      false,
      1,
      now,
      now,
      null
    );
  }
}
