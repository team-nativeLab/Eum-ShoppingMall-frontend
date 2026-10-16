'use client';

import { sanitizeRedirectPath } from '@eum/api/redirect';
import { Button } from '@eum/ui/components/Button';
import { Checkbox } from '@eum/ui/components/Checkbox';
import { TextField } from '@eum/ui/components/TextField';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { PageContainer } from '@/components/page-container';
import { useMemberSession } from './member-session';
import { getMemberAuth } from '@/lib/member-auth';

/** W-09: 목 회원 로그인을 처리하고 안전한 내부 경로로 돌아갑니다. */
export function LoginPageView({ rawRedirect }: { rawRedirect?: string }) {
  const router = useRouter();
  const { setMember } = useMemberSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberLogin, setRememberLogin] = useState(false);
  const [helpMessage, setHelpMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const redirectPath = sanitizeRedirectPath(rawRedirect, '/');

  const handleSubmit = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const memberAuth = await getMemberAuth();
      const member = await memberAuth.login({ email, password });
      if (!rememberLogin) await memberAuth.logout();
      setMember(member);
      router.replace(redirectPath);
    } catch (loginFailure: unknown) {
      const code =
        typeof loginFailure === 'object' && loginFailure !== null && 'code' in loginFailure
          ? loginFailure.code
          : '';
      setError(
        code === 'NOT_IMPLEMENTED'
          ? '실제 로그인 API는 아직 연결되지 않았습니다. 목 데모 모드에서 확인해 주세요.'
          : code === 'INVALID_CREDENTIALS'
            ? '이메일을 확인하거나 회원가입을 진행해 주세요.'
            : '로그인하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer className="py-40 lg:pt-96 lg:pb-120">
      <section className="mx-auto flex w-full max-w-400 flex-col gap-32">
        <header className="flex flex-col items-start gap-8">
          <p className="text-h3 text-text-3">이음산업건설</p>
          <h1 className="text-h1">로그인</h1>
          <p className="text-body-s text-text-2">이음산업건설 계정으로 로그인하세요.</p>
        </header>
        <form
          className="flex flex-col gap-24"
          onSubmit={(submitEvent) => void handleSubmit(submitEvent)}
        >
          <div className="flex flex-col gap-16">
            <TextField
              label="이메일"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="example@email.com"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <div className="flex flex-col gap-12">
              <TextField
                label="비밀번호"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="비밀번호를 입력해 주세요"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <Checkbox
                checked={rememberLogin}
                onChange={(event) => setRememberLogin(event.target.checked)}
                className="[&>.peer:focus-visible+span]:outline-[2.667px] [&>.peer:focus-visible+span]:outline-offset-[2.667px] [&>span]:scale-75"
              >
                로그인 상태 유지
              </Checkbox>
            </div>
          </div>
          {error ? (
            <p role="alert" className="rounded-8 bg-danger-tint p-12 text-body-s text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col gap-16">
            <Button type="submit" size="l" isFullWidth disabled={isSubmitting}>
              {isSubmitting ? '확인 중…' : '로그인'}
            </Button>
            <nav
              aria-label="계정 도움말"
              className="flex flex-wrap items-center justify-center gap-12 text-body-s text-text-2"
            >
              <button
                type="button"
                onClick={() =>
                  setHelpMessage('이메일 찾기는 실제 계정 조회 없이 데모 문의 안내만 제공합니다.')
                }
                aria-controls="account-help-message"
                aria-expanded={Boolean(helpMessage)}
                className="rounded-4 underline focus-ring"
              >
                이메일 찾기
              </button>
              <span aria-hidden="true">|</span>
              <button
                type="button"
                onClick={() =>
                  setHelpMessage('비밀번호 찾기는 실제 재설정 없이 데모 문의 안내만 제공합니다.')
                }
                aria-controls="account-help-message"
                aria-expanded={Boolean(helpMessage)}
                className="rounded-4 underline focus-ring"
              >
                비밀번호 찾기
              </button>
              <span aria-hidden="true">|</span>
              <Link
                href={`/signup?redirect=${encodeURIComponent(redirectPath)}`}
                className="rounded-4 underline focus-ring"
              >
                회원가입
              </Link>
            </nav>
            <p
              id="account-help-message"
              role="status"
              className="text-center text-caption text-text-2"
            >
              {helpMessage}
            </p>
          </div>
        </form>
        <div className="flex flex-col gap-16">
          <div className="flex items-center gap-12 text-caption text-text-3">
            <span aria-hidden="true" className="h-px flex-1 bg-line" />
            <span>또는</span>
            <span aria-hidden="true" className="h-px flex-1 bg-line" />
          </div>
          <div className="flex flex-col gap-8">
            <Button
              type="button"
              variant="secondary"
              size="l"
              isFullWidth
              disabled
              aria-describedby="social-login-note"
            >
              간편로그인 A
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="l"
              isFullWidth
              disabled
              aria-describedby="social-login-note"
            >
              간편로그인 B
            </Button>
          </div>
          <p id="social-login-note" className="sr-only">
            목 데모에서는 외부 간편로그인을 사용할 수 없습니다.
          </p>
        </div>
        <p className="text-caption text-text-3">
          목 로그인은 화면 흐름 확인용이며 실제 인증은 처리되지 않습니다.
        </p>
      </section>
    </PageContainer>
  );
}
