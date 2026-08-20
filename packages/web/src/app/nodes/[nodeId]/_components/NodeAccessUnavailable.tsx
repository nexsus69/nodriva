import { PageShell, Panel } from '../../../components/ui/layout';

export function NodeAccessUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <PageShell>
      <Panel className="mx-auto max-w-xl space-y-4 border-amber-200 bg-amber-50">
        <div className="text-4xl">⚠️</div>
        <h1 className="text-xl font-semibold text-slate-900">Verifica accesso non disponibile</h1>
        <p className="text-sm text-slate-600">Non è stato possibile verificare lo scope per un problema temporaneo. Il tuo accesso non è stato negato.</p>
        <button type="button" onClick={onRetry} className="inline-flex rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500">Riprova</button>
      </Panel>
    </PageShell>
  );
}
