import type { Metadata } from 'next';
import { FaqPage } from '@/features/company-support/support-pages';

export const metadata: Metadata = { title: '자주 묻는 질문' };

export default function FaqRoute() {
  return <FaqPage />;
}
