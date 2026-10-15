import { Badge } from '@eum/ui/components/Badge';
import { Button } from '@eum/ui/components/Button';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { TextField } from '@eum/ui/components/TextField';
import { ApiError } from '@eum/api/errors';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { AdminError, AdminLoading } from '@/components/AdminUI';
import { currentAdminQueryKey, getAdminAuth } from '@/lib/admin-auth';
import { ensureAdminSessionActive, startAdminSession } from '@/lib/admin-request-lifecycle';
import { sanitizeRedirectPath } from '@eum/api/redirect';

type LoginFormError = {
  message: string;
  invalidFields: {
    loginId: boolean;
    password: boolean;
  };
};

/** 관리자 목 인증에 연결된 로그인 화면입니다. 로그인은 실제 인가를 대신하지 않습니다. */
export function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentAdminQuery = useQuery({
    queryKey: currentAdminQueryKey,
    queryFn: async () => (await getAdminAuth()).getCurrentUser(),
  });
  useEffect(() => {
    if (currentAdminQuery.data) ensureAdminSessionActive();
  }, [currentAdminQuery.data]);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<LoginFormError | null>(null);
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
      startAdminSession();
      await queryClient.cancelQueries({ queryKey: ['admin'] });
      queryClient.removeQueries({ queryKey: ['admin'] });
      queryClient.setQueryData(currentAdminQueryKey, signedInAdmin);
      await navigate(redirectPath, { replace: true });
    } catch (loginError: unknown) {
      if (loginError instanceof ApiError && loginError.code === 'INVALID_CREDENTIALS') {
        setFormError({
          message: '아이디 또는 비밀번호가 올바르지 않습니다.',
          invalidFields: { loginId: true, password: true },
        });
      } else if (loginError instanceof ApiError && loginError.code === 'VALIDATION') {
        const hasEmptyLoginId = loginId.trim() === '';
        const hasEmptyPassword = password.trim() === '';
        const message =
          hasEmptyLoginId && hasEmptyPassword
            ? '아이디와 비밀번호를 입력해 주세요.'
            : hasEmptyLoginId
              ? '아이디를 입력해 주세요.'
              : hasEmptyPassword
                ? '비밀번호를 입력해 주세요.'
                : '입력한 정보를 확인해 주세요.';

        setFormError({
          message,
          invalidFields: { loginId: hasEmptyLoginId, password: hasEmptyPassword },
        });
      } else {
        setFormError({
          message: '로그인할 수 없습니다. 잠시 후 다시 시도해 주세요.',
          invalidFields: { loginId: false, password: false },
        });
      }
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
          <NoticeInline id="login-error" role="alert" tone="danger" className="mb-20">
            {formError.message}
          </NoticeInline>
        ) : null}

        <form className="flex flex-col gap-24" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-16">
            <TextField
              id="login-id"
              label="아이디"
              autoComplete="username"
              value={loginId}
              onChange={(changeEvent) => {
                setLoginId(changeEvent.target.value);
                setFormError(null);
              }}
              placeholder="관리자 아이디를 입력해 주세요"
              aria-invalid={formError?.invalidFields.loginId || undefined}
              aria-describedby={formError?.invalidFields.loginId ? 'login-error' : undefined}
              style={
                formError?.invalidFields.loginId
                  ? { borderColor: 'var(--color-danger)' }
                  : undefined
              }
              inputClassName={
                formError?.invalidFields.loginId ? 'ring-[0.5px] ring-inset ring-danger' : undefined
              }
              readOnly={isSubmitting}
              required
            />
            <TextField
              id="login-password"
              label="비밀번호"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(changeEvent) => {
                setPassword(changeEvent.target.value);
                setFormError(null);
              }}
              placeholder="비밀번호를 입력해 주세요"
              aria-invalid={formError?.invalidFields.password || undefined}
              aria-describedby={formError?.invalidFields.password ? 'login-error' : undefined}
              style={
                formError?.invalidFields.password
                  ? { borderColor: 'var(--color-danger)' }
                  : undefined
              }
              inputClassName={
                formError?.invalidFields.password
                  ? 'ring-[0.5px] ring-inset ring-danger'
                  : undefined
              }
              readOnly={isSubmitting}
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
