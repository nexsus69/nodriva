'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type {
  TypeKind,
  TypeDetailDto,
  FieldDto,
  TypeListItemDto,
  FieldDataType,
  UpdateTypeUiCommand,
  DisableTypeUiCommand,
  CreateFieldUiCommand,
  UpdateFieldUiCommand,
  DeleteFieldUiCommand,
  ReorderFieldsUiCommand,
  ApiErrorResponse,
} from '@dashboard/core';
import { AppCache } from '../../../../cache/GlobalCacheClient';
import { ConfirmModal } from '../../../../components/ui/ConfirmModal';
import { TypeFieldsTable } from '../../_components/TypeFieldsTable';
import { TypeFieldEditorModal } from '../../_components/TypeFieldEditorModal';

export default function AdminTypeDetailPage() {
  const params = useParams();
  const kind = params.kind as TypeKind;
  const typeKey = params.typeKey as string;

  const [typeDetail, setTypeDetail] = useState<TypeDetailDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);
  const [conflictError, setConflictError] = useState<ApiErrorResponse | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  // Form Tipo (coarse-grained)
  const [typeName, setTypeName] = useState('');
  const [typeDesc, setTypeDesc] = useState('');

  // Modals per Campi
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [editingField, setEditingField] = useState<FieldDto | null>(null);
  const [fieldFormError, setFieldFormError] = useState<ApiErrorResponse | null>(null);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<{ id: string; label: string } | null>(null);

  // Form Campo (Aggiunta / Edizione)
  const [fieldKey, setFieldKey] = useState('');
  const [label, setLabel] = useState('');
  const [columnName, setColumnName] = useState('');
  const [dataType, setDataType] = useState<FieldDataType>('string');
  const [enumMode, setEnumMode] = useState<'static' | 'managed'>('static');
  const [isRequired, setIsRequired] = useState(false);
  const [isUnique, setIsUnique] = useState(false);
  const [isIndexed, setIsIndexed] = useState(false);
  const [defaultValueText, setDefaultValueText] = useState('');
  const [relationTargetDomain, setRelationTargetDomain] = useState<'node' | 'entity'>('entity');
  const [relationTargetTypeKey, setRelationTargetTypeKey] = useState('');
  const [relationTargetTypes, setRelationTargetTypes] = useState<TypeListItemDto[]>([]);
  const [relationTargetTypesLoading, setRelationTargetTypesLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setConflictError(null);
    const res = await AppCache.admin.getTypeDetail(kind, typeKey);
    if (res.success && res.data) {
      setTypeDetail(res.data);
      setTypeName(res.data.name);
      setTypeDesc(res.data.description);
    } else if (res.error) {
      setError(res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!kind || !typeKey) return;
    const timer = window.setTimeout(() => {
      AppCache.admin.getTypeDetail(kind, typeKey).then((res) => {
        if (res.success && res.data) {
          setTypeDetail(res.data);
          setTypeName(res.data.name);
          setTypeDesc(res.data.description);
        } else if (res.error) {
          setError(res.error);
        }
        setLoading(false);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [kind, typeKey]);

  useEffect(() => {
    if (dataType !== 'relation' || editingField) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setRelationTargetTypesLoading(true);
      const res = await AppCache.admin.listTypes(relationTargetDomain);
      if (!active) return;
      if (res.success && res.data) {
        setRelationTargetTypes(res.data.filter((item) => item.isActive));
      } else if (res.error) {
        setRelationTargetTypes([]);
        setFieldFormError(res.error);
      }
      setRelationTargetTypesLoading(false);
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [dataType, editingField, relationTargetDomain]);

  const handleUpdateType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeDetail) return;
    setError(null);
    setConflictError(null);
    setSuccessMsg(null);

    const cmd: UpdateTypeUiCommand = {
      name: typeName.trim(),
      description: typeDesc.trim(),
      expectedRowVersion: typeDetail.rowVersion,
    };

    startTransition(async () => {
      const res = await AppCache.admin.updateType(kind, typeKey, cmd);
      if (res.success && res.data) {
        setTypeDetail(res.data);
        setTypeName(res.data.name);
        setTypeDesc(res.data.description);
        setSuccessMsg('Tipo aggiornato con successo.');
      } else if (res.error) {
        if (res.error.code === 'ROW_VERSION_MISMATCH') {
          setConflictError(res.error);
        } else {
          setError(res.error);
        }
      }
    });
  };

  const handleDisableType = () => {
    if (!typeDetail) return;
    setShowDisableConfirm(true);
  };

  const confirmDisableType = () => {
    if (!typeDetail) return;
    setShowDisableConfirm(false);

    setError(null);
    setConflictError(null);

    const cmd: DisableTypeUiCommand = {
      expectedRowVersion: typeDetail.rowVersion,
    };

    startTransition(async () => {
      const res = await AppCache.admin.disableType(kind, typeKey, cmd);
      if (res.success && res.data) {
        setTypeDetail(res.data);
        setSuccessMsg('Tipo disabilitato con successo.');
      } else if (res.error) {
        if (res.error.code === 'ROW_VERSION_MISMATCH') {
          setConflictError(res.error);
        } else {
          setError(res.error);
        }
      }
    });
  };

  const openAddFieldModal = () => {
    setEditingField(null);
    setFieldKey('');
    setLabel('');
    setColumnName('');
    setDataType('string');
    setEnumMode('static');
    setIsRequired(false);
    setIsUnique(false);
    setIsIndexed(false);
    setDefaultValueText('');
    setRelationTargetDomain('entity');
    setRelationTargetTypeKey('');
    setRelationTargetTypes([]);
    setFieldFormError(null);
    setShowAddFieldModal(true);
  };

  const openEditFieldModal = (f: FieldDto) => {
    setEditingField(f);
    setFieldKey(f.fieldKey);
    setLabel(f.label);
    setColumnName(f.columnName);
    setDataType(f.dataType);
    setEnumMode(f.enumMode ?? 'static');
    setIsRequired(f.isRequired);
    setIsUnique(f.isUnique);
    setIsIndexed(f.isIndexed);
    setDefaultValueText(f.defaultValueText ?? '');
    setRelationTargetDomain(f.relationTargetDomain ?? 'entity');
    setRelationTargetTypeKey(f.relationTargetTypeKey ?? '');
    setFieldFormError(null);
    setShowAddFieldModal(true);
  };

  const handleSaveField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeDetail) return;

    if (!editingField && dataType === 'relation') {
      const targetKey = relationTargetTypeKey.trim();
      if (!targetKey || !/^[a-z][a-z0-9_-]*$/.test(targetKey)) {
        setFieldFormError({
          code: 'VALIDATION_ERROR',
          message: 'Il type key target deve iniziare con una lettera minuscola e contenere solo lettere minuscole, numeri, underscore o trattini.',
          target: 'relationTargetTypeKey',
        });
        return;
      }
    }

    setFieldFormError(null);
    setConflictError(null);

    startTransition(async () => {
      if (editingField) {
        // Modifica campo
        const cmd: UpdateFieldUiCommand = {
          fieldId: editingField.id,
          label: label.trim(),
          isRequired,
          isUnique,
          isIndexed,
          defaultValueText: defaultValueText.trim() || null,
          expectedTypeRowVersion: typeDetail.rowVersion,
        };
        const res = await AppCache.admin.updateField(kind, typeKey, cmd);
        if (res.success && res.data) {
          setTypeDetail(res.data);
          setShowAddFieldModal(false);
          setSuccessMsg('Campo aggiornato.');
        } else if (res.error) {
          if (res.error.code === 'ROW_VERSION_MISMATCH') {
            setConflictError(res.error);
            setShowAddFieldModal(false);
          } else {
            setFieldFormError(res.error);
          }
        }
      } else {
        // Aggiunta campo
        const cmd: CreateFieldUiCommand = {
          fieldKey: fieldKey.trim(),
          label: label.trim(),
          columnName: columnName.trim(),
          dataType,
          enumMode: dataType === 'enum' ? enumMode : undefined,
          isRequired,
          isUnique,
          isIndexed,
          defaultValueText: defaultValueText.trim() || null,
          relationTargetDomain: dataType === 'relation' ? relationTargetDomain : undefined,
          relationTargetTypeKey: dataType === 'relation' ? relationTargetTypeKey.trim() : undefined,
          position: typeDetail.fields.length,
          expectedTypeRowVersion: typeDetail.rowVersion,
        };
        const res = await AppCache.admin.createField(kind, typeKey, cmd);
        if (res.success && res.data) {
          setTypeDetail(res.data);
          setShowAddFieldModal(false);
          setSuccessMsg('Nuovo campo aggiunto.');
        } else if (res.error) {
          if (res.error.code === 'ROW_VERSION_MISMATCH') {
            setConflictError(res.error);
            setShowAddFieldModal(false);
          } else {
            setFieldFormError(res.error);
          }
        }
      }
    });
  };

  const handleDeleteField = (fieldId: string, fieldLabel: string) => {
    if (!typeDetail) return;
    setFieldToDelete({ id: fieldId, label: fieldLabel });
  };

  const confirmDeleteField = () => {
    if (!typeDetail || !fieldToDelete) return;
    setFieldToDelete(null);

    setError(null);
    setConflictError(null);

    const cmd: DeleteFieldUiCommand = {
      fieldId: fieldToDelete.id,
      expectedTypeRowVersion: typeDetail.rowVersion,
    };

    startTransition(async () => {
      const res = await AppCache.admin.deleteField(kind, typeKey, cmd);
      if (res.success && res.data) {
        setTypeDetail(res.data);
        setSuccessMsg('Campo rimosso.');
      } else if (res.error) {
        if (res.error.code === 'ROW_VERSION_MISMATCH') {
          setConflictError(res.error);
        } else {
          setError(res.error);
        }
      }
    });
  };

  // Reordering campi
  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    if (!typeDetail) return;
    const fieldsCopy = [...typeDetail.fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= fieldsCopy.length) return;

    // Swap
    const temp = fieldsCopy[index];
    fieldsCopy[index] = fieldsCopy[targetIndex];
    fieldsCopy[targetIndex] = temp;

    const orderedFieldIds = fieldsCopy.map((f) => f.id);
    const cmd: ReorderFieldsUiCommand = {
      orderedFieldIds,
      expectedTypeRowVersion: typeDetail.rowVersion,
    };

    startTransition(async () => {
      const res = await AppCache.admin.reorderFields(kind, typeKey, cmd);
      if (res.success && res.data) {
        setTypeDetail(res.data);
        setSuccessMsg('Ordine dei campi aggiornato.');
      } else if (res.error) {
        if (res.error.code === 'ROW_VERSION_MISMATCH') {
          setConflictError(res.error);
        } else {
          setError(res.error);
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-6 sm:p-10 max-w-5xl mx-auto text-center text-slate-400 space-y-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p>Caricamento dettaglio tipo...</p>
      </div>
    );
  }

  if (error && !typeDetail) {
    return (
      <div className="min-h-screen px-4 py-6 sm:p-10 max-w-3xl mx-auto space-y-4">
        <div className="p-5 bg-red-950/50 border border-red-500/40 rounded-2xl text-red-200">
          <h2 className="text-lg font-bold">Errore di Caricamento</h2>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
        <Link href="/admin/types" className="text-indigo-400 hover:underline text-sm">
          ← Torna alla lista tipi
        </Link>
      </div>
    );
  }

  if (!typeDetail) return null;

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      <ConfirmModal
        open={showDisableConfirm}
        title="Disabilita tipo"
        message={`Sei sicuro di voler disabilitare il tipo '${typeDetail.name}'?`}
        confirmLabel="Disabilita"
        onCancel={() => setShowDisableConfirm(false)}
        onConfirm={confirmDisableType}
        busy={isPending}
      />
      <ConfirmModal
        open={fieldToDelete !== null}
        title="Rimuovi campo"
        message={fieldToDelete ? `Rimuovere il campo '${fieldToDelete.label}'?` : ''}
        confirmLabel="Rimuovi"
        onCancel={() => setFieldToDelete(null)}
        onConfirm={confirmDeleteField}
        busy={isPending}
      />
      {/* Navigation & Title */}
      <div className="space-y-2">
        <Link
          href="/admin/types"
          className="text-slate-400 hover:text-white text-xs font-medium flex items-center gap-1 w-fit transition-colors"
        >
          ←Torna alla lista tipi
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white tracking-tight">{typeDetail.name}</h1>
            <span className="font-mono text-xs px-2.5 py-1 bg-indigo-950/60 text-indigo-300 border border-indigo-500/30 rounded-md">
              {typeDetail.typeKey}
            </span>
            {typeDetail.isSystem && (
              <span className="px-2.5 py-1 text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-md">
                🔒 SYSTEM TYPE
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {typeDetail.isActive ? (
              <button
                type="button"
                onClick={handleDisableType}
                disabled={!typeDetail.isEditable || isPending}
                className="px-3.5 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 text-xs font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Disabilita Tipo
              </button>
            ) : (
              <span className="px-3 py-1.5 bg-slate-800 text-rose-400 text-xs font-medium rounded-lg">
                Stato: Disabilitato
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Banner per Conflitto di Concorrenza Ottimistica (ROW_VERSION_MISMATCH) */}
      {conflictError && (
        <div className="p-5 bg-amber-950/60 border border-amber-500/50 rounded-2xl text-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in">
          <div>
            <h4 className="font-bold text-amber-100 flex items-center gap-2">
              <span>⚠️</span> Conflitto di Concorrenza (Row Version Mismatch)
            </h4>
            <p className="text-xs text-amber-300/90 mt-1">{conflictError.message}</p>
          </div>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-lg shadow-md transition-all whitespace-nowrap"
          >
            🔄 Ricarica Scheda
          </button>
        </div>
      )}

      {/* Messaggi di successo o errore generale */}
      {successMsg && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex justify-between">
          <span>✅ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 text-xs font-bold">
            ✕
          </button>
        </div>
      )}

      {error && !conflictError && (
        <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-xl text-red-300 text-sm">
          ⚠️ {error.message}
        </div>
      )}

      {/* Grid: 1. Form Modifica Tipo — 2. Info Scheda */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Form Coarse-Grained Tipo */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-slate-800 space-y-5">
          <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3 flex items-center justify-between">
            <span>Proprietà del Tipo</span>
            <span className="text-xs font-mono text-slate-400 font-normal">
              Schema: v{typeDetail.currentSchemaVersion} | RowVersion: r{typeDetail.rowVersion}
            </span>
          </h2>

          <form onSubmit={handleUpdateType} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Nome Tipo *
              </label>
              <input
                type="text"
                required
                disabled={!typeDetail.isEditable}
                value={typeName}
                onChange={(e) => setTypeName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Descrizione
              </label>
              <textarea
                rows={3}
                disabled={!typeDetail.isEditable}
                value={typeDesc}
                onChange={(e) => setTypeDesc(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {typeDetail.isEditable && (
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg shadow-lg hover:shadow-indigo-500/20 transition-all disabled:opacity-50"
                >
                  {isPending ? 'Salvataggio...' : 'Salva Modifiche Tipo'}
                </button>
              </div>
            )}

          </form>
        </div>

        {/* Right: Technical Metadata Info */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4 text-xs">
          <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3">Informazioni Tecniche</h3>
          
          <div className="space-y-2.5">
            <div>
              <span className="text-slate-400 block">Identificatore UUID:</span>
              <span className="font-mono text-slate-200">{typeDetail.id}</span>
            </div>

            <div>
              <span className="text-slate-400 block">Dominio:</span>
              <span className="font-semibold text-indigo-300 capitalize">{typeDetail.kind}</span>
            </div>

            {typeDetail.storageTable && (
              <div>
                <span className="text-slate-400 block">Tabella Fisica Storage:</span>
                <span className="font-mono text-slate-200">{typeDetail.storageTable}</span>
              </div>
            )}

            <div>
              <span className="text-slate-400 block">Istanze Attive nel DB:</span>
              <span className="font-bold text-slate-200">{typeDetail.instanceCount} elementi</span>
            </div>

            <div>
              <span className="text-slate-400 block">Data Creazione:</span>
              <span className="text-slate-300">{new Date(typeDetail.createdAt).toLocaleString()}</span>
            </div>

            <div>
              <span className="text-slate-400 block">Ultimo Aggiornamento:</span>
              <span className="text-slate-300">{new Date(typeDetail.updatedAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Gestione dei Campi (Fields Management & Reordering) */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Campi del Tipo ({typeDetail.fields.length})</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Configura i campi tipizzati. L&apos;ordine definisce il layout di rendering dei form.
            </p>
          </div>

          {typeDetail.isEditable && (
            <button
              onClick={openAddFieldModal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5 w-fit"
            >
              <span>+</span> Aggiungi Campo
            </button>
          )}
        </div>

        <TypeFieldsTable
          fields={typeDetail.fields}
          isEditable={typeDetail.isEditable}
          isPending={isPending}
          onMove={handleMoveField}
          onEdit={openEditFieldModal}
          onDelete={handleDeleteField}
        />
      </div>

      {/* Modal Aggiunta / Modifica Campo */}
      {showAddFieldModal && (
        <TypeFieldEditorModal
          editingField={editingField}
          fieldFormError={fieldFormError}
          isPending={isPending}
          onClose={() => setShowAddFieldModal(false)}
          onSubmit={handleSaveField}
          fieldKey={fieldKey}
          setFieldKey={setFieldKey}
          label={label}
          setLabel={setLabel}
          columnName={columnName}
          setColumnName={setColumnName}
          dataType={dataType}
          setDataType={setDataType}
          enumMode={enumMode}
          setEnumMode={setEnumMode}
          defaultValueText={defaultValueText}
          setDefaultValueText={setDefaultValueText}
          isRequired={isRequired}
          setIsRequired={setIsRequired}
          isUnique={isUnique}
          setIsUnique={setIsUnique}
          isIndexed={isIndexed}
          setIsIndexed={setIsIndexed}
          relationTargetDomain={relationTargetDomain}
          setRelationTargetDomain={setRelationTargetDomain}
          relationTargetTypeKey={relationTargetTypeKey}
          setRelationTargetTypeKey={setRelationTargetTypeKey}
          relationTargetTypes={relationTargetTypes}
          relationTargetTypesLoading={relationTargetTypesLoading}
        />
      )}
    </div>
  );
}
