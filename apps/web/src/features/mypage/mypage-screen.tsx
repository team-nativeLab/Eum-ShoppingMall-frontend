'use client';

import { QUOTE_STATUS_META } from '@eum/api/quote-status';
import type {
  Address,
  Claim,
  ClaimStatus,
  ClaimType,
  Coupon,
  Order,
  OrderStatus,
  Point,
  Product,
  Quote,
  QuoteStatus,
} from '@eum/api/types';
import { Badge } from '@eum/ui/components/Badge';
import { Button } from '@eum/ui/components/Button';
import { Checkbox } from '@eum/ui/components/Checkbox';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { Modal } from '@eum/ui/components/Modal';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { Pagination } from '@eum/ui/components/Pagination';
import { TextField } from '@eum/ui/components/TextField';
import { cx } from '@eum/ui/lib/cx';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Heart,
  Info,
  LockKeyhole,
  MapPin,
  Package,
  Plus,
  Search,
  ShoppingBag,
  TicketPercent,
  UserRound,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ProductCard } from '@/features/products/product-card';
import { useLocalCollections } from '@/features/products/local-collections-context';
import { useMemberSession } from '@/features/auth/member-session';
import { getWebApiConfig } from '@/lib/api-config';
import { MyPageActionLink, MyPageShell, type MyPageSection } from './mypage-shell';
import {
  formatMyPageDate,
  formatMyPagePrice,
  getCollectionProductIds,
  useMyPageData,
  type MyPageData,
} from './mypage-data';
import {
  calculateSelectedOrderAmount,
  clampReturnQuantity,
  dateInputValue,
  getInitialClaimOrderId,
  getTrackingProgressIndex,
  isCouponExpired,
  shouldShowQuoteProgress,
  shouldShowPresentationRows,
  subtractMonthsClamped,
} from './mypage-utils';
import {
  DateRangeFilter,
  DividerTitle,
  NoticeResult,
  PageErrorState,
  PageLoadingState,
  StatusBadge,
  TabBar,
  type LocalNotice,
} from './mypage-ui';
import { PasswordChangeDemoModal } from './password-change-demo-modal';

type OrderTab = OrderStatus | 'all';
type ClaimTab = ClaimType | 'all';
type QuoteTab = QuoteStatus | 'all';
type PointTab = 'all' | 'earned' | 'spent' | 'expired';
const SECTION_TITLE: Record<MyPageSection, string> = {
  dashboard: '마이페이지',
  orders: '주문/배송 조회',
  'order-detail': '주문 상세',
  claims: '취소/반품 내역',
  'claim-new': '취소/반품/교환 신청',
  wishlist: '찜한 상품',
  recent: '최근 본 상품',
  coupons: '쿠폰',
  points: '적립금',
  profile: '내 정보 관리',
  'profile-edit': '내 정보 수정',
  addresses: '배송지 관리',
  quotes: '견적 문의 내역',
  'quote-detail': '견적 문의 상세',
};
const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; tone: 'dark' | 'warning' | 'outline' | 'success' | 'neutral' }
> = {
  paymentPending: { label: '입금대기', tone: 'warning' },
  paid: { label: '결제완료', tone: 'neutral' },
  preparing: { label: '배송준비', tone: 'neutral' },
  shipping: { label: '배송중', tone: 'dark' },
  delivered: { label: '배송완료', tone: 'success' },
  canceled: { label: '취소완료', tone: 'neutral' },
};
const CLAIM_STATUS_META: Record<
  ClaimStatus,
  { label: string; tone: 'dark' | 'warning' | 'outline' | 'success' | 'danger' }
> = {
  requested: { label: '신청 접수', tone: 'warning' },
  processing: { label: '처리중', tone: 'dark' },
  completed: { label: '처리 완료', tone: 'success' },
  rejected: { label: '반려', tone: 'danger' },
};
const ORDER_TABS: { value: OrderTab; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'paymentPending', label: '입금대기' },
  { value: 'paid', label: '결제완료' },
  { value: 'preparing', label: '배송준비' },
  { value: 'shipping', label: '배송중' },
  { value: 'delivered', label: '배송완료' },
  { value: 'canceled', label: '취소' },
];
const CLAIM_TABS: { value: ClaimTab; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'cancel', label: '취소' },
  { value: 'return', label: '반품' },
  { value: 'exchange', label: '교환' },
];
const QUOTE_TABS: { value: QuoteTab; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'received', label: '접수' },
  { value: 'consulting', label: '상담중' },
  { value: 'quoteSent', label: '견적 발송' },
  { value: 'completed', label: '완료' },
  { value: 'canceled', label: '취소' },
];
const POINT_TABS: { value: PointTab; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'earned', label: '적립' },
  { value: 'spent', label: '사용' },
  { value: 'expired', label: '소멸' },
];
const ORDER_STAGE_ORDER: OrderStatus[] = [
  'paymentPending',
  'paid',
  'preparing',
  'shipping',
  'delivered',
];
const QUOTE_STAGE_ORDER: QuoteStatus[] = ['received', 'consulting', 'quoteSent', 'completed'];
export function MyPageScreen({ section, itemId }: { section: MyPageSection; itemId?: string }) {
  const addAddressActionRef = useRef<(() => void) | null>(null);
  const { member, status: memberStatus, refreshMember } = useMemberSession();
  const { wishlistIds, recentIds, recentViewedAt } = useLocalCollections();
  const query = useMyPageData(
    getCollectionProductIds(section, wishlistIds, recentIds),
    section,
    member?.id ?? null,
  );
  const dashboardTop =
    section === 'dashboard' && query.data?.member ? (
      <DashboardSummary
        member={query.data.member}
        coupons={query.data.coupons}
        wishlistCount={wishlistIds.length}
        recentCount={recentIds.length}
      />
    ) : undefined;
  return (
    <MyPageShell
      activeSection={section}
      title={SECTION_TITLE[section]}
      dashboardTop={dashboardTop}
      titleAction={
        section === 'addresses' ? (
          <Button
            size="m"
            leadingIcon={<Plus size={18} aria-hidden="true" />}
            className="shrink-0"
            onClick={() => addAddressActionRef.current?.()}
          >
            배송지 추가
          </Button>
        ) : section === 'quotes' ? (
          <MyPageActionLink href="/solutions" variant="primary" size="m" className="shrink-0">
            견적 문의하기
          </MyPageActionLink>
        ) : undefined
      }
    >
      {memberStatus === 'loading' ? (
        <PageLoadingState />
      ) : memberStatus === 'error' ? (
        <PageErrorState onRetry={() => void refreshMember()} />
      ) : !member ? (
        <div
          role="status"
          className="rounded-12 border border-line bg-bg-subtle px-20 py-32 text-center"
        >
          <p className="text-body-s text-text-2">로그인 후 회원 정보를 확인할 수 있습니다.</p>
          <Link
            href="/login?redirect=%2Fmypage"
            className="mt-16 inline-flex min-h-44 items-center justify-center rounded-8 bg-text-1 px-16 text-label-m text-inverse focus-ring"
          >
            로그인
          </Link>
        </div>
      ) : query.isPending ? (
        <PageLoadingState />
      ) : query.isError ? (
        <PageErrorState onRetry={() => void query.refetch()} />
      ) : (
        <>
          {query.data.loadWarnings.length ? (
            <NoticeInline tone="warning" role="status" className="mb-16">
              <div className="flex flex-wrap items-center justify-between gap-8">
                <span>{query.data.loadWarnings.join(' ')}</span>
                <Button size="s" variant="secondary" onClick={() => void query.refetch()}>
                  다시 불러오기
                </Button>
              </div>
            </NoticeInline>
          ) : null}
          <MyPageContent
            data={query.data}
            section={section}
            itemId={itemId}
            wishlistIds={wishlistIds}
            recentIds={recentIds}
            recentViewedAt={recentViewedAt}
            addAddressActionRef={addAddressActionRef}
          />
        </>
      )}
    </MyPageShell>
  );
}

function MyPageContent({
  data,
  section,
  itemId,
  wishlistIds,
  recentIds,
  recentViewedAt,
  addAddressActionRef,
}: {
  data: MyPageData;
  section: MyPageSection;
  itemId?: string;
  wishlistIds: string[];
  recentIds: string[];
  recentViewedAt: Record<string, string>;
  addAddressActionRef: { current: (() => void) | null };
}) {
  if (section === 'wishlist' || section === 'recent') {
    return (
      <ProductCollectionView
        mode={section}
        products={data.products}
        productIds={section === 'wishlist' ? wishlistIds : recentIds}
        unavailableProductIds={data.unavailableProductIds}
        recentViewedAt={recentViewedAt}
      />
    );
  }

  if (!data.member) {
    return (
      <div role="alert" className="rounded-12 border border-line p-20 text-body-s text-text-2">
        회원 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </div>
    );
  }
  const member = data.member;
  const memberData = { ...data, member };

  switch (section) {
    case 'dashboard':
      return <DashboardView data={memberData} />;
    case 'orders':
      return <OrdersView orders={data.orders} />;
    case 'order-detail':
      return <OrderDetailView order={data.orders.find((order) => order.id === itemId)} />;
    case 'claims':
      return <ClaimsView claims={data.claims} orders={data.orders} />;
    case 'claim-new':
      return (
        <ClaimFormView
          key={itemId ?? 'claim-form-default'}
          orders={data.orders}
          addresses={data.addresses}
          preferredOrderId={itemId}
        />
      );
    case 'coupons':
      return <CouponsView coupons={data.coupons} />;
    case 'points':
      return <PointsView memberBalance={member.pointBalance} points={data.points} />;
    case 'profile':
      return <ProfileView member={member} />;
    case 'profile-edit':
      return <ProfileView member={member} editable />;
    case 'addresses':
      return <AddressesView addresses={data.addresses} addAddressActionRef={addAddressActionRef} />;
    case 'quotes':
      return <QuotesView quotes={data.quotes} />;
    case 'quote-detail':
      return (
        <QuoteDetailView
          quote={data.quotes.find((quote) => quote.id === itemId)}
          memberEmail={member.email}
        />
      );
  }
}

