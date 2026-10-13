import { Outlet } from 'react-router';
import { AdminSidebar } from '@/components/AdminSidebar';
import { AdminTopBar } from '@/components/AdminTopBar';

/**
 * 관리자 기본 레이아웃(Sidebar 240 · TopBar 64 · content 패딩 32, 기준 폭 1136).
 * 로그인 확인(가드)은 6단계 AD-01과 함께 붙입니다(클라이언트 가드는 UX용이고 실제 인가는 서버).
 * Admin은 데스크톱 전용입니다(Figma 1440 = 사이드바 240 + 패딩 64 + 내용 1136).
 * 최소 폭 1280(흔한 노트북 해상도)까지는 내용 폭이 976으로 줄며 대응하고, 더 좁으면 가로 스크롤합니다.
 */
export function AdminLayout() {
  return (
    <div className="flex min-h-dvh min-w-[1280px] bg-bg-subtle text-text-1">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar />
        <main className="flex-1 p-32">
          <div className="mx-auto w-full max-w-admin-content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
