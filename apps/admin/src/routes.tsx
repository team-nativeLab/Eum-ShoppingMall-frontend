import type { RouteObject } from 'react-router';
import { AdminLayout } from './layouts/AdminLayout';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PlaceholderPage } from './pages/PlaceholderPage';

/** 화면 제목·상위 메뉴를 route handle에 담아 TopBar 경로 표시에 씁니다. */
export interface AdminRouteHandle {
  title: string;
  section?: string;
}

// 자리표시 화면 route를 만드는 함수(6단계에서 실제 화면으로 바꿉니다)
function placeholderRoute(path: string, handle: AdminRouteHandle, screenId: string): RouteObject {
  return {
    path,
    handle,
    element: <PlaceholderPage title={handle.title} screenId={screenId} />,
  };
}

/** admin 라우트(HANDOFF 9절 라우트 안) */
export const adminRoutes: RouteObject[] = [
  { path: '/login', element: <LoginPage />, handle: { title: '관리자 로그인' } },
  {
    path: '/',
    element: <AdminLayout />,
    children: [
      {
        index: true,
        handle: { title: '대시보드' },
        element: <PlaceholderPage title="대시보드" screenId="AD-02" />,
      },
      placeholderRoute('products', { title: '상품 목록', section: '상품 관리' }, 'AD-03'),
      placeholderRoute('products/new', { title: '상품 등록', section: '상품 관리' }, 'AD-04'),
      placeholderRoute(
        'products/:productId',
        { title: '상품 수정', section: '상품 관리' },
        'AD-04',
      ),
      placeholderRoute('categories', { title: '카테고리 관리' }, 'AD-05'),
      placeholderRoute('quotes', { title: '견적 문의 관리', section: '견적 문의' }, 'AD-06'),
      placeholderRoute('orders', { title: '주문 목록', section: '주문 관리' }, 'AD-07'),
      placeholderRoute('orders/:orderId', { title: '주문 상세', section: '주문 관리' }, 'AD-08'),
      placeholderRoute('members', { title: '회원 목록', section: '회원 관리' }, 'AD-09'),
      placeholderRoute('members/:memberId', { title: '회원 상세', section: '회원 관리' }, 'AD-10'),
      { path: '*', handle: { title: '페이지 없음' }, element: <NotFoundPage /> },
    ],
  },
];