function DashboardSummary({
  member,
  coupons,
  wishlistCount,
  recentCount,
}: {
  member: NonNullable<MyPageData['member']>;
  coupons: Coupon[];
  wishlistCount: number;
  recentCount: number;
}) {
  const today = dateInputValue(new Date());
  const availableCouponCount = coupons.filter(
    (coupon) => !coupon.isUsed && !isCouponExpired(coupon, today),
  ).length;
  return (
    <section className="mb-24 flex flex-col gap-20 rounded-12 border border-line bg-surface px-20 py-20 sm:flex-row sm:items-center sm:justify-between lg:mb-32 lg:px-32 lg:py-28">
      <div className="flex min-w-0 items-center gap-16">
        <div className="flex size-56 shrink-0 items-center justify-center rounded-capsule bg-surface-2 text-text-2">
          <UserRound size={28} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-8">
            <h2 className="text-h2">{member.name}님</h2>
            <Badge tone="neutral">회원</Badge>
          </div>
          <p className="mt-4 text-body-s break-all text-text-3">{member.email}</p>
        </div>
      </div>
      <dl className="grid grid-cols-4 divide-x divide-line border-t border-line pt-16 text-center sm:w-[440px] sm:border-t-0 sm:pt-0">
        {[
          { label: '쿠폰', value: availableCouponCount, href: '/mypage/coupons' },
          { label: '적립금', value: member.pointBalance, href: '/mypage/points' },
          { label: '찜', value: wishlistCount, href: '/mypage/wishlist' },
          { label: '최근 본', value: recentCount, href: '/mypage/recent' },
        ].map((stat) => (
          <div key={stat.label} className="px-4">
            <dt className="text-caption text-text-3">{stat.label}</dt>
            <dd className="mt-4 text-h2 tabular-nums">
              <Link href={stat.href} className="rounded-4 focus-ring hover:underline">
                {new Intl.NumberFormat('ko-KR').format(stat.value)}
              </Link>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DashboardView({
  data,
}: {
  data: MyPageData & { member: NonNullable<MyPageData['member']> };
}) {
  const orderProgress = ORDER_STAGE_ORDER.map((status) => ({
    status,
    count: data.orders.filter((order) => order.status === status).length,
  }));
  return (
    <div className="space-y-24 lg:space-y-32">
      <section className="rounded-12 border border-line px-16 py-20 lg:px-32 lg:py-28">
        <h2 className="text-h3">주문 현황</h2>
        <ol className="mt-20 grid grid-cols-2 gap-y-20 sm:grid-cols-5 sm:gap-12">
          {orderProgress.map(({ status, count }, index) => (
            <li key={status} className="relative flex min-w-0 flex-col items-center text-center">
              {index > 0 ? (
                <ChevronRight
                  className="absolute top-8 -left-8 hidden text-text-3 sm:block"
                  size={18}
                  aria-hidden="true"
                />
              ) : null}
              <Link href="/mypage/orders" className="rounded-4 focus-ring">
                <span className="block text-h2 tabular-nums">{count}</span>
                <span className="mt-4 block text-caption text-text-2">
                  {ORDER_STATUS_META[status].label}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <div className="mb-12 flex items-center justify-between gap-12">
          <h2 className="text-h3">최근 주문</h2>
          <Link
            href="/mypage/orders"
            className="inline-flex items-center gap-4 rounded-4 text-label-s focus-ring hover:underline"
          >
            전체 보기 <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        {data.orders.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="주문 내역이 없습니다."
            description="상품을 둘러보고 필요한 안전용품을 찾아보세요."
            action={
              <MyPageActionLink href="/" variant="primary">
                상품 보러 가기
              </MyPageActionLink>
            }
          />
        ) : (
          <div className="space-y-12">
            {data.orders.slice(0, 2).map((order) => (
              <OrderCard key={order.id} order={order} compact />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function OrderCard({ order, compact = false }: { order: Order; compact?: boolean }) {
  const firstLine = order.lines[0];
  const lineSummary = firstLine
    ? `${firstLine.productName}${order.lines.length > 1 ? ` 외 ${order.lines.length - 1}건` : ''}`
    : '상품 정보가 없습니다.';
  return (
    <article className="rounded-12 border border-line px-16 py-16 lg:px-24 lg:py-20">
      <div className="flex flex-wrap items-center justify-between gap-8 border-b border-line pb-12">
        <div className="flex flex-wrap items-center gap-10">
          <time className="text-label-m">{formatMyPageDate(order.orderedAt)}</time>
          <span className="text-caption text-text-3">주문번호 {order.orderNumber}</span>
        </div>
        <Link
          href={`/mypage/orders/${encodeURIComponent(order.id)}`}
          className="inline-flex items-center gap-4 rounded-4 text-label-s focus-ring hover:underline"
        >
          주문 상세 <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-16 flex flex-col gap-16 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-12">
          <div
            aria-hidden="true"
            className="flex size-64 shrink-0 items-center justify-center rounded-8 bg-surface text-text-3"
          >
            <Package size={24} />
          </div>
          <div className="min-w-0">
            <StatusBadge {...ORDER_STATUS_META[order.status]} />
            <p className="mt-6 truncate text-label-m">{lineSummary}</p>
            {firstLine ? (
              <p className="mt-4 text-caption text-text-2">
                {formatMyPagePrice(firstLine.unitPrice)} · {firstLine.quantity}개
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-8 sm:justify-end">
          {!compact && ['shipping', 'delivered'].includes(order.status) ? (
            <TrackingButton order={order} />
          ) : null}
          {!compact && ['shipping', 'delivered'].includes(order.status) ? (
            <MyPageActionLink href={`/mypage/claims/new?orderId=${encodeURIComponent(order.id)}`}>
              교환/반품
            </MyPageActionLink>
          ) : null}
          {!compact && ['paymentPending', 'paid'].includes(order.status) ? (
            <CancelOrderButton order={order} />
          ) : null}
          <span className="min-w-104 text-right text-price-m">
            {formatMyPagePrice(order.paymentTotal)}
          </span>
        </div>
      </div>
    </article>
  );
}

function TrackingButton({ order }: { order: Order }) {
  const [isOpen, setIsOpen] = useState(false);
  const activeIndex = getTrackingProgressIndex(order.status);
  const shipmentSteps = ['결제완료', '상품준비', '배송시작', '배송중', '배송완료'];
  return (
    <>
      <Button size="s" variant="secondary" onClick={() => setIsOpen(true)}>
        배송 조회
      </Button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="배송 조회"
        className="relative max-w-560"
        actions={<Button onClick={() => setIsOpen(false)}>확인</Button>}
      >
        <button
          type="button"
          aria-label="배송 조회 닫기"
          onClick={() => setIsOpen(false)}
          className="absolute top-20 right-20 rounded-4 p-4 text-text-2 focus-ring hover:text-text-1"
        >
          <X size={20} aria-hidden="true" />
        </button>
        <div className="mt-20 rounded-12 bg-surface px-16 py-16">
          <dl className="grid gap-12 sm:grid-cols-3">
            {[
              ['도착 예정일', '목 데이터에 미제공'],
              ['택배사', '목 데이터에 미제공'],
              ['송장 번호', '목 데이터에 미제공'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-caption text-text-3">{label}</dt>
                <dd className="mt-4 text-label-m">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-12 border-t border-line pt-12 text-caption text-text-2">
            주문번호 {order.orderNumber} · 배송 정보는 현재 목 데이터에 연결되어 있지 않습니다.
          </p>
        </div>
        <ol aria-label="배송 진행 5단계" className="mt-24 grid grid-cols-5 gap-4">
          {shipmentSteps.map((step, index) => {
            const complete = index <= activeIndex;
            return (
              <li key={step} className="relative min-w-0 text-center">
                {index < shipmentSteps.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className={cx(
                      'absolute top-10 left-1/2 h-2 w-full',
                      index < activeIndex ? 'bg-text-1' : 'bg-line',
                    )}
                  />
                ) : null}
                <span
                  className={cx(
                    'relative z-1 mx-auto flex size-24 items-center justify-center rounded-capsule border bg-bg',
                    complete
                      ? 'border-text-1 bg-text-1 text-inverse'
                      : 'border-line-strong text-text-3',
                  )}
                >
                  {complete ? <Check size={14} aria-hidden="true" /> : index + 1}
                </span>
                <span
                  className={cx(
                    'mt-8 block text-caption break-keep',
                    complete ? 'text-text-1' : 'text-text-3',
                  )}
                >
                  {step}
                </span>
              </li>
            );
          })}
        </ol>
        <section className="mt-24 border-t border-line pt-16">
          <h3 className="text-label-m">배송 진행 내역</h3>
          <ol className="mt-12 space-y-0">
            {shipmentSteps.map((step) => (
              <li
                key={step}
                className="flex min-h-48 items-center gap-12 border-b border-line py-10"
              >
                <span
                  className="size-8 shrink-0 rounded-capsule bg-line-strong"
                  aria-hidden="true"
                />
                <span className="min-w-100 text-body-s">{step}</span>
                <span className="text-caption text-text-3">배송 이력 미제공</span>
              </li>
            ))}
          </ol>
        </section>
      </Modal>
    </>
  );
}

function CancelOrderButton({ order }: { order: Order }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notice, setNotice] = useState<LocalNotice>(null);
  return (
    <>
      <Button size="s" variant="secondary" onClick={() => setIsOpen(true)}>
        주문 취소
      </Button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="주문을 취소하시겠습니까?"
        description="현재 화면은 목 데이터로 동작합니다. 실제 주문 상태는 변경되지 않습니다."
        tone="danger"
        actions={
          <>
            <Button variant="secondary" onClick={() => setIsOpen(false)}>
              돌아가기
            </Button>
            <Button
              onClick={() => {
                setNotice({
                  tone: 'info',
                  message: '목 화면에서는 실제 주문 취소가 처리되지 않습니다.',
                });
                setIsOpen(false);
              }}
            >
              확인
            </Button>
          </>
        }
      >
        <p className="mt-16 text-body-s text-text-2">주문번호 {order.orderNumber}</p>
      </Modal>
      <NoticeResult notice={notice} />
    </>
  );
}

function OrdersView({ orders }: { orders: Order[] }) {
  const today = new Date();
  const [startDate, setStartDate] = useState(() => dateInputValue(subtractMonthsClamped(today, 1)));
  const [endDate, setEndDate] = useState(() => dateInputValue(today));
  const [selectedPreset, setSelectedPreset] = useState<number | null>(1);
  const [appliedRange, setAppliedRange] = useState(() => ({
    start: dateInputValue(subtractMonthsClamped(today, 1)),
    end: dateInputValue(today),
  }));
  const [tab, setTab] = useState<OrderTab>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const dateFilteredOrders = orders.filter((order) => {
    const day = dateInputValue(new Date(order.orderedAt));
    return day >= appliedRange.start && day <= appliedRange.end;
  });
  const visibleOrders = dateFilteredOrders.filter((order) => tab === 'all' || order.status === tab);
  const pageOrders = visibleOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showLayoutSamples =
    shouldShowPresentationRows(getWebApiConfig().mode) &&
    appliedRange.start === dateInputValue(subtractMonthsClamped(today, 1)) &&
    appliedRange.end === dateInputValue(today) &&
    (tab === 'all' || tab === 'paymentPending' || tab === 'paid');
  const presetRange = (months: number) => {
    const now = new Date();
    setStartDate(dateInputValue(subtractMonthsClamped(now, months)));
    setEndDate(dateInputValue(now));
    setCurrentPage(1);
  };
  const counts = Object.fromEntries(
    ORDER_TABS.map((item) => [
      item.value,
      item.value === 'all'
        ? dateFilteredOrders.length
        : dateFilteredOrders.filter((order) => order.status === item.value).length,
    ]),
  );
  return (
    <div className="space-y-16 lg:space-y-20">
      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={(value) => {
          setStartDate(value);
          setSelectedPreset(null);
          setCurrentPage(1);
        }}
        onEndDateChange={(value) => {
          setEndDate(value);
          setSelectedPreset(null);
          setCurrentPage(1);
        }}
        selectedPreset={selectedPreset}
        onPreset={(months) => {
          setSelectedPreset(months);
          presetRange(months);
        }}
        onApply={() => {
          setAppliedRange({ start: startDate, end: endDate });
          setCurrentPage(1);
        }}
      />
      <TabBar
        options={ORDER_TABS}
        value={tab}
        onChange={(next) => {
          setTab(next);
          setCurrentPage(1);
        }}
        label="주문 상태"
        counts={counts}
      />
      {pageOrders.length === 0 && !showLayoutSamples ? (
        <EmptyState
          icon={ShoppingBag}
          title="주문 내역이 없습니다."
          description="선택한 기간과 상태에 해당하는 주문이 없습니다."
          action={
            <MyPageActionLink href="/" variant="primary">
              상품 보러 가기
            </MyPageActionLink>
          }
        />
      ) : (
        <div className="space-y-12">
          {pageOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
          {showLayoutSamples && (tab === 'all' || tab === 'paymentPending') ? (
            <OrderLayoutSampleCard status="paymentPending" />
          ) : null}
          {showLayoutSamples && (tab === 'all' || tab === 'paid') ? (
            <OrderLayoutSampleCard status="paid" />
          ) : null}
        </div>
      )}
      <Pagination
        currentPage={currentPage}
        totalPages={Math.ceil(visibleOrders.length / pageSize)}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}

function OrderLayoutSampleCard({ status }: { status: 'paymentPending' | 'paid' }) {
  return (
    <article className="rounded-12 border border-line px-16 py-16 lg:px-24 lg:py-20">
      <div className="flex flex-wrap items-center justify-between gap-8 border-b border-line pb-12">
        <div className="flex flex-wrap items-center gap-10">
          <time className="text-label-m">0000.00.00</time>
          <span className="text-caption text-text-3">주문번호 0000000000</span>
        </div>
        <span className="text-label-s text-text-2">주문 상세</span>
      </div>
      <div className="mt-16 flex flex-col gap-16 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-12">
          <div aria-hidden="true" className="size-64 shrink-0 rounded-8 bg-surface" />
          <div className="min-w-0">
            <StatusBadge {...ORDER_STATUS_META[status]} />
            <p className="mt-6 truncate text-label-m">제품명</p>
            <p className="mt-4 text-caption text-text-2">₩00,000 · 1개</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-8 sm:justify-end">
          <Button size="s" variant="secondary" disabled>
            주문 취소
          </Button>
          <span className="min-w-104 text-right text-price-m">₩00,000</span>
        </div>
      </div>
    </article>
  );
}

function OrderDetailView({ order }: { order?: Order }) {
  const router = useRouter();
  if (!order)
    return (
      <EmptyState
        icon={Package}
        title="주문을 찾을 수 없습니다."
        action={
          <Button variant="secondary" onClick={() => router.push('/mypage/orders')}>
            주문 목록으로
          </Button>
        }
      />
    );
  const address = order.shippingAddress;
  return (
    <div className="space-y-20 lg:space-y-24">
      <div className="flex flex-wrap items-center justify-between gap-8">
        <StatusBadge {...ORDER_STATUS_META[order.status]} />
        <p className="text-body-s text-text-3">
          {formatMyPageDate(order.orderedAt)} 주문 · 주문번호 {order.orderNumber}
        </p>
      </div>
      <section>
        <DividerTitle>주문 상품</DividerTitle>
        <div className="hidden grid-cols-[minmax(0,1fr)_72px_120px_96px_104px] gap-12 border-b border-line-strong bg-surface px-16 py-12 text-label-s text-text-2 lg:grid">
          <span>상품정보</span>
          <span className="text-center">수량</span>
          <span className="text-right">상품 금액</span>
          <span className="text-center">상태</span>
          <span className="text-center">관리</span>
        </div>
        <ul className="divide-y divide-line">
          {order.lines.map((line, index) => (
            <li
              key={`${line.productId}-${index}`}
              className="grid gap-12 py-16 lg:grid-cols-[minmax(0,1fr)_72px_120px_96px_104px] lg:items-center lg:px-16"
            >
              <div className="flex min-w-0 items-center gap-12">
                <div
                  aria-hidden="true"
                  className="flex size-56 shrink-0 items-center justify-center rounded-8 bg-surface text-text-3"
                >
                  <Package size={22} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-label-m">{line.productName}</p>
                  <p className="mt-4 text-caption text-text-3">상품번호 {line.productId}</p>
                </div>
              </div>
              <p className="text-body-s lg:text-center">수량 {line.quantity}개</p>
              <p className="text-label-m lg:text-right">
                {formatMyPagePrice(line.unitPrice * line.quantity)}
              </p>
              <div className="lg:justify-self-center">
                <StatusBadge {...ORDER_STATUS_META[order.status]} />
              </div>
              <div className="flex flex-wrap gap-8 lg:flex-col">
                {['shipping', 'delivered'].includes(order.status) ? (
                  <TrackingButton order={order} />
                ) : null}
                {['shipping', 'delivered'].includes(order.status) ? (
                  <MyPageActionLink
                    href={`/mypage/claims/new?orderId=${encodeURIComponent(order.id)}`}
                  >
                    교환/반품
                  </MyPageActionLink>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-12 border border-line p-16 lg:p-24">
        <h2 className="text-h3">배송지 정보</h2>
        <dl className="mt-16 grid gap-12 text-body-s sm:grid-cols-[120px_minmax(0,1fr)]">
          <dt className="text-text-3">받는 분</dt>
          <dd>{address.recipientName}</dd>
          <dt className="text-text-3">연락처</dt>
          <dd>{address.phone}</dd>
          <dt className="text-text-3">주소</dt>
          <dd>
            {address.postalCode} {address.address1} {address.address2}
          </dd>
        </dl>
      </section>
      <section className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
        <div className="rounded-12 border border-line p-16 lg:p-24">
          <h2 className="text-h3">결제 정보</h2>
          <dl className="mt-16 space-y-10 text-body-s">
            <PriceRow label="상품 금액" amount={order.productTotal} />
            <PriceRow label="배송비" amount={order.shippingFee} />
            <PriceRow label="쿠폰 할인" amount={-order.discountTotal} />
            <PriceRow label="적립금 사용" amount={-order.pointUsed} />
          </dl>
        </div>
        <div className="rounded-12 bg-surface p-16 lg:p-24">
          <p className="text-label-m">총 결제 금액</p>
          <p className="mt-8 text-web-price-xl">{formatMyPagePrice(order.paymentTotal)}</p>
          <p className="mt-12 border-t border-line pt-12 text-body-s text-text-2">
            결제 수단 정보는 목 데이터에서 제공하지 않습니다.
          </p>
        </div>
      </section>
      <section>
        <DividerTitle>증빙 서류</DividerTitle>
        <div className="mt-12 flex flex-wrap items-center gap-8">
          <Button variant="secondary" disabled>
            거래명세서 출력
          </Button>
          <Button variant="secondary" disabled>
            영수증 출력
          </Button>
          <span className="text-caption text-text-3">
            증빙 서류는 현재 목 데이터에서 제공하지 않습니다.
          </span>
        </div>
      </section>
      <div className="flex justify-center">
        <Button size="l" variant="secondary" onClick={() => router.push('/mypage/orders')}>
          목록으로
        </Button>
      </div>
    </div>
  );
}

function PriceRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between gap-12">
      <dt className="text-text-2">{label}</dt>
      <dd className="tabular-nums">
        {amount < 0 ? `-${formatMyPagePrice(Math.abs(amount))}` : formatMyPagePrice(amount)}
      </dd>
    </div>
  );
}

function ClaimsView({ claims, orders }: { claims: Claim[]; orders: Order[] }) {
  const today = new Date();
  const [startDate, setStartDate] = useState(() => dateInputValue(subtractMonthsClamped(today, 1)));
  const [endDate, setEndDate] = useState(() => dateInputValue(today));
  const [selectedPreset, setSelectedPreset] = useState<number | null>(1);
  const [appliedRange, setAppliedRange] = useState(() => ({
    start: dateInputValue(subtractMonthsClamped(today, 1)),
    end: dateInputValue(today),
  }));
  const [tab, setTab] = useState<ClaimTab>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const labels: Record<ClaimType, string> = { cancel: '취소', return: '반품', exchange: '교환' };
  const dateFilteredClaims = claims.filter((claim) => {
    const day = dateInputValue(new Date(claim.requestedAt));
    return day >= appliedRange.start && day <= appliedRange.end;
  });
  const filteredClaims = dateFilteredClaims.filter((claim) => tab === 'all' || claim.type === tab);
  const pageClaims = filteredClaims.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showLayoutSamples =
    shouldShowPresentationRows(getWebApiConfig().mode) &&
    appliedRange.start === dateInputValue(subtractMonthsClamped(today, 1)) &&
    appliedRange.end === dateInputValue(today);
  const claimLayoutSamples = [
    {
      key: 'claim-layout-requested',
      type: 'return' as const,
      status: 'requested' as const,
      statusLabel: '반품 요청',
      action: '신청 철회',
      refund: '₩00,000',
    },
    {
      key: 'claim-layout-recovery',
      type: 'return' as const,
      status: 'processing' as const,
      statusLabel: '회수중',
      action: '신청 상세',
      refund: '₩00,000',
    },
    {
      key: 'claim-layout-cancelled',
      type: 'cancel' as const,
      status: 'completed' as const,
      statusLabel: '취소 완료',
      action: '신청 상세',
      refund: '₩00,000',
    },
    {
      key: 'claim-layout-rejected',
      type: 'return' as const,
      status: 'rejected' as const,
      statusLabel: '반려',
      action: '반려 사유',
      refund: '₩00,000',
    },
  ];
  const displayClaims = [
    ...pageClaims.map((claim) => ({ kind: 'claim' as const, claim })),
    ...(showLayoutSamples
      ? claimLayoutSamples
          .filter((claim) => tab === 'all' || claim.type === tab)
          .map((claim) => ({ kind: 'sample' as const, claim }))
      : []),
  ];
  const counts = Object.fromEntries(
    CLAIM_TABS.map((item) => [
      item.value,
      item.value === 'all'
        ? dateFilteredClaims.length
        : dateFilteredClaims.filter((claim) => claim.type === item.value).length,
    ]),
  );
  return (
    <div className="space-y-16 lg:space-y-20">
      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={(value) => {
          setStartDate(value);
          setSelectedPreset(null);
          setCurrentPage(1);
        }}
        onEndDateChange={(value) => {
          setEndDate(value);
          setSelectedPreset(null);
          setCurrentPage(1);
        }}
        selectedPreset={selectedPreset}
        onPreset={(months) => {
          const now = new Date();
          setSelectedPreset(months);
          setStartDate(dateInputValue(subtractMonthsClamped(now, months)));
          setEndDate(dateInputValue(now));
          setCurrentPage(1);
        }}
        onApply={() => {
          setAppliedRange({ start: startDate, end: endDate });
          setCurrentPage(1);
        }}
      />
      <TabBar
        options={CLAIM_TABS}
        value={tab}
        onChange={(next) => {
          setTab(next);
          setCurrentPage(1);
        }}
        label="신청 종류"
        counts={counts}
      />
      {displayClaims.length === 0 ? (
        <EmptyState
          icon={Package}
          title="신청 내역이 없습니다."
          description="주문 내역에서 취소·반품·교환을 신청할 수 있습니다."
          action={
            <MyPageActionLink href="/mypage/orders" variant="primary">
              주문 내역 보기
            </MyPageActionLink>
          }
        />
      ) : (
        <>
          <div className="hidden grid-cols-[128px_52px_minmax(140px,1.2fr)_minmax(132px,1fr)_72px_58px_112px_96px_104px] gap-12 border-y border-line bg-surface px-12 py-12 text-label-s text-text-2 lg:grid">
            <span>신청일 · 주문번호</span>
            <span aria-hidden="true" />
            <span>상품 정보</span>
            <span>신청 사유</span>
            <span>구분</span>
            <span className="text-center">수량</span>
            <span className="text-right">환불 금액</span>
            <span>상태</span>
            <span className="text-center">관리</span>
          </div>
          <ul className="divide-y divide-line">
            {displayClaims.map((row) => {
              if (row.kind === 'sample') {
                return (
                  <li
                    key={row.claim.key}
                    className="grid gap-10 py-16 lg:grid-cols-[128px_52px_minmax(140px,1.2fr)_minmax(132px,1fr)_72px_58px_112px_96px_104px] lg:items-center lg:px-12"
                  >
                    <div>
                      <time className="text-body-s">0000.00.00</time>
                      <p className="mt-4 text-caption text-text-3">0000000000</p>
                    </div>
                    <div
                      aria-hidden="true"
                      className="flex size-48 items-center justify-center rounded-8 bg-surface text-text-3"
                    >
                      <Package size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-label-m">제품명</p>
                      <p className="mt-4 truncate text-caption text-text-3">옵션명</p>
                    </div>
                    <p className="truncate text-body-s text-text-2">—</p>
                    <p className="text-body-s">{labels[row.claim.type]}</p>
                    <p className="text-body-s lg:text-center">0개</p>
                    <p className="text-body-s lg:text-right">{row.claim.refund}</p>
                    <div>
                      <StatusBadge
                        label={row.claim.statusLabel}
                        tone={CLAIM_STATUS_META[row.claim.status].tone}
                      />
                    </div>
                    <div className="lg:justify-self-center">
                      <Button size="s" variant="secondary" disabled>
                        {row.claim.action}
                      </Button>
                    </div>
                  </li>
                );
              }
              const claim = row.claim;
              const order = orders.find((candidate) => candidate.id === claim.orderId);
              return (
                <li
                  key={claim.id}
                  className="grid gap-10 py-16 lg:grid-cols-[128px_52px_minmax(140px,1.2fr)_minmax(132px,1fr)_72px_58px_112px_96px_104px] lg:items-center lg:px-12"
                >
                  <div>
                    <time className="text-body-s">{formatMyPageDate(claim.requestedAt)}</time>
                    <p className="mt-4 text-caption text-text-3">
                      {order?.orderNumber ?? claim.orderId}
                    </p>
                  </div>
                  <div
                    aria-hidden="true"
                    className="flex size-48 items-center justify-center rounded-8 bg-surface text-text-3"
                  >
                    <Package size={20} />
                  </div>
                  <p className="truncate text-label-m">
                    {order?.lines.length
                      ? order.lines.map((line) => line.productName).join(', ')
                      : '상품 정보 미제공'}
                  </p>
                  <p className="truncate text-body-s text-text-2">{claim.reason}</p>
                  <p className="text-body-s">{labels[claim.type]}</p>
                  <p className="text-body-s lg:text-center">{order?.lines[0]?.quantity ?? '—'}개</p>
                  <p className="text-body-s text-text-3 lg:text-right">미제공</p>
                  <div>
                    <StatusBadge {...CLAIM_STATUS_META[claim.status]} />
                  </div>
                  <div className="lg:justify-self-center">
                    <Link
                      href={`/mypage/claims/${encodeURIComponent(claim.id)}`}
                      className="inline-flex min-h-44 items-center justify-center rounded-8 border border-line-strong px-12 text-label-m focus-ring"
                    >
                      신청 상세
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {filteredClaims.length > pageSize ? (
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(filteredClaims.length / pageSize)}
          onPageChange={setCurrentPage}
        />
      ) : null}
    </div>
  );
}

function ClaimFormView({
  orders,
  addresses,
  preferredOrderId,
}: {
  orders: Order[];
  addresses: Address[];
  preferredOrderId?: string;
}) {
  const router = useRouter();
  const eligible = orders.filter(
    (order) => order.status === 'shipping' || order.status === 'delivered',
  );
  const [orderId, setOrderId] = useState(() =>
    getInitialClaimOrderId(
      eligible.map((order) => order.id),
      preferredOrderId,
    ),
  );
  const [claimType, setClaimType] = useState<ClaimType>('return');
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [fileName, setFileName] = useState('');
  const [returnMethod, setReturnMethod] = useState<'pickup' | 'direct'>('pickup');
  const [addressId, setAddressId] = useState(
    addresses.find((address) => address.isDefault)?.id ?? addresses[0]?.id ?? '',
  );
  const [isSubmitted, setIsSubmitted] = useState(false);
  const order = eligible.find((candidate) => candidate.id === orderId);
  const reasonOptions =
    claimType === 'cancel'
      ? ['주문 변경', '주문 실수', '배송 지연', '기타']
      : ['단순 변심', '상품 불량·파손', '오배송', '배송 지연', '기타'];
  const selectedAmount = calculateSelectedOrderAmount(
    order?.lines ?? [],
    selectedLines,
    claimType === 'return' ? returnQuantities : {},
  );
  const isReasonValid = reasonOptions.includes(reason);
  const needsReturnAddress = claimType !== 'cancel';
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      order &&
      selectedLines.length > 0 &&
      isReasonValid &&
      details.trim() &&
      (!needsReturnAddress ||
        (Boolean(returnMethod) && addresses.some((address) => address.id === addressId)))
    )
      setIsSubmitted(true);
  };

  if (!eligible.length)
    return (
      <EmptyState
        icon={Package}
        title="신청 가능한 주문이 없습니다."
        description="배송 중이거나 배송 완료된 주문이 있을 때 신청할 수 있습니다."
        action={
          <MyPageActionLink href="/mypage/orders" variant="primary">
            주문 내역 보기
          </MyPageActionLink>
        }
      />
    );
  if (isSubmitted)
    return (
      <div className="mx-auto max-w-560 rounded-12 border border-line p-24 text-center lg:p-40">
        <div className="mx-auto flex size-56 items-center justify-center rounded-capsule bg-success-tint text-success">
          <Check size={28} aria-hidden="true" />
        </div>
        <h2 className="mt-16 text-h3">신청서 입력을 마쳤습니다.</h2>
        <p className="mt-8 text-body-s text-text-2">
          목 화면이라 신청 내용은 저장되거나 접수되지 않았습니다.
        </p>
        <Button className="mt-24" onClick={() => router.push('/mypage/claims')}>
          신청 내역 보기
        </Button>
      </div>
    );

  return (
    <form onSubmit={handleSubmit} className="space-y-20">
      <div className="flex flex-wrap items-center gap-8 text-body-s text-text-2">
        <span>주문번호</span>
        <div className="relative max-w-full">
          <select
            aria-label="주문 선택"
            value={orderId}
            onChange={(event) => {
              setOrderId(event.target.value);
              setSelectedLines([]);
              setReturnQuantities({});
            }}
            className="h-40 max-w-full appearance-none rounded-8 border border-line-strong bg-bg pr-40 pl-12 text-body-s focus-ring"
          >
            <option value="">주문을 선택해 주세요</option>
            {eligible.map((option) => (
              <option key={option.id} value={option.id}>
                {option.orderNumber} · {formatMyPageDate(option.orderedAt)}
              </option>
            ))}
          </select>
          <ChevronDown
            size={20}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-14 -translate-y-1/2 text-text-1"
          />
        </div>
      </div>
      {!order && preferredOrderId ? (
        <NoticeInline tone="warning" role="status">
          요청한 주문을 찾을 수 없습니다. 신청할 주문을 직접 선택해 주세요.
        </NoticeInline>
      ) : null}
      {order ? (
        <>
          <TabBar
            options={[
              { value: 'cancel', label: '취소' },
              { value: 'return', label: '반품' },
              { value: 'exchange', label: '교환' },
            ]}
            value={claimType}
            onChange={(nextType) => {
              setClaimType(nextType);
              setReason('');
            }}
            label="신청 종류"
          />
          <ClaimFormSection title="상품 선택">
            <ul className="divide-y divide-line">
              {order.lines.map((line, index) => {
                const lineId = `${line.productId}-${index}`;
                const isSelected = selectedLines.includes(lineId);
                const selectedQuantity = clampReturnQuantity(
                  returnQuantities[lineId] ?? line.quantity,
                  line.quantity,
                );
                return (
                  <li key={lineId} className="flex flex-wrap items-center gap-12 py-14">
                    <Checkbox
                      aria-label={`${line.productName} 선택`}
                      checked={isSelected}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedLines((previous) =>
                            previous.includes(lineId) ? previous : [...previous, lineId],
                          );
                          setReturnQuantities((previous) => ({
                            ...previous,
                            [lineId]: previous[lineId] ?? line.quantity,
                          }));
                          return;
                        }
                        setSelectedLines((previous) => previous.filter((id) => id !== lineId));
                        setReturnQuantities((previous) => {
                          const next = { ...previous };
                          delete next[lineId];
                          return next;
                        });
                      }}
                    />
                    <div
                      aria-hidden="true"
                      className="flex size-48 shrink-0 items-center justify-center rounded-8 bg-surface text-text-3"
                    >
                      <Package size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-label-m">{line.productName}</p>
                      <p className="mt-4 text-caption text-text-2">
                        주문 {line.quantity}개 · {formatMyPagePrice(line.unitPrice)}
                      </p>
                    </div>
                    {claimType === 'return' && isSelected ? (
                      <div className="ml-auto flex shrink-0 items-center gap-8">
                        <Button
                          type="button"
                          size="s"
                          variant="secondary"
                          aria-label={`${line.productName} 수량 감소`}
                          disabled={selectedQuantity <= 1}
                          onClick={() =>
                            setReturnQuantities((previous) => ({
                              ...previous,
                              [lineId]: clampReturnQuantity(selectedQuantity - 1, line.quantity),
                            }))
                          }
                        >
                          −
                        </Button>
                        <span aria-live="polite" className="min-w-32 text-center text-body-s">
                          {selectedQuantity}개
                        </span>
                        <Button
                          type="button"
                          size="s"
                          variant="secondary"
                          aria-label={`${line.productName} 수량 증가`}
                          disabled={selectedQuantity >= line.quantity}
                          onClick={() =>
                            setReturnQuantities((previous) => ({
                              ...previous,
                              [lineId]: clampReturnQuantity(selectedQuantity + 1, line.quantity),
                            }))
                          }
                        >
                          +
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </ClaimFormSection>
          <ClaimFormSection title="사유">
            <div
              role="radiogroup"
              aria-label="사유"
              className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4"
            >
              {reasonOptions.map((option) => (
                <label
                  key={option}
                  className={cx(
                    'flex min-h-44 cursor-pointer items-center justify-center rounded-8 border px-12 text-center text-body-s focus-within:ring-2 focus-within:ring-text-1',
                    reason === option
                      ? 'border-text-1 bg-bg text-text-1'
                      : reason
                        ? 'border-line bg-surface text-text-2'
                        : 'border-line bg-bg text-text-1',
                  )}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="claim-reason"
                    value={option}
                    checked={reason === option}
                    onChange={() => setReason(option)}
                  />
                  {option}
                </label>
              ))}
            </div>
            <label className="mt-12 block">
              <span className="sr-only">상세 사유</span>
              <textarea
                value={details}
                maxLength={500}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="상세 사유를 입력해 주세요."
                className="min-h-104 w-full resize-y rounded-8 border border-line-strong p-12 text-body-s outline-none placeholder:text-text-3 focus:border-text-1 focus:ring-1 focus:ring-text-1"
              />
              <span className="mt-4 block text-right text-caption text-text-3">
                {details.length}/500
              </span>
            </label>
          </ClaimFormSection>
          <ClaimFormSection title="사진 첨부">
            <label className="mt-12 flex min-h-96 cursor-pointer flex-col items-center justify-center rounded-8 border border-dashed border-line-strong px-16 py-20 text-center focus-within:ring-2 focus-within:ring-text-1">
              <ArrowDownToLine size={20} aria-hidden="true" className="text-text-2" />
              <span className="mt-8 text-body-s">사진을 선택해 첨부할 수 있습니다.</span>
              <span className="mt-4 text-caption text-text-3">
                선택한 파일명만 이 화면에 표시됩니다.
              </span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => setFileName(event.target.files?.[0]?.name ?? '')}
              />
            </label>
            {fileName ? (
              <p className="mt-8 flex items-center gap-6 text-caption text-text-2">
                <Info size={14} aria-hidden="true" />
                {fileName}
              </p>
            ) : null}
          </ClaimFormSection>
          {needsReturnAddress ? (
            <ClaimFormSection title="상품 회수 방법">
              <div className="mt-12 grid gap-8 sm:grid-cols-2">
                {[
                  { value: 'pickup' as const, label: '택배 회수 신청' },
                  { value: 'direct' as const, label: '직접 발송' },
                ].map((method) => (
                  <label
                    key={method.value}
                    className={cx(
                      'flex min-h-48 cursor-pointer items-center gap-8 rounded-8 border px-14 text-body-s focus-within:ring-2 focus-within:ring-text-1',
                      returnMethod === method.value ? 'border-text-1' : 'border-line',
                    )}
                  >
                    <input
                      type="radio"
                      name="return-method"
                      value={method.value}
                      checked={returnMethod === method.value}
                      onChange={() => setReturnMethod(method.value)}
                    />
                    {method.label}
                  </label>
                ))}
              </div>
              <label className="mt-16 block max-w-560">
                <span className="mb-8 block text-label-m">회수 주소</span>
                {addresses.length ? (
                  <div className="relative w-full">
                    <select
                      aria-label="회수 주소 선택"
                      value={addressId}
                      onChange={(event) => setAddressId(event.target.value)}
                      className="h-48 w-full appearance-none rounded-8 border border-line-strong bg-bg pr-40 pl-14 text-body-m focus-ring"
                    >
                      {addresses.map((address) => (
                        <option key={address.id} value={address.id}>
                          {address.label} · {address.recipientName} · {address.address1}{' '}
                          {address.address2}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={20}
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 right-14 -translate-y-1/2 text-text-1"
                    />
                  </div>
                ) : (
                  <span className="block rounded-8 border border-line p-12 text-body-s text-text-3">
                    등록된 회수 주소가 없습니다. 배송지 관리에서 주소를 추가해 주세요.
                  </span>
                )}
              </label>
            </ClaimFormSection>
          ) : null}
          <ClaimFormSection title="환불 예상액">
            <div className="rounded-12 bg-surface p-16 lg:p-20">
              <dl className="divide-y divide-line text-body-s">
                <div className="flex items-center justify-between gap-12 py-10 first:pt-0">
                  <dt className="text-text-3">상품 금액</dt>
                  <dd>{selectedLines.length ? formatMyPagePrice(selectedAmount) : '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-12 py-10">
                  <dt className="text-text-3">배송비</dt>
                  <dd>미제공</dd>
                </div>
                <div className="flex items-center justify-between gap-12 py-10">
                  <dt className="font-medium">예정 환불액</dt>
                  <dd className="text-web-price-xl">
                    {selectedLines.length ? formatMyPagePrice(selectedAmount) : '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-12 py-10 last:pb-0">
                  <dt className="text-text-3">환불 수단</dt>
                  <dd>미제공</dd>
                </div>
              </dl>
              <p className="mt-12 border-t border-line pt-12 text-caption text-text-2">
                예정 환불액은 선택 상품 금액 기준입니다. 배송비·할인 조정과 실제 환불은 현재
                연결되어 있지 않습니다.
              </p>
            </div>
          </ClaimFormSection>
          <NoticeInline tone="warning">
            택배 회수 정보와 신청 접수는 현재 연결되어 있지 않습니다.
          </NoticeInline>
          <div className="flex flex-wrap justify-center gap-8 pt-4">
            <Button variant="secondary" size="l" onClick={() => router.push('/mypage/orders')}>
              취소
            </Button>
            <Button
              type="submit"
              size="l"
              disabled={
                selectedLines.length === 0 ||
                !isReasonValid ||
                !details.trim() ||
                (needsReturnAddress && !addresses.some((address) => address.id === addressId))
              }
            >
              신청하기
            </Button>
          </div>
        </>
      ) : null}
    </form>
  );
}

function ClaimFormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-12 border-b border-line pb-20 lg:grid-cols-[140px_minmax(0,1fr)] lg:gap-24">
      <h2 className="text-label-m lg:pt-12">{title}</h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function ProductCollectionView({
  mode,
  products,
  productIds,
  unavailableProductIds,
  recentViewedAt,
}: {
  mode: 'wishlist' | 'recent';
  products: Product[];
  productIds: string[];
  unavailableProductIds: string[];
  recentViewedAt: Record<string, string>;
}) {
  const { toggleWishlist, removeRecent, clearRecent } = useLocalCollections();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const productById = new Map(products.map((product) => [product.id, product]));
  const unavailableIdSet = new Set(unavailableProductIds);
  const orderedProducts = productIds
    .map((id) => productById.get(id))
    .filter((product): product is Product => product !== undefined);
  const isWishlist = mode === 'wishlist';
  const recentGroupsByDate = new Map<
    string,
    { products: Product[]; unavailableProductIds: string[] }
  >();
  for (const productId of productIds) {
    const product = productById.get(productId);
    if (!product && !unavailableIdSet.has(productId)) continue;
    const viewedAt = recentViewedAt[productId];
    const groupLabel = viewedAt ? formatMyPageDate(viewedAt) : '날짜 정보 미제공';
    const group = recentGroupsByDate.get(groupLabel) ?? {
      products: [],
      unavailableProductIds: [],
    };
    if (product) group.products.push(product);
    else group.unavailableProductIds.push(productId);
    recentGroupsByDate.set(groupLabel, group);
  }
  const productGroups: {
    label: string;
    products: Product[];
    unavailableProductIds: string[];
  }[] = isWishlist
    ? [
        {
          label: '',
          products: orderedProducts,
          unavailableProductIds: productIds.filter((productId) => unavailableIdSet.has(productId)),
        },
      ]
    : [...recentGroupsByDate.entries()].map(([label, group]) => ({ label, ...group }));
  const allSelected =
    orderedProducts.length > 0 &&
    orderedProducts.every((product) => selectedIds.includes(product.id));
  const removeProduct = (productId: string) => {
    if (isWishlist) {
      toggleWishlist(productId);
      setSelectedIds((previous) => previous.filter((id) => id !== productId));
    } else removeRecent(productId);
  };
  const removeSelected = () => {
    orderedProducts
      .filter((product) => selectedIds.includes(product.id))
      .forEach((product) => removeProduct(product.id));
    setSelectedIds([]);
  };
  return (
    <div>
      <div className="mb-16 flex flex-wrap items-center justify-between gap-12">
        <p className="text-body-s text-text-2">
          {isWishlist
            ? `찜한 상품 ${orderedProducts.length + unavailableProductIds.length}개`
            : `${orderedProducts.length + unavailableProductIds.length}개 상품`}
        </p>
        {isWishlist ? (
          <div className="flex items-center gap-12">
            <Checkbox
              aria-label="상품 전체 선택"
              checked={allSelected}
              isIndeterminate={selectedIds.length > 0 && !allSelected}
              onChange={(event) =>
                setSelectedIds(
                  event.target.checked ? orderedProducts.map((product) => product.id) : [],
                )
              }
            >
              전체 선택
            </Checkbox>
            <Button
              size="s"
              variant="secondary"
              disabled={!selectedIds.length}
              onClick={removeSelected}
            >
              선택 삭제
            </Button>
          </div>
        ) : (
          <Button size="s" variant="ghost" onClick={clearRecent}>
            전체 삭제
          </Button>
        )}
      </div>
      {!isWishlist ? (
        <NoticeInline className="mb-16">
          최근 본 상품은 최대 20개까지 브라우저에 보관됩니다. 삭제 내용은 이 브라우저에 저장됩니다.
        </NoticeInline>
      ) : null}
      {!orderedProducts.length && !unavailableProductIds.length ? (
        <EmptyState
          icon={isWishlist ? Heart : Clock3}
          title={isWishlist ? '찜한 상품이 없습니다.' : '최근 본 상품이 없습니다.'}
          description={
            isWishlist
              ? '마음에 드는 상품을 찜해 두면 여기에서 확인할 수 있습니다.'
              : '상품을 확인하면 최근 본 상품에 표시됩니다.'
          }
          action={
            <MyPageActionLink href="/" variant="primary">
              상품 보러 가기
            </MyPageActionLink>
          }
        />
      ) : (
        productGroups.map((group) => (
          <section key={group.label || 'wishlist'} className="mb-24 last:mb-0">
            {!isWishlist ? (
              <div className="mb-12 flex flex-wrap items-center justify-between gap-8 border-b border-line pb-10">
                <h2 className="text-label-m">{group.label}</h2>
                {group.label === '날짜 정보 미제공' ? (
                  <span className="text-caption text-text-3">
                    이전 방문일은 저장되지 않았습니다.
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-12 sm:grid-cols-3 lg:grid-cols-4 lg:gap-16">
              {group.products.map((product) => (
                <div key={product.id} className="relative min-w-0">
                  {isWishlist ? (
                    <div className="absolute top-8 left-8 z-10 flex size-32 items-center justify-center rounded-4 bg-bg/90">
                      <Checkbox
                        aria-label={`${product.name} 선택`}
                        checked={selectedIds.includes(product.id)}
                        onChange={(event) =>
                          setSelectedIds((previous) =>
                            event.target.checked
                              ? [...previous, product.id]
                              : previous.filter((id) => id !== product.id),
                          )
                        }
                      />
                    </div>
                  ) : (
                    <Button
                      aria-label={`${product.name} 최근 본 상품에서 삭제`}
                      size="s"
                      variant="secondary"
                      className="absolute top-8 right-8 z-10 size-32 !p-0"
                      onClick={() => removeProduct(product.id)}
                    >
                      <X size={16} aria-hidden="true" />
                    </Button>
                  )}
                  <ProductCard
                    product={product}
                    className={
                      isWishlist
                        ? 'pt-8 [&>div:first-child>div:first-of-type]:top-[44px] lg:[&>div:first-child>div:first-of-type]:top-8 lg:[&>div:first-child>div:first-of-type]:left-[44px]'
                        : '[&>div:first-child>button]:hidden'
                    }
                  />
                </div>
              ))}
              {group.unavailableProductIds.map((productId, index) => (
                <div
                  key={`unavailable-${productId}`}
                  role="group"
                  aria-label="상품 정보를 불러올 수 없는 항목"
                  className="flex min-h-260 flex-col items-center justify-center rounded-12 border border-line bg-surface p-16 text-center"
                >
                  <Package size={28} aria-hidden="true" className="text-text-3" />
                  <p className="mt-12 text-label-m">상품 정보를 불러오지 못했습니다.</p>
                  <p className="mt-4 text-caption text-text-3">
                    다시 시도하거나 목록에서 삭제할 수 있습니다.
                  </p>
                  <Button
                    className="mt-16"
                    size="s"
                    variant="secondary"
                    aria-label={`${isWishlist ? '찜' : '최근 본'} 불러올 수 없는 상품 ${index + 1} 삭제`}
                    onClick={() => removeProduct(productId)}
                  >
                    목록에서 삭제
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function CouponsView({ coupons }: { coupons: Coupon[] }) {
  const [tab, setTab] = useState<'available' | 'used'>('available');
  const [couponCode, setCouponCode] = useState('');
  const [notice, setNotice] = useState<LocalNotice>(null);
  const today = dateInputValue(new Date());
  const isPresentationMode = shouldShowPresentationRows(getWebApiConfig().mode);
  const available = coupons.filter(
    (coupon) => !coupon.isUsed && !isCouponExpired(coupon, today),
  ).length;
  const used = coupons.length - available;
  const visibleCoupons = coupons.filter((coupon) =>
    tab === 'used'
      ? coupon.isUsed || isCouponExpired(coupon, today)
      : !coupon.isUsed && !isCouponExpired(coupon, today),
  );
  const layoutCouponSamples = [
    {
      key: 'coupon-layout-rate-a',
      discount: '00%',
      name: '쿠폰명',
      minimum: '₩00,000',
      date: '0000.00.00',
      scope: '적용 상품',
    },
    {
      key: 'coupon-layout-amount-a',
      discount: '₩0,000',
      name: '쿠폰명',
      minimum: '₩00,000',
      date: '0000.00.00',
      scope: '적용 상품',
    },
    {
      key: 'coupon-layout-rate-b',
      discount: '00%',
      name: '쿠폰명',
      minimum: '₩00,000',
      date: '0000.00.00',
      scope: '전 상품',
    },
    {
      key: 'coupon-layout-shipping',
      discount: '₩0,000',
      name: '배송비 쿠폰',
      minimum: '₩00,000',
      date: '0000.00.00',
      scope: '배송비',
    },
    {
      key: 'coupon-layout-rate-c',
      discount: '00%',
      name: '쿠폰명',
      minimum: '₩00,000',
      date: '0000.00.00',
      scope: '전 상품',
    },
  ];
  const registerCoupon = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(
      couponCode.trim()
        ? {
            tone: 'info',
            message: '쿠폰 등록 API가 연결되지 않아 입력한 코드는 저장되지 않았습니다.',
          }
        : { tone: 'warning', message: '쿠폰 코드를 입력해 주세요.' },
    );
  };
  return (
    <div className="space-y-20">
      <section className="flex flex-col gap-16 rounded-12 bg-surface p-16 sm:flex-row sm:items-center sm:justify-between lg:px-32 lg:py-24">
        <div>
          <p className="text-body-s text-text-2">사용 가능 쿠폰</p>
          <p className="mt-4 text-h2">{available}장</p>
        </div>
        <form onSubmit={registerCoupon} className="flex w-full gap-8 sm:max-w-420">
          <TextField
            label="쿠폰 코드"
            isLabelHidden
            name="couponCode"
            value={couponCode}
            onChange={(event) => setCouponCode(event.target.value)}
            placeholder="쿠폰 코드를 입력해 주세요"
          />
          <Button type="submit" className="self-start">
            등록
          </Button>
        </form>
      </section>
      <NoticeResult notice={notice} />
      <TabBar
        options={[
          { value: 'available', label: '사용 가능' },
          { value: 'used', label: '사용 완료 · 만료' },
        ]}
        value={tab}
        onChange={setTab}
        label="쿠폰 상태"
        counts={{ available, used }}
      />
      {!visibleCoupons.length ? (
        <EmptyState
          icon={TicketPercent}
          title={
            tab === 'available' ? '사용 가능한 쿠폰이 없습니다.' : '사용 완료한 쿠폰이 없습니다.'
          }
          description="보유한 쿠폰이 이곳에 표시됩니다."
        />
      ) : (
        <ul className="grid gap-12 sm:grid-cols-2 lg:gap-16">
          {visibleCoupons.map((coupon) => (
            <li
              key={coupon.id}
              className="relative flex min-h-128 overflow-hidden rounded-12 border border-line"
            >
              <div className="min-w-0 flex-1 px-16 py-16 lg:px-24">
                <p className="text-web-price-xl">
                  {coupon.discountType === 'rate'
                    ? `${coupon.discountValue}%`
                    : formatMyPagePrice(coupon.discountValue)}
                </p>
                <p className="mt-4 text-label-m">{coupon.name}</p>
                <p className="mt-8 text-caption text-text-2">
                  {formatMyPagePrice(coupon.minOrderAmount)} 이상 구매 시 적용
                </p>
                <p className="mt-4 text-caption text-text-3">
                  {formatMyPageDate(coupon.expiresAt)}까지
                </p>
              </div>
              <div className="flex w-88 shrink-0 flex-col items-center justify-center gap-8 border-l border-dashed border-line bg-surface text-center text-caption text-text-2">
                <TicketPercent size={20} aria-hidden="true" />
                <span>적용 상품</span>
              </div>
              {coupon.isUsed || isCouponExpired(coupon, today) ? (
                <span className="absolute inset-0 bg-bg/55" aria-hidden="true" />
              ) : null}
              {isCouponExpired(coupon, today) && !coupon.isUsed ? (
                <span className="absolute top-10 right-10 rounded-4 bg-bg/90 px-8 py-4 text-caption text-text-2">
                  기간 만료
                </span>
              ) : null}
            </li>
          ))}
          {isPresentationMode && tab === 'available'
            ? layoutCouponSamples.map((coupon) => (
                <li
                  key={coupon.key}
                  className="relative flex min-h-128 overflow-hidden rounded-12 border border-line"
                >
                  <div className="min-w-0 flex-1 px-16 py-16 lg:px-24">
                    <p className="text-web-price-xl">{coupon.discount}</p>
                    <p className="mt-4 text-label-m">{coupon.name}</p>
                    <p className="mt-8 text-caption text-text-2">
                      {coupon.minimum} 이상 구매 시 적용
                    </p>
                    <p className="mt-4 text-caption text-text-3">{coupon.date}까지</p>
                  </div>
                  <div className="flex w-88 shrink-0 flex-col items-center justify-center gap-8 border-l border-dashed border-line bg-surface text-center text-caption text-text-2">
                    <TicketPercent size={20} aria-hidden="true" />
                    <span>{coupon.scope}</span>
                  </div>
                </li>
              ))
            : null}
        </ul>
      )}
    </div>
  );
}

function PointsView({ memberBalance, points }: { memberBalance: number; points: Point[] }) {
  const [tab, setTab] = useState<PointTab>('all');
  const [periodMonths, setPeriodMonths] = useState(3);
  const [currentPage, setCurrentPage] = useState(1);
  const isPresentationMode = shouldShowPresentationRows(getWebApiConfig().mode);
  const threshold = subtractMonthsClamped(new Date(), periodMonths);
  const expiringAmount = points
    .filter(
      (point) =>
        point.amount > 0 &&
        point.expiresAt &&
        daysFromNow(point.expiresAt) >= 0 &&
        daysFromNow(point.expiresAt) <= 30,
    )
    .reduce((total, point) => total + point.amount, 0);
  const filtered = points.filter((point) => {
    const expired = point.description.includes('소멸');
    const matchesTab =
      tab === 'all' ||
      (tab === 'expired'
        ? expired
        : tab === 'spent'
          ? point.amount < 0 && !expired
          : point.amount > 0 && !expired);
    return matchesTab && new Date(point.occurredAt) >= threshold;
  });
  const rows = filtered.slice((currentPage - 1) * 8, currentPage * 8);
  const layoutRows = [
    {
      key: 'order-earned-a',
      description: '주문 적립',
      bucket: 'earned',
      amount: '+0원',
      order: '0000000000',
      expires: '0000.00.00',
    },
    {
      key: 'order-spent-a',
      description: '주문 사용',
      bucket: 'spent',
      amount: '-0원',
      order: '0000000000',
      expires: '-',
    },
    {
      key: 'event-earned',
      description: '이벤트 적립',
      bucket: 'earned',
      amount: '+0원',
      order: '-',
      expires: '0000.00.00',
    },
    {
      key: 'expired-points',
      description: '기간 만료 소멸',
      bucket: 'expired',
      amount: '-0원',
      order: '-',
      expires: '-',
    },
    {
      key: 'order-earned-b',
      description: '주문 적립',
      bucket: 'earned',
      amount: '+0원',
      order: '0000000000',
      expires: '0000.00.00',
    },
    {
      key: 'cancel-return',
      description: '주문 취소 환원',
      bucket: 'earned',
      amount: '+0원',
      order: '0000000000',
      expires: '0000.00.00',
    },
    {
      key: 'order-spent-b',
      description: '주문 사용',
      bucket: 'spent',
      amount: '-0원',
      order: '0000000000',
      expires: '-',
    },
  ] as const;
  const pointLayoutRows =
    isPresentationMode && periodMonths === 3
      ? layoutRows.filter((point) => tab === 'all' || point.bucket === tab)
      : [];
  const displayRows = [
    ...rows.map((point) => ({ kind: 'point' as const, point })),
    ...pointLayoutRows.map((point) => ({ kind: 'layout' as const, point })),
  ].slice(0, 8);
  return (
    <div className="space-y-20">
      <section className="grid grid-cols-1 divide-y divide-line rounded-12 bg-surface px-16 sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:px-24">
        <SummaryMetric label="사용 가능 적립금" value={formatMyPagePrice(memberBalance)} />
        <SummaryMetric label="적립 예정" value="—" />
        <SummaryMetric
          label="30일 내 소멸 예정"
          value={formatMyPagePrice(expiringAmount)}
          emphasis
        />
      </section>
      <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
        <TabBar
          options={POINT_TABS}
          value={tab}
          onChange={(next) => {
            setTab(next);
            setCurrentPage(1);
          }}
          label="적립금 내역 종류"
        />
        <label className="flex h-40 items-center gap-8 self-end rounded-8 border border-line-strong px-12 text-body-s focus-within:border-text-1 focus-within:ring-1 focus-within:ring-text-1 lg:self-auto">
          <span className="sr-only">조회 기간</span>
          <span className="relative inline-flex items-center">
            <select
              aria-label="조회 기간"
              value={periodMonths}
              onChange={(event) => {
                setPeriodMonths(Number(event.target.value));
                setCurrentPage(1);
              }}
              className="appearance-none bg-transparent pr-32 outline-none"
            >
              <option value={1}>최근 1개월</option>
              <option value={3}>최근 3개월</option>
              <option value={6}>최근 6개월</option>
              <option value={12}>최근 1년</option>
            </select>
            <ChevronDown
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-14 -translate-y-1/2 text-text-1"
            />
          </span>
        </label>
      </div>
      {!displayRows.length ? (
        <EmptyState
          icon={TicketPercent}
          title="적립금 내역이 없습니다."
          description="선택한 기간에 해당하는 적립금 내역이 없습니다."
        />
      ) : (
        <>
          <div className="hidden grid-cols-[120px_minmax(140px,1fr)_minmax(140px,1fr)_110px_120px] gap-12 border-y border-line bg-surface px-12 py-12 text-label-s text-text-2 lg:grid">
            <span>일자</span>
            <span>내용</span>
            <span>주문번호</span>
            <span className="text-right">적립/사용</span>
            <span className="text-right">유효기간</span>
          </div>
          <ul className="divide-y divide-line">
            {displayRows.map((row) =>
              row.kind === 'point' ? (
                <li
                  key={row.point.id}
                  className="grid gap-8 py-14 text-body-s lg:grid-cols-[120px_minmax(140px,1fr)_minmax(140px,1fr)_110px_120px] lg:items-center lg:px-12"
                >
                  <time className="text-text-2">{formatMyPageDate(row.point.occurredAt)}</time>
                  <span>{row.point.description}</span>
                  <span className="text-caption text-text-3">—</span>
                  <span
                    className={cx(
                      'font-medium tabular-nums lg:text-right',
                      row.point.amount < 0 ? 'text-text-1' : 'text-success',
                    )}
                  >
                    {row.point.amount > 0 ? '+' : ''}
                    {formatMyPagePrice(row.point.amount)}
                  </span>
                  <span className="text-caption text-text-3 lg:text-right">
                    {row.point.expiresAt ? formatMyPageDate(row.point.expiresAt) : '—'}
                  </span>
                </li>
              ) : (
                <li
                  key={row.point.key}
                  className="grid gap-8 py-14 text-body-s lg:grid-cols-[120px_minmax(140px,1fr)_minmax(140px,1fr)_110px_120px] lg:items-center lg:px-12"
                >
                  <time className="text-text-2">0000.00.00</time>
                  <span>{row.point.description}</span>
                  <span className="text-caption text-text-3">{row.point.order}</span>
                  <span className="font-medium tabular-nums lg:text-right">{row.point.amount}</span>
                  <span className="text-caption text-text-3 lg:text-right">
                    {row.point.expires}
                  </span>
                </li>
              ),
            )}
          </ul>
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(filtered.length / 8)}
            onPageChange={setCurrentPage}
          />
        </>
      )}
      <NoticeInline>
        적립금은 결제 시 사용할 수 있습니다. 적립 예정 정보는 현재 제공되지 않습니다.
      </NoticeInline>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="py-16 text-center lg:py-24">
      <p className="text-caption text-text-2">{label}</p>
      <p className={cx('mt-4 text-h2 tabular-nums', emphasis && 'text-warning')}>{value}</p>
    </div>
  );
}

function ProfileView({
  member,
  editable = false,
}: {
  member: NonNullable<MyPageData['member']>;
  editable?: boolean;
}) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [reauthError, setReauthError] = useState('');
  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(member.phone);
  const [companyName, setCompanyName] = useState('');
  const [businessNumber, setBusinessNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [smsOptIn, setSmsOptIn] = useState(true);
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [notice, setNotice] = useState<LocalNotice>(null);
  if (!editable)
    return (
      <div className="mx-auto max-w-480 rounded-12 border border-line p-20 lg:p-40">
        <div className="mx-auto flex size-48 items-center justify-center rounded-capsule bg-surface">
          <LockKeyhole size={24} aria-hidden="true" />
        </div>
        <h2 className="mt-12 text-center text-h3">비밀번호를 다시 입력해 주세요</h2>
        <p className="mt-8 text-center text-body-s text-text-2">
          데모 화면 확인 단계입니다. 실제 본인 확인은 진행되지 않습니다.
        </p>
        <form
          className="mt-24 space-y-16"
          onSubmit={(event) => {
            event.preventDefault();
            setReauthError(
              password
                ? '데모 화면입니다. 실제 인증은 진행되지 않았습니다.'
                : '비밀번호를 입력해 주세요.',
            );
            setPassword('');
          }}
        >
          <TextField label="이메일" type="email" value={member.email} disabled />
          <TextField
            label="비밀번호"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
          <Button type="submit" isFullWidth>
            확인
          </Button>
          {reauthError ? (
            <p role="status" className="text-body-s text-text-2">
              {reauthError}
            </p>
          ) : null}
        </form>
        {!reauthError ? (
          <p className="mt-16 text-center text-caption text-text-3">
            이 화면에서는 실제 계정 인증을 하지 않습니다.
          </p>
        ) : null}
      </div>
    );
  return (
    <div className="space-y-24">
      <section>
        <DividerTitle>기본 정보</DividerTitle>
        <ProfileRow label="이메일">
          <TextField label="이메일" isLabelHidden type="email" value={member.email} disabled />
        </ProfileRow>
        <ProfileRow label="이름">
          <TextField
            label="이름"
            isLabelHidden
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </ProfileRow>
        <ProfileRow label="휴대폰 번호">
          <div className="flex gap-8">
            <TextField
              label="휴대폰 번호"
              isLabelHidden
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            <Button variant="secondary" onClick={() => setIsPhoneModalOpen(true)}>
              변경
            </Button>
          </div>
        </ProfileRow>
        <ProfileRow label="비밀번호">
          <Button variant="secondary" onClick={() => setIsPasswordModalOpen(true)}>
            비밀번호 변경
          </Button>
        </ProfileRow>
      </section>
      <section>
        <DividerTitle>
          사업자 정보{' '}
          <span className="ml-8 text-caption font-normal text-text-3">
            사업자 회원에게만 표시됩니다.
          </span>
        </DividerTitle>
        <ProfileRow label="회사명">
          <TextField
            label="회사명"
            isLabelHidden
            value={companyName}
            placeholder="회사명을 입력해 주세요"
            onChange={(event) => setCompanyName(event.target.value)}
          />
        </ProfileRow>
        <ProfileRow label="사업자등록번호">
          <div>
            <TextField
              label="사업자등록번호"
              isLabelHidden
              value={businessNumber}
              placeholder="사업자등록번호를 입력해 주세요"
              onChange={(event) => setBusinessNumber(event.target.value)}
            />
            <p className="mt-4 text-caption text-text-3">변경은 고객센터로 문의해 주세요.</p>
          </div>
        </ProfileRow>
        <ProfileRow label="담당 부서">
          <TextField
            label="담당 부서"
            isLabelHidden
            value={department}
            placeholder="부서명을 입력해 주세요"
            onChange={(event) => setDepartment(event.target.value)}
          />
        </ProfileRow>
      </section>
      <section>
        <DividerTitle>수신 동의</DividerTitle>
        <div className="flex flex-wrap items-center gap-16 border-b border-line py-14">
          <span className="w-112 shrink-0 text-label-s">마케팅 정보</span>
          <Checkbox checked={smsOptIn} onChange={(event) => setSmsOptIn(event.target.checked)}>
            SMS 수신 동의
          </Checkbox>
          <Checkbox checked={emailOptIn} onChange={(event) => setEmailOptIn(event.target.checked)}>
            이메일 수신 동의
          </Checkbox>
        </div>
        <p className="mt-4 text-caption text-text-3">
          주문·배송 알림은 수신 동의와 관계없이 발송됩니다.
        </p>
      </section>
      <div className="flex flex-wrap justify-center gap-8">
        <Button variant="secondary" size="l" onClick={() => router.push('/mypage/profile')}>
          취소
        </Button>
        <Button
          size="l"
          onClick={() =>
            setNotice({
              tone: 'info',
              message: '변경 내용은 현재 화면에만 반영되며 서버에는 저장되지 않습니다.',
            })
          }
        >
          저장
        </Button>
      </div>
      <div className="flex justify-end">
        <Button variant="ghost" size="s" onClick={() => router.push('/mypage/withdrawal')}>
          회원 탈퇴
        </Button>
      </div>
      <NoticeResult notice={notice} />
      <PasswordChangeDemoModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
      <PhoneChangeDemoModal isOpen={isPhoneModalOpen} onClose={() => setIsPhoneModalOpen(false)} />
    </div>
  );
}

function PhoneChangeDemoModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [phoneInput, setPhoneInput] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function closeModal() {
    setPhoneInput('');
    setMessage('');
    setError('');
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const digits = phoneInput.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 11) {
      setError('휴대폰 번호 형식을 확인해 주세요.');
      return;
    }
    setPhoneInput('');
    setError('');
    setMessage('데모 입력을 확인했습니다. 실제 문자 인증이나 번호 변경은 진행되지 않았습니다.');
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="휴대폰 번호 변경"
      description="데모 전용 화면입니다. 실제 문자를 보내거나 번호를 인증·변경하지 않습니다."
      actions={
        message ? (
          <Button onClick={closeModal}>확인</Button>
        ) : (
          <Button type="submit" form="phone-change-demo-form">
            데모 확인
          </Button>
        )
      }
    >
      {message ? (
        <p role="status" className="mt-20 rounded-8 bg-info-tint p-12 text-body-s text-info">
          {message}
        </p>
      ) : (
        <form id="phone-change-demo-form" onSubmit={handleSubmit} className="mt-20 space-y-12">
          <TextField
            label="새 휴대폰 번호"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={phoneInput}
            onChange={(event) => setPhoneInput(event.target.value)}
            errorMessage={error || undefined}
            required
          />
        </form>
      )}
    </Modal>
  );
}

function ProfileRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-8 border-b border-line-strong py-20 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-center lg:grid-cols-[150px_minmax(0,1fr)]">
      <h3 className="text-label-m">{label}</h3>
      <div className="max-w-420 min-w-0">{children}</div>
    </div>
  );
}

function daysFromNow(value: string) {
  return Math.floor((new Date(value).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
}

interface LocalAddress extends Address {
  deliveryNote: string;
}

interface AddressFormState {
  label: string;
  recipientName: string;
  phone: string;
  postalCode: string;
  address1: string;
  address2: string;
  deliveryNote: string;
  isDefault: boolean;
}
const EMPTY_ADDRESS_FORM: AddressFormState = {
  label: '',
  recipientName: '',
  phone: '',
  postalCode: '',
  address1: '',
  address2: '',
  deliveryNote: '',
  isDefault: false,
};

function AddressesView({
  addresses: initialAddresses,
  addAddressActionRef,
}: {
  addresses: Address[];
  addAddressActionRef: { current: (() => void) | null };
}) {
  const [addresses, setAddresses] = useState<LocalAddress[]>(() =>
    initialAddresses.map((address) => ({ ...address, deliveryNote: '' })),
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressFormState>(EMPTY_ADDRESS_FORM);
  const [pendingDelete, setPendingDelete] = useState<LocalAddress | null>(null);
  const [notice, setNotice] = useState<LocalNotice>(null);
  const isPresentationMode = shouldShowPresentationRows(getWebApiConfig().mode);
  const openNew = useCallback(() => {
    if (addresses.length >= 7) {
      setNotice({ tone: 'warning', message: '배송지는 최대 7개까지 등록할 수 있습니다.' });
      return;
    }
    setEditingAddressId(null);
    setForm(EMPTY_ADDRESS_FORM);
    setIsModalOpen(true);
  }, [addresses.length]);
  useEffect(() => {
    addAddressActionRef.current = openNew;
    return () => {
      if (addAddressActionRef.current === openNew) addAddressActionRef.current = null;
    };
  }, [addAddressActionRef, openNew]);
  const openEdit = (address: LocalAddress) => {
    setEditingAddressId(address.id);
    setForm({ ...address, isDefault: address.isDefault });
    setIsModalOpen(true);
  };
  const save = () => {
    if (
      !form.label.trim() ||
      !form.recipientName.trim() ||
      !form.phone.trim() ||
      !form.postalCode.trim() ||
      !form.address1.trim()
    )
      return;
    setAddresses((previous) => {
      const normalized = form.isDefault
        ? previous.map((address) => ({ ...address, isDefault: false }))
        : previous;
      const next: LocalAddress = {
        id: editingAddressId ?? `local-${Date.now()}`,
        label: form.label.trim(),
        recipientName: form.recipientName.trim(),
        phone: form.phone.trim(),
        postalCode: form.postalCode.trim(),
        address1: form.address1.trim(),
        address2: form.address2.trim(),
        deliveryNote: form.deliveryNote,
        isDefault: form.isDefault || normalized.length === 0,
      };
      return editingAddressId
        ? normalized.map((address) => (address.id === editingAddressId ? next : address))
        : [...normalized, next];
    });
    setNotice({
      tone: 'info',
      message: '배송지 변경은 현재 화면에만 반영되며 서버에는 저장되지 않습니다.',
    });
    setIsModalOpen(false);
  };
  const remove = () => {
    if (!pendingDelete || pendingDelete.isDefault) return;
    setAddresses((previous) => previous.filter((address) => address.id !== pendingDelete.id));
    setPendingDelete(null);
    setNotice({
      tone: 'info',
      message: '배송지 삭제는 현재 화면에만 반영되며 서버에는 저장되지 않습니다.',
    });
  };
  const updateForm = (key: keyof AddressFormState, value: string | boolean) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const isFormReady = Boolean(
    form.label.trim() &&
    form.recipientName.trim() &&
    form.phone.trim() &&
    form.postalCode.trim() &&
    form.address1.trim(),
  );
  const addressRows = [
    ...addresses.map((address) => ({ kind: 'address' as const, address })),
    ...(isPresentationMode
      ? [
          { kind: 'sample' as const, key: 'layout-address-1' },
          { kind: 'sample' as const, key: 'layout-address-2' },
        ]
      : []),
  ];
  return (
    <div>
      {!addresses.length ? (
        <EmptyState
          icon={MapPin}
          title="등록된 배송지가 없습니다."
          description="배송지를 추가하면 주문 시 빠르게 선택할 수 있습니다."
        />
      ) : (
        <>
          <div className="hidden grid-cols-[minmax(120px,0.8fr)_minmax(120px,0.8fr)_minmax(220px,2fr)_minmax(120px,1fr)_112px] gap-12 border-y border-line bg-surface px-16 py-12 text-label-s text-text-2 lg:grid">
            <span>배송지명</span>
            <span>받는 분</span>
            <span>주소</span>
            <span>연락처</span>
            <span className="text-center">관리</span>
          </div>
          <ul className="divide-y divide-line">
            {addressRows.map((row) =>
              row.kind === 'address' ? (
                <li
                  key={row.address.id}
                  className="grid gap-10 py-16 lg:grid-cols-[minmax(120px,0.8fr)_minmax(120px,0.8fr)_minmax(220px,2fr)_minmax(120px,1fr)_112px] lg:items-center lg:px-16"
                >
                  <div className="flex flex-wrap items-center gap-8">
                    <span className="text-label-m">{row.address.label}</span>
                    {row.address.isDefault ? <Badge tone="dark">기본 배송지</Badge> : null}
                  </div>
                  <p className="text-body-s">{row.address.recipientName}</p>
                  <p className="text-body-s">
                    {row.address.postalCode} {row.address.address1} {row.address.address2}
                  </p>
                  <p className="text-body-s">{row.address.phone}</p>
                  <div className="flex flex-wrap gap-8 lg:justify-center">
                    <Button size="s" variant="secondary" onClick={() => openEdit(row.address)}>
                      수정
                    </Button>
                    {!row.address.isDefault ? (
                      <Button
                        size="s"
                        variant="secondary"
                        onClick={() => setPendingDelete(row.address)}
                      >
                        삭제
                      </Button>
                    ) : null}
                  </div>
                </li>
              ) : (
                <li
                  key={row.key}
                  className="grid gap-10 py-16 text-text-2 lg:grid-cols-[minmax(120px,0.8fr)_minmax(120px,0.8fr)_minmax(220px,2fr)_minmax(120px,1fr)_112px] lg:items-center lg:px-16"
                >
                  <span className="text-label-m">배송지명</span>
                  <p className="text-body-s">홍길동</p>
                  <p className="text-body-s">(00000) 주소 상세주소</p>
                  <p className="text-body-s">010-0000-0000</p>
                  <div className="flex flex-wrap gap-8 lg:justify-center">
                    <Button size="s" variant="secondary" disabled>
                      수정
                    </Button>
                    <Button size="s" variant="secondary" disabled>
                      삭제
                    </Button>
                  </div>
                </li>
              ),
            )}
          </ul>
        </>
      )}
      <p className="mt-12 text-caption text-text-3">
        배송지와 요청사항 변경은 현재 화면에만 임시 보관됩니다. 배송지는 최대 7개까지 등록할 수
        있으며, 기본 배송지는 삭제할 수 없습니다.
      </p>
      {addresses.length >= 7 ? (
        <NoticeInline className="mt-8" tone="warning">
          새 배송지를 등록하려면 기존 배송지를 삭제해 주세요.
        </NoticeInline>
      ) : null}
      <NoticeResult notice={notice} />
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAddressId ? '배송지 수정' : '배송지 추가'}
        className="relative max-w-640"
        actions={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              취소
            </Button>
            <Button onClick={save} disabled={!isFormReady}>
              저장
            </Button>
          </>
        }
      >
        <button
          type="button"
          aria-label="배송지 모달 닫기"
          onClick={() => setIsModalOpen(false)}
          className="absolute top-20 right-20 rounded-4 p-4 text-text-2 focus-ring hover:text-text-1"
        >
          <X size={20} aria-hidden="true" />
        </button>
        <div className="mt-20 grid gap-12 sm:grid-cols-2">
          <TextField
            label="배송지명"
            name="label"
            value={form.label}
            placeholder="예: 본사, 현장"
            onChange={(event) => updateForm('label', event.target.value)}
          />
          <TextField
            label="받는 분"
            name="recipientName"
            value={form.recipientName}
            onChange={(event) => updateForm('recipientName', event.target.value)}
          />
          <TextField
            label="휴대폰 번호"
            name="phone"
            value={form.phone}
            onChange={(event) => updateForm('phone', event.target.value)}
            className="sm:col-span-2"
          />
          <div className="flex items-end gap-8 sm:col-span-2">
            <TextField
              label="우편번호"
              name="postalCode"
              value={form.postalCode}
              onChange={(event) => updateForm('postalCode', event.target.value)}
            />
            <Button
              variant="secondary"
              className="shrink-0"
              onClick={() =>
                setNotice({
                  tone: 'info',
                  message: '주소 검색은 연결되어 있지 않습니다. 주소를 직접 입력해 주세요.',
                })
              }
            >
              주소 검색
            </Button>
          </div>
          <TextField
            label="주소"
            name="address1"
            value={form.address1}
            onChange={(event) => updateForm('address1', event.target.value)}
            className="sm:col-span-2"
          />
          <TextField
            label="상세 주소"
            name="address2"
            value={form.address2}
            onChange={(event) => updateForm('address2', event.target.value)}
            className="sm:col-span-2"
          />
          <label className="rounded-8 focus-within:ring-1 focus-within:ring-text-1 sm:col-span-2">
            <span className="mb-8 block text-label-m">배송 요청사항</span>
            <div className="relative w-full">
              <select
                value={form.deliveryNote}
                onChange={(event) => updateForm('deliveryNote', event.target.value)}
                className="h-48 w-full appearance-none rounded-8 border border-line-strong bg-bg pr-40 pl-14 text-body-m focus-ring"
              >
                <option value="">선택해 주세요</option>
                <option value="배송 전 연락 바랍니다">배송 전 연락 바랍니다</option>
                <option value="문 앞에 놓아 주세요">문 앞에 놓아 주세요</option>
              </select>
              <ChevronDown
                size={20}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-14 -translate-y-1/2 text-text-1"
              />
            </div>
          </label>
          <Checkbox
            checked={form.isDefault}
            onChange={(event) => updateForm('isDefault', event.target.checked)}
            className="sm:col-span-2"
          >
            기본 배송지로 설정
          </Checkbox>
        </div>
      </Modal>
      <Modal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="배송지를 삭제하시겠습니까?"
        tone="danger"
        actions={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              취소
            </Button>
            <Button variant="danger" onClick={remove}>
              삭제
            </Button>
          </>
        }
      >
        {pendingDelete ? (
          <p className="mt-12 text-body-s text-text-2">
            {pendingDelete.label} · {pendingDelete.address1}
          </p>
        ) : null}
      </Modal>
    </div>
  );
}

function QuotesView({ quotes }: { quotes: Quote[] }) {
  const today = new Date();
  const [startDate, setStartDate] = useState(() => dateInputValue(subtractMonthsClamped(today, 1)));
  const [endDate, setEndDate] = useState(() => dateInputValue(today));
  const [selectedPreset, setSelectedPreset] = useState<number | null>(1);
  const [appliedRange, setAppliedRange] = useState(() => ({
    start: dateInputValue(subtractMonthsClamped(today, 1)),
    end: dateInputValue(today),
  }));
  const [tab, setTab] = useState<QuoteTab>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;
  const isPresentationMode = shouldShowPresentationRows(getWebApiConfig().mode);
  const dateFiltered = quotes.filter((quote) => {
    const day = dateInputValue(new Date(quote.requestedAt));
    return day >= appliedRange.start && day <= appliedRange.end;
  });
  const visible = dateFiltered.filter((quote) => tab === 'all' || quote.status === tab);
  const rows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showLayoutSamples =
    isPresentationMode &&
    appliedRange.start === dateInputValue(subtractMonthsClamped(today, 1)) &&
    appliedRange.end === dateInputValue(today);
  const sampleQuoteStatuses: QuoteStatus[] = ['consulting', 'received', 'completed', 'canceled'];
  const displayRows = [
    ...rows.map((quote) => ({ kind: 'quote' as const, quote })),
    ...(showLayoutSamples
      ? sampleQuoteStatuses
          .filter((status) => tab === 'all' || status === tab)
          .map((status, index) => ({ kind: 'sample' as const, status, index }))
      : []),
  ].slice(0, pageSize);
  const counts = Object.fromEntries(
    QUOTE_TABS.map((item) => [
      item.value,
      item.value === 'all'
        ? dateFiltered.length
        : dateFiltered.filter((quote) => quote.status === item.value).length,
    ]),
  );
  return (
    <div className="space-y-16 lg:space-y-20">
      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={(value) => {
          setStartDate(value);
          setSelectedPreset(null);
          setCurrentPage(1);
        }}
        onEndDateChange={(value) => {
          setEndDate(value);
          setSelectedPreset(null);
          setCurrentPage(1);
        }}
        onPreset={(months) => {
          const now = new Date();
          setSelectedPreset(months);
          setStartDate(dateInputValue(subtractMonthsClamped(now, months)));
          setEndDate(dateInputValue(now));
          setCurrentPage(1);
        }}
        selectedPreset={selectedPreset}
        onApply={() => {
          setAppliedRange({ start: startDate, end: endDate });
          setCurrentPage(1);
        }}
      />
      <TabBar
        options={QUOTE_TABS}
        value={tab}
        onChange={(next) => {
          setTab(next);
          setCurrentPage(1);
        }}
        label="견적 상태"
        counts={counts}
      />
      {!displayRows.length ? (
        <EmptyState
          icon={Search}
          title="견적 문의 내역이 없습니다."
          description="필요한 상품의 견적을 문의하면 처리 현황을 확인할 수 있습니다."
          action={
            <MyPageActionLink href="/solutions" variant="primary">
              견적 문의하기
            </MyPageActionLink>
          }
        />
      ) : (
        <>
          <div className="hidden grid-cols-[120px_140px_minmax(200px,1fr)_80px_112px_132px] gap-12 border-y border-line bg-surface px-12 py-12 text-label-s text-text-2 lg:grid">
            <span>문의일</span>
            <span>문의번호</span>
            <span>제목</span>
            <span className="text-center">수량</span>
            <span className="text-center">상태</span>
            <span className="text-center">견적서</span>
          </div>
          <ul className="divide-y divide-line">
            {displayRows.map((row) =>
              row.kind === 'quote' ? (
                <li
                  key={row.quote.id}
                  className="grid gap-8 py-14 lg:grid-cols-[120px_140px_minmax(200px,1fr)_80px_112px_132px] lg:items-center lg:px-12"
                >
                  <time className="text-body-s text-text-2">
                    {formatMyPageDate(row.quote.requestedAt)}
                  </time>
                  <span className="text-caption text-text-3">{row.quote.id}</span>
                  <Link
                    href={`/mypage/quotes/${encodeURIComponent(row.quote.id)}`}
                    className="min-w-0 rounded-4 focus-ring hover:underline"
                  >
                    <span className="block truncate text-label-m">{row.quote.title}</span>
                    <span className="mt-4 block text-caption text-text-3">
                      {row.quote.companyName}
                    </span>
                  </Link>
                  <span className="text-caption text-text-3 lg:text-center">미제공</span>
                  <span className="lg:justify-self-center">
                    <StatusBadge {...QUOTE_STATUS_META[row.quote.status]} />
                  </span>
                  <span className="lg:justify-self-center">
                    {row.quote.status === 'quoteSent' ? (
                      <Button size="s" variant="secondary" disabled aria-label="견적서 파일 미제공">
                        파일 미제공
                      </Button>
                    ) : (
                      <span className="text-body-s text-text-3">—</span>
                    )}
                  </span>
                </li>
              ) : (
                <li
                  key={`layout-quote-${row.index}`}
                  className="grid gap-8 py-14 lg:grid-cols-[120px_140px_minmax(200px,1fr)_80px_112px_132px] lg:items-center lg:px-12"
                >
                  <time className="text-body-s text-text-2">0000.00.00</time>
                  <span className="text-caption text-text-3">0000000000</span>
                  <span className="min-w-0">
                    <span className="block truncate text-label-m">견적 문의 제목</span>
                    <span className="mt-4 block text-caption text-text-3">제품명 외 0건</span>
                  </span>
                  <span className="text-center text-body-s">0개</span>
                  <span className="lg:justify-self-center">
                    <StatusBadge {...QUOTE_STATUS_META[row.status]} />
                  </span>
                  <span className="lg:justify-self-center">
                    {row.status === 'quoteSent' || row.status === 'completed' ? (
                      <Button size="s" variant="secondary" disabled aria-label="견적서 파일 미제공">
                        다운로드
                      </Button>
                    ) : (
                      <span className="text-body-s text-text-3">—</span>
                    )}
                  </span>
                </li>
              ),
            )}
          </ul>
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(visible.length / pageSize)}
            onPageChange={setCurrentPage}
          />
        </>
      )}
      {isPresentationMode ? (
        <NoticeInline>
          목 견적 문의는 현재 상태와 요청 제목만 제공합니다. 견적 파일은 연결되어 있지 않습니다.
        </NoticeInline>
      ) : null}
    </div>
  );
}

function QuoteDetailView({ quote, memberEmail }: { quote?: Quote; memberEmail: string }) {
  const router = useRouter();
  if (!quote)
    return (
      <EmptyState
        icon={Search}
        title="견적 문의를 찾을 수 없습니다."
        action={
          <Button variant="secondary" onClick={() => router.push('/mypage/quotes')}>
            목록으로
          </Button>
        }
      />
    );
  const currentIndex = QUOTE_STAGE_ORDER.indexOf(quote.status);
  return (
    <div className="space-y-16 lg:space-y-20">
      <section className="rounded-12 border border-line p-16 lg:p-24">
        <StatusBadge {...QUOTE_STATUS_META[quote.status]} />
        <h2 className="mt-8 text-h3">{quote.title}</h2>
        <p className="mt-4 text-caption text-text-3">
          {formatMyPageDate(quote.requestedAt)} 접수 · 문의번호 {quote.id}
        </p>
        {shouldShowQuoteProgress(quote.status) ? (
          <ol
            aria-label="견적 진행 상태"
            className="mt-20 grid grid-cols-4 gap-4 border-t border-line pt-16"
          >
            {QUOTE_STAGE_ORDER.map((status, index) => (
              <li
                key={status}
                className={cx(
                  'text-center text-caption',
                  index <= currentIndex ? 'text-text-1' : 'text-text-3',
                )}
              >
                <span
                  className={cx(
                    'mx-auto mb-6 flex size-20 items-center justify-center rounded-capsule',
                    index <= currentIndex ? 'bg-text-1 text-inverse' : 'bg-surface text-text-3',
                  )}
                >
                  {index < currentIndex ? <Check size={12} aria-hidden="true" /> : index + 1}
                </span>
                {QUOTE_STATUS_META[status].label}
              </li>
            ))}
          </ol>
        ) : (
          <p role="status" className="mt-20 border-t border-line pt-16 text-body-s text-text-2">
            취소된 문의입니다. 취소 처리 내역은 제공되지 않습니다.
          </p>
        )}
      </section>
      <div className="grid items-start gap-16 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-12">
          <section className="rounded-12 border border-line p-16 lg:p-24">
            <h2 className="text-h3">요청 정보</h2>
            <dl className="mt-16 grid grid-cols-[92px_minmax(0,1fr)] gap-x-12 gap-y-12 text-body-s">
              <dt className="text-text-3">회사명</dt>
              <dd>{quote.companyName}</dd>
              <dt className="text-text-3">담당자</dt>
              <dd>{quote.contactName}</dd>
              <dt className="text-text-3">이메일</dt>
              <dd className="break-all">{memberEmail}</dd>
              <dt className="text-text-3">접수일</dt>
              <dd>{formatMyPageDate(quote.requestedAt)}</dd>
              <dt className="text-text-3">문의 제목</dt>
              <dd>{quote.title}</dd>
            </dl>
          </section>
          <section className="rounded-12 border border-line p-16 lg:p-24">
            <h2 className="text-label-m">요청 상품</h2>
            <div className="mt-12 grid grid-cols-[minmax(0,1fr)_64px_108px] gap-8 bg-surface px-10 py-10 text-caption text-text-2">
              <span>상품명</span>
              <span className="text-center">수량</span>
              <span className="text-right">비고</span>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_64px_108px] gap-8 border-b border-line px-10 py-14 text-body-s">
              <span>요청 상품 정보 미제공</span>
              <span className="text-center">—</span>
              <span className="text-right text-text-3">미제공</span>
            </div>
          </section>
          <section className="rounded-12 border border-line p-16 lg:p-24">
            <h2 className="text-label-m">요청 사항</h2>
            <dl className="mt-12 grid gap-10 text-body-s sm:grid-cols-[112px_minmax(0,1fr)]">
              <dt className="text-text-3">요청 내용</dt>
              <dd>{quote.title}</dd>
              <dt className="text-text-3">상세 요청</dt>
              <dd className="text-text-3">미제공</dd>
              <dt className="text-text-3">첨부 파일</dt>
              <dd className="text-text-3">첨부 내역 미제공</dd>
            </dl>
          </section>
        </div>
        <section className="rounded-12 border border-line p-16 lg:p-24">
          <h2 className="text-h3">견적 답변</h2>
          <dl className="mt-16 divide-y divide-line text-body-s">
            {[
              ['공급 금액', '미제공'],
              ['부가세', '미제공'],
              ['견적 유효기간', '미제공'],
              ['담당자', '미제공'],
              ['연락처', '미제공'],
              ['이메일', '미제공'],
              ['답변 내용', '답변 내용 미제공'],
              ['첨부 파일', '첨부 내역 미제공'],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[88px_minmax(0,1fr)] gap-12 py-12">
                <dt className="text-text-3">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <Button
            className="mt-16"
            isFullWidth
            disabled
            leadingIcon={<ArrowDownToLine size={18} aria-hidden="true" />}
          >
            견적서 다운로드 불가
          </Button>
          <p className="mt-8 text-caption text-text-3">견적 파일이 현재 제공되지 않습니다.</p>
        </section>
      </div>
      <div className="flex justify-center">
        <Button size="l" variant="secondary" onClick={() => router.push('/mypage/quotes')}>
          목록으로
        </Button>
      </div>
    </div>
  );
}
