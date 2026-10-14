import type { Metadata } from 'next';
import { InquiryPage } from '@/features/company-support/support-pages';

export const metadata: Metadata = { title: '1:1 문의' };

export default function InquiryRoute() {
  return <InquiryPage />;
}
