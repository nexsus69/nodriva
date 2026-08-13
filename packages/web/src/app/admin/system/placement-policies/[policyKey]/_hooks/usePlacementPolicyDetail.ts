import { useCallback, useEffect, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type {
  ApiErrorResponse,
  CreatePlacementRuleUiCommand,
  PlacementPolicyDetailDto,
  PolicyMode,
  RuleType,
  UpdatePlacementPolicyUiCommand,
} from '@dashboard/core';
import { AppCache } from '../../../../../cache/GlobalCacheClient';
import { useUnsavedChanges } from '../../../../../navigation/NavigationBlocker';

export function usePlacementPolicyDetail(policyKey: string) {
  const router = useRouter();
  const [policy, setPolicy] = useState<PlacementPolicyDetailDto | null>(null);
  const [nodes, setNodes] = useState<{ id: string; name: string }[]>([]);
  const [nodeTypes, setNodeTypes] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);
  const [formError, setFormError] = useState<ApiErrorResponse | null>(null);
  const [showEditPolicyModal, setShowEditPolicyModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPolicyMode, setEditPolicyMode] = useState<PolicyMode>('allow_all');
  const [ruleType, setRuleType] = useState<RuleType>('allow_node_type');
  const [targetNodeId, setTargetNodeId] = useState('');
  const [targetNodeTypeId, setTargetNodeTypeId] = useState('');
  const [comparator, setComparator] = useState('EQUALS');
  const [valueText, setValueText] = useState('');
  const [isPending, startTransition] = useTransition();
  const editPolicyDirty = Boolean(showEditPolicyModal && policy && (
    editName !== policy.name || editDescription !== policy.description || editPolicyMode !== policy.policyMode
  ));
  const addRuleDirty = showAddRuleModal && (
    ruleType !== 'allow_node_type' || targetNodeId !== '' || targetNodeTypeId !== ''
    || comparator !== 'EQUALS' || valueText !== ''
  );
  const navigationGuard = useUnsavedChanges(editPolicyDirty || addRuleDirty);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [policyResult, rootNodes, nodeTypeResult] = await Promise.all([
      AppCache.admin.getPlacementPolicyByKey(policyKey),
      AppCache.admin.listChildren(null),
      AppCache.admin.listTypes('node'),
    ]);
    if (policyResult.success && policyResult.data) {
      setPolicy(policyResult.data);
      setEditName(policyResult.data.name);
      setEditDescription(policyResult.data.description);
      setEditPolicyMode(policyResult.data.policyMode);
    } else if (policyResult.error) {
      setError(policyResult.error);
    }
    setNodes(rootNodes?.map((node) => ({ id: node.id, name: node.name })) ?? []);
    setNodeTypes(nodeTypeResult.success && nodeTypeResult.data
      ? nodeTypeResult.data.map((type) => ({ id: type.id, name: type.name }))
      : []);
    setLoading(false);
  }, [policyKey]);

  useEffect(() => {
    if (!policyKey) return;
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData, policyKey]);

  const openEditPolicy = () => {
    if (!policy) return;
    setEditName(policy.name);
    setEditDescription(policy.description);
    setEditPolicyMode(policy.policyMode);
    setFormError(null);
    setShowEditPolicyModal(true);
  };

  const openAddRule = () => {
    setFormError(null);
    setShowAddRuleModal(true);
  };

  const handleUpdatePolicy = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!policy) return;
    setFormError(null);
    const command: UpdatePlacementPolicyUiCommand = {
      policyKey: policy.policyKey,
      name: editName,
      description: editDescription,
      policyMode: editPolicyMode,
      expectedRowVersion: policy.rowVersion,
    };
    startTransition(async () => {
      const result = await AppCache.admin.updatePlacementPolicy(command);
      if (result.success) {
        setShowEditPolicyModal(false);
        await loadData();
      } else if (result.error) setFormError(result.error);
    });
  };

  const confirmDeletePolicy = () => {
    if (!policy) return;
    setShowDeleteConfirm(false);
    startTransition(async () => {
      const result = await AppCache.admin.deletePlacementPolicy({ policyKey: policy.policyKey, expectedRowVersion: policy.rowVersion });
      if (result.success) {
        navigationGuard.allowNavigation();
        router.push('/admin/system/placement-policies');
      }
      else if (result.error) setError(result.error);
    });
  };

  const handleAddRule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const command: CreatePlacementRuleUiCommand = {
      policyKey,
      ruleType,
      targetNodeId: targetNodeId || undefined,
      targetNodeTypeId: targetNodeTypeId || undefined,
      comparator: comparator || undefined,
      valueText: valueText || undefined,
    };
    startTransition(async () => {
      const result = await AppCache.admin.createPlacementRule(command);
      if (result.success) {
        setShowAddRuleModal(false);
        setRuleType('allow_node_type');
        setTargetNodeId('');
        setTargetNodeTypeId('');
        setComparator('EQUALS');
        setValueText('');
        await loadData();
      } else if (result.error) setFormError(result.error);
    });
  };

  const handleDeleteRule = (ruleId: string) => {
    startTransition(async () => {
      const result = await AppCache.admin.deletePlacementRule({ ruleId });
      if (result.success) await loadData();
      else if (result.error) setError(result.error);
    });
  };

  const closeEditPolicy = () => {
    if (editPolicyDirty && !navigationGuard.confirmDiscard()) return;
    setShowEditPolicyModal(false);
  };

  const closeAddRule = () => {
    if (addRuleDirty && !navigationGuard.confirmDiscard()) return;
    setShowAddRuleModal(false);
  };

  return {
    policy, nodes, nodeTypes, loading, error, formError, isPending,
    showEditPolicyModal, showDeleteConfirm, showAddRuleModal,
    editName, editDescription, editPolicyMode,
    ruleType, targetNodeId, targetNodeTypeId, comparator, valueText,
    setEditName, setEditDescription, setEditPolicyMode,
    setRuleType, setTargetNodeId, setTargetNodeTypeId, setComparator, setValueText,
    openEditPolicy, openAddRule,
    closeEditPolicy,
    closeAddRule,
    requestDeletePolicy: () => setShowDeleteConfirm(true),
    cancelDeletePolicy: () => setShowDeleteConfirm(false),
    confirmDeletePolicy, handleUpdatePolicy, handleAddRule, handleDeleteRule,
  };
}
