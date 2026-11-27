'use client';
import { queryKeys } from '@eum/api/query-keys';
import type { Coupon, CouponOffer, Point } from '@eum/api/types';
import { Button } from '@eum/ui/components/Button';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { Pagination } from '@eum/ui/components/Pagination';
import { TextField } from '@eum/ui/components/TextField';
import { cx } from '@eum/ui/lib/cx';
import { ChevronDown, TicketPercent } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { getWebApiConfig } from '@/lib/api-config';
import { getShopApi } from '@/lib/shop-api';
import { formatMyPageDate, formatMyPagePrice } from './mypage-data';
import {
  dateInputValue,
  isCouponExpired,
  shouldShowPresentationRows,
  subtractMonthsClamped,
} from './mypage-utils';
import { NoticeResult, TabBar, type LocalNotice } from './mypage-ui';
import { COUPON_LAYOUT_SAMPLES, POINT_LAYOUT_SAMPLES } from './mypage-presentation-fixtures';

type PointTab = 'all' | 'earned' | 'spent' | 'expired';

const POINT_TABS: { value: PointTab; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'earned', label: '적립' },
  { value: 'spent', label: '사용' },
  { value: 'expired', label: '소멸' },
];

function daysFromNow(value: string) {
  return Math.floor((new Date(value).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
}

export function CouponsView({
  coupons,
  offers,
  memberId,
}: {
  coupons: Coupon[];
  offers: CouponOffer[];
  memberId: string;
}) {
  const [tab, setTab] = useState<'available' | 'used'>('available');
  const [couponCode, setCouponCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<LocalNotice>(null);
  const [couponFeedback, setCouponFeedback] = useState<LocalNotice>(null);
  const queryClient = useQueryClient();
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
  const refreshCoupons = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.myPage.byMember(memberId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.coupons.all }),
    ]);
  };
  const registerCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!couponCode.trim())
      return setCouponFeedback({ tone: 'warning', message: '쿠폰 코드를 입력해 주세요.' });
    setIsSubmitting(true);
    try {
      await (await getShopApi()).coupons.redeemCode(couponCode.trim());
      setCouponCode('');
      setCouponFeedback({ tone: 'info', message: '쿠폰을 등록했습니다.' });
      await refreshCoupons();
    } catch (error) {
      setCouponFeedback({
        tone: 'warning',
        message: error instanceof Error ? error.message : '쿠폰 등록에 실패했습니다.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="space-y-20">
      <section className="flex flex-col gap-16 rounded-12 bg-surface p-16 sm:flex-row sm:items-center sm:justify-between lg:px-32 lg:py-24">
        <div>
          <p className="text-body-s text-text-2">사용 가능 쿠폰</p>
          <p className="mt-4 text-h2">{available}장</p>
        </div>
        <form onSubmit={(event) => void registerCoupon(event)} className="w-full sm:max-w-420">
          <div className="flex gap-8">
            <TextField
              label="쿠폰 코드"
              isLabelHidden
              name="couponCode"
              value={couponCode}
              onChange={(event) => {
                setCouponCode(event.target.value);
                setCouponFeedback(null);
              }}
              placeholder="쿠폰 코드를 입력해 주세요"
              disabled={isSubmitting}
              aria-describedby={couponFeedback ? 'coupon-code-feedback' : undefined}
              aria-invalid={couponFeedback?.tone === 'warning'}
            />
            <Button type="submit" className="self-start" disabled={isSubmitting}>
              {isSubmitting ? '등록 중…' : '등록'}
            </Button>
          </div>
          {couponFeedback ? (
            <NoticeInline
              id="coupon-code-feedback"
              tone={couponFeedback.tone === 'warning' ? 'danger' : 'info'}
              role={couponFeedback.tone === 'warning' ? 'alert' : 'status'}
              className="mt-8"
            >
              {couponFeedback.message}
            </NoticeInline>
          ) : null}
        </form>
      </section>
      {offers.length ? (
        <section aria-label="받을 수 있는 쿠폰" className="rounded-12 border border-line p-16">
          <h3 className="text-label-l">받을 수 있는 쿠폰</h3>
          <ul className="mt-12 grid gap-12 sm:grid-cols-2">
            {offers.map((offer) => (
              <li
                key={offer.id}
                className="flex items-center justify-between gap-12 rounded-8 bg-surface p-12"
              >
                <div>
                  <p className="text-label-m">{offer.name}</p>
                  <p className="mt-4 text-caption text-text-2">
                    {offer.discountType === 'rate'
                      ? `${offer.discountValue}% 할인`
                      : `${formatMyPagePrice(offer.discountValue)} 할인`}
                  </p>
                </div>
                {offer.issueMethod === 'download' ? (
                  <Button
                    size="s"
                    variant="secondary"
                    disabled={isSubmitting || offer.isAcquired}
                    onClick={() => {
                      setIsSubmitting(true);
                      void (async () => {
                        try {
                          await (await getShopApi()).coupons.acquire(offer.id);
                          setNotice({ tone: 'info', message: '쿠폰을 받았습니다.' });
                          await refreshCoupons();
                        } catch (error) {
                          setNotice({
                            tone: 'warning',
                            message:
                              error instanceof Error ? error.message : '쿠폰을 받지 못했습니다.',
                          });
                        } finally {
                          setIsSubmitting(false);
                        }
                      })();
                    }}
                  >
                    {offer.isAcquired ? '받은 쿠폰' : '쿠폰 받기'}
                  </Button>
                ) : offer.issueMethod === 'automatic' ? (
                  <span className="text-caption text-text-2">자동 발급</span>
                ) : (
                  <span className="text-caption text-text-2">코드 등록</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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
            ? COUPON_LAYOUT_SAMPLES.map((coupon) => (
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

export function PointsView({ memberBalance, points }: { memberBalance: number; points: Point[] }) {
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
  const pointLayoutRows =
    isPresentationMode && periodMonths === 3
      ? POINT_LAYOUT_SAMPLES.filter((point) => tab === 'all' || point.bucket === tab)
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
