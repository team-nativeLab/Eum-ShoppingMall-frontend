import { MyPageScreen } from '@/features/mypage/mypage-screen';

export const metadata = { title: '내 정보 관리' };

export default function ProfilePage() {
  return <MyPageScreen section="profile" />;
}
