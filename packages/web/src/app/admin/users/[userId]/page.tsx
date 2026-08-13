'use client';

import { useParams } from 'next/navigation';
import { UserDetailScreen } from './_components/UserDetailScreen';

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  return <UserDetailScreen userId={userId} />;
}
