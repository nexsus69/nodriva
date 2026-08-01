export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly passwordHash: string,
    public readonly isActive: boolean,
    public readonly isSuperAdmin: boolean,
    public readonly rowVersion: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null = null
  ) {}

  static create(
    id: string,
    email: string,
    passwordHash: string,
    isSuperAdmin: boolean = false
  ): User {
    const now = new Date();
    return new User(
      id,
      email.toLowerCase().trim(),
      passwordHash,
      true,
      isSuperAdmin,
      1,
      now,
      now,
      null
    );
  }

  activate(): User {
    return new User(
      this.id,
      this.email,
      this.passwordHash,
      true,
      this.isSuperAdmin,
      this.rowVersion + 1,
      this.createdAt,
      new Date(),
      this.deletedAt
    );
  }

  disable(): User {
    return new User(
      this.id,
      this.email,
      this.passwordHash,
      false,
      this.isSuperAdmin,
      this.rowVersion + 1,
      this.createdAt,
      new Date(),
      this.deletedAt
    );
  }

  changePassword(passwordHash: string): User {
    return new User(
      this.id,
      this.email,
      passwordHash,
      this.isActive,
      this.isSuperAdmin,
      this.rowVersion + 1,
      this.createdAt,
      new Date(),
      this.deletedAt
    );
  }
}
