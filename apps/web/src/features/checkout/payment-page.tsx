'use client';

import { calculateCartTotals, resolveCartOption } from '@eum/api/cart';
import { formatKrw } from '@eum/api/price';
import type { CartItem, PaymentMethod } from '@eum/api/types';
import { Button, buttonClassName } from '@eum/ui/components/Button';
import { Checkbox } from '@eum/ui/components/Checkbox';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { Radio } from '@eum/ui/components/Radio';
import { TextField } from '@eum/ui/components/TextField';
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
import { useCheckoutOptionsQuery, useCouponsQuery } from './use-checkout-queries';

const REQUIRED_TERMS = ['order', 'privacy', 'payment'] as const;
type RequiredTerm = (typeof REQUIRED_TERMS)[number];
type ReceiptType = 'cash' | 'tax' | 'none';

/** W-07 결제: 쿠폰·적립금·목 결제수단·약관 동의 후 mock receipt만 생성합니다. */
export function PaymentPageView() {
  const router = useRouter();
  const { cartItems, cartGroups, hasRestored, restoreError, removeFromCart, retryRestore } =
    useCart();
  const { member, status: memberStatus } = useMemberSession();
  const checkout = useCheckout();
  const optionsQuery = useCheckoutOptionsQuery();
  const couponsQuery = useCouponsQuery();
  const resolvedOptions = optionsQuery.isError ? null : resolveCheckoutOptions(optionsQuery.data);
  const options = resolvedOptions?.options;
  const hasOptionsError = optionsQuery.isError || (optionsQuery.isSuccess && !resolvedOptions);
  const selectedIds = checkout.checkoutStarted
    ? checkout.cartItemIds.filter((id) => cartGroups.orderableItems.some((item) => item.id === id))
    : [];
  const selectedItems = cartItems.filter((item) => selectedIds.includes(item.id));
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
  const [isOrdering, setIsOrdering] = useState(false);
  const [error, setError] = useState('');

  const availableCoupons = couponsQuery.data?.filter((coupon) => !coupon.isUsed) ?? [];
  const selectedCoupon = availableCoupons.find((coupon) => coupon.id === couponId);
  const productTotal = calculateCartTotals(cartItems, new Set(selectedIds)).productTotal;
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
    setError('');
    setIsOrdering(true);
    const couponDiscount = selectedCoupon ? getCouponDiscount(selectedCoupon, productTotal) : 0;
    const safePoints = Math.min(pointsToUse, Math.max(0, productTotal - couponDiscount));
    checkout.setPayment(selectedPaymentMethod, couponId, safePoints);
    try {
      const receipt = await (
        await getShopApi()
      ).orders.create({
        lines: selectedItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          optionId: item.optionId,
        })),
        shippingAddress: checkout.shippingAddress,
        deliveryRequest: checkout.deliveryRequest,
        paymentMethod: selectedPaymentMethod,
        couponId,
        pointsToUse: safePoints,
      });
      const paymentLabel =
        options.paymentMethods.find((method) => method.id === selectedPaymentMethod)?.label ??
        '선택한 결제 수단';
      checkout.completeCheckout({
        ...receipt,
        paymentMethod: selectedPaymentMethod,
        paymentMethodLabel: paymentLabel,
        shippingAddress: checkout.shippingAddress,
      });
      removeFromCart(new Set(selectedIds));
      router.push('/checkout/complete');
    } catch (orderFailure: unknown) {
      const isNotImplemented =
        typeof orderFailure === 'object' &&
        orderFailure !== null &&
        'code' in orderFailure &&
        orderFailure.code === 'NOT_IMPLEMENTED';
      setError(
        isNotImplemented
          ? '실제 주문 API는 아직 연결되지 않았습니다. 데모 화면에서는 주문·결제가 처리되지 않습니다.'
          : '주문을 완료하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.',
      );
    } finally {
      setIsOrdering(false);
    }
  };

  if (restoreError) {
    return (
      <CheckoutPageShell>
        <MockOnlyNotice>
          장바구니 상품을 복원하지 못했습니다. 장바구니로 돌아가 다시 확인하거나 복원을 다시 시도해
          주세요.
        </MockOnlyNotice>
        <div className="mt-24 flex flex-wrap gap-8">
          <Button variant="secondary" onClick={retryRestore}>
            장바구니 복원 다시 시도
          </Button>
          <Link href="/cart" className={buttonClassName({ variant: 'secondary', size: 'm' })}>
            장바구니로 돌아가기
          </Link>
        </div>
      </CheckoutPageShell>
    );
  }
  if (
    memberStatus === 'loading' ||
    !checkout.isSelectionReady ||
    !hasRestored ||
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
  if (!checkout.shippingAddress || selectedIds.length === 0) {
    return (
      <CheckoutPageShell>
        <h1 className="text-h1">주문/결제</h1>
        <p className="mt-16 text-body-m text-text-2">배송지나 주문할 상품이 없습니다.</p>
        <Link
          href="/checkout/shipping"
          className={buttonClassName({ variant: 'secondary', size: 'm' }) + ' mt-24'}
        >
          배송지 단계로 돌아가기
        </Link>
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
              <Link
                href="/checkout/shipping"
                className="rounded-4 text-label-s underline focus-ring"
              >
                변경
              </Link>
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
              <select
                value={couponId ?? ''}
                onChange={(event) => setCouponId(event.target.value || null)}
                className="h-48 w-full rounded-8 border border-line-strong bg-bg px-14 text-body-m focus-ring"
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
                  checked={receiptType === 'cash'}
                  onChange={() => setReceiptType('cash')}
                >
                  소득공제용
                </Radio>
                <Radio
                  name="receipt-type"
                  value="tax"
                  checked={receiptType === 'tax'}
                  onChange={() => setReceiptType('tax')}
                >
                  지출증빙용
                </Radio>
                <Radio
                  name="receipt-type"
                  value="none"
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
                onChange={(event) => toggleAllTerms(event.target.checked)}
              >
                전체 동의
              </Checkbox>
            }
          >
            <div className="flex flex-col gap-12">
              <Checkbox
                checked={acceptedTerms.order}
                onChange={(event) => toggleTerm('order', event.target.checked)}
              >
                주문 상품 및 결제 금액을 확인했습니다. (필수)
              </Checkbox>
              <Checkbox
                checked={acceptedTerms.privacy}
                onChange={(event) => toggleTerm('privacy', event.target.checked)}
              >
                개인정보 수집·이용에 동의합니다. (필수)
              </Checkbox>
              <Checkbox
                checked={acceptedTerms.payment}
                onChange={(event) => toggleTerm('payment', event.target.checked)}
              >
                결제 진행에 동의합니다. (필수)
              </Checkbox>
            </div>
            <p className="mt-16 text-caption text-text-3">
              이 데모에서는 약관 선택 상태만 확인하며 실제 주문이나 결제는 처리되지 않습니다.
            </p>
          </CheckoutSection>
          {error ? (
            <p role="alert" className="rounded-8 bg-danger-tint p-12 text-body-s text-danger">
              {error}
            </p>
          ) : null}
        </div>
        <CheckoutOrderSummary
          cartItems={cartItems}
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
          isPending={isOrdering}
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
