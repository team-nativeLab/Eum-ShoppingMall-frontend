import type { Metadata } from 'next';
import { LoginPageView } from '@/features/auth/login-page';

export const metadata: Metadata = { title: '로그인' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawRedirect = typeof params.redirect === 'string' ? params.redirect : undefined;
  return <LoginPageView rawRedirect={rawRedirect} />;
}
