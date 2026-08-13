'use client';

import { useParams } from 'next/navigation';
import { RoleDetailScreen } from './_components/RoleDetailScreen';

export default function RoleDetailPage() {
  const { roleKey } = useParams<{ roleKey: string }>();
  return <RoleDetailScreen roleKey={roleKey} />;
}
