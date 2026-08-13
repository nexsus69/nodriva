'use client';

import { useParams } from 'next/navigation';
import { AuditLogDetail } from './_components/AuditLogDetail';
import { useAuditLogDetail } from './_hooks/useAuditLogDetail';

export default function AuditLogDetailPage() {
  const { auditId } = useParams<{ auditId: string }>();
  return <AuditLogDetail {...useAuditLogDetail(auditId)} />;
}
