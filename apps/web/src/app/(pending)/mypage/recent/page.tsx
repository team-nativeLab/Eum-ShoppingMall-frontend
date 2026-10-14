import { MyPageScreen } from '@/features/mypage/mypage-screen';

export const metadata = { title: '최근 본 상품' };

export default function RecentProductsPage() {
  return <MyPageScreen section="recent" />;
}
