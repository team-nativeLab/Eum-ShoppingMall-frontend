import { Outlet, Navigate, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AdminSidebar } from '@/components/AdminSidebar';
import { AdminTopBar } from '@/components/AdminTopBar';
import { AdminError, AdminLoading } from '@/components/AdminUI';
import { AdminPriceVisibilityPreviewProvider } from '@/lib/admin-price-visibility-preview';
import { currentAdminQueryKey, getAdminAuth } from '@/lib/admin-auth';

/**
 * 관리자 기본 레이아웃(Sidebar 240 · TopBar 64 · content 패딩 32, 기준 폭 1136).
 * 로그인 확인은 클라이언트 UX 가드입니다. 실제 인가와 API 보호는 서버에서 제공해야 합니다.
 * Admin은 데스크톱 전용입니다(Figma 1440 = 사이드바 240 + 패딩 64 + 내용 1136).
 * 최소 폭 1280(흔한 노트북 해상도)까지는 내용 폭이 976으로 줄며 대응하고, 더 좁으면 가로 스크롤합니다.
 */
export function AdminLayout() {
  const currentLocation = useLocation();
  const currentAdminQuery = useQuery({
    queryKey: currentAdminQueryKey,
    queryFn: async () => (await getAdminAuth()).getCurrentUser(),
  });

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
            title="로그인 상태를 확인할 수 없습니다"
            description="실제 인증 API가 연결되지 않았거나 설정을 확인할 수 없습니다. 데모 모드로 다시 시도해 주세요."
            onRetry={() => void currentAdminQuery.refetch()}
          />
        </div>
      </main>
    );
  }
  if (!currentAdminQuery.data) {
    const redirectTarget = `${currentLocation.pathname}${currentLocation.search}${currentLocation.hash}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectTarget)}`} replace />;
  }

  return (
    <AdminPriceVisibilityPreviewProvider>
      <div className="flex min-h-dvh min-w-[1280px] bg-bg-subtle text-text-1">
        <a
          href="#admin-main-content"
          className="focus:shadow-lg sr-only focus:not-sr-only focus:fixed focus:top-12 focus:left-12 focus:z-50 focus:rounded-8 focus:bg-bg focus:px-16 focus:py-12 focus:text-text-1"
        >
          본문 바로가기
        </a>
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopBar />
          <main id="admin-main-content" tabIndex={-1} className="flex-1 p-32">
            <div className="mx-auto w-full max-w-admin-content">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </AdminPriceVisibilityPreviewProvider>
  );
}
