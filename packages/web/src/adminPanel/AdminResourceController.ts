import type {
  AdminResourceAction,
  AdminResourceDefinition,
} from "./AdminResourceDefinition";

/** Represents the observable lifecycle state of one administrative resource. */
export interface AdminResourceSnapshot<TRow, TDetail> {
  rows: readonly TRow[];
  detail: TDetail | null;
  loading: boolean;
  detailLoading: boolean;
  pending: boolean;
  error: Error | null;
  detailError: Error | null;
}

const INITIAL_SNAPSHOT: AdminResourceSnapshot<never, never> = {
  rows: [],
  detail: null,
  loading: false,
  detailLoading: false,
  pending: false,
  error: null,
  detailError: null,
};

/** Owns resource lifecycle transitions independently from React components. */
export class AdminResourceController<
  TRow extends { id: string },
  TDetail = TRow,
  TForm extends Record<string, unknown> = Record<string, unknown>,
  TContext = unknown,
  TId = string,
> {
  private snapshot: AdminResourceSnapshot<TRow, TDetail> =
    INITIAL_SNAPSHOT as AdminResourceSnapshot<TRow, TDetail>;
  private readonly subscribers = new Set<() => void>();
  private listRequestVersion = 0;

  public constructor(
    private readonly definition: AdminResourceDefinition<
      TRow,
      TDetail,
      TForm,
      TContext,
      TId
    >,
    private readonly context: TContext,
  ) {}

  public getSnapshot = (): AdminResourceSnapshot<TRow, TDetail> =>
    this.snapshot;

  public subscribe = (listener: () => void): (() => void) => {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  };

  public async loadList(): Promise<void> {
    const requestVersion = ++this.listRequestVersion;
    // Keep visible rows stable during refreshes; `loading` is reserved for the
    // initial empty collection so screens do not flash a loading footer after
    // every mutation or realtime invalidation.
    this.patch({ loading: this.snapshot.rows.length === 0, error: null });
    try {
      const rows = await this.definition.list.load();
      if (requestVersion !== this.listRequestVersion) return;
      this.patch({ rows: [...rows], loading: false });
    } catch (reason) {
      if (requestVersion !== this.listRequestVersion) return;
      this.patch({
        loading: false,
        error: toError(reason),
      });
    }
  }

  public async loadDetail(id: TId): Promise<TDetail | null> {
    if (!this.definition.detail) return null;
    this.patch({ detailLoading: true, detailError: null });
    try {
      const detail = await this.definition.detail.load(id);
      this.patch({ detail, detailLoading: false });
      return detail;
    } catch (reason) {
      this.patch({ detailLoading: false, detailError: toError(reason) });
      return null;
    }
  }

  public async create(input: TForm): Promise<TDetail | null> {
    if (!this.definition.detail?.create) return null;
    this.patch({ pending: true, error: null });
    try {
      const detail = await this.definition.detail.create(input);
      this.patch({ detail, pending: false });
      await this.loadList();
      return detail;
    } catch (reason) {
      this.patch({ pending: false, error: toError(reason) });
      return null;
    }
  }

  public async update(
    id: TId,
    input: TForm,
    expectedRowVersion?: number,
  ): Promise<TDetail | null> {
    if (!this.definition.detail?.update) return null;
    this.patch({ pending: true, error: null });
    try {
      const detail = await this.definition.detail.update(
        id,
        input,
        expectedRowVersion,
      );
      this.patch({ detail, pending: false });
      await this.loadList();
      return detail;
    } catch (reason) {
      this.patch({ pending: false, error: toError(reason) });
      return null;
    }
  }

  public async executeAction(
    action: AdminResourceAction<TRow, TContext>,
    row: TRow,
  ): Promise<boolean> {
    this.patch({ pending: true, error: null });
    try {
      await action.execute(row, this.context);
      this.patch({ pending: false });
      await this.loadList();
      return true;
    } catch (reason) {
      this.patch({ pending: false, error: toError(reason) });
      return false;
    }
  }

  private patch(
    values: Partial<AdminResourceSnapshot<TRow, TDetail>>,
  ): void {
    this.snapshot = { ...this.snapshot, ...values };
    this.subscribers.forEach((subscriber) => subscriber());
  }
}

function toError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason));
}
