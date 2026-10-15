import type { RouteObject } from 'react-router';
import { AdminLayout } from './layouts/AdminLayout';
import { LoginPage } from './pages/LoginPage';
import { AdminCategoriesPage } from './pages/AdminCategoriesPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminProductFormPage } from './pages/AdminProductFormPage';
import { AdminProductsPage } from './pages/AdminProductsPage';
import { AdminOrdersPage } from './pages/AdminOrdersPage';
import { AdminOrderDetailPage } from './pages/AdminOrderDetailPage';
import { AdminQuotesPage } from './pages/AdminQuotesPage';
import { AdminMembersPage } from './pages/AdminMembersPage';
import { AdminMemberDetailPage } from './pages/AdminMemberDetailPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { AdminCouponsPage } from './pages/AdminCouponsPage';
import { AdminWithdrawnMemberDetailPage } from './pages/AdminWithdrawnMemberDetailPage';
import { AdminBrandsPage } from './pages/AdminBrandsPage';
import { AdminBrandFormPage } from './pages/AdminBrandFormPage';

/** 화면 제목·상위 메뉴를 route handle에 담아 TopBar 경로 표시에 씁니다. */
export interface AdminRouteHandle {
  title: string;
  section?: string;
}

/** Admin 라우트(HANDOFF 9절 및 Stage 6 화면) */
export const adminRoutes: RouteObject[] = [
  { path: '/login', element: <LoginPage />, handle: { title: '관리자 로그인' } },
  {
    path: '/',
    element: <AdminLayout />,
    children: [
      {
        index: true,
        handle: { title: '대시보드' },
        element: <AdminDashboardPage />,
      },
      {
        path: 'products',
        handle: { title: '상품 목록', section: '상품 관리' },
        element: <AdminProductsPage />,
      },
      {
        path: 'products/new',
        handle: { title: '상품 등록', section: '상품 관리' },
        element: <AdminProductFormPage />,
      },
      {
        path: 'products/:productId',
        handle: { title: '상품 수정', section: '상품 관리' },
        element: <AdminProductFormPage />,
      },
      {
        path: 'categories',
        handle: { title: '카테고리 관리' },
        element: <AdminCategoriesPage />,
      },
      {
        path: 'brands',
        handle: { title: '브랜드 관리', section: '브랜드 관리' },
        element: <AdminBrandsPage />,
      },
      {
        path: 'brands/new',
        handle: { title: '브랜드 등록', section: '브랜드 관리' },
        element: <AdminBrandFormPage />,
      },
      {
        path: 'brands/:brandId',
        handle: { title: '브랜드 수정', section: '브랜드 관리' },
        element: <AdminBrandFormPage />,
      },
      {
        path: 'quotes',
        handle: { title: '견적 문의 관리', section: '견적 문의' },
        element: <AdminQuotesPage />,
      },
      {
        path: 'orders',
        handle: { title: '주문 목록', section: '주문 관리' },
        element: <AdminOrdersPage />,
      },
      {
        path: 'orders/:orderId',
        handle: { title: '주문 상세', section: '주문 관리' },
        element: <AdminOrderDetailPage />,
      },
      {
        path: 'members',
        handle: { title: '회원 목록', section: '회원 관리' },
        element: <AdminMembersPage />,
      },
      {
        path: 'members/withdrawn/:memberId',
        handle: { title: '탈퇴 회원 상세', section: '회원 관리' },
        element: <AdminWithdrawnMemberDetailPage />,
      },
      {
        path: 'members/:memberId',
        handle: { title: '회원 상세', section: '회원 관리' },
        element: <AdminMemberDetailPage />,
      },
      {
        path: 'settings/shipping-discount',
        handle: { title: '배송·할인 설정', section: '운영 설정' },
        element: <AdminSettingsPage />,
      },
      {
        path: 'coupons',
        handle: { title: '쿠폰 관리', section: '운영 설정' },
        element: <AdminCouponsPage />,
      },
      { path: '*', handle: { title: '페이지 없음' }, element: <NotFoundPage /> },
    ],
  },
];
