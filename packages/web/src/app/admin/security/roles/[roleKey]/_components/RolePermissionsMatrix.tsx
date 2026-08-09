import type { RoleDetailDto } from '@dashboard/core';

export interface RolePermissionsMatrixProps {
  groupedPermissions: Readonly<Record<string, readonly RoleDetailDto['allAvailablePermissions'][number][]>>;
  isSystem: boolean;
  selectedPermissionIds: readonly string[];
  onToggle: (permissionId: string) => void;
}

export function RolePermissionsMatrix({ groupedPermissions, isSystem, selectedPermissionIds, onToggle }: RolePermissionsMatrixProps) {
  return <div className="space-y-6">{Object.entries(groupedPermissions).map(([kind, permissions]) => <div key={kind} className="space-y-3"><h3 className="text-xs font-semibold text-purple-300 font-mono tracking-wider uppercase border-b border-slate-800/60 pb-1">Risorsa: {kind} ({permissions.length})</h3><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{permissions.map((permission) => { const checked = selectedPermissionIds.includes(permission.id); return <label key={permission.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${isSystem ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'} ${checked ? 'bg-purple-600/10 border-purple-500/40 text-purple-200' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'}`}><input type="checkbox" disabled={isSystem} checked={checked} onChange={() => onToggle(permission.id)} className="mt-0.5 rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-purple-500" /><div className="space-y-0.5"><span className="text-xs font-semibold block">{permission.name}</span><span className="text-[10px] font-mono text-purple-400 block">{permission.permissionKey}</span>{permission.description && <p className="text-[10px] text-slate-500">{permission.description}</p>}</div></label>; })}</div></div>)}</div>;
}
