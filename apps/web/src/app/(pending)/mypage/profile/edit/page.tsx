import { MyPageScreen } from '@/features/mypage/mypage-screen';

export const metadata = { title: '내 정보 수정' };

export default function ProfileEditPage() {
  return <MyPageScreen section="profile-edit" />;
}
