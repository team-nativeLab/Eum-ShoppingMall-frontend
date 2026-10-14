import { Badge } from '@eum/ui/components/Badge';
import { Button } from '@eum/ui/components/Button';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { TextField } from '@eum/ui/components/TextField';
import { ApiError } from '@eum/api/errors';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { AdminError, AdminLoading } from '@/components/AdminUI';
import { currentAdminQueryKey, getAdminAuth } from '@/lib/admin-auth';
import { sanitizeRedirectPath } from '@eum/api/redirect';

/** 관리자 목 인증에 연결된 로그인 화면입니다. 로그인은 실제 인가를 대신하지 않습니다. */
export function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentAdminQuery = useQuery({
    queryKey: currentAdminQueryKey,
    queryFn: async () => (await getAdminAuth()).getCurrentUser(),
  });
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const redirectPath = sanitizeRedirectPath(searchParams.get('redirect'));
  const isRealApi = import.meta.env.VITE_API_MODE === 'real';

  if (currentAdminQuery.isPending) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg-subtle p-32">
        <div className="w-full max-w-440">
          <AdminLoading label="관리자 로그인 상태를 확인하고 있습니다." />
        </div>
      </main>
    );
  }
  if (currentAdminQuery.isError) {
    return (
      <main className="min-h-dvh bg-bg-subtle p-32">
        <div className="mx-auto max-w-440 pt-120">
          <AdminError
            title={
              isRealApi
                ? '실제 관리자 인증 API가 연결되지 않았습니다'
                : '로그인 상태를 확인할 수 없습니다'
            }
            description={
              isRealApi
                ? '현재는 운영자 계정을 확인할 수 없습니다. API 연결 후 다시 시도해 주세요.'
                : '인증 설정을 확인하고 다시 시도해 주세요.'
            }
            onRetry={() => void currentAdminQuery.refetch()}
          />
        </div>
      </main>
    );
  }
  if (currentAdminQuery.data) return <Navigate to={redirectPath} replace />;

  const handleSubmit = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      const signedInAdmin = await (await getAdminAuth()).login({ loginId, password });
      queryClient.setQueryData(currentAdminQueryKey, signedInAdmin);
      await navigate(redirectPath, { replace: true });
    } catch (loginError: unknown) {
      setFormError(
        loginError instanceof ApiError &&
          (loginError.code === 'INVALID_CREDENTIALS' || loginError.code === 'VALIDATION')
          ? loginError.message
          : '로그인할 수 없습니다. 인증 설정을 확인해 주세요.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg-subtle p-32">
      <section
        aria-labelledby="login-title"
        className="w-full max-w-440 rounded-12 border border-line bg-bg p-40"
      >
        <div className="mb-32">
          <div className="flex items-center gap-8">
            <span className="text-title">이음산업건설</span>
            <Badge tone="outline">관리자</Badge>
          </div>
          <h1 id="login-title" className="mt-16 text-h2">
            관리자 로그인
          </h1>
          <p className="mt-4 text-body-s text-text-3">관리자 계정으로만 접속할 수 있습니다.</p>
        </div>

        {formError ? (
          <NoticeInline role="alert" tone="danger" className="mb-20">
            {formError}
          </NoticeInline>
        ) : null}

        <form className="flex flex-col gap-24" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-16">
            <TextField
              label="아이디"
              autoComplete="username"
              value={loginId}
              onChange={(changeEvent) => setLoginId(changeEvent.target.value)}
              placeholder="관리자 아이디를 입력해 주세요"
              required
            />
            <TextField
              label="비밀번호"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(changeEvent) => setPassword(changeEvent.target.value)}
              placeholder="비밀번호를 입력해 주세요"
              required
            />
          </div>

          {!isRealApi ? (
            <NoticeInline tone="warning">
              개발용 목 인증입니다. 화면 내 로그인 확인은 실제 관리자 권한 검증을 대신하지 않습니다.
            </NoticeInline>
          ) : (
            <NoticeInline tone="info">
              실제 관리자 인증 API가 연결되기 전까지 로그인할 수 없습니다.
            </NoticeInline>
          )}

          <Button type="submit" size="l" isFullWidth disabled={isSubmitting || isRealApi}>
            {isSubmitting ? '로그인 확인 중' : '로그인'}
          </Button>
          <p className="-mt-16 text-caption text-text-3">
            관리자 계정은 시스템 담당자에게 문의하세요.
          </p>
        </form>
      </section>
    </main>
  );
}
