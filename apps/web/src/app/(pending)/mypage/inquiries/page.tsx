import type { Metadata } from 'next';
import { MemberInquiriesPage } from '@/features/mypage/member-inquiries';

export const metadata: Metadata = { title: '1:1 문의 내역' };

export default function MemberInquiriesRoute() {
  return <MemberInquiriesPage />;
}
