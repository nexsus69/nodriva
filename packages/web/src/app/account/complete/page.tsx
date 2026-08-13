import { Suspense } from 'react';
import { AccountCompletionForm } from './_components/AccountCompletionForm';

export default function AccountCompletionPage() {
  return <Suspense fallback={null}><AccountCompletionForm /></Suspense>;
}
