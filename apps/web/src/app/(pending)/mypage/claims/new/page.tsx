import { MyPageScreen } from '@/features/mypage/mypage-screen';
import type { ClaimType } from '@eum/api/types';

export const metadata = { title: '취소/반품/교환 신청' };

export default async function NewClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; type?: string }>;
}) {
  const { orderId, type } = await searchParams;
  const preferredClaimType: ClaimType | undefined =
    type === 'cancel' || type === 'return' || type === 'exchange' ? type : undefined;
  return (
    <MyPageScreen section="claim-new" itemId={orderId} preferredClaimType={preferredClaimType} />
  );
}
