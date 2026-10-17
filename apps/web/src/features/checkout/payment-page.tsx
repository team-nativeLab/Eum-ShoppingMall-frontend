'use client';

import { calculateCartTotals, resolveCartOption } from '@eum/api/cart';
import { formatKrw } from '@eum/api/price';
import type { CartItem, PaymentMethod } from '@eum/api/types';
import { Button, buttonClassName } from '@eum/ui/components/Button';
import { Checkbox } from '@eum/ui/components/Checkbox';
import { Modal } from '@eum/ui/components/Modal';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { Radio } from '@eum/ui/components/Radio';
import { TextField } from '@eum/ui/components/TextField';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useCart } from '@/features/cart/cart-context';
import { useMemberSession } from '@/features/auth/member-session';
import { getShopApi } from '@/lib/shop-api';
import { useCheckout } from './checkout-context';
import {
  CheckoutOrderSummary,
  CheckoutPageShell,
  CheckoutPageTitle,
  CheckoutSection,
  MockOnlyNotice,
} from './checkout-common';
import {
  getCouponDiscount,
  resolveAvailablePaymentMethod,
  resolveCheckoutOptions,
} from './checkout-utils';
import { buildCheckoutOrderLines } from './direct-checkout-items';
import { useCheckoutOptionsQuery, useCouponsQuery } from './use-checkout-queries';
import { useDirectCheckoutItems } from './use-direct-checkout-items';

const REQUIRED_TERMS = ['order', 'privacy', 'payment'] as const;
type RequiredTerm = (typeof REQUIRED_TERMS)[number];
type ReceiptType = 'cash' | 'tax' | 'none';
interface OrderError {
  generation: number;
  message: string;
}

