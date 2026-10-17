import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/features/company-pages/legal-pages';

export const metadata: Metadata = { title: '이용약관' };

export default function TermsPage() {
  return <LegalDocumentPage document="terms" />;
}
