import { MyPageScreen } from '@/features/mypage/mypage-screen';

export const metadata = { title: '주문/배송 조회' };

export default function MyOrdersPage() {
  return <MyPageScreen section="orders" />;
}
