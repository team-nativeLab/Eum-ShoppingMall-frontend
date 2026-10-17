'use client';

import { formatKrw } from '@eum/api/price';
import type { CartItem, CheckoutOptions, Coupon } from '@eum/api/types';
import { Button } from '@eum/ui/components/Button';
import { Icon } from '@eum/ui/components/Icon';
import { cx } from '@eum/ui/lib/cx';
import { CircleAlert } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageContainer } from '@/components/page-container';
import { calculateCheckoutAmounts, getCouponDiscount } from './checkout-utils';

export function CheckoutPageTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-24 flex flex-wrap items-center justify-between gap-16">
      <h1 className="text-h1">{children}</h1>
      <Link href="/cart" className="rounded-4 text-label-s text-text-2 underline focus-ring">
        장바구니로 돌아가기
      </Link>
    </div>
  );
}

export function CheckoutSection({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('rounded-12 border border-line p-24', className)}>
      <div className="mb-20 flex items-center justify-between gap-16">
        <h2 className="text-h3">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function MockOnlyNotice({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-8 rounded-12 bg-warning-tint px-16 py-12 text-body-s text-warning">
      <Icon icon={CircleAlert} size={20} className="mt-1 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function CheckoutOrderSummary({
  cartItems,
  selectedCartItemIds,
  options,
  coupon,
  pointsToUse = 0,
  showPointsRow = true,
  amountsStatus = 'ready',
  buttonLabel,
  buttonDisabled = false,
  isPending = false,
  onSubmit,
  caption,
}: {
  cartItems: readonly CartItem[];
  selectedCartItemIds: readonly string[];
  options: CheckoutOptions;
  coupon?: Coupon;
  pointsToUse?: number;
  showPointsRow?: boolean;
  amountsStatus?: 'ready' | 'loading' | 'error';
  buttonLabel: string;
  buttonDisabled?: boolean;
  isPending?: boolean;
  onSubmit?: () => void;
  caption: string;
}) {
  const amounts = calculateCheckoutAmounts({
    cartItems,
    selectedCartItemIds,
    options,
    coupon,
    pointsToUse,
  });
  const selectedCount = cartItems.filter((item) => selectedCartItemIds.includes(item.id)).length;
  const couponDiscount = coupon ? getCouponDiscount(coupon, amounts.productTotal) : 0;
  const unresolvedAmountLabel = amountsStatus === 'loading' ? '확인 중' : '확인 필요';
  return (
    <aside className="h-fit rounded-12 border border-line bg-bg-subtle p-24 lg:sticky lg:top-96">
      <h2 className="text-h3">결제 금액</h2>
      <dl className="mt-20 flex flex-col gap-12">
        <MoneyRow label="상품금액" amount={amounts.productTotal} />
        <MoneyRow label="할인" amount={-couponDiscount} />
        {showPointsRow ? <MoneyRow label="적립금" amount={-amounts.pointsUsed} /> : null}
        <MoneyRow
          label="배송비"
          amount={amountsStatus === 'ready' ? amounts.shippingFee : null}
          unavailableLabel={unresolvedAmountLabel}
        />
      </dl>
      <div className="my-20 border-t border-line-strong" />
      <div className="flex items-center justify-between gap-12">
        <span className="text-label-l">
          {buttonLabel.includes('결제') ? '최종 결제금액' : '결제예정금액'}
        </span>
        <strong className="text-price-l">
          {amountsStatus === 'ready' ? formatKrw(amounts.paymentTotal) : unresolvedAmountLabel}
        </strong>
      </div>
      <Button
        type={onSubmit ? 'button' : 'button'}
        className="mt-24"
        isFullWidth
        size="l"
        disabled={buttonDisabled || isPending}
        onClick={onSubmit}
      >
        {isPending ? '처리 중…' : `${buttonLabel} (${selectedCount})`}
      </Button>
      <p className="mt-12 text-caption text-text-3">{caption}</p>
    </aside>
  );
}

export function MoneyRow({
  label,
  amount,
  unavailableLabel = '확인 필요',
}: {
  label: string;
  amount: number | null;
  unavailableLabel?: string;
}) {
  const isDiscount = amount !== null && amount < 0;
  return (
    <div className="flex items-center justify-between gap-12 text-body-s">
      <dt className="text-text-2">{label}</dt>
      <dd className={cx('text-label-m', isDiscount && 'text-text-1')}>
        {amount === null
          ? unavailableLabel
          : isDiscount
            ? `-${formatKrw(Math.abs(amount))}`
            : formatKrw(amount)}
      </dd>
    </div>
  );
}

export function CheckoutPageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <PageContainer className={cx('py-40 lg:py-48', className)}>{children}</PageContainer>;
}
