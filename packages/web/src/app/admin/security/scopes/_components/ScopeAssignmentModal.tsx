import type { FormEventHandler } from 'react';
import type { ApiErrorResponse, RoleListItemDto, ScopeAssignmentDto, UserListItemDto } from '@dashboard/core';
import { AdminModalShell } from '../../../_components/AdminModalShell';
import { AdminResourceLock } from '../../../_components/AdminResourceLock';

interface ScopeAssignmentModalProps {
  editingScope: ScopeAssignmentDto | null;
  users: UserListItemDto[];
  roles: RoleListItemDto[];
  nodes: { id: string; name: string }[];
  selectedUserId: string;
  selectedNodeId: string;
  selectedRoleId: string;
  assignmentEffect: 'allow' | 'deny';
  propagation: 'self' | 'subtree';
  formError: ApiErrorResponse | null;
  isPending: boolean;
  setSelectedUserId: (value: string) => void;
  setSelectedNodeId: (value: string) => void;
  setSelectedRoleId: (value: string) => void;
  setAssignmentEffect: (value: 'allow' | 'deny') => void;
  setPropagation: (value: 'self' | 'subtree') => void;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}

export function ScopeAssignmentModal(props: ScopeAssignmentModalProps) {
  const editing = Boolean(props.editingScope);
  return (
    <AdminModalShell>
      {props.editingScope && <AdminResourceLock resourceType="scope_assignment" resourceId={props.editingScope.id} />}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2"><span>🔒</span> {editing ? 'Modifica ambito' : 'Nuova assegnazione ambito'}</h3>
        <button type="button" onClick={props.onClose} aria-label="Chiudi assegnazione ambito" className="text-slate-400 hover:text-slate-200 text-sm">✕</button>
      </div>
      {props.formError && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{props.formError.message}</div>}
      <form onSubmit={props.onSubmit} className="space-y-4">
        <div>
          <label htmlFor="scope-user" className="block text-xs font-medium text-slate-300 mb-1">Utente *</label>
          <select id="scope-user" name="userId" required disabled={editing} value={props.selectedUserId} onChange={(event) => props.setSelectedUserId(event.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-purple-500 disabled:opacity-60">
            <option value="">-- Scegli un utente --</option>
            {props.users.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="scope-node" className="block text-xs font-medium text-slate-300 mb-1">Nodo *</label>
          <select id="scope-node" name="nodeId" required disabled={editing} value={props.selectedNodeId} onChange={(event) => props.setSelectedNodeId(event.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-purple-500 disabled:opacity-60">
            <option value="">-- Scegli un nodo --</option>
            {props.nodes.map((node) => <option key={node.id} value={node.id}>{node.name} (ID: {node.id.substring(0, 8)}...)</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="scope-role" className="block text-xs font-medium text-slate-300 mb-1">Ruolo associato allo scope *</label>
          <select id="scope-role" name="roleId" required value={props.selectedRoleId} onChange={(event) => props.setSelectedRoleId(event.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-purple-500">
            <option value="">-- Scegli un ruolo --</option>
            {props.roles.map((role) => <option key={role.id} value={role.id}>{role.name} ({role.roleKey})</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="scope-effect" className="block text-xs font-medium text-slate-300 mb-1">Effetto *</label>
            <select id="scope-effect" name="assignmentEffect" value={props.assignmentEffect} onChange={(event) => props.setAssignmentEffect(event.target.value as 'allow' | 'deny')} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-purple-500"><option value="allow">ALLOW (Consenti)</option><option value="deny">DENY (Nega)</option></select>
          </div>
          <div>
            <label htmlFor="scope-propagation" className="block text-xs font-medium text-slate-300 mb-1">Propagazione *</label>
            <select id="scope-propagation" name="propagation" value={props.propagation} onChange={(event) => props.setPropagation(event.target.value as 'self' | 'subtree')} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-purple-500"><option value="subtree">Sottoalbero (ricorsivo)</option><option value="self">Solo nodo</option></select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
          <button type="button" onClick={props.onClose} className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50">Annulla</button>
          <button type="submit" disabled={props.isPending || !props.selectedUserId || !props.selectedNodeId || !props.selectedRoleId} className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20 disabled:opacity-50">{props.isPending ? 'Salvataggio…' : editing ? 'Salva modifiche' : 'Crea assegnazione'}</button>
        </div>
      </form>
    </AdminModalShell>
  );
}
