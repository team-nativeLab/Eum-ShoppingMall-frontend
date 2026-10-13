import type { Metadata } from 'next';
import { SignupPageView } from '@/features/auth/signup-page';

export const metadata: Metadata = { title: '회원가입' };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawRedirect = typeof params.redirect === 'string' ? params.redirect : undefined;
  return <SignupPageView rawRedirect={rawRedirect} />;
}
