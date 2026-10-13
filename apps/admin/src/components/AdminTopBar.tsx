import { Breadcrumb, type BreadcrumbItem } from '@eum/ui/components/Breadcrumb';
import { Button, buttonClassName } from '@eum/ui/components/Button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useMatches, useNavigate } from 'react-router';
import { currentAdminQueryKey, getAdminAuth } from '@/lib/admin-auth';
import type { AdminRouteHandle } from '@/routes';

// route handle에 제목이 있는지 확인하는 타입 가드
function isAdminRouteHandle(handle: unknown): handle is AdminRouteHandle {
  return (
    typeof handle === 'object' &&
    handle !== null &&
    'title' in handle &&
    typeof handle.title === 'string'
  );
}

/** 관리자 상단 바(Figma HF/Admin/TopBar, h64 · px32). 경로·쇼핑몰 바로가기·현재 관리자·로그아웃 */
export function AdminTopBar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const routeMatches = useMatches();
  const currentHandle = routeMatches
    .map((routeMatch) => routeMatch.handle)
    .findLast(isAdminRouteHandle);
  const currentAdminQuery = useQuery({
    queryKey: currentAdminQueryKey,
    queryFn: async () => (await getAdminAuth()).getCurrentUser(),
  });
  const webBaseUrl = import.meta.env.VITE_WEB_BASE_URL;

  const breadcrumbItems: BreadcrumbItem[] = [{ label: '관리자', href: '/' }];
  if (currentHandle?.section) breadcrumbItems.push({ label: currentHandle.section });
  if (currentHandle) breadcrumbItems.push({ label: currentHandle.title });

  // 목 세션을 지우고 로그인 화면으로 보내는 함수
  const handleLogout = async () => {
    try {
      await (await getAdminAuth()).logout();
    } finally {
      // 서버 로그아웃 실패와 상관없이 화면의 로그인 정보는 지우고 로그인 화면으로 보냅니다.
      queryClient.removeQueries({ queryKey: currentAdminQueryKey });
      await navigate('/login', { replace: true });
    }
  };

  return (
    <header className="flex h-64 shrink-0 items-center justify-between border-b border-line bg-bg px-32">
      <Breadcrumb
        items={breadcrumbItems}
        renderLink={(breadcrumbItem, linkClassName) => (
          <Link to={breadcrumbItem.href} className={linkClassName}>
            {breadcrumbItem.label}
          </Link>
        )}
      />
      <div className="flex items-center gap-8">
        {webBaseUrl ? (
          <a
            href={webBaseUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonClassName({ variant: 'ghost', size: 's' })}
          >
            쇼핑몰 보기
          </a>
        ) : null}
        {currentAdminQuery.data ? (
          <>
            <span aria-hidden="true" className="h-16 w-px bg-line" />
            <span className="flex items-center gap-8">
              <span
                aria-hidden="true"
                className="flex size-28 items-center justify-center rounded-capsule bg-surface-2 text-label-s"
              >
                {currentAdminQuery.data.name.slice(0, 1)}
              </span>
              <span className="text-body-s text-text-2">{currentAdminQuery.data.name}</span>
            </span>
          </>
        ) : null}
        <Button variant="ghost" size="s" onClick={handleLogout}>
          로그아웃
        </Button>
      </div>
    </header>
  );
}
