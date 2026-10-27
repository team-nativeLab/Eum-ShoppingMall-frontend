import { Breadcrumb, type BreadcrumbItem } from '@eum/ui/components/Breadcrumb';
import { Button, buttonClassName } from '@eum/ui/components/Button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useMatches, useNavigate } from 'react-router';
import { endAdminSession } from '@/lib/admin-request-lifecycle';
import { getAdminApiConfig } from '@/lib/api-config';
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
  const isMockMode = getAdminApiConfig().mode === 'mock';

  const breadcrumbItems: BreadcrumbItem[] = [{ label: '관리자', href: '/' }];
  if (currentHandle?.section) breadcrumbItems.push({ label: currentHandle.section });
  if (currentHandle) breadcrumbItems.push({ label: currentHandle.title });

  // 목 세션을 지우고 로그인 화면으로 보내는 함수
  const handleLogout = async () => {
    endAdminSession();
    try {
      await queryClient.cancelQueries({ queryKey: ['admin'] });
      await (await getAdminAuth()).logout();
    } catch {
      // 로컬 관리자 상태는 로그아웃 응답과 무관하게 정리합니다.
    } finally {
      queryClient.removeQueries({ queryKey: ['admin'] });
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
        {isMockMode ? (
          <details className="group relative inline-flex">
            <summary
              aria-describedby="admin-mock-data-storage-help"
              title="목 API 변경 사항은 앱을 실행하는 동안에만 유지되며, 새로고침하거나 앱을 종료하면 사라집니다."
              className="list-none rounded-6 bg-warning-tint px-8 py-4 text-caption text-warning focus-ring [&::-webkit-details-marker]:hidden"
            >
              목 데이터
            </summary>
            <span
              role="tooltip"
              className="pointer-events-none invisible absolute top-full right-0 z-20 mt-8 w-240 rounded-8 bg-text-1 px-12 py-8 text-caption text-inverse group-open:visible group-focus-within:visible group-hover:visible"
            >
              목 API 변경 사항은 앱을 실행하는 동안에만 유지되며, 새로고침하거나 앱을 종료하면
              사라집니다.
            </span>
            <span id="admin-mock-data-storage-help" className="sr-only">
              목 API 변경 사항은 앱을 실행하는 동안에만 유지되며, 새로고침하거나 앱을 종료하면
              사라집니다.
            </span>
          </details>
        ) : null}
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
