'use client';

import type { MemberSignupInput } from '@eum/api/auth';
import { sanitizeRedirectPath } from '@eum/api/redirect';
import { Button } from '@eum/ui/components/Button';
import { Checkbox } from '@eum/ui/components/Checkbox';
import { Modal } from '@eum/ui/components/Modal';
import { Segmented } from '@eum/ui/components/Segmented';
import { TextField } from '@eum/ui/components/TextField';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { PageContainer } from '@/components/page-container';
import { getMemberAuth } from '@/lib/member-auth';
import { useMemberSession } from './member-session';

type AccountType = MemberSignupInput['accountType'];
type ConsentDocument = 'terms' | 'privacy' | 'marketing';

/** W-10: 이메일 중복 확인·메모리 휴대폰 코드 확인을 거치는 mock 가입 화면입니다. */
export function SignupPageView({ rawRedirect }: { rawRedirect?: string }) {
  const router = useRouter();
  const { setMember } = useMemberSession();
  const [accountType, setAccountType] = useState<AccountType>('personal');
  const [email, setEmail] = useState('');
  const [checkedEmail, setCheckedEmail] = useState('');
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [generatedPhoneCode, setGeneratedPhoneCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCodeSecondsRemaining, setPhoneCodeSecondsRemaining] = useState(180);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [isEmailChecking, setIsEmailChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedMarketing, setAcceptedMarketing] = useState(false);
  const [consentDocument, setConsentDocument] = useState<ConsentDocument | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const redirectPath = sanitizeRedirectPath(rawRedirect, '/');
  const normalizedEmail = email.trim().toLowerCase();
  const isPasswordValid = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password);
  const isPhoneCodeExpired = phoneCodeSecondsRemaining === 0;
  const phoneCodeTimerText = `남은 시간 ${String(Math.floor(phoneCodeSecondsRemaining / 60)).padStart(2, '0')}:${String(phoneCodeSecondsRemaining % 60).padStart(2, '0')}`;
  const phoneCodeHelperText = isPhoneVerified
    ? undefined
    : generatedPhoneCode
      ? `${phoneCodeTimerText} · 목 인증번호 ${generatedPhoneCode}`
      : phoneCodeTimerText;
  const canSubmit =
    emailAvailable === true &&
    checkedEmail === normalizedEmail &&
    isPasswordValid &&
    password === passwordConfirmation &&
    name.trim().length > 0 &&
    isPhoneVerified &&
    acceptedTerms &&
    acceptedPrivacy;
  const areAllTermsAccepted = acceptedTerms && acceptedPrivacy && acceptedMarketing;

  useEffect(() => {
    if (!generatedPhoneCode || isPhoneCodeExpired || isPhoneVerified) return;
    const countdownId = window.setInterval(() => {
      setPhoneCodeSecondsRemaining((secondsRemaining) => Math.max(0, secondsRemaining - 1));
    }, 1000);
    return () => window.clearInterval(countdownId);
  }, [generatedPhoneCode, isPhoneCodeExpired, isPhoneVerified]);

  const handleEmailChange = (nextEmail: string) => {
    setEmail(nextEmail);
    setEmailAvailable(null);
    setCheckedEmail('');
    setMessage('');
    setError('');
  };

  const handleCheckEmail = async () => {
    setMessage('');
    setError('');
    if (!normalizedEmail) {
      setError('이메일을 입력해 주세요.');
      return;
    }
    setIsEmailChecking(true);
    try {
      const isAvailable = await (await getMemberAuth()).isEmailAvailable(normalizedEmail);
      setCheckedEmail(normalizedEmail);
      setEmailAvailable(isAvailable);
      setMessage(isAvailable ? '사용할 수 있는 이메일입니다.' : '이미 사용 중인 이메일입니다.');
    } catch (checkFailure: unknown) {
      const code =
        typeof checkFailure === 'object' && checkFailure !== null && 'code' in checkFailure
          ? checkFailure.code
          : '';
      setError(
        code === 'NOT_IMPLEMENTED'
          ? '실제 이메일 확인 API는 아직 연결되지 않았습니다.'
          : '이메일을 확인하지 못했습니다. 다시 시도해 주세요.',
      );
    } finally {
      setIsEmailChecking(false);
    }
  };

  const handlePhoneChange = (nextPhone: string) => {
    setPhone(nextPhone);
    setGeneratedPhoneCode('');
    setPhoneCode('');
    setPhoneCodeSecondsRemaining(180);
    setIsPhoneVerified(false);
    setMessage('');
  };

  const handleSendPhoneCode = () => {
    const normalizedPhone = phone.replace(/\D/g, '');
    setError('');
    setMessage('');
    if (normalizedPhone.length < 10 || normalizedPhone.length > 11) {
      setError('휴대폰 번호를 확인해 주세요.');
      return;
    }
    const randomNumber = new Uint32Array(1);
    crypto.getRandomValues(randomNumber);
    const nextCode = String((randomNumber[0] ?? 0) % 1_000_000).padStart(6, '0');
    setGeneratedPhoneCode(nextCode);
    setPhoneCode('');
    setPhoneCodeSecondsRemaining(180);
    setIsPhoneVerified(false);
    setMessage('목 인증번호를 만들었습니다. 화면에 표시된 번호를 입력해 주세요.');
  };

  const handleVerifyPhoneCode = () => {
    setError('');
    if (generatedPhoneCode && !isPhoneCodeExpired && phoneCode === generatedPhoneCode) {
      setIsPhoneVerified(true);
      setMessage('휴대폰 확인이 완료되었습니다.');
      return;
    }
    setIsPhoneVerified(false);
    setError('인증번호를 확인해 주세요.');
  };

  const handleSubmit = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    setMessage('');
    setError('');
    if (!canSubmit) {
      setError('이메일 확인, 비밀번호 조건, 휴대폰 확인과 필수 약관 동의를 완료해 주세요.');
      return;
    }
    setIsSubmitting(true);
    try {
      const signupInput: MemberSignupInput = {
        email: normalizedEmail,
        password,
        name: name.trim(),
        phone: phone.trim(),
        accountType,
      };
      const member = await (await getMemberAuth()).signup(signupInput);
      setMember(member);
      // 즉시 참조 해제해 비밀번호와 입력 코드를 화면 상태에 더 오래 두지 않습니다.
      setPassword('');
      setPasswordConfirmation('');
      setPhoneCode('');
      setGeneratedPhoneCode('');
      router.replace(redirectPath);
    } catch (signupFailure: unknown) {
      const code =
        typeof signupFailure === 'object' && signupFailure !== null && 'code' in signupFailure
          ? signupFailure.code
          : '';
      setError(
        code === 'NOT_IMPLEMENTED'
          ? '실제 회원가입 API는 아직 연결되지 않았습니다.'
          : '가입하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer className="py-40 lg:pt-96 lg:pb-120">
      <section className="mx-auto w-full max-w-480">
        <header className="flex flex-col items-start gap-8">
          <h1 className="text-h1">회원가입</h1>
          <p className="text-body-s text-text-2">
            안전한 현장을 위한 이음산업건설 회원이 되어 보세요.
          </p>
        </header>
        <form
          className="mt-24 flex flex-col gap-16"
          onSubmit={(submitEvent) => void handleSubmit(submitEvent)}
        >
          <Segmented
            label="회원 유형"
            value={accountType}
            onValueChange={setAccountType}
            options={[
              { value: 'personal', label: '개인 회원' },
              { value: 'business', label: '사업자 회원' },
            ]}
          />
          <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <TextField
              label="이메일"
              showRequiredIndicator
              name="email"
              type="email"
              autoComplete="email"
              placeholder="example@email.com"
              required
              value={email}
              onChange={(event) => handleEmailChange(event.target.value)}
              successMessage={
                checkedEmail === normalizedEmail && emailAvailable
                  ? '사용 가능한 이메일입니다.'
                  : undefined
              }
            />
            <Button
              type="button"
              variant="secondary"
              size="m"
              className="mt-28"
              onClick={() => void handleCheckEmail()}
              disabled={isEmailChecking}
            >
              {isEmailChecking ? '확인 중…' : '중복 확인'}
            </Button>
          </div>
          <TextField
            label="비밀번호"
            showRequiredIndicator
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호를 입력해 주세요"
            helperText="영문·숫자 조합 8자 이상"
            errorMessage={
              password.length > 0 && !isPasswordValid
                ? '영문·숫자 조합 8자 이상 입력해 주세요.'
                : undefined
            }
          />
          <TextField
            label="비밀번호 확인"
            showRequiredIndicator
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            placeholder="비밀번호를 한 번 더 입력해 주세요"
            required
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            errorMessage={
              passwordConfirmation.length > 0 && password !== passwordConfirmation
                ? '비밀번호가 일치하지 않습니다.'
                : undefined
            }
            successMessage={
              passwordConfirmation.length > 0 && password === passwordConfirmation
                ? '비밀번호가 일치합니다.'
                : undefined
            }
          />
          <TextField
            label="이름"
            showRequiredIndicator
            name="name"
            autoComplete="name"
            placeholder="이름을 입력해 주세요"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <TextField
              label="휴대폰 번호"
              showRequiredIndicator
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="숫자만 입력해 주세요"
              required
              value={phone}
              onChange={(event) => handlePhoneChange(event.target.value)}
              successMessage={isPhoneVerified ? '휴대폰 확인이 완료되었습니다.' : undefined}
            />
            <Button
              type="button"
              variant="secondary"
              size="m"
              className="mt-28"
              onClick={handleSendPhoneCode}
            >
              인증번호 받기
            </Button>
          </div>
          <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div className="min-w-0">
              <TextField
                label="인증번호"
                isLabelHidden
                showRequiredIndicator
                name="verificationCode"
                aria-required="true"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="인증번호 6자리"
                value={phoneCode}
                disabled={!generatedPhoneCode || isPhoneCodeExpired}
                onChange={(event) =>
                  setPhoneCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                }
                helperText={phoneCodeHelperText}
              />
              <p role="status" aria-atomic="true" className="sr-only">
                {generatedPhoneCode && isPhoneCodeExpired && !isPhoneVerified
                  ? '인증번호 유효 시간이 만료되었습니다. 인증번호를 다시 받아 주세요.'
                  : ''}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="m"
              onClick={handleVerifyPhoneCode}
              disabled={!generatedPhoneCode || isPhoneCodeExpired || phoneCode.length !== 6}
            >
              확인
            </Button>
          </div>
          <fieldset className="flex flex-col gap-12 rounded-12 border border-line bg-bg-subtle p-20">
            <legend className="sr-only">약관 동의</legend>
            <Checkbox
              checked={areAllTermsAccepted}
              onChange={(event) => {
                setAcceptedTerms(event.target.checked);
                setAcceptedPrivacy(event.target.checked);
                setAcceptedMarketing(event.target.checked);
              }}
            >
              전체 동의
            </Checkbox>
            <div aria-hidden="true" className="border-t border-line" />
            <div className="flex flex-wrap items-center justify-between gap-8">
              <Checkbox
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
              >
                [필수] 이용약관 동의
              </Checkbox>
              <button
                type="button"
                onClick={() => setConsentDocument('terms')}
                className="min-h-40 rounded-4 px-8 text-caption text-text-2 underline focus-ring"
              >
                보기
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-8">
              <Checkbox
                checked={acceptedPrivacy}
                onChange={(event) => setAcceptedPrivacy(event.target.checked)}
              >
                [필수] 개인정보 수집·이용 동의
              </Checkbox>
              <button
                type="button"
                onClick={() => setConsentDocument('privacy')}
                className="min-h-40 rounded-4 px-8 text-caption text-text-2 underline focus-ring"
              >
                보기
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-8">
              <Checkbox
                checked={acceptedMarketing}
                onChange={(event) => setAcceptedMarketing(event.target.checked)}
              >
                [선택] 마케팅 정보 수신 동의
              </Checkbox>
              <button
                type="button"
                onClick={() => setConsentDocument('marketing')}
                className="min-h-40 rounded-4 px-8 text-caption text-text-2 underline focus-ring"
              >
                보기
              </button>
            </div>
          </fieldset>
          {message ? (
            <p aria-live="polite" className="text-body-s text-success">
              {message}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-8 bg-danger-tint p-12 text-body-s text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="l" isFullWidth disabled={isSubmitting || !canSubmit}>
            {isSubmitting ? '가입 중…' : '가입하기'}
          </Button>
        </form>
        <p className="mt-20 text-center text-body-s text-text-2">
          이미 계정이 있나요?{' '}
          <Link
            href={`/login?redirect=${encodeURIComponent(redirectPath)}`}
            className="rounded-4 text-label-m underline focus-ring"
          >
            로그인
          </Link>
        </p>
        <p className="mt-20 text-caption text-text-3">
          목 가입과 이메일·휴대폰 확인은 화면 흐름용이며 실제 계정이나 인증 문자는 생성되지
          않습니다.
        </p>
        <ConsentDocumentModal document={consentDocument} onClose={() => setConsentDocument(null)} />
      </section>
    </PageContainer>
  );
}

function ConsentDocumentModal({
  document,
  onClose,
}: {
  document: ConsentDocument | null;
  onClose: () => void;
}) {
  const title =
    document === 'terms'
      ? '[필수] 이용약관'
      : document === 'privacy'
        ? '[필수] 개인정보 수집·이용 동의'
        : '[선택] 마케팅 정보 수신 동의';
  const body =
    document === 'terms'
      ? '회원 가입과 상품 주문, 결제 및 고객지원 서비스 이용에 필요한 내용을 안내합니다. 서비스 이용 시 상품과 주문 화면에 표시되는 안내를 확인해 주세요.'
      : document === 'privacy'
        ? '회원 관리와 주문·배송, 고객 문의 처리를 위해 필요한 개인정보를 처리합니다. 항목과 보유 기간은 개인정보처리방침에서 확인해 주세요.'
        : '이벤트와 상품 소식 등 마케팅 정보를 이메일 또는 문자로 받을 수 있습니다. 동의는 선택 사항이며 언제든지 변경할 수 있습니다.';
  return (
    <Modal
      isOpen={document !== null}
      onClose={onClose}
      title={title}
      actions={
        <>
          <Link
            href={document === 'terms' ? '/terms' : '/privacy'}
            className="inline-flex min-h-36 items-center rounded-8 px-12 text-label-m underline focus-ring"
          >
            전문 보기
          </Link>
          <Button onClick={onClose}>닫기</Button>
        </>
      }
    >
      <div className="mt-16 max-h-[60dvh] overflow-y-auto rounded-8 border border-line p-16 text-body-s text-text-2">
        <p>{body}</p>
        <p className="mt-12">가입을 계속하기 전에 동의 항목과 처리 목적을 확인해 주세요.</p>
      </div>
    </Modal>
  );
}
