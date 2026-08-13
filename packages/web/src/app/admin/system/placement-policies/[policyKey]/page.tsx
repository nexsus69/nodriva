'use client';

import { useParams } from 'next/navigation';
import { PlacementPolicyDetailScreen } from './_components/PlacementPolicyDetailScreen';

export default function PlacementPolicyDetailPage() {
  const { policyKey } = useParams<{ policyKey: string }>();
  return <PlacementPolicyDetailScreen policyKey={policyKey} />;
}
