'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppCache } from './cache/GlobalCacheClient';
import { useSemanticNodeList } from './hooks/useSemanticNodeList';
import { PageShell, Panel, SectionHeader } from './components/ui/layout';
import { Alert, EmptyState, LoadingState } from './components/ui/feedback';

export default function WorkspaceOperationalHub() {
  const [isCheckingSeed, setIsCheckingSeed] = useState(true);
  const [dbSeeded, setDbSeeded] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedConfirmation, setSeedConfirmation] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { nodes: rootNodes, isLoading: isNodesLoading, error: nodesError } = useSemanticNodeList(null);

  // 1. Controllo inizializzazione DB
  useEffect(() => {
    AppCache.admin.checkDatabaseSeeded().then((seeded) => {
      setDbSeeded(seeded);
      setIsCheckingSeed(false);
    });
  }, []);

  // Removed manual fetchChildren/fetchTypes in useEffect because useSemanticNodeList handles it declaratively

  const handleSeedDatabase = async () => {
    setIsSeeding(true);
    setErrorMsg(null);
    try {
      await AppCache.admin.seedDatabase(seedConfirmation);
      setDbSeeded(true);
      window.location.reload();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Errore sconosciuto';
      setErrorMsg('Errore durante l\'inizializzazione del DB: ' + message);
      setIsSeeding(false);
    }
  };


  return (
    <PageShell className="space-y-8">
      {/* Banner Principale Hub Operativo */}
      <section className="relative overflow-hidden rounded-[2rem] border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/60 to-violet-50 p-7 shadow-xl shadow-slate-200/70 sm:p-9">
        <div aria-hidden="true" className="absolute -right-28 -top-32 h-80 w-80 rounded-full border-[42px] border-indigo-400/10" />
        <div aria-hidden="true" className="absolute bottom-[-8rem] right-24 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-300/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />
              Workspace operativo
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Il tuo spazio di lavoro.</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
                Esplora la struttura aziendale e accedi rapidamente a ordini, entità, clienti e sotto-nodi.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
              <span aria-hidden="true">⚙</span> Centro di controllo
            </Link>
          </div>
        </div>
      </section>

      <section aria-label="Riepilogo workspace" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="glass-panel flex items-center justify-between rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Nodi radice</p><p className="mt-2 text-2xl font-semibold text-slate-900">{isCheckingSeed || isNodesLoading ? '—' : rootNodes.length}</p></div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-xl text-indigo-300">⌘</span>
        </div>
        <div className="glass-panel flex items-center justify-between rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Stato sistema</p><p className={`mt-2 text-sm font-semibold ${dbSeeded ? 'text-emerald-300' : 'text-amber-300'}`}>{isCheckingSeed ? 'Verifica in corso' : dbSeeded ? 'Operativo' : 'Configurazione richiesta'}</p></div>
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${dbSeeded ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300'}`}>●</span>
        </div>
        <div className="glass-panel flex items-center justify-between rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Accesso</p><p className="mt-2 text-sm font-semibold text-slate-700">Sessione protetta</p></div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-400/10 text-violet-300">✓</span>
        </div>
      </section>

      {/* Se il DB non è ancora inizializzato */}
      {!isCheckingSeed && !dbSeeded && (
        <div className="space-y-4 rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 to-transparent p-8 text-center shadow-lg shadow-amber-950/10">
          <span className="text-4xl block">🌱</span>
          <h2 className="text-base font-semibold text-amber-100">Completa la configurazione iniziale</h2>
          <p className="text-xs text-amber-300/80 max-w-md mx-auto">
            Operazione distruttiva: inserisci <strong>RESET DEMO DATABASE</strong> per confermare il ripristino dei dati demo.
          </p>
          <input
            value={seedConfirmation}
            onChange={(event) => setSeedConfirmation(event.target.value)}
            aria-label="Conferma ripristino database demo"
            className="mx-auto w-full max-w-sm rounded-xl border border-amber-500/30 bg-white px-3 py-2 text-sm text-slate-900"
            placeholder="RESET DEMO DATABASE"
          />
          <button
            onClick={handleSeedDatabase}
            disabled={isSeeding || seedConfirmation !== 'RESET DEMO DATABASE'}
            className="rounded-xl bg-amber-500 px-6 py-2.5 text-xs font-semibold text-slate-950 shadow-lg shadow-amber-600/20 transition-all hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSeeding ? 'Inizializzazione in corso...' : '🌱 Esegui Seeding Dati Demo'}
          </button>
        </div>
      )}

      {/* Messaggi di Errore */}
      {(errorMsg || nodesError) && (
        <Alert tone="danger"><span className="font-bold">Errore:</span> {errorMsg || nodesError?.message}</Alert>
      )}

      {/* Griglia Nodi Radice */}
      <div className="space-y-4">
        <SectionHeader
          title="Nodi radice"
          description="Navigazione"
          actions={<span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-500 shadow-sm">{rootNodes.length} disponibili</span>}
        />

        {isNodesLoading || isCheckingSeed ? (
          <Panel><LoadingState label="Caricamento struttura gerarchica in corso…" /></Panel>
        ) : rootNodes.length === 0 ? (
          <EmptyState title="Nessun nodo radice trovato" description="Inizializza il database o crea un primo nodo dall&apos;amministrazione." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rootNodes.map((node) => {
              return (
                <div
                  key={node.id}
                  className="group glass-panel flex flex-col justify-between space-y-6 rounded-2xl border border-slate-200 p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-100"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-xl text-indigo-400">
                        ⌂
                      </div>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-mono text-slate-500">
                        Nodo Radice
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-800 transition-colors group-hover:text-indigo-600">
                        {node.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
                        {node.description || 'Nessuna descrizione specificata per questo nodo radice.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                    <span className="text-xs text-slate-500 font-mono">ID: {node.id.substring(0, 8)}...</span>
                    <Link
                      href={`/nodes/${node.id}`}
                      className="flex items-center gap-1.5 rounded-xl bg-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition-all hover:bg-indigo-400"
                    >
                      <span>Apri Nodo</span>
                      <span>→</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Scheda Riepilogo Architettura Workspace */}
      <Panel className="space-y-3">
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 font-mono">
          <span>🛡️</span> Isolamento Architetturale
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Il Workspace Operativo consuma esclusivamente i servizi applicativi <code className="text-indigo-300 font-mono">NodeApplicationService</code> ed <code className="text-indigo-300 font-mono">EntityApplicationService</code>. Le funzioni di configurazione amministrativa restano nettamente segregate sotto <code className="text-purple-300 font-mono">/admin/*</code>.
        </p>
      </Panel>
    </PageShell>
  );
}
