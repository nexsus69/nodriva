'use client';

import { useParams } from 'next/navigation';
import type { TypeKind } from '@dashboard/core';
import { AdminTypeDetailScreen } from './_components/AdminTypeDetailScreen';

export default function AdminTypeDetailPage() {
  const { kind, typeKey } = useParams<{ kind: TypeKind; typeKey: string }>();
  return <AdminTypeDetailScreen kind={kind} typeKey={typeKey} />;
}
