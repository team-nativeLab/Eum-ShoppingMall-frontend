import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/features/company-pages/legal-pages';

export const metadata: Metadata = { title: '배송·교환·반품 안내' };

export default function ShippingPolicyPage() {
  return <LegalDocumentPage document="shipping" />;
}
