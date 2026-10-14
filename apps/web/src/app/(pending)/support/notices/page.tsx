import type { Metadata } from 'next';
import { NoticesPage } from '@/features/company-support/support-pages';

export const metadata: Metadata = { title: '공지사항' };

export default function NoticesRoute() {
  return <NoticesPage />;
}
