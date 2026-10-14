import type { Metadata } from 'next';
import { MemberInquiryDetailPage } from '@/features/mypage/member-inquiries';

export const metadata: Metadata = { title: '문의 상세' };

export default async function MemberInquiryDetailRoute({
  params,
}: {
  params: Promise<{ inquiryId: string }>;
}) {
  const { inquiryId } = await params;
  return <MemberInquiryDetailPage inquiryId={inquiryId} />;
}
