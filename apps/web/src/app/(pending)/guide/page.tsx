import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/features/company-pages/legal-pages';

export const metadata: Metadata = { title: '이용안내' };

export default function GuidePage() {
  return <LegalDocumentPage document="guide" />;
}
