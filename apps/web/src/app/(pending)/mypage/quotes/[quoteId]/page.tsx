import { MyPageScreen } from '@/features/mypage/mypage-screen';

export const metadata = { title: '견적 문의 상세' };

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const { quoteId } = await params;
  return <MyPageScreen section="quote-detail" itemId={quoteId} />;
}
