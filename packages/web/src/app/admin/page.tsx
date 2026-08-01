'use client';

import React from 'react';
import Link from 'next/link';

export default function AdminOverviewPage() {
  return (
    <div className="space-y-8">
      {/* Banner di Benvenuto / Titolo Sezione */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-panel border border-slate-800 bg-gradient-to-r from-slate-900/80 via-indigo-950/20 to-slate-900/80">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-3">
            <span>⚙️</span> Centro di Controllo Amministrativo
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestione centralizzata dell&apos;architettura di dominio, sicurezza IAM, capacità runtime e governance di sistema.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/types"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all"
          >
            🧱 Gestisci Tipi (Schema)
          </Link>
          <Link
            href="/"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
          >
            🌐 Workspace Operativo
          </Link>
        </div>
      </div>

      {/* Grid dei 5 Moduli Funzionali dell'Admin */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Modulo 1: Schema Admin */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 hover:border-indigo-500/40 transition-all flex flex-col justify-between group">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xl text-indigo-400">
                🧱
              </div>
              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                Modulo Schema
              </span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-200 group-hover:text-indigo-300 transition-colors">
                1. Schema Admin
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Definizione dei Tipi di Nodo ed Entità, creazione delle colonne fisiche e vincoli di validazione di dominio.
              </p>
            </div>
          </div>
          <div className="pt-6 mt-6 border-t border-slate-800/60 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-mono">Tipi Nodo & Entità</span>
            <Link
              href="/admin/types"
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              Accedi allo Schema &rarr;
            </Link>
          </div>
        </div>

        {/* Modulo 2: User Admin */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 hover:border-blue-500/40 transition-all flex flex-col justify-between group">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xl text-blue-400">
                👥
              </div>
              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                Modulo Utenti
              </span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-200 group-hover:text-blue-300 transition-colors">
                2. Gestione Utenti
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Anagrafica utenti di sistema, controllo stato account (attivo/disabilitato) e associazione dei ruoli operativi.
              </p>
            </div>
          </div>
          <div className="pt-6 mt-6 border-t border-slate-800/60 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-mono">Utenti & Account</span>
            <Link
              href="/admin/users"
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              Gestisci Utenti &rarr;
            </Link>
          </div>
        </div>

        {/* Modulo 3: IAM & Security Admin */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 hover:border-purple-500/40 transition-all flex flex-col justify-between group">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-xl text-purple-400">
                🛡️
              </div>
              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                Modulo Sicurezza IAM
              </span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-200 group-hover:text-purple-300 transition-colors">
                3. Sicurezza & Accessi (IAM)
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Configurazione della matrice Ruoli-Permessi atomici e regole di isolamento gerarchico (Scope per nodo).
              </p>
            </div>
          </div>
          <div className="pt-6 mt-6 border-t border-slate-800/60 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-mono">Ruoli & Scope</span>
            <Link
              href="/admin/security/roles"
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              Gestisci Sicurezza &rarr;
            </Link>
          </div>
        </div>

        {/* Modulo 4: System & Governance Admin */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 hover:border-emerald-500/40 transition-all flex flex-col justify-between group">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xl text-emerald-400">
                ⚙️
              </div>
              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                Modulo Governance Sistema
              </span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-200 group-hover:text-emerald-300 transition-colors">
                4. Governance di Sistema
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Gestione stato delle Capacità Runtime (`hierarchical_structure`, `locking`), Impostazioni di Sistema e Policy di Posizionamento.
              </p>
            </div>
          </div>
          <div className="pt-6 mt-6 border-t border-slate-800/60 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-mono">Capacità & Policy</span>
            <Link
              href="/admin/system/config"
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              Configura Sistema &rarr;
            </Link>
          </div>
        </div>

        {/* Modulo 5: Audit & Activity Log */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 hover:border-amber-500/40 transition-all flex flex-col justify-between group">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xl text-amber-400">
                📜
              </div>
              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                Modulo Registro Audit
              </span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-200 group-hover:text-amber-300 transition-colors">
                5. Audit & Registro Attività
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Ispezione del registro immutabile delle operazioni amministrative e delle revisioni storiche di dominio.
              </p>
            </div>
          </div>
          <div className="pt-6 mt-6 border-t border-slate-800/60 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-mono">Registro Append-Only</span>
            <Link
              href="/admin/audit"
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              Ispeziona Log &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Scheda Diagnostica Stato Ambiente e Architettura */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <span>🛡️</span> Architettura & Stato Infrastruttura
          </h3>
          <span className="text-xs font-mono text-slate-400">Clean Architecture / DDD Modular Monolith</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
            <span className="text-slate-500 block text-[10px]">MOTORE DATABASE</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span> PostgreSQL 16 (Porta 5433)
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
            <span className="text-slate-500 block text-[10px]">SERVIZI APPLICATIVI CORE</span>
            <span className="text-indigo-400 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-400"></span> @dashboard/core (Isolato)
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
            <span className="text-slate-500 block text-[10px]">WEB SERVER ACTIONS</span>
            <span className="text-purple-400 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400"></span> Zero Query SQL Dirette
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
