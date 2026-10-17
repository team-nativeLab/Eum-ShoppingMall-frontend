import type { Metadata } from 'next';
import { NoticeDetailPage } from '@/features/company-support/notice-detail-page';

export const metadata: Metadata = { title: '공지사항 상세' };

export default async function NoticeDetailRoute({
  params,
}: {
  params: Promise<{ noticeId: string }>;
}) {
  const routeParams = await params;
  return <NoticeDetailPage noticeId={routeParams.noticeId} />;
}
