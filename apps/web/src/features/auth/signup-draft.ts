import { useEffect, useRef, useState } from 'react';

export type ConsentDocument = 'terms' | 'privacy' | 'marketing';

/**
 * 가입 폼 입력값 훅입니다. 로그인 화면도 이 훅을 호출해 상태를 폼 밖에 두므로,
 * 로그인 탭으로 갔다가 돌아와도 입력값과 약관 동의가 남습니다.
 */
export function useSignupDraft() {
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
  // 중복 확인 응답이 늦게 와도 지금 입력된 이메일과 같을 때만 결과를 씁니다.
  const currentEmailRef = useRef('');
  const isPhoneCodeExpired = phoneCodeSecondsRemaining === 0;

  useEffect(() => {
    if (!generatedPhoneCode || isPhoneCodeExpired || isPhoneVerified) return;
    const countdownId = window.setInterval(() => {
      setPhoneCodeSecondsRemaining((secondsRemaining) => Math.max(0, secondsRemaining - 1));
    }, 1000);
    return () => window.clearInterval(countdownId);
  }, [generatedPhoneCode, isPhoneCodeExpired, isPhoneVerified]);

  // 탭을 오갈 때 비우는 민감값입니다(비밀번호·확인·인증번호). 이메일·이름·휴대폰·약관 동의는 유지합니다.
  const clearSensitive = () => {
    setPassword('');
    setPasswordConfirmation('');
    setPhoneCode('');
    setGeneratedPhoneCode('');
    // 인증번호와 함께 안내 문구·오류·타이머도 초기 화면 상태로 되돌립니다(입력 불가 상태의 남은 시간이 남지 않도록).
    setPhoneCodeSecondsRemaining(180);
    setMessage('');
    setError('');
  };

  return {
    clearSensitive,
    currentEmailRef,
    email,
    setEmail,
    checkedEmail,
    setCheckedEmail,
    emailAvailable,
    setEmailAvailable,
    password,
    setPassword,
    passwordConfirmation,
    setPasswordConfirmation,
    name,
    setName,
    phone,
    setPhone,
    generatedPhoneCode,
    setGeneratedPhoneCode,
    phoneCode,
    setPhoneCode,
    phoneCodeSecondsRemaining,
    setPhoneCodeSecondsRemaining,
    isPhoneVerified,
    setIsPhoneVerified,
    isEmailChecking,
    setIsEmailChecking,
    isSubmitting,
    setIsSubmitting,
    acceptedTerms,
    setAcceptedTerms,
    acceptedPrivacy,
    setAcceptedPrivacy,
    acceptedMarketing,
    setAcceptedMarketing,
    consentDocument,
    setConsentDocument,
    message,
    setMessage,
    error,
    setError,
    isPhoneCodeExpired,
  };
}

export type SignupDraft = ReturnType<typeof useSignupDraft>;