/** W-07 결제: 쿠폰·적립금·목 결제수단·약관 동의 후 mock receipt만 생성합니다. */
export function PaymentPageView() {
  const router = useRouter();
  const {
    cartItems,
    cartGroups,
    hasRestored,
    restoreError,
    orderCleanupError,
    isOrderPending: isCartOperationPending,
    retryRestore,
    consumeOrderedCartItems,
  } = useCart();
  const { member, status: memberStatus } = useMemberSession();
  const checkout = useCheckout();
  const optionsQuery = useCheckoutOptionsQuery();
  const couponsQuery = useCouponsQuery();
  const resolvedOptions = optionsQuery.isError ? null : resolveCheckoutOptions(optionsQuery.data);
  const options = resolvedOptions?.options;
  const hasOptionsError = optionsQuery.isError || (optionsQuery.isSuccess && !resolvedOptions);
  const isDirectCheckout = checkout.selectionSource === 'direct';
  const directItemsQuery = useDirectCheckoutItems(
    checkout.directLines,
    isDirectCheckout && checkout.checkoutStarted,
  );
  const directItems = directItemsQuery.data?.isValid ? directItemsQuery.data.items : [];
  const selectedIds = isDirectCheckout
    ? directItems.map((item) => item.id)
    : checkout.checkoutStarted
      ? checkout.cartItemIds.filter((id) =>
          cartGroups.orderableItems.some((item) => item.id === id),
        )
      : [];
  const selectedItems = isDirectCheckout
    ? directItems
    : cartItems.filter((item) => selectedIds.includes(item.id));
  const checkoutItems = isDirectCheckout ? directItems : cartItems;
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(checkout.paymentMethod);
  const [couponId, setCouponId] = useState<string | null>(checkout.couponId);
  const [pointsInput, setPointsInput] = useState(
    checkout.pointsToUse ? String(checkout.pointsToUse) : '0',
  );
  const [receiptType, setReceiptType] = useState<ReceiptType>('cash');
  const [receiptPhone, setReceiptPhone] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState<Record<RequiredTerm, boolean>>({
    order: false,
    privacy: false,
    payment: false,
  });
  const [orderError, setOrderError] = useState<OrderError | null>(null);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const isOrdering = checkout.isOrderPending || isCartOperationPending;
  const error = orderError?.generation === checkout.checkoutGeneration ? orderError.message : '';

  const availableCoupons = couponsQuery.data?.filter((coupon) => !coupon.isUsed) ?? [];
  const selectedCoupon = availableCoupons.find((coupon) => coupon.id === couponId);
  const productTotal = calculateCartTotals(checkoutItems, new Set(selectedIds)).productTotal;
  const pointsToUse = Math.min(Math.max(0, Number(pointsInput) || 0), member?.pointBalance ?? 0);
  const areTermsAccepted = REQUIRED_TERMS.every((term) => acceptedTerms[term]);
  const selectedPaymentMethod = options
    ? resolveAvailablePaymentMethod(paymentMethod, options.paymentMethods)
    : null;

  const toggleAllTerms = (checked: boolean) =>
    setAcceptedTerms({ order: checked, privacy: checked, payment: checked });
  const toggleTerm = (term: RequiredTerm, checked: boolean) =>
    setAcceptedTerms((current) => ({ ...current, [term]: checked }));

  const handleOrder = async () => {
    if (
      !member ||
      !checkout.shippingAddress ||
      !options ||
      !selectedPaymentMethod ||
      selectedIds.length === 0 ||
      !areTermsAccepted ||
      isOrdering
    )
      return;
    const orderedCartLines =
      checkout.selectionSource === 'cart'
        ? selectedItems.map(({ productId, optionId, quantity }) => ({
            productId,
            optionId,
            quantity,
          }))
        : [];
    const requestId = checkout.beginOrderRequest(checkout.checkoutGeneration);
    if (requestId === null) return;
    setOrderError(null);
    const couponDiscount = selectedCoupon ? getCouponDiscount(selectedCoupon, productTotal) : 0;
    const safePoints = Math.min(pointsToUse, Math.max(0, productTotal - couponDiscount));
    const expectedGeneration = checkout.setPayment(
      selectedPaymentMethod,
      couponId,
      safePoints,
      requestId,
    );
    try {
      const receipt = await (
        await getShopApi()
      ).orders.create({
        lines: buildCheckoutOrderLines(selectedItems),
        shippingAddress: checkout.shippingAddress,
        deliveryRequest: checkout.deliveryRequest,
        paymentMethod: selectedPaymentMethod,
        couponId,
        pointsToUse: safePoints,
      });
      const paymentLabel =
        options.paymentMethods.find((method) => method.id === selectedPaymentMethod)?.label ??
        '선택한 결제 수단';
      if (!checkout.isOrderRequestCurrent(requestId, expectedGeneration)) return;
      const didCompleteCheckout = checkout.completeCheckout(
        {
          ...receipt,
          paymentMethod: selectedPaymentMethod,
          paymentMethodLabel: paymentLabel,
          shippingAddress: checkout.shippingAddress,
        },
        expectedGeneration,
        requestId,
      );
      if (!didCompleteCheckout) return;
      if (orderedCartLines.length > 0) consumeOrderedCartItems(orderedCartLines);
      router.push('/checkout/complete');
    } catch (orderFailure: unknown) {
      if (!checkout.isOrderRequestCurrent(requestId, expectedGeneration)) {
        return;
      }
      const isNotImplemented =
        typeof orderFailure === 'object' &&
        orderFailure !== null &&
        'code' in orderFailure &&
        orderFailure.code === 'NOT_IMPLEMENTED';
      setOrderError({
        generation: expectedGeneration,
        message: isNotImplemented
          ? '실제 주문 API는 아직 연결되지 않았습니다. 데모 화면에서는 주문·결제가 처리되지 않습니다.'
          : '주문을 완료하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.',
      });
    } finally {
      checkout.finishOrderRequest(requestId);
    }
  };

  if (!isDirectCheckout && restoreError && !orderCleanupError) {
    return (
      <CheckoutPageShell>
        <MockOnlyNotice>
          장바구니 상품을 복원하지 못했습니다. 장바구니로 돌아가 다시 확인하거나 복원을 다시 시도해
          주세요.
        </MockOnlyNotice>
        <div className="mt-24 flex flex-wrap gap-8">
          <Button variant="secondary" disabled={isOrdering} onClick={retryRestore}>
            장바구니 복원 다시 시도
          </Button>
          {isOrdering ? (
            <span aria-disabled="true" className="text-body-s text-text-3">
              주문 처리 중입니다.
            </span>
          ) : (
            <Link href="/cart" className={buttonClassName({ variant: 'secondary', size: 'm' })}>
              장바구니로 돌아가기
            </Link>
          )}
        </div>
      </CheckoutPageShell>
    );
  }
  if (
    memberStatus === 'loading' ||
    !checkout.isSelectionReady ||
    (!isDirectCheckout && !hasRestored) ||
    (isDirectCheckout &&
      checkout.directLines.length > 0 &&
      (directItemsQuery.isPending || directItemsQuery.isFetching)) ||
    (!hasOptionsError && (optionsQuery.isPending || couponsQuery.isPending))
  ) {
    return (
      <CheckoutPageShell>
        <div aria-busy="true" className="h-600 animate-pulse rounded-12 bg-surface" />
      </CheckoutPageShell>
    );
  }
  if (memberStatus === 'error') {
    return (
      <CheckoutPageShell>
        <MockOnlyNotice>
          회원 세션을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.
        </MockOnlyNotice>
      </CheckoutPageShell>
    );
  }
  if (hasOptionsError || couponsQuery.isError) {
    return (
      <CheckoutPageShell>
        <CheckoutPageTitle>주문/결제</CheckoutPageTitle>
        <div className="flex flex-col items-start gap-12">
          {hasOptionsError ? (
            <div className="flex w-full flex-col items-start gap-8 sm:flex-row sm:items-center">
              <NoticeInline tone="danger" role="alert" className="w-full sm:flex-1">
                주문서 선택지를 확인할 수 없습니다. 다시 시도해 주세요.
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
          {couponsQuery.isError ? (
            <div className="flex w-full flex-col items-start gap-8 sm:flex-row sm:items-center">
              <NoticeInline tone="danger" role="alert" className="w-full sm:flex-1">
                쿠폰 정보를 불러오지 못했습니다. 다시 시도해 주세요.
              </NoticeInline>
              <Button
                variant="secondary"
                size="s"
                disabled={couponsQuery.isFetching}
                onClick={() => void couponsQuery.refetch()}
              >
                {couponsQuery.isFetching ? '불러오는 중…' : '다시 시도'}
              </Button>
            </div>
          ) : null}
        </div>
      </CheckoutPageShell>
    );
  }
  if (!options) {
    return (
      <CheckoutPageShell>
        <MockOnlyNotice>
          결제 선택지를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.
        </MockOnlyNotice>
        <Button
          variant="secondary"
          size="s"
          className="mt-16"
          disabled={optionsQuery.isFetching}
          onClick={() => void optionsQuery.refetch()}
        >
          {optionsQuery.isFetching ? '불러오는 중…' : '다시 시도'}
        </Button>
      </CheckoutPageShell>
    );
  }
  if (!member) {
    return (
      <CheckoutPageShell>
        <MockOnlyNotice>
          로그인이 필요합니다. 로그인 화면으로 이동한 뒤 다시 시도해 주세요.
        </MockOnlyNotice>
        <Link
          href="/login?redirect=%2Fcheckout%2Fpayment"
          className={buttonClassName({ size: 'm' }) + ' mt-20'}
        >
          로그인
        </Link>
      </CheckoutPageShell>
    );
  }
  if (isDirectCheckout && directItemsQuery.isError) {
    return (
      <CheckoutPageShell>
        <CheckoutPageTitle>주문/결제</CheckoutPageTitle>
        <NoticeInline tone="danger" role="alert">
          바로 구매 상품을 최신 정보로 확인하지 못했습니다. 다시 시도해 주세요.
        </NoticeInline>
        <div className="mt-24 flex flex-wrap gap-8">
          <Button
            variant="secondary"
            onClick={() => void directItemsQuery.refetch()}
            disabled={isOrdering || directItemsQuery.isFetching}
          >
            {directItemsQuery.isFetching ? '불러오는 중…' : '상품 정보 다시 확인'}
          </Button>
          {isOrdering ? (
            <span aria-disabled="true" className="text-body-s text-text-3">
              주문 처리 중입니다.
            </span>
          ) : (
            <Link href="/search" className={buttonClassName({ variant: 'secondary', size: 'm' })}>
              상품 다시 선택
            </Link>
          )}
        </div>
      </CheckoutPageShell>
    );
  }
  if (isDirectCheckout && directItemsQuery.data && !directItemsQuery.data.isValid) {
    return (
      <CheckoutPageShell>
        <CheckoutPageTitle>주문/결제</CheckoutPageTitle>
        <NoticeInline tone="danger" role="alert">
          선택한 상품이나 옵션을 더 이상 바로 구매할 수 없습니다. 상품을 다시 선택해 주세요.
        </NoticeInline>
        {isOrdering ? (
          <span aria-disabled="true" className="mt-24 text-body-s text-text-3">
            주문 처리 중입니다.
          </span>
        ) : (
          <Link
            href="/search"
            className={buttonClassName({ variant: 'secondary', size: 'm' }) + ' mt-24'}
          >
            상품 다시 선택
          </Link>
        )}
      </CheckoutPageShell>
    );
  }
  if (!checkout.shippingAddress || selectedIds.length === 0) {
    return (
      <CheckoutPageShell>
        <h1 className="text-h1">주문/결제</h1>
        <p className="mt-16 text-body-m text-text-2">배송지나 주문할 상품이 없습니다.</p>
        {isOrdering ? (
          <span aria-disabled="true" className="mt-24 text-body-s text-text-3">
            주문 처리 중입니다.
          </span>
        ) : (
          <Link
            href="/checkout/shipping"
            className={buttonClassName({ variant: 'secondary', size: 'm' }) + ' mt-24'}
          >
            배송지 단계로 돌아가기
          </Link>
        )}
      </CheckoutPageShell>
    );
  }

  const couponDiscount = selectedCoupon ? getCouponDiscount(selectedCoupon, productTotal) : 0;
  const canUsePoints = Math.max(0, productTotal - couponDiscount);
  const pointsBalance = member.pointBalance;
  const receiptPhoneError =
    receiptType === 'cash' &&
    receiptPhone.length > 0 &&
    receiptPhone.replace(/\D/g, '').length < 10;

  return (
    <CheckoutPageShell>
      <CheckoutPageTitle>주문/결제</CheckoutPageTitle>
      <MockOnlyNotice>
        결제 수단은 화면 확인용 선택입니다. 카드 정보는 받지 않으며 실제 주문이나 결제는 처리되지
        않습니다.
      </MockOnlyNotice>
      <div className="mt-24 grid items-start gap-24 lg:grid-cols-[minmax(0,1fr)_416px]">
        <div className="flex min-w-0 flex-col gap-20">
          <CheckoutSection
            title={`주문 상품 (${selectedItems.length})`}
            aside={
              <details>
                <summary className="cursor-pointer rounded-4 text-caption text-text-2 focus-ring">
                  상품 보기
                </summary>
                <ul className="mt-12 divide-y divide-line">
                  {selectedItems.map((item) => (
                    <li key={item.id} className="flex justify-between gap-12 py-8 text-body-s">
                      <span>
                        {item.product.name} · {item.quantity}개
                      </span>
                      <span>
                        {formatKrw(
                          ((item.product.price ?? 0) + getOptionDelta(item)) * item.quantity,
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            }
          >
            <p className="text-body-s text-text-2">
              선택한 주문 가능 상품 {selectedItems.length}개
            </p>
          </CheckoutSection>
          <CheckoutSection
            title="배송지"
            aside={
              isOrdering ? (
                <span aria-disabled="true" className="rounded-4 text-label-s text-text-3">
                  변경
                </span>
              ) : (
                <Link
                  href="/checkout/shipping"
                  className="rounded-4 text-label-s underline focus-ring"
                >
                  변경
                </Link>
              )
            }
          >
            <p className="text-body-s">
              <strong>{checkout.shippingAddress.recipientName}</strong>
              <span className="ml-8 text-text-2">{checkout.shippingAddress.phone}</span>
            </p>
            <p className="mt-8 text-body-s">
              {checkout.shippingAddress.postalCode} {checkout.shippingAddress.address1}{' '}
              {checkout.shippingAddress.address2}
            </p>
            {checkout.deliveryRequest ? (
              <p className="mt-8 text-body-s text-text-2">
                요청사항:{' '}
                {options.deliveryRequests.find((option) => option.id === checkout.deliveryRequest)
                  ?.label ?? checkout.deliveryRequest}
              </p>
            ) : null}
          </CheckoutSection>
          <CheckoutSection title="할인">
            <label className="flex flex-col gap-8 text-label-m">
              쿠폰
              <div className="relative">
                <select
                  disabled={isOrdering}
                  value={couponId ?? ''}
                  onChange={(event) => setCouponId(event.target.value || null)}
                  className="h-48 w-full appearance-none rounded-8 border border-line-strong bg-bg pr-40 pl-14 text-body-m focus-ring"
                >
                  <option value="">사용 가능한 쿠폰을 선택해 주세요</option>
                  {availableCoupons.map((coupon) => (
                    <option
                      key={coupon.id}
                      value={coupon.id}
                      disabled={productTotal < coupon.minOrderAmount}
                    >
                      {coupon.name} ·{' '}
                      {productTotal >= coupon.minOrderAmount
                        ? '사용 가능'
                        : `${formatKrw(coupon.minOrderAmount)} 이상`}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={20}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 right-14 -translate-y-1/2 text-text-1"
                />
              </div>
            </label>
            {selectedCoupon ? (
              <p className="mt-8 text-caption text-success">
                {formatKrw(couponDiscount)} 할인이 적용됩니다.
              </p>
            ) : null}
            <div className="mt-16 grid gap-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <TextField
                label="적립금"
                type="number"
                disabled={isOrdering}
                inputMode="numeric"
                min={0}
                max={Math.min(pointsBalance, canUsePoints)}
                value={pointsInput}
                onChange={(event) => setPointsInput(event.target.value.replace(/\D/g, ''))}
                helperText={`보유 적립금 ${formatKrw(pointsBalance)}`}
              />
              <Button
                variant="secondary"
                size="s"
                className="mb-24"
                disabled={isOrdering}
                onClick={() => setPointsInput(String(Math.min(pointsBalance, canUsePoints)))}
              >
                전액 사용
              </Button>
            </div>
          </CheckoutSection>
          <CheckoutSection title="결제 수단">
            <fieldset>
              <legend className="sr-only">결제 수단 선택</legend>
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3">
                {options.paymentMethods.map((method) => (
                  <label
                    key={method.id}
                    className="flex min-h-52 cursor-pointer items-center gap-10 rounded-8 border border-line px-16 py-12 focus-within:ring-2 focus-within:ring-text-1 has-[:checked]:border-text-1 has-[:checked]:bg-bg-subtle"
                  >
                    <Radio
                      name="payment-method"
                      value={method.id}
                      disabled={isOrdering}
                      checked={selectedPaymentMethod === method.id}
                      onChange={() => setPaymentMethod(method.id)}
                    />
                    <span className="text-label-m">{method.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="mt-12 text-caption text-text-2">
              카드·계좌 정보는 받지 않으며 결제 수단 선택만 확인합니다.
            </p>
          </CheckoutSection>
          <CheckoutSection title="현금영수증">
            <fieldset>
              <legend className="sr-only">현금영수증 발급 여부</legend>
              <div className="flex flex-wrap gap-x-20 gap-y-12">
                <Radio
                  name="receipt-type"
                  value="cash"
                  disabled={isOrdering}
                  checked={receiptType === 'cash'}
                  onChange={() => setReceiptType('cash')}
                >
                  소득공제용
                </Radio>
                <Radio
                  name="receipt-type"
                  value="tax"
                  disabled={isOrdering}
                  checked={receiptType === 'tax'}
                  onChange={() => setReceiptType('tax')}
                >
                  지출증빙용
                </Radio>
                <Radio
                  name="receipt-type"
                  value="none"
                  disabled={isOrdering}
                  checked={receiptType === 'none'}
                  onChange={() => setReceiptType('none')}
                >
                  신청 안 함
                </Radio>
              </div>
            </fieldset>
            {receiptType !== 'none' ? (
              <TextField
                className="mt-16 max-w-360"
                label={receiptType === 'tax' ? '사업자등록번호' : '휴대폰 번호'}
                type="tel"
                disabled={isOrdering}
                inputMode="numeric"
                autoComplete="off"
                value={receiptPhone}
                onChange={(event) => setReceiptPhone(event.target.value)}
                helperText="입력 값은 저장하지 않으며 목 화면에서만 사용합니다."
                errorMessage={receiptPhoneError ? '번호를 확인해 주세요.' : undefined}
              />
            ) : null}
          </CheckoutSection>
          <CheckoutSection
            title="주문 동의"
            aside={
              <Checkbox
                checked={areTermsAccepted}
                disabled={isOrdering}
                onChange={(event) => toggleAllTerms(event.target.checked)}
              >
                전체 동의
              </Checkbox>
            }
          >
            <div className="flex flex-col gap-12">
              <Checkbox
                checked={acceptedTerms.order}
                disabled={isOrdering}
                onChange={(event) => toggleTerm('order', event.target.checked)}
              >
                주문 상품 및 결제 금액을 확인했습니다. (필수)
              </Checkbox>
              <div className="flex flex-wrap items-center justify-between gap-8">
                <Checkbox
                  checked={acceptedTerms.privacy}
                  disabled={isOrdering}
                  onChange={(event) => toggleTerm('privacy', event.target.checked)}
                >
                  개인정보 수집·이용에 동의합니다. (필수)
                </Checkbox>
                <button
                  type="button"
                  disabled={isOrdering}
                  onClick={() => setIsPrivacyModalOpen(true)}
                  className="min-h-40 rounded-4 px-8 text-caption text-text-2 underline focus-ring"
                >
                  내용 보기
                </button>
              </div>
              <Checkbox
                checked={acceptedTerms.payment}
                disabled={isOrdering}
                onChange={(event) => toggleTerm('payment', event.target.checked)}
              >
                결제 진행에 동의합니다. (필수)
              </Checkbox>
            </div>
            <p className="mt-16 text-caption text-text-3">
              이 데모에서는 약관 선택 상태만 확인하며 실제 주문이나 결제는 처리되지 않습니다.
            </p>
            <Modal
              isOpen={isPrivacyModalOpen}
              onClose={() => setIsPrivacyModalOpen(false)}
              title="개인정보 수집·이용 동의"
              description="주문 접수와 배송, 결제 안내를 위해 필요한 정보를 처리합니다."
              actions={
                <>
                  <Link
                    href="/privacy"
                    className="inline-flex min-h-36 items-center rounded-8 px-12 text-label-m underline focus-ring"
                  >
                    개인정보처리방침
                  </Link>
                  <Button onClick={() => setIsPrivacyModalOpen(false)}>확인</Button>
                </>
              }
            >
              <div className="mt-16 max-h-[60dvh] overflow-y-auto rounded-8 border border-line p-16 text-body-s text-text-2">
                <p>처리 목적: 주문 확인, 결제 처리, 상품 배송과 고객 문의 응대</p>
                <p className="mt-12">
                  처리 항목: 주문자와 수령인 정보, 연락처, 배송지, 주문 상품 정보
                </p>
                <p className="mt-12">
                  보유 기간: 관련 법령에 따른 보관 기간 또는 처리 목적 달성 시까지
                </p>
                <p className="mt-12">
                  이 화면은 목 데모이며 실제 주문과 개인정보 처리는 발생하지 않습니다.
                </p>
              </div>
            </Modal>
          </CheckoutSection>
          {error ? (
            <p role="alert" className="rounded-8 bg-danger-tint p-12 text-body-s text-danger">
              {error}
            </p>
          ) : null}
        </div>
        <CheckoutOrderSummary
          cartItems={checkoutItems}
          selectedCartItemIds={selectedIds}
          options={options}
          coupon={selectedCoupon}
          pointsToUse={pointsToUse}
          buttonLabel="결제하기"
          buttonDisabled={
            !areTermsAccepted ||
            receiptPhoneError ||
            pointsToUse > pointsBalance ||
            isOrdering ||
            !selectedPaymentMethod
          }
          isPending={checkout.isOrderPending}
          onSubmit={() => void handleOrder()}
          caption="결제 버튼을 눌러도 실제 주문·결제는 처리되지 않습니다."
        />
      </div>
    </CheckoutPageShell>
  );
}

function getOptionDelta(item: CartItem): number {
  const resolvedOption = resolveCartOption(item.product, item.optionId);
  return resolvedOption.isAvailable ? resolvedOption.priceDelta : 0;
}
