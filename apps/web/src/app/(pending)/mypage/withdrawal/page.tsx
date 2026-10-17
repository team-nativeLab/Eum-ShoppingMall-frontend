import type { Metadata } from 'next';
import { WithdrawalPage } from '@/features/mypage/withdrawal-page';

export const metadata: Metadata = { title: '회원 탈퇴' };

export default function WithdrawalRoute() {
  return <WithdrawalPage />;
}
