import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/features/company-pages/legal-pages';

export const metadata: Metadata = { title: '개인정보처리방침' };

export default function PrivacyPage() {
  return <LegalDocumentPage document="privacy" />;
}
