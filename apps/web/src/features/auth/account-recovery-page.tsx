'use client';

import { Button } from '@eum/ui/components/Button';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { TextField } from '@eum/ui/components/TextField';
import { sanitizeRedirectPath } from '@eum/api/redirect';
import { PageContainer } from '@/components/page-container';
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';

type RecoveryMode = 'email' | 'password';
type RecoveryStage = 'form' | 'result' | 'reset' | 'complete';

export function AccountRecoveryPage({
  mode,
  rawRedirect,
}: {
  mode: RecoveryMode;
  rawRedirect?: string;
}) {
  const [stage, setStage] = useState<RecoveryStage>('form');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [nameError, setNameError] = useState('');
  const [contactError, setContactError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmationError, setConfirmationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLock = useRef(false);
  const title = mode === 'email' ? '이메일 찾기' : '비밀번호 찾기';
  const redirectPath = sanitizeRedirectPath(rawRedirect, '/');
  const loginHref = rawRedirect ? `/login?redirect=${encodeURIComponent(redirectPath)}` : '/login';
  const recoveryRedirectQuery = `?redirect=${encodeURIComponent(redirectPath)}`;

  function clearRecoveryInputs() {
    setName('');
    setContact('');
  }

  function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;
    const nextNameError = name.trim() ? '' : '이름을 입력해 주세요.';
    const nextContactError = contact.trim() ? '' : '연락처를 입력해 주세요.';
    setNameError(nextNameError);
    setContactError(nextContactError);
    if (nextNameError || nextContactError) {
      const firstInvalidId = nextNameError ? 'recovery-name' : 'recovery-contact';
      window.requestAnimationFrame(() => document.getElementById(firstInvalidId)?.focus());
      return;
    }
    submitLock.current = true;
    setIsSubmitting(true);
    // 데모 흐름은 계정 조회나 인증을 요청하지 않습니다.
    clearRecoveryInputs();
    setStage('result');
  }

  function handlePasswordPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;
    const nextPasswordError = newPassword.length >= 8 ? '' : '비밀번호를 8자 이상 입력해 주세요.';
    const nextConfirmationError =
      confirmation && confirmation === newPassword ? '' : '비밀번호 확인 내용이 일치하지 않습니다.';
    setPasswordError(nextPasswordError);
    setConfirmationError(nextConfirmationError);
    if (nextPasswordError || nextConfirmationError) {
      const firstInvalidId = nextPasswordError
        ? 'recovery-new-password'
        : 'recovery-password-confirmation';
      window.requestAnimationFrame(() => document.getElementById(firstInvalidId)?.focus());
      return;
    }
    submitLock.current = true;
    setIsSubmitting(true);
    // 입력값은 저장하지 않고 실제 계정 비밀번호도 변경하지 않습니다.
    setNewPassword('');
    setConfirmation('');
    setStage('complete');
  }

  function showResetPreview() {
    submitLock.current = false;
    setIsSubmitting(false);
    setPasswordError('');
    setConfirmationError('');
    setStage('reset');
  }

  return (
    <PageContainer className="px-16 py-40 sm:px-20 lg:pt-96 lg:pb-120">
      <section className="mx-auto w-full max-w-480">
        <header className="mb-24 text-center">
          <p className="text-caption text-text-3">계정 도움말</p>
          <h1 className="mt-8 text-h1">
            {stage === 'reset' ? '비밀번호 재설정' : stage === 'complete' ? '요청 완료' : title}
          </h1>
          <p className="mt-8 text-body-s text-text-2">계정 복구 화면은 데모 흐름으로 제공됩니다.</p>
        </header>
        <NoticeInline tone="warning" className="mb-20">
          실제 회원 조회, 본인 확인 또는 계정 정보 변경은 진행되지 않습니다. 입력한 정보는 화면
          안에서만 사용하고 제출 직후 지웁니다.
        </NoticeInline>
        {stage === 'form' ? (
          <form className="space-y-16" onSubmit={handleLookup} noValidate>
            <TextField
              id="recovery-name"
              label="이름"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setNameError('');
              }}
              autoComplete="name"
              errorMessage={nameError || undefined}
              required
            />
            <TextField
              id="recovery-contact"
              label={mode === 'email' ? '휴대폰 번호' : '이메일 또는 휴대폰 번호'}
              type={mode === 'email' ? 'tel' : 'text'}
              value={contact}
              onChange={(event) => {
                setContact(event.target.value);
                setContactError('');
              }}
              autoComplete={mode === 'email' ? 'tel' : 'username'}
              errorMessage={contactError || undefined}
              required
            />
            <Button type="submit" size="l" isFullWidth disabled={isSubmitting}>
              {isSubmitting ? '확인 중…' : mode === 'email' ? '이메일 찾기' : '비밀번호 찾기'}
            </Button>
          </form>
        ) : null}
        {stage === 'result' ? (
          <section
            className="rounded-12 border border-line p-24 text-center"
            aria-labelledby="recovery-result-heading"
          >
            <h2 id="recovery-result-heading" className="text-h3">
              요청 내용을 확인했습니다.
            </h2>
            <p className="mt-12 text-body-s text-text-2">
              개인정보 보호를 위해 계정 존재 여부나 이메일·휴대폰 번호를 안내하지 않습니다. 이
              데모에서는 실제 조회나 인증이 이루어지지 않았습니다.
            </p>
            {mode === 'password' ? (
              <Button className="mt-20" variant="secondary" onClick={showResetPreview}>
                데모 재설정 화면 보기
              </Button>
            ) : null}
          </section>
        ) : null}
        {stage === 'reset' ? (
          <form className="space-y-16" onSubmit={handlePasswordPreview} noValidate>
            <TextField
              id="recovery-new-password"
              label="새 비밀번호"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => {
                setNewPassword(event.target.value);
                setPasswordError('');
              }}
              helperText="8자 이상 입력해 주세요. 실제 비밀번호에는 반영되지 않습니다."
              errorMessage={passwordError || undefined}
              required
            />
            <TextField
              id="recovery-password-confirmation"
              label="새 비밀번호 확인"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value);
                setConfirmationError('');
              }}
              errorMessage={confirmationError || undefined}
              required
            />
            <Button type="submit" size="l" isFullWidth disabled={isSubmitting}>
              {isSubmitting ? '확인 중…' : '데모 완료'}
            </Button>
          </form>
        ) : null}
        {stage === 'complete' ? (
          <section
            className="rounded-12 border border-line p-24 text-center"
            aria-labelledby="recovery-complete-heading"
          >
            <h2 id="recovery-complete-heading" className="text-h3">
              데모 흐름이 완료되었습니다.
            </h2>
            <p className="mt-12 text-body-s text-text-2">
              실제 비밀번호는 변경되지 않았습니다. 기존 계정 정보를 계속 사용해 주세요.
            </p>
          </section>
        ) : null}
        <nav
          aria-label="계정 복구 메뉴"
          className="mt-24 flex flex-wrap justify-center gap-16 text-body-s"
        >
          <Link href={loginHref} className="rounded-4 underline focus-ring">
            로그인으로
          </Link>
          {mode === 'email' ? (
            <Link
              href={`/account/find-password${recoveryRedirectQuery}`}
              className="rounded-4 underline focus-ring"
            >
              비밀번호 찾기
            </Link>
          ) : (
            <Link
              href={`/account/find-email${recoveryRedirectQuery}`}
              className="rounded-4 underline focus-ring"
            >
              이메일 찾기
            </Link>
          )}
        </nav>
      </section>
    </PageContainer>
  );
}
