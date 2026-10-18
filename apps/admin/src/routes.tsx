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
import { AdminHomePage } from './pages/AdminHomePage';
import { AdminEventsPage } from './pages/AdminEventsPage';
import { AdminClaimsPage } from './pages/AdminClaimsPage';
import { AdminPointsPage } from './pages/AdminPointsPage';
import { AdminFaqsPage, AdminNoticesPage } from './pages/AdminSupportContentPage';
import { AdminInquiriesPage } from './pages/AdminInquiriesPage';
import { AdminReviewsPage } from './pages/AdminReviewsPage';
import { AdminProductQuestionsPage } from './pages/AdminProductQuestionsPage';
import { AdminCompanyPoliciesPage } from './pages/AdminCompanyPoliciesPage';

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
        path: 'home-content',
        handle: { title: '홈 편성', section: '몰 콘텐츠' },
        element: <AdminHomePage />,
      },
      {
        path: 'events',
        handle: { title: '이벤트 관리', section: '몰 콘텐츠' },
        element: <AdminEventsPage />,
      },
      {
        path: 'events/new',
        handle: { title: '이벤트 등록', section: '몰 콘텐츠' },
        element: <AdminEventsPage />,
      },
      {
        path: 'events/:eventId',
        handle: { title: '이벤트 수정', section: '몰 콘텐츠' },
        element: <AdminEventsPage />,
      },
      {
        path: 'quotes',
        handle: { title: '견적 문의 관리', section: '견적 문의' },
        element: <AdminQuotesPage />,
      },
      {
        path: 'claims',
        handle: { title: '취소·반품·교환 관리', section: '주문 관리' },
        element: <AdminClaimsPage />,
      },
      {
        path: 'points',
        handle: { title: '적립금 관리', section: '회원·혜택' },
        element: <AdminPointsPage />,
      },
      {
        path: 'content/notices',
        handle: { title: '공지 관리', section: '몰 콘텐츠' },
        element: <AdminNoticesPage />,
      },
      {
        path: 'content/faqs',
        handle: { title: 'FAQ 관리', section: '고객 응대' },
        element: <AdminFaqsPage />,
      },
      {
        path: 'content/inquiries',
        handle: { title: '1:1 문의', section: '고객 응대' },
        element: <AdminInquiriesPage />,
      },
      {
        path: 'content/reviews',
        handle: { title: '상품 리뷰', section: '고객 응대' },
        element: <AdminReviewsPage />,
      },
      {
        path: 'content/product-questions',
        handle: { title: '상품 문의', section: '고객 응대' },
        element: <AdminProductQuestionsPage />,
      },
      {
        path: 'settings/company-policies',
        handle: { title: '회사·정책 정보', section: '운영 설정' },
        element: <AdminCompanyPoliciesPage />,
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
