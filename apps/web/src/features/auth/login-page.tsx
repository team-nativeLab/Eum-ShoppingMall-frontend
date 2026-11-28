'use client';

import { sanitizeRedirectPath } from '@eum/api/redirect';
import { Button } from '@eum/ui/components/Button';
import { Checkbox } from '@eum/ui/components/Checkbox';
import { TextField } from '@eum/ui/components/TextField';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { ApiError } from '@eum/api/errors';
import { SignupForm } from './signup-form';
import { useSignupDraft } from './signup-draft';
import { AuthFrame } from './auth-frame';
import { getWebApiConfig } from '@/lib/api-config';
import { useMemberSession } from './member-session';
import { getMemberAuth, getUnifiedAuth } from '@/lib/member-auth';

function getLoginFailureMessage(loginFailure: unknown): string {
  if (!(loginFailure instanceof ApiError))
    return '로그인하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.';

  switch (loginFailure.serverCode) {
    case 'CAPTCHA_REQUIRED':
    case 'CAPTCHA_INVALID':
      return '보안 확인이 필요합니다. 현재 화면에서는 진행할 수 없어 고객센터에 문의해 주세요.';
    case 'CAPTCHA_UNAVAILABLE':
      return '보안 확인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.';
    case 'LOGIN_LOCKED':
      return '로그인 시도가 일시적으로 제한되었습니다. 잠시 후 다시 시도해 주세요.';
    case 'ACCOUNT_SUSPENDED':
      return '계정이 제한되어 있습니다. 고객센터에 문의해 주세요.';
    case 'INVALID_INPUT':
      return '입력한 정보를 확인하고 다시 시도해 주세요.';
    case 'LOGIN_FAILED':
      return '이메일 또는 비밀번호가 올바르지 않습니다.';
    default:
      if (loginFailure.code === 'NOT_IMPLEMENTED')
        return '실제 로그인 API는 아직 연결되지 않았습니다. 목 데모 모드에서 확인해 주세요.';
      if (loginFailure.code === 'INVALID_CREDENTIALS')
        return '이메일을 확인하거나 회원가입을 진행해 주세요.';
      return '로그인하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.';
  }
}

