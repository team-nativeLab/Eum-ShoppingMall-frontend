import { MyPageScreen } from '@/features/mypage/mypage-screen';

export const metadata = { title: '취소/반품/교환 신청' };

export default async function NewClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;
  return <MyPageScreen section="claim-new" itemId={orderId} />;
}
