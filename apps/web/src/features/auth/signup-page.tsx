'use client';

import { AuthFrame } from './auth-frame';
import { SignupForm } from './signup-form';
import { useSignupDraft } from './signup-draft';

/** W-10: 탭 없이 제목과 가입 폼만 보여주는 /signup 화면입니다. */
export function SignupPageView({ rawRedirect }: { rawRedirect?: string }) {
  const draft = useSignupDraft();
  return (
    <AuthFrame title="회원가입" description="안전한 현장을 위한 안전맛집 회원이 되어 보세요.">
      <SignupForm draft={draft} rawRedirect={rawRedirect} />
    </AuthFrame>
  );
}