/** W-09: 목 회원 로그인을 처리하고 안전한 내부 경로로 돌아갑니다. */
export function LoginPageView({ rawRedirect }: { rawRedirect?: string }) {
  const router = useRouter();
  const { setMember } = useMemberSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [rememberLogin, setRememberLogin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  // 본문 링크로 전환하면 링크가 사라지므로, 전환 뒤 회원가입 탭으로 포커스를 옮기는 데 씁니다.
  const loginTabRef = useRef<HTMLButtonElement>(null);
  const signupTabRef = useRef<HTMLButtonElement>(null);
  // 가입 폼 입력값은 이 화면이 가지므로 탭을 오가도 남습니다.
  const signupDraft = useSignupDraft();
  // 가입 탭으로 가면 로그인 비밀번호를 비우고, 로그인 탭으로 오면 가입 폼의 민감값을 비웁니다.
  const enterSignupMode = () => {
    setPassword('');
    setIsSignup(true);
  };
  const leaveSignupMode = () => {
    signupDraft.clearSensitive();
    setIsSignup(false);
  };
  // 가입 폼의 로그인 링크는 로그인 탭으로 전환하고 그 탭에 포커스를 둡니다.
  const handleBackToLogin = () => {
    flushSync(() => leaveSignupMode());
    loginTabRef.current?.focus();
  };
  const isMockMode = getWebApiConfig().mode === 'mock';
  const redirectPath = sanitizeRedirectPath(rawRedirect, '/');
  const recoveryRedirectQuery = `?redirect=${encodeURIComponent(redirectPath)}`;

  const handleSubmit = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    setError('');

    const emailInput =
      submitEvent.currentTarget.querySelector<HTMLInputElement>('input[name="email"]');
    const passwordInput =
      submitEvent.currentTarget.querySelector<HTMLInputElement>('input[name="password"]');

    if (!emailInput || !passwordInput) return;

    const nextEmailError = emailInput.validity.valueMissing
      ? '이메일을 입력해 주세요.'
      : emailInput.validity.typeMismatch
        ? '올바른 이메일 형식으로 입력해 주세요.'
        : '';
    const nextPasswordError = passwordInput.validity.valueMissing
      ? '비밀번호를 입력해 주세요.'
      : '';

    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);

    if (nextEmailError || nextPasswordError) {
      const firstInvalidInput = nextEmailError ? emailInput : passwordInput;
      window.requestAnimationFrame(() => firstInvalidInput.focus());
      return;
    }

    setIsSubmitting(true);
    try {
      if (isMockMode) {
        const auth = await getUnifiedAuth();
        const loginResult = await auth.login({ email, password });
        if (loginResult.role === 'admin') {
          router.replace(redirectPath.startsWith('/admin') ? redirectPath : '/admin');
          return;
        }
        setMember(loginResult.user);
      } else {
        const member = await (
          await getMemberAuth()
        ).login({ email, password }, { remember: rememberLogin });
        setMember(member);
      }
      router.replace(redirectPath.startsWith('/admin') ? '/' : redirectPath);
    } catch (loginFailure: unknown) {
      setError(getLoginFailureMessage(loginFailure));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthFrame
      title={isSignup ? '회원가입' : '로그인'}
      description={
        isSignup
          ? '안전한 현장을 위한 안전맛집 회원이 되어 보세요.'
          : '안전맛집 계정으로 로그인하세요.'
      }
      tab={{
        value: isSignup ? 'signup' : 'login',
        onChange: (next) => (next === 'signup' ? enterSignupMode() : leaveSignupMode()),
        tabRefs: { login: loginTabRef, signup: signupTabRef },
      }}
    >
      {isSignup ? (
        <SignupForm
          draft={signupDraft}
          rawRedirect={rawRedirect}
          onBackToLogin={handleBackToLogin}
        />
      ) : (
        <div className="flex flex-col gap-32">
          <form
            method="post"
            className="flex flex-col gap-24"
            onSubmit={(submitEvent) => void handleSubmit(submitEvent)}
            noValidate
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
                errorMessage={emailError || undefined}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setEmailError('');
                }}
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
                  errorMessage={passwordError || undefined}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setPasswordError('');
                  }}
                />
                <Checkbox
                  checked={rememberLogin}
                  onChange={(event) => setRememberLogin(event.target.checked)}
                  className="min-h-24 [&>.peer:focus-visible+span]:outline-[2.667px] [&>.peer:focus-visible+span]:outline-offset-[2.667px] [&>span]:scale-75"
                >
                  로그인 상태 유지
                </Checkbox>
                {isMockMode ? (
                  <p className="text-caption text-text-3">
                    목 데모 로그인은 로그아웃할 때까지 유지됩니다. 로그인 상태 유지는 목 모드에
                    적용되지 않습니다.
                  </p>
                ) : null}
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
                <Link
                  href={`/account/find-email${recoveryRedirectQuery}`}
                  className="-my-12 inline-flex min-h-44 items-center rounded-4 underline focus-ring"
                >
                  이메일 찾기
                </Link>
                <span aria-hidden="true">|</span>
                <Link
                  href={`/account/find-password${recoveryRedirectQuery}`}
                  className="-my-12 inline-flex min-h-44 items-center rounded-4 underline focus-ring"
                >
                  비밀번호 찾기
                </Link>
                <span aria-hidden="true">|</span>
                <Link
                  href={`/signup?redirect=${encodeURIComponent(redirectPath)}`}
                  onClick={(event) => {
                    // 수정 키나 가운데 버튼 클릭은 브라우저 기본 동작(새 탭 등)에 맡깁니다.
                    if (
                      event.button !== 0 ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return;
                    event.preventDefault();
                    // 링크가 unmount되기 전에 전환을 동기 반영하고, 같은 탭 버튼 경로와 같게 회원가입 탭에 포커스를 둡니다.
                    flushSync(() => enterSignupMode());
                    signupTabRef.current?.focus();
                  }}
                  className="-my-12 inline-flex min-h-44 items-center rounded-4 underline focus-ring"
                >
                  회원가입
                </Link>
              </nav>
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
          {isMockMode ? (
            <p className="text-caption text-text-3">
              목 로그인은 화면 흐름 확인용이며 실제 인증은 처리되지 않습니다.
            </p>
          ) : null}
        </div>
      )}
    </AuthFrame>
  );
}
