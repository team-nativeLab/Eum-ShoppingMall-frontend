'use client';

import { calculateCartTotals, groupCartItems, resolveCartOption } from '@eum/api/cart';
import { formatKrw, getPriceDisplay } from '@eum/api/price';
import type { CartItem } from '@eum/api/types';
import { Button, buttonClassName } from '@eum/ui/components/Button';
import { Checkbox } from '@eum/ui/components/Checkbox';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { Icon } from '@eum/ui/components/Icon';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { QuantityStepper } from '@eum/ui/components/QuantityStepper';
import { cx } from '@eum/ui/lib/cx';
import { ShoppingCart, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { PageContainer } from '@/components/page-container';
import { useMemberSession } from '@/features/auth/member-session';
import { buildQuoteInquiryHref } from '@/features/company-pages/quote-inquiry-link';
import { useCart } from '@/features/cart/cart-context';
import { ProductImage } from '@/features/products/product-image';
import { useCheckout } from './checkout-context';
import { calculateShippingFee, resolveCheckoutOptions } from './checkout-utils';
import { useCheckoutOptionsQuery } from './use-checkout-queries';

/** W-05, W-05h, W-05h2: 주문 가능 상품만 선택·합산하고 숨은 가격·품절을 분리합니다. */
export function CartPageView() {
  const router = useRouter();
  const {
    cartItems,
    hasRestored,
    restoreError,
    orderCleanupError,
    isOrderPending: isCartOperationPending,
    changeQuantity,
    removeFromCart,
    retryRestore,
  } = useCart();
  const { member, status: memberStatus } = useMemberSession();
  const {
    beginCheckout,
    cartItemIds: persistedCartItemIds,
    isSelectionReady,
    isOrderPending: isCheckoutPending,
    selectionMode,
    setCartSelection,
  } = useCheckout();
  const isOrderPending = isCheckoutPending || isCartOperationPending;
  const optionsQuery = useCheckoutOptionsQuery();
  const resolvedOptions = optionsQuery.isError ? null : resolveCheckoutOptions(optionsQuery.data);
  const options = resolvedOptions?.options;
  const hasOptionsError = optionsQuery.isError || (optionsQuery.isSuccess && !resolvedOptions);
  const groups = useMemo(() => groupCartItems(cartItems), [cartItems]);
  const orderableIds = useMemo(
    () => groups.orderableItems.map((item) => item.id),
    [groups.orderableItems],
  );
  const selectedIds = useMemo(
    () =>
      selectionMode === 'defaultAll'
        ? new Set(orderableIds)
        : new Set(persistedCartItemIds.filter((id) => orderableIds.includes(id))),
    [orderableIds, persistedCartItemIds, selectionMode],
  );
  const selectedCount = selectedIds.size;
  const selectedTotals = calculateCartTotals(cartItems, selectedIds);
  const allSelected = orderableIds.length > 0 && selectedCount === orderableIds.length;
  const partiallySelected = selectedCount > 0 && !allSelected;

  const handleCheckout = () => {
    if (isOrderPending || !options || selectedCount === 0 || memberStatus !== 'ready') return;
    if (!beginCheckout([...selectedIds])) return;
    if (!member) {
      router.push('/login?redirect=' + encodeURIComponent('/checkout/shipping'));
      return;
    }
    router.push('/checkout/shipping');
  };

  if (orderCleanupError && (!hasRestored || cartItems.length === 0)) {
    return (
      <PageContainer className="py-40">
        <EmptyState
          icon={ShoppingCart}
          title="주문 후 장바구니 정리가 필요합니다"
          description="주문은 완료됐지만 주문한 수량을 장바구니에서 정리하지 못했습니다. 정리가 끝날 때까지 새 주문을 시작할 수 없습니다."
          action={
            <Button variant="secondary" onClick={retryRestore}>
              주문 후 장바구니 정리 다시 시도
            </Button>
          }
        />
      </PageContainer>
    );
  }

  if (((!hasRestored && !restoreError) || !isSelectionReady) && !orderCleanupError) {
    return (
      <PageContainer className="grid gap-24 py-40 lg:grid-cols-[minmax(0,1fr)_416px]">
        <div aria-busy="true" className="h-320 animate-pulse rounded-12 bg-surface" />
        <div className="h-300 animate-pulse rounded-12 bg-surface" />
      </PageContainer>
    );
  }
  if (restoreError && !orderCleanupError) {
    return (
      <PageContainer className="py-40">
        <EmptyState
          icon={ShoppingCart}
          title="장바구니를 불러오지 못했습니다"
          description="상품 정보를 확인할 수 없습니다. 연결을 확인한 뒤 다시 시도해 주세요."
          action={
            <Button variant="secondary" onClick={retryRestore}>
              다시 시도
            </Button>
          }
        />
      </PageContainer>
    );
  }
  if (cartItems.length === 0) {
    return (
      <PageContainer className="py-40">
        <h1 className="text-h1">장바구니</h1>
        <EmptyState
          icon={ShoppingCart}
          title="장바구니가 비어 있습니다"
          description="필요한 안전용품을 찾아 장바구니에 담아 보세요."
          action={
            <Link href="/search" className={buttonClassName({ size: 'm' })}>
              상품 둘러보기
            </Link>
          }
        />
      </PageContainer>
    );
  }

  const unresolvedAmountLabel = hasOptionsError ? '확인 필요' : '확인 중';
  const progress = options
    ? options.freeShippingThreshold > 0
      ? Math.min(
          100,
          Math.max(0, (selectedTotals.productTotal / options.freeShippingThreshold) * 100),
        )
      : 100
    : 0;
  const remaining = options
    ? Math.max(0, options.freeShippingThreshold - selectedTotals.productTotal)
    : 0;
  const hasFreeShipping =
    options !== undefined &&
    (options.freeShippingThreshold <= 0 ||
      selectedTotals.productTotal >= options.freeShippingThreshold);
  const shippingFee = options ? calculateShippingFee(selectedTotals.productTotal, options) : null;
  const showFreeShippingBanner = Boolean(options && resolvedOptions?.hasFreeShippingThreshold);
  const toggleSelected = (itemId: string, checked: boolean) => {
    if (isOrderPending) return;
    const next = new Set(selectedIds);
    if (checked) next.add(itemId);
    else next.delete(itemId);
    setCartSelection([...next]);
  };
  const deleteSelected = () => {
    if (isOrderPending || selectedIds.size === 0) return;
    removeFromCart(selectedIds);
    setCartSelection([]);
  };
  const handleToggleAll = () => {
    if (isOrderPending) return;
    setCartSelection(allSelected ? [] : orderableIds);
  };
  const handleRemoveItem = (itemId: string) => {
    if (isOrderPending) return;
    removeFromCart(new Set([itemId]));
    if (selectedIds.has(itemId)) {
      setCartSelection([...selectedIds].filter((selectedId) => selectedId !== itemId));
    }
  };

  return (
    <PageContainer className="py-32 lg:py-48">
      <div className="mb-24 flex flex-wrap items-center justify-between gap-16">
        <h1 className="text-h1">장바구니</h1>
        <nav aria-label="주문 진행" className="text-label-s text-text-3">
          <span aria-current="step" className="text-text-1">
            장바구니
          </span>
          <span aria-hidden="true" className="px-8">
            ›
          </span>{' '}
          주문/결제{' '}
          <span aria-hidden="true" className="px-8">
            ›
          </span>{' '}
          완료
        </nav>
      </div>
      {orderCleanupError ? (
        <div className="mb-20 max-w-720">
          <NoticeInline tone="danger" role="alert">
            주문은 완료됐지만 주문한 수량을 장바구니에서 정리하지 못했습니다. 정리가 끝날 때까지 새
            주문을 시작할 수 없습니다.
          </NoticeInline>
          <Button variant="secondary" className="mt-12" onClick={retryRestore}>
            주문 후 장바구니 정리 다시 시도
          </Button>
        </div>
      ) : null}
      <div className="grid items-start gap-24 lg:grid-cols-[minmax(0,1fr)_416px]">
        <div className="min-w-0">
          {showFreeShippingBanner && options ? (
            <section
              aria-label="무료 배송 혜택"
              className={cx(
                'mb-16 rounded-12 border p-24',
                hasFreeShipping ? 'border-success bg-success-tint' : 'border-text-1 bg-bg',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-8">
                <strong className={cx('text-h3', hasFreeShipping ? 'text-success' : 'text-text-1')}>
                  {remaining === 0
                    ? '무료 배송 기준을 충족했습니다.'
                    : `${formatKrw(remaining)} 더 담으면 무료배송!`}
                </strong>
                <span
                  className={cx('text-caption', hasFreeShipping ? 'text-success' : 'text-text-1')}
                >
                  {formatKrw(selectedTotals.productTotal)} /{' '}
                  {formatKrw(options.freeShippingThreshold)}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="무료 배송 기준 달성률"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
                className={cx(
                  'mt-12 h-8 overflow-hidden rounded-capsule',
                  hasFreeShipping ? 'bg-bg' : 'bg-bg-subtle',
                )}
              >
                <div
                  className={cx(
                    'h-full rounded-capsule transition-[width] duration-300 motion-reduce:transition-none',
                    hasFreeShipping ? 'bg-success' : 'bg-text-1',
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </section>
          ) : null}
          {!member && memberStatus === 'ready' ? (
            <div className="mb-24 flex flex-col items-stretch gap-12 sm:flex-row sm:items-center">
              <NoticeInline tone="neutral" className="flex-1">
                로그인하면 장바구니가 저장되고, 주문할 수 있습니다.
              </NoticeInline>
              <Link
                href="/login?redirect=%2Fcheckout%2Fshipping"
                className={buttonClassName({ variant: 'secondary', size: 's' })}
              >
                로그인
              </Link>
            </div>
          ) : null}
          {memberStatus === 'error' ? (
            <NoticeInline tone="danger" className="mb-16">
              회원 세션을 확인하지 못했습니다. 잠시 후 새로고침해 주세요.
            </NoticeInline>
          ) : null}
          {hasOptionsError ? (
            <div className="mb-16 flex flex-col items-start gap-8 sm:flex-row sm:items-center">
              <NoticeInline tone="danger" role="alert" className="w-full sm:flex-1">
                배송 정보를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.
              </NoticeInline>
              <Button
                variant="secondary"
                size="s"
                disabled={optionsQuery.isFetching}
                onClick={() => void optionsQuery.refetch()}
              >
                {optionsQuery.isFetching ? '불러오는 중…' : '다시 시도'}
              </Button>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-b-2 border-text-1 pb-12">
            <Checkbox
              checked={allSelected}
              isIndeterminate={partiallySelected}
              disabled={isOrderPending || orderableIds.length === 0}
              aria-label="주문 가능한 상품 전체 선택"
              onChange={handleToggleAll}
            >
              전체 선택 ({selectedCount}/{orderableIds.length})
            </Checkbox>
            <button
              type="button"
              disabled={isOrderPending || selectedCount === 0}
              onClick={deleteSelected}
              className="inline-flex items-center gap-6 rounded-4 text-label-s text-text-2 underline focus-ring disabled:text-text-disabled"
            >
              <Icon icon={Trash2} size={16} /> 선택 삭제
            </button>
          </div>
          <div className="mt-24 hidden grid-cols-[48px_minmax(0,1fr)_120px_112px_36px] bg-surface px-12 py-12 text-label-s text-text-3 md:grid">
            <span />
            <span>상품정보</span>
            <span className="text-center">수량</span>
            <span className="text-right">상품금액</span>
            <span className="text-right">삭제</span>
          </div>
          {groups.orderableItems.length > 0 ? (
            <section aria-labelledby="orderable-heading" className="mt-24 md:mt-0">
              <h2 id="orderable-heading" className="mb-12 px-12 text-title">
                주문 가능 상품 ({groups.orderableItems.length})
              </h2>
              <ul className="divide-y divide-line">
                {groups.orderableItems.map((item) => (
                  <CartLine
                    key={item.id}
                    item={item}
                    selected={selectedIds.has(item.id)}
                    isMutationDisabled={isOrderPending}
                    onSelect={(checked) => toggleSelected(item.id, checked)}
                    onQuantity={(quantity) => {
                      if (!isOrderPending) changeQuantity(item.id, quantity);
                    }}
                    onRemove={() => handleRemoveItem(item.id)}
                  />
                ))}
              </ul>
            </section>
          ) : null}
          {groups.unorderableItems.length > 0 ? (
            <section aria-labelledby="unorderable-heading" className="mt-32">
              <h2 id="unorderable-heading" className="text-title">
                주문할 수 없는 상품 ({groups.unorderableItems.length})
              </h2>
              <p className="mt-4 mb-12 text-body-s text-text-2">
                금액 미표시·품절 상품은 주문에서 제외됩니다. 수량 변경이나 삭제만 할 수 있습니다.
              </p>
              <ul className="divide-y divide-line">
                {groups.unorderableItems.map(({ cartItem, reason }) => (
                  <CartLine
                    key={cartItem.id}
                    item={cartItem}
                    selected={false}
                    isMutationDisabled={isOrderPending}
                    unavailableReason={reason}
                    onSelect={() => undefined}
                    onQuantity={(quantity) => {
                      if (!isOrderPending) changeQuantity(cartItem.id, quantity);
                    }}
                    onRemove={() => handleRemoveItem(cartItem.id)}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
        <aside className="h-fit rounded-12 border border-line bg-bg-subtle p-24 lg:sticky lg:top-96">
          <h2 className="text-h3">주문 예상 금액</h2>
          <dl className="mt-20 flex flex-col gap-12">
            <MoneyRow label="상품금액" value={selectedTotals.productTotal} />
            <MoneyRow label="할인" value={0} />
            <MoneyRow label="배송비" value={shippingFee} unavailableLabel={unresolvedAmountLabel} />
          </dl>
          <div className="my-20 border-t border-line-strong" />
          <div className="flex items-center justify-between gap-12">
            <span className="text-label-l">결제예정금액</span>
            <strong className="text-price-l">
              {shippingFee === null
                ? unresolvedAmountLabel
                : formatKrw(selectedTotals.productTotal + shippingFee)}
            </strong>
          </div>
          {groups.unorderableItems.length > 0 ? (
            <NoticeInline tone="info" className="mt-16">
              주문할 수 없는 상품 {groups.unorderableItems.length}개는 결제에서 제외됩니다.
            </NoticeInline>
          ) : null}
          {orderableIds.length === 0 ? (
            <Link
              href={buildQuoteInquiryHref(
                groups.unorderableItems.map(({ cartItem }) => ({
                  productId: cartItem.productId,
                  optionId: cartItem.optionId,
                  quantity: cartItem.quantity,
                })),
              )}
              className={cx(
                buttonClassName({ variant: 'secondary', size: 'l', isFullWidth: true }),
                'mt-24',
              )}
            >
              견적 문의하기
            </Link>
          ) : (
            <Button
              isFullWidth
              size="l"
              className="mt-24"
              disabled={
                isOrderPending || !options || memberStatus !== 'ready' || selectedCount === 0
              }
              onClick={handleCheckout}
            >
              {formatKrw(selectedTotals.productTotal)} 주문하기 ({selectedCount})
            </Button>
          )}
          <p className="mt-12 text-caption text-text-3">
            배송비·할인은 주문서에서 최종 확정됩니다.
          </p>
        </aside>
      </div>
      <p className="sr-only" aria-live="polite">
        선택한 주문 가능 상품 {selectedCount}개, 상품금액 {formatKrw(selectedTotals.productTotal)}
      </p>
    </PageContainer>
  );
}

function MoneyRow({
  label,
  value,
  unavailableLabel = '확인 필요',
}: {
  label: string;
  value: number | null;
  unavailableLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-12 text-body-s">
      <dt className="text-text-2">{label}</dt>
      <dd className="text-label-m">
        {value === null ? unavailableLabel : `${value < 0 ? '-' : ''}${formatKrw(Math.abs(value))}`}
      </dd>
    </div>
  );
}

function CartLine({
  item,
  selected,
  isMutationDisabled,
  unavailableReason,
  onSelect,
  onQuantity,
  onRemove,
}: {
  item: CartItem;
  selected: boolean;
  isMutationDisabled: boolean;
  unavailableReason?: 'priceHidden' | 'soldOut' | 'optionUnavailable';
  onSelect: (checked: boolean) => void;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const unavailable = Boolean(unavailableReason);
  const soldOut = unavailableReason === 'soldOut';
  const price = getPriceDisplay(item.product);
  const option = resolveCartOption(item.product, item.optionId);
  const linePrice =
    price.isPriceVisible && option.isAvailable
      ? formatKrw(((item.product.price ?? 0) + option.priceDelta) * item.quantity)
      : '구매 불가';

  return (
    <li
      className={cx(
        'grid grid-cols-[32px_minmax(0,1fr)] items-center gap-12 py-16 md:grid-cols-[48px_minmax(0,1fr)_120px_112px_36px]',
        unavailable && 'text-text-3',
      )}
    >
      <Checkbox
        checked={selected}
        disabled={isMutationDisabled || unavailable}
        aria-label={`${item.product.name} 선택`}
        onChange={(event) => onSelect(event.target.checked)}
      />
      <div className="flex min-w-0 items-center gap-16">
        <Link
          href={`/products/${encodeURIComponent(item.productId)}`}
          className="size-88 shrink-0 overflow-hidden rounded-8 bg-surface focus-ring"
        >
          <ProductImage src={item.product.thumbnailUrl} alt={`${item.product.name} 상품 이미지`} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-caption text-text-3">{item.product.brand}</p>
          <Link
            href={`/products/${encodeURIComponent(item.productId)}`}
            className="mt-4 inline-block rounded-4 text-body-s text-text-1 focus-ring"
          >
            {item.product.name}
          </Link>
          {soldOut ? (
            <p className="mt-4 inline-flex rounded-4 bg-text-2 px-6 py-2 text-caption text-inverse">
              품절
            </p>
          ) : null}
          {unavailableReason === 'priceHidden' ? (
            <p className="mt-4 inline-flex rounded-4 border border-line-strong px-6 py-2 text-caption">
              금액 미표시
            </p>
          ) : null}
          {unavailableReason === 'optionUnavailable' ? (
            <p className="mt-4 text-caption text-danger">옵션을 다시 선택해 주세요</p>
          ) : null}
          {item.optionLabel ? (
            <p className="mt-4 text-body-s text-text-2">옵션: {item.optionLabel}</p>
          ) : null}
          {item.product.options.length > 0 ? (
            <Link
              href={`/products/${encodeURIComponent(item.productId)}`}
              className="mt-4 inline-block rounded-4 text-caption text-text-2 underline focus-ring"
            >
              옵션 변경 · 상품 상세에서 선택
            </Link>
          ) : null}
        </div>
      </div>
      <div className="col-start-2 row-start-2 md:col-start-auto md:row-start-auto">
        <QuantityStepper
          size="s"
          value={item.quantity}
          label={`${item.product.name} 수량`}
          isDisabled={isMutationDisabled || soldOut}
          max={999}
          onValueChange={onQuantity}
        />
      </div>
      <p className="col-start-2 text-right text-label-m md:col-start-auto">
        {linePrice}
        {unavailableReason === 'priceHidden' ? (
          <Link
            href={buildQuoteInquiryHref([
              { productId: item.productId, optionId: item.optionId, quantity: item.quantity },
            ])}
            className="mt-4 block text-caption text-text-1 underline focus-ring"
          >
            견적 문의 →
          </Link>
        ) : null}
      </p>
      <button
        type="button"
        disabled={isMutationDisabled}
        onClick={onRemove}
        aria-label={`${item.product.name} 삭제`}
        className="col-start-1 row-start-2 inline-flex size-36 items-center justify-center rounded-8 text-text-3 focus-ring hover:bg-surface md:col-start-auto md:row-start-auto"
      >
        <Icon icon={X} size={16} />
      </button>
    </li>
  );
}
