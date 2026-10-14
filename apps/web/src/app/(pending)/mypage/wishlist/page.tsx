import { MyPageScreen } from '@/features/mypage/mypage-screen';

export const metadata = { title: '찜한 상품' };

export default function WishlistPage() {
  return <MyPageScreen section="wishlist" />;
}
