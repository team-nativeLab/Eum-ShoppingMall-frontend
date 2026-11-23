import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router';
import { AdminLayout } from './layouts/AdminLayout';
import { SharedLoginRedirect } from './components/SharedLoginRedirect';
import { getAdminWebBaseUrl } from './lib/api-config';

const AdminCategoriesPage = lazy(() =>
  import('./pages/AdminCategoriesPage').then((module) => ({ default: module.AdminCategoriesPage })),
);
const AdminDashboardPage = lazy(() =>
  import('./pages/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })),
);
const AdminProductFormPage = lazy(() =>
  import('./pages/AdminProductFormPage').then((module) => ({
    default: module.AdminProductFormPage,
  })),
);
const AdminProductsPage = lazy(() =>
  import('./pages/AdminProductsPage').then((module) => ({ default: module.AdminProductsPage })),
);
const AdminOrdersPage = lazy(() =>
  import('./pages/AdminOrdersPage').then((module) => ({ default: module.AdminOrdersPage })),
);
const AdminOrderDetailPage = lazy(() =>
  import('./pages/AdminOrderDetailPage').then((module) => ({
    default: module.AdminOrderDetailPage,
  })),
);
const AdminMembersPage = lazy(() =>
  import('./pages/AdminMembersPage').then((module) => ({ default: module.AdminMembersPage })),
);
const AdminMemberDetailPage = lazy(() =>
  import('./pages/AdminMemberDetailPage').then((module) => ({
    default: module.AdminMemberDetailPage,
  })),
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
);
const AdminSettingsPage = lazy(() =>
  import('./pages/AdminSettingsPage').then((module) => ({ default: module.AdminSettingsPage })),
);
const AdminCouponsPage = lazy(() =>
  import('./pages/AdminCouponsPage').then((module) => ({ default: module.AdminCouponsPage })),
);
const AdminWithdrawnMemberDetailPage = lazy(() =>
  import('./pages/AdminWithdrawnMemberDetailPage').then((module) => ({
    default: module.AdminWithdrawnMemberDetailPage,
  })),
);
const AdminBrandsPage = lazy(() =>
  import('./pages/AdminBrandsPage').then((module) => ({ default: module.AdminBrandsPage })),
);
const AdminBrandFormPage = lazy(() =>
  import('./pages/AdminBrandFormPage').then((module) => ({ default: module.AdminBrandFormPage })),
);
const AdminHomePage = lazy(() =>
  import('./pages/AdminHomePage').then((module) => ({ default: module.AdminHomePage })),
);
const AdminEventsPage = lazy(() =>
  import('./pages/AdminEventsPage').then((module) => ({ default: module.AdminEventsPage })),
);
const AdminClaimsPage = lazy(() =>
  import('./pages/AdminClaimsPage').then((module) => ({ default: module.AdminClaimsPage })),
);
const AdminPointsPage = lazy(() =>
  import('./pages/AdminPointsPage').then((module) => ({ default: module.AdminPointsPage })),
);
const AdminFaqsPage = lazy(() =>
  import('./pages/AdminSupportContentPage').then((module) => ({ default: module.AdminFaqsPage })),
);
const AdminPopupsPage = lazy(() =>
  import('./pages/AdminPopupsPage').then((module) => ({ default: module.AdminPopupsPage })),
);
const AdminInquiriesPage = lazy(() =>
  import('./pages/AdminInquiriesPage').then((module) => ({ default: module.AdminInquiriesPage })),
);
const AdminReviewsPage = lazy(() =>
  import('./pages/AdminReviewsPage').then((module) => ({ default: module.AdminReviewsPage })),
);
const AdminProductQuestionsPage = lazy(() =>
  import('./pages/AdminProductQuestionsPage').then((module) => ({
    default: module.AdminProductQuestionsPage,
  })),
);
const AdminCompanyPoliciesPage = lazy(() =>
  import('./pages/AdminCompanyPoliciesPage').then((module) => ({
    default: module.AdminCompanyPoliciesPage,
  })),
);
const AdminSuppliersPage = lazy(() =>
  import('./pages/AdminSuppliersPage').then((module) => ({ default: module.AdminSuppliersPage })),
);

function AdminPageError() {
  return (
    <div role="alert" className="space-y-12 p-20">
      <p>화면을 불러오지 못했습니다. 페이지를 새로고침해 다시 시도해 주세요.</p>
      <button
        type="button"
        className="underline focus-ring"
        onClick={() => window.location.reload()}
      >
        새로고침
      </button>
    </div>
  );
}

/** 화면 제목·상위 메뉴를 route handle에 담아 TopBar 경로 표시에 씁니다. */
export interface AdminRouteHandle {
  title: string;
  section?: string;
}

/** Admin 라우트(HANDOFF 9절 및 Stage 6 화면) */
export const adminRoutes: RouteObject[] = [
  {
    path: '/login',
    element: <SharedLoginRedirect webBaseUrl={getAdminWebBaseUrl()} />,
    handle: { title: '로그인' },
  },
  {
    path: '/',
    element: <AdminLayout />,
    children: (
      [
        {
          index: true,
          handle: { title: '대시보드' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminDashboardPage />
            </Suspense>
          ),
        },
        {
          path: 'products',
          handle: { title: '상품 목록', section: '상품 관리' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminProductsPage />
            </Suspense>
          ),
        },
        {
          path: 'products/new',
          handle: { title: '상품 등록', section: '상품 관리' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminProductFormPage />
            </Suspense>
          ),
        },
        {
          path: 'products/:productId',
          handle: { title: '상품 수정', section: '상품 관리' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminProductFormPage />
            </Suspense>
          ),
        },
        {
          path: 'categories',
          handle: { title: '카테고리 관리' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminCategoriesPage />
            </Suspense>
          ),
        },
        {
          path: 'brands',
          handle: { title: '브랜드 관리', section: '브랜드 관리' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminBrandsPage />
            </Suspense>
          ),
        },
        {
          path: 'suppliers',
          handle: { title: '발주 관리', section: '상품 관리' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminSuppliersPage />
            </Suspense>
          ),
        },
        {
          path: 'brands/new',
          handle: { title: '브랜드 등록', section: '브랜드 관리' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminBrandFormPage />
            </Suspense>
          ),
        },
        {
          path: 'brands/:brandId',
          handle: { title: '브랜드 수정', section: '브랜드 관리' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminBrandFormPage />
            </Suspense>
          ),
        },
        {
          path: 'home-content',
          handle: { title: '홈 편성', section: '몰 콘텐츠' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminHomePage />
            </Suspense>
          ),
        },
        {
          path: 'events',
          handle: { title: '이벤트 관리', section: '몰 콘텐츠' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminEventsPage />
            </Suspense>
          ),
        },
        {
          path: 'events/new',
          handle: { title: '이벤트 등록', section: '몰 콘텐츠' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminEventsPage />
            </Suspense>
          ),
        },
        {
          path: 'events/:eventId',
          handle: { title: '이벤트 수정', section: '몰 콘텐츠' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminEventsPage />
            </Suspense>
          ),
        },
        {
          path: 'claims',
          handle: { title: '취소·반품·교환 관리', section: '주문 관리' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminClaimsPage />
            </Suspense>
          ),
        },
        {
          path: 'points',
          handle: { title: '적립금 관리', section: '회원·혜택' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminPointsPage />
            </Suspense>
          ),
        },
        {
          path: 'content/popups',
          handle: { title: '팝업 관리', section: '몰 콘텐츠' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminPopupsPage />
            </Suspense>
          ),
        },
        {
          path: 'content/faqs',
          handle: { title: 'FAQ 관리', section: '고객 응대' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminFaqsPage />
            </Suspense>
          ),
        },
        {
          path: 'content/inquiries',
          handle: { title: '1:1 문의', section: '고객 응대' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminInquiriesPage />
            </Suspense>
          ),
        },
        {
          path: 'content/reviews',
          handle: { title: '상품 리뷰', section: '고객 응대' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminReviewsPage />
            </Suspense>
          ),
        },
        {
          path: 'content/product-questions',
          handle: { title: '상품 문의', section: '고객 응대' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminProductQuestionsPage />
            </Suspense>
          ),
        },
        {
          path: 'settings/company-policies',
          handle: { title: '회사·정책 정보', section: '운영 설정' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminCompanyPoliciesPage />
            </Suspense>
          ),
        },
        {
          path: 'orders',
          handle: { title: '주문 목록', section: '주문 관리' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminOrdersPage />
            </Suspense>
          ),
        },
        {
          path: 'orders/:orderId',
          handle: { title: '주문 상세', section: '주문 관리' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminOrderDetailPage />
            </Suspense>
          ),
        },
        {
          path: 'members',
          handle: { title: '회원 목록', section: '회원 관리' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminMembersPage />
            </Suspense>
          ),
        },
        {
          path: 'members/withdrawn/:memberId',
          handle: { title: '탈퇴 회원 상세', section: '회원 관리' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminWithdrawnMemberDetailPage />
            </Suspense>
          ),
        },
        {
          path: 'members/:memberId',
          handle: { title: '회원 상세', section: '회원 관리' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminMemberDetailPage />
            </Suspense>
          ),
        },
        {
          path: 'settings/shipping-discount',
          handle: { title: '배송·할인 설정', section: '운영 설정' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminSettingsPage />
            </Suspense>
          ),
        },
        {
          path: 'coupons',
          handle: { title: '쿠폰 관리', section: '운영 설정' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <AdminCouponsPage />
            </Suspense>
          ),
        },
        {
          path: '*',
          handle: { title: '페이지 없음' },
          element: (
            <Suspense fallback={<p role="status">화면을 불러오고 있습니다.</p>}>
              <NotFoundPage />
            </Suspense>
          ),
        },
      ] satisfies RouteObject[]
    ).map((route) => ({
      ...route,
      errorElement: <AdminPageError />,
    })),
  },
];
