import { NoticeInline } from '@eum/ui/components/NoticeInline';

/** 관리자 로그인 자리표시(AD-01). 폼과 목 인증 연결은 6단계에서 구현합니다. */
export function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg-subtle p-32">
      <section
        aria-labelledby="login-title"
        className="w-full max-w-440 rounded-12 bg-bg p-32 shadow-2"
      >
        <h1 id="login-title" className="text-h2">
          관리자 로그인
        </h1>
        <NoticeInline tone="info" className="mt-16">
          AD-01 화면은 6단계에서 구현합니다.
        </NoticeInline>
      </section>
    </main>
  );
}
