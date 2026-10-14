import { MyPageScreen } from '@/features/mypage/mypage-screen';

export const metadata = { title: '주문 상세' };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <MyPageScreen section="order-detail" itemId={orderId} />;
}
