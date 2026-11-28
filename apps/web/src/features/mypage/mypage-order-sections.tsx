'use client';
import type { Coupon, Order, OrderStatus } from '@eum/api/types';
import { Badge } from '@eum/ui/components/Badge';
import { Button } from '@eum/ui/components/Button';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { Modal } from '@eum/ui/components/Modal';
import { Pagination } from '@eum/ui/components/Pagination';
import { cx } from '@eum/ui/lib/cx';
import { ArrowRight, Check, ChevronRight, Package, ShoppingBag, UserRound, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getWebApiConfig } from '@/lib/api-config';
import { MyPageActionLink } from './mypage-shell';
import { formatMyPageDate, formatMyPagePrice, type MyPageData } from './mypage-data';
import {
  dateInputValue,
  getTrackingProgressIndex,
  isCouponExpired,
  shouldShowPresentationRows,
  subtractMonthsClamped,
} from './mypage-utils';
import { DateRangeFilter, DividerTitle, StatusBadge, TabBar } from './mypage-ui';
import { ORDER_LAYOUT_SAMPLE } from './mypage-presentation-fixtures';

type OrderTab = OrderStatus | 'all';

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

const ORDER_TABS: { value: OrderTab; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'paymentPending', label: '입금대기' },
  { value: 'paid', label: '결제완료' },
  { value: 'preparing', label: '배송준비' },
  { value: 'shipping', label: '배송중' },
  { value: 'delivered', label: '배송완료' },
  { value: 'canceled', label: '취소' },
];

const ORDER_STAGE_ORDER: OrderStatus[] = [
  'paymentPending',
  'paid',
  'preparing',
  'shipping',
  'delivered',
];

export function DashboardSummary({
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
              {stat.value === undefined ? (
                <span className="text-body-s text-text-3">미제공</span>
              ) : (
                <Link href={stat.href} className="rounded-4 focus-ring hover:underline">
                  {new Intl.NumberFormat('ko-KR').format(stat.value)}
                </Link>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function DashboardView({
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
            <MyPageActionLink
              href={`/mypage/claims/new?orderId=${encodeURIComponent(order.id)}&type=cancel`}
            >
              주문 취소 신청
            </MyPageActionLink>
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
              ['택배사', order.trackingCarrier || '등록되지 않음'],
              ['송장 번호', order.trackingNumber || '등록되지 않음'],
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

export function OrdersView({ orders }: { orders: Order[] }) {
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
          <time className="text-label-m">{ORDER_LAYOUT_SAMPLE.date}</time>
          <span className="text-caption text-text-3">
            주문번호 {ORDER_LAYOUT_SAMPLE.orderNumber}
          </span>
        </div>
        <span className="text-label-s text-text-2">주문 상세</span>
      </div>
      <div className="mt-16 flex flex-col gap-16 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-12">
          <div aria-hidden="true" className="size-64 shrink-0 rounded-8 bg-surface" />
          <div className="min-w-0">
            <StatusBadge {...ORDER_STATUS_META[status]} />
            <p className="mt-6 truncate text-label-m">{ORDER_LAYOUT_SAMPLE.productName}</p>
            <p className="mt-4 text-caption text-text-2">
              {ORDER_LAYOUT_SAMPLE.unitPrice} · {ORDER_LAYOUT_SAMPLE.quantity}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-8 sm:justify-end">
          <Button size="s" variant="secondary" disabled>
            주문 취소
          </Button>
          <span className="min-w-104 text-right text-price-m">
            {ORDER_LAYOUT_SAMPLE.totalPrice}
          </span>
        </div>
      </div>
    </article>
  );
}

export function OrderDetailView({ order }: { order?: Order }) {
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
                  {line.optionLabel ? (
                    <p className="mt-4 text-caption text-text-2">옵션 {line.optionLabel}</p>
                  ) : null}
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
        <p className="mt-12 text-caption text-text-3">배송 추적 서비스 연동은 제공하지 않습니다.</p>
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

export function PriceRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between gap-12">
      <dt className="text-text-2">{label}</dt>
      <dd className="tabular-nums">
        {amount < 0 ? `-${formatMyPagePrice(Math.abs(amount))}` : formatMyPagePrice(amount)}
      </dd>
    </div>
  );
}
