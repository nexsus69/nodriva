'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { seedDatabaseAction, checkDatabaseSeededAction } from './actions/seedAction';
import { useSemanticNodeList } from './hooks/useSemanticNodeList';
import { LogoutButton } from './components/ui/LogoutButton';

export default function WorkspaceOperationalHub() {
  const [isCheckingSeed, setIsCheckingSeed] = useState(true);
  const [dbSeeded, setDbSeeded] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { nodes: rootNodes, isLoading: isNodesLoading, error: nodesError } = useSemanticNodeList(null);

  // 1. Controllo inizializzazione DB
  useEffect(() => {
    checkDatabaseSeededAction().then((seeded) => {
      setDbSeeded(seeded);
      setIsCheckingSeed(false);
    });
  }, []);

  // Removed manual fetchChildren/fetchTypes in useEffect because useSemanticNodeList handles it declaratively

  const handleSeedDatabase = async () => {
    setIsSeeding(true);
    setErrorMsg(null);
    try {
      await seedDatabaseAction();
      setDbSeeded(true);
      window.location.reload();
    } catch (err: any) {
      setErrorMsg('Errore durante l\'inizializzazione del DB: ' + err.message);
      setIsSeeding(false);
    }
  };


  return (
    <div className="space-y-8">
      {/* Banner Principale Hub Operativo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 rounded-3xl glass-panel border border-slate-800 bg-gradient-to-r from-slate-900/90 via-indigo-950/30 to-slate-900/90 shadow-2xl">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
            Workspace Operativo V2
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-3">
            <span>🌐</span> Hub Operativo Dashboard
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
            Seleziona un nodo gerarchico per accedere alla gestione operativa di ordini, entità, clienti e sotto-nodi aziendali.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <Link
            href="/admin"
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-2 shadow-sm"
          >
            <span>⚙️</span> Centro di Controllo Admin
          </Link>
          <LogoutButton />
        </div>
      </div>

      {/* Se il DB non è ancora inizializzato */}
      {!isCheckingSeed && !dbSeeded && (
        <div className="p-8 glass-panel rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-4 text-center">
          <span className="text-4xl block">🌱</span>
          <h2 className="text-base font-bold text-amber-200">Database non ancora inizializzato</h2>
          <p className="text-xs text-amber-300/80 max-w-md mx-auto">
            Il database PostgreSQL non contiene dati iniziali. Clicca il pulsante sottostante per eseguire il seeding con dati demo (nodi, ordini, entità).
          </p>
          <button
            onClick={handleSeedDatabase}
            disabled={isSeeding}
            className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/25 transition-all"
          >
            {isSeeding ? 'Inizializzazione in corso...' : '🌱 Esegui Seeding Dati Demo'}
          </button>
        </div>
      )}

      {/* Messaggi di Errore */}
      {(errorMsg || nodesError) && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          <span className="font-bold">Errore:</span> {errorMsg || nodesError?.message}
        </div>
      )}

      {/* Griglia Nodi Radice */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200 uppercase font-mono tracking-wider flex items-center gap-2">
            <span>📁</span> Nodi Radice Operativi ({rootNodes.length})
          </h2>
        </div>

        {isNodesLoading || isCheckingSeed ? (
          <div className="glass-panel p-12 text-center text-xs text-slate-400 rounded-2xl">
            Caricamento struttura gerarchica in corso...
          </div>
        ) : rootNodes.length === 0 ? (
          <div className="glass-panel p-12 text-center space-y-3 rounded-2xl">
            <span className="text-3xl block">📦</span>
            <p className="text-sm font-semibold text-slate-300">Nessun Nodo Radice Trovato</p>
            <p className="text-xs text-slate-500">Inizializza il database o crea un primo nodo dall&apos;amministrazione.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rootNodes.map((node) => {
              return (
                <div
                  key={node.id}
                  className="glass-panel p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/40 transition-all flex flex-col justify-between space-y-6 group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xl text-indigo-400">
                        📦
                      </div>
                      <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        Nodo Radice
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">
                        {node.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
                        {node.description || 'Nessuna descrizione specificata per questo nodo radice.'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-mono">ID: {node.id.substring(0, 8)}...</span>
                    <Link
                      href={`/nodes/${node.id}`}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
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
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3">
        <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider flex items-center gap-2">
          <span>🛡️</span> Isolamento Architetturale
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Il Workspace Operativo consuma esclusivamente i servizi applicativi <code className="text-indigo-300 font-mono">NodeApplicationService</code> ed <code className="text-indigo-300 font-mono">EntityApplicationService</code>. Le funzioni di configurazione amministrativa restano nettamente segregate sotto <code className="text-purple-300 font-mono">/admin/*</code>.
        </p>
      </div>
    </div>
  );
}
