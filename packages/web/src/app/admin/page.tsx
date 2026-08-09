'use client';

import React from 'react';
import Link from 'next/link';
import { AdminInfrastructureStatus } from './_components/AdminInfrastructureStatus';
import { AdminModuleCard, type AdminModuleCardProps } from './_components/AdminModuleCard';

const adminModules: AdminModuleCardProps[] = [
  { icon: '🧱', badge: 'Modulo Schema', title: '1. Schema Admin', description: 'Definizione dei Tipi di Nodo ed Entità, creazione delle colonne fisiche e vincoli di validazione di dominio.', footer: 'Tipi Nodo & Entità', href: '/admin/types', action: 'Accedi allo Schema', accent: 'indigo' },
  { icon: '👥', badge: 'Modulo Utenti', title: '2. Gestione Utenti', description: 'Anagrafica utenti di sistema, controllo stato account (attivo/disabilitato) e associazione dei ruoli operativi.', footer: 'Utenti & Account', href: '/admin/users', action: 'Gestisci Utenti', accent: 'blue' },
  { icon: '🛡️', badge: 'Modulo Sicurezza IAM', title: '3. Sicurezza & Accessi (IAM)', description: 'Configurazione della matrice Ruoli-Permessi atomici e regole di isolamento gerarchico (Scope per nodo).', footer: 'Ruoli & Scope', href: '/admin/security/roles', action: 'Gestisci Sicurezza', accent: 'purple' },
  { icon: '⚙️', badge: 'Modulo Governance Sistema', title: '4. Governance di Sistema', description: 'Gestione stato delle Capacità Runtime (`hierarchical_structure`, `locking`), Impostazioni di Sistema e Policy di Posizionamento.', footer: 'Capacità & Policy', href: '/admin/system/config', action: 'Configura Sistema', accent: 'emerald' },
  { icon: '📜', badge: 'Modulo Registro Audit', title: '5. Audit & Registro Attività', description: 'Ispezione del registro immutabile delle operazioni amministrative e delle revisioni storiche di dominio.', footer: 'Registro Append-Only', href: '/admin/audit', action: 'Ispeziona Log', accent: 'amber' },
];

export default function AdminOverviewPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-panel border border-slate-200 bg-gradient-to-r from-white via-indigo-50/70 to-white">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-3"><span>⚙️</span> Centro di Controllo Amministrativo</h1>
          <p className="text-sm text-slate-400 mt-1">Gestione centralizzata dell&apos;architettura di dominio, sicurezza IAM, capacità runtime e governance di sistema.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/types" className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all">🧱 Gestisci Tipi (Schema)</Link>
          <Link href="/" className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all">🌐 Workspace Operativo</Link>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminModules.map((module) => <AdminModuleCard key={module.title} {...module} />)}
      </div>
      <AdminInfrastructureStatus />
    </div>
  );
}
