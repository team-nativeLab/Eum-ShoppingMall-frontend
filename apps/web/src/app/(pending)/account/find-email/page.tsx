import type { Metadata } from 'next';
import { AccountRecoveryPage } from '@/features/auth/account-recovery-page';

export const metadata: Metadata = { title: '이메일 찾기' };

export default async function FindEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawRedirect = typeof params.redirect === 'string' ? params.redirect : undefined;
  return <AccountRecoveryPage mode="email" rawRedirect={rawRedirect} />;
}
