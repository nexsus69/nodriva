export class ManagedEnumOption {
  constructor(
    readonly id: string,
    readonly fieldId: string,
    readonly value: string,
    readonly label: string,
    readonly position: number,
    readonly isActive: boolean,
    readonly createdAt: Date,
    readonly updatedAt: Date
  ) {}
}
