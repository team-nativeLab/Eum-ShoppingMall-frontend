'use client';

import { calculateCartTotals, resolveCartOption } from '@eum/api/cart';
import { formatKrw } from '@eum/api/price';
import type { Address, CartItem, CheckoutOptions } from '@eum/api/types';
import { Button, buttonClassName } from '@eum/ui/components/Button';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { TextField } from '@eum/ui/components/TextField';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useCart } from '@/features/cart/cart-context';
import { useMemberSession } from '@/features/auth/member-session';
import { useCheckout } from './checkout-context';
import {
  CheckoutOrderSummary,
  CheckoutPageShell,
  CheckoutPageTitle,
  CheckoutSection,
  MockOnlyNotice,
} from './checkout-common';
import { calculateShippingFee, resolveCheckoutOptions } from './checkout-utils';
import { useAddressesQuery, useCheckoutOptionsQuery } from './use-checkout-queries';
import { useDirectCheckoutItems } from './use-direct-checkout-items';

interface ShippingFields {
  recipientName: string;
  phone: string;
  postalCode: string;
  address1: string;
  address2: string;
}

const EMPTY_SHIPPING_FIELDS: ShippingFields = {
  recipientName: '',
  phone: '',
  postalCode: '',
  address1: '',
  address2: '',
};

/** W-06 배송지: 기존 mock 주소 선택 또는 메모리 임시 입력 후 다음 단계로 전달합니다. */
export function ShippingPageView() {
  const router = useRouter();
  const {
    cartItems,
    cartGroups,
    hasRestored,
    restoreError,
    orderCleanupError,
    isOrderPending: isCartOperationPending,
    retryRestore,
  } = useCart();
  const { member, status: memberStatus } = useMemberSession();
  const checkout = useCheckout();
  const isOrderRequestPending = checkout.isOrderPending || isCartOperationPending;
  const addressesQuery = useAddressesQuery();
  const optionsQuery = useCheckoutOptionsQuery();
  const resolvedOptions = optionsQuery.isError ? null : resolveCheckoutOptions(optionsQuery.data);
  const options = resolvedOptions?.options;
  const hasOptionsError = optionsQuery.isError || (optionsQuery.isSuccess && !resolvedOptions);
  const amountsStatus = hasOptionsError ? 'error' : options ? 'ready' : 'loading';
  const isDirectCheckout = checkout.selectionSource === 'direct';
  const directItemsQuery = useDirectCheckoutItems(
    checkout.directLines,
    isDirectCheckout && checkout.checkoutStarted,
  );
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(checkout.shippingAddress);
  const [fields, setFields] = useState<ShippingFields>(
    checkout.shippingAddress ?? EMPTY_SHIPPING_FIELDS,
  );
  const [addressMode, setAddressMode] = useState<'saved' | 'new'>('saved');
  const [isChoosingAddress, setIsChoosingAddress] = useState(false);
  const [deliveryRequest, setDeliveryRequest] = useState(checkout.deliveryRequest);
  const [formError, setFormError] = useState('');

  const memberAddresses = useMemo(() => {
    if (!member || !addressesQuery.data) return [];
    // Mock API의 전체 주소 목록은 현재 목 회원의 휴대폰 번호와 일치하는 합성 주소만 표시합니다.
    return addressesQuery.data.filter((address) => address.phone === member.phone);
  }, [addressesQuery.data, member]);
  const defaultAddress =
    memberAddresses.find((address) => address.isDefault) ?? memberAddresses[0] ?? null;
  const selectedShipping = selectedAddress ?? defaultAddress;
  const directItems = directItemsQuery.data?.isValid ? directItemsQuery.data.items : [];
  const selectedIds = isDirectCheckout
    ? directItems.map((item) => item.id)
    : checkout.checkoutStarted
      ? checkout.cartItemIds.filter((id) =>
          cartGroups.orderableItems.some((item) => item.id === id),
        )
      : [];
  const checkoutItems = isDirectCheckout ? directItems : cartItems;

  useEffect(() => {
    if (
      memberStatus === 'ready' &&
      checkout.isSelectionReady &&
      (isDirectCheckout || hasRestored) &&
      !member
    )
      router.replace('/login?redirect=%2Fcheckout%2Fshipping');
  }, [checkout.isSelectionReady, hasRestored, isDirectCheckout, member, memberStatus, router]);

  const handleContinue = () => {
    if (!options || isOrderRequestPending) return;
    const nextAddress: Address | null =
      addressMode === 'saved'
        ? selectedShipping
        : { id: 'address-session-only', label: '직접 입력', ...fields, isDefault: false };
    if (
      !nextAddress?.recipientName.trim() ||
      !nextAddress.phone.trim() ||
      !nextAddress.postalCode.trim() ||
      !nextAddress.address1.trim()
    ) {
      setFormError('받는 분, 연락처, 우편번호와 주소를 입력해 주세요.');
      return;
    }
    setFormError('');
    if (!checkout.setShipping(nextAddress, deliveryRequest)) return;
    router.push('/checkout/payment');
  };

  if (!isDirectCheckout && restoreError && !orderCleanupError && checkout.isSelectionReady) {
    return (
      <CheckoutPageShell>
        <MockOnlyNotice>
          장바구니 상품을 복원하지 못했습니다. 장바구니로 돌아가 다시 확인해 주세요.
        </MockOnlyNotice>
        <div className="mt-24 flex flex-wrap gap-8">
          <Button variant="secondary" disabled={isOrderRequestPending} onClick={retryRestore}>
            장바구니 복원 다시 시도
          </Button>
          {isOrderRequestPending ? (
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
      (directItemsQuery.isPending || directItemsQuery.isFetching))
  ) {
    return (
      <CheckoutPageShell>
        <div aria-busy="true" className="h-480 animate-pulse rounded-12 bg-surface" />
      </CheckoutPageShell>
    );
  }
  if (memberStatus === 'error') {
    return (
      <CheckoutPageShell>
        <MockOnlyNotice>
          회원 세션을 확인하지 못했습니다. 목 인증이 준비되지 않았거나 실제 인증 API가 아직 연결되지
          않았습니다.
        </MockOnlyNotice>
      </CheckoutPageShell>
    );
  }
  if (!member) {
    return (
      <CheckoutPageShell>
        <MockOnlyNotice>로그인 화면으로 이동합니다. 로그인 후 주문서로 돌아옵니다.</MockOnlyNotice>
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
            disabled={directItemsQuery.isFetching}
          >
            {directItemsQuery.isFetching ? '불러오는 중…' : '상품 정보 다시 확인'}
          </Button>
          {isOrderRequestPending ? (
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
        {isOrderRequestPending ? (
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
  if (selectedIds.length === 0) {
    return (
      <CheckoutPageShell>
        <h1 className="text-h1">주문/결제</h1>
        <p className="mt-16 text-body-m text-text-2">주문할 수 있는 상품이 없습니다.</p>
        {isOrderRequestPending ? (
          <span aria-disabled="true" className="mt-24 text-body-s text-text-3">
            주문 처리 중입니다.
          </span>
        ) : (
          <Link
            href="/cart"
            className={buttonClassName({ variant: 'secondary', size: 'm' }) + ' mt-24'}
          >
            장바구니로 돌아가기
          </Link>
        )}
      </CheckoutPageShell>
    );
  }

  const orderItems = checkoutItems.filter((item) => selectedIds.includes(item.id));
  const productTotal = calculateCartTotals(checkoutItems, new Set(selectedIds)).productTotal;
  const shippingFee = options ? calculateShippingFee(productTotal, options) : 0;
  const shippingFeeLabel = options
    ? shippingFee === 0
      ? '무료'
      : formatKrw(shippingFee)
    : hasOptionsError
      ? '운임 확인 필요'
      : '운임 확인 중';
  const updateField = (field: keyof ShippingFields, value: string) =>
    setFields((current) => ({ ...current, [field]: value }));

  return (
    <CheckoutPageShell>
      <CheckoutPageTitle>주문/결제</CheckoutPageTitle>
      <MockOnlyNotice>
        배송지와 주문은 이 화면의 데모 입력으로만 처리됩니다. 실제 주문이나 결제는 진행되지
        않습니다.
      </MockOnlyNotice>
      {isOrderRequestPending ? (
        <p role="status" className="mt-16 text-body-s text-text-2">
          주문 요청 처리 중입니다. 요청 결과를 기다리는 동안 배송지를 변경하거나 다음 단계로 이동할
          수 없습니다.
        </p>
      ) : null}
      {hasOptionsError ? (
        <div className="mt-16 flex flex-col items-start gap-8 sm:flex-row sm:items-center">
          <NoticeInline tone="danger" role="alert" className="w-full sm:flex-1">
            배송 및 주문 선택지를 확인할 수 없습니다. 다시 시도해 주세요.
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
      <div className="mt-24 grid items-start gap-24 lg:grid-cols-[minmax(0,1fr)_416px]">
        <div className="flex min-w-0 flex-col gap-24">
          <CheckoutSection
            title={`주문 상품 (${orderItems.length})`}
            className="p-32"
            aside={<span className="text-caption text-text-3">{orderItems.length}개 상품</span>}
          >
            <ul className="divide-y divide-line">
              {orderItems.map((item) => (
                <li key={item.id} className="flex items-center gap-12 py-12 first:pt-0 last:pb-0">
                  <div className="size-56 shrink-0 overflow-hidden rounded-8 bg-surface">
                    <span className="sr-only">{item.product.name} 이미지</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-label-m">{item.product.name}</p>
                    <p className="mt-4 text-caption text-text-3">
                      {item.optionLabel ?? '기본'} · {item.quantity}개
                    </p>
                  </div>
                  <strong className="shrink-0 text-label-m">
                    {formatKrw(
                      ((item.product.price ?? 0) + resolvePriceDelta(item)) * item.quantity,
                    )}
                  </strong>
                </li>
              ))}
            </ul>
          </CheckoutSection>
          <CheckoutSection title="주문자 정보" className="p-32">
            <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-16 gap-y-12 text-body-s">
              <dt className="text-text-2">이름</dt>
              <dd>{member.name}</dd>
              <dt className="text-text-2">연락처</dt>
              <dd>{member.phone}</dd>
              <dt className="text-text-2">이메일</dt>
              <dd>{member.email}</dd>
            </dl>
          </CheckoutSection>
          <CheckoutSection
            title="배송지"
            className="p-32"
            aside={
              <Button
                variant="secondary"
                size="s"
                disabled={isOrderRequestPending}
                onClick={() => setIsChoosingAddress((open) => !open)}
                aria-expanded={isChoosingAddress}
              >
                {isChoosingAddress ? '닫기' : '변경'}
              </Button>
            }
          >
            {addressesQuery.isError ? (
              <div className="mb-12 flex flex-col items-start gap-8 sm:flex-row sm:items-center">
                <NoticeInline tone="danger" role="alert" className="w-full sm:flex-1">
                  저장 배송지를 불러오지 못했습니다. 직접 입력을 사용할 수 있습니다.
                </NoticeInline>
                <Button
                  variant="secondary"
                  size="s"
                  disabled={isOrderRequestPending || addressesQuery.isFetching}
                  onClick={() => void addressesQuery.refetch()}
                >
                  {addressesQuery.isFetching ? '불러오는 중…' : '다시 시도'}
                </Button>
              </div>
            ) : null}
            {isChoosingAddress ? (
              <fieldset className="mb-16 space-y-8" disabled={isOrderRequestPending}>
                <legend className="mb-8 text-label-m">저장 배송지</legend>
                {memberAddresses.map((address) => (
                  <label
                    key={address.id}
                    className="flex cursor-pointer items-start gap-8 rounded-8 border border-line p-12 focus-within:ring-2 focus-within:ring-text-1"
                  >
                    <input
                      type="radio"
                      name="saved-address"
                      checked={selectedShipping?.id === address.id}
                      onChange={() => {
                        setSelectedAddress(address);
                        setFields(address);
                        setAddressMode('saved');
                      }}
                      className="mt-2 accent-text-1"
                    />
                    <span>
                      <strong>{address.recipientName}</strong>
                      <span className="ml-8 text-caption text-text-2">{address.phone}</span>
                      {address.isDefault ? (
                        <span className="ml-8 rounded-4 bg-text-1 px-6 py-2 text-caption text-inverse">
                          기본 배송지
                        </span>
                      ) : null}
                      <span className="mt-4 block text-body-s">
                        {address.postalCode} {address.address1} {address.address2}
                      </span>
                    </span>
                  </label>
                ))}
                <Button
                  variant="ghost"
                  size="s"
                  onClick={() => {
                    setAddressMode('new');
                    setSelectedAddress(null);
                    setFields(EMPTY_SHIPPING_FIELDS);
                  }}
                >
                  새 배송지 직접 입력
                </Button>
              </fieldset>
            ) : null}
            {addressMode === 'saved' && selectedShipping ? (
              <div className="rounded-8 border border-line bg-bg-subtle p-16">
                <p className="text-body-s">
                  <strong>{selectedShipping.recipientName}</strong>
                  <span className="ml-8 text-text-2">{selectedShipping.phone}</span>
                  {selectedShipping.isDefault ? (
                    <span className="ml-8 rounded-4 bg-text-1 px-6 py-2 text-caption text-inverse">
                      기본 배송지
                    </span>
                  ) : null}
                </p>
                <p className="mt-8 text-body-s">
                  {selectedShipping.postalCode} {selectedShipping.address1}{' '}
                  {selectedShipping.address2}
                </p>
              </div>
            ) : null}
            {addressMode === 'saved' && !selectedShipping && addressesQuery.isPending ? (
              <div
                role="status"
                aria-label="저장 배송지를 불러오는 중입니다."
                aria-busy="true"
                className="h-72 animate-pulse rounded-8 bg-surface"
              />
            ) : null}
            {addressMode === 'new' ? (
              <div className="grid gap-12 sm:grid-cols-2">
                <TextField
                  label="받는 분"
                  disabled={isOrderRequestPending}
                  value={fields.recipientName}
                  onChange={(event) => updateField('recipientName', event.target.value)}
                  autoComplete="name"
                />
                <TextField
                  label="연락처"
                  type="tel"
                  disabled={isOrderRequestPending}
                  inputMode="tel"
                  value={fields.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                  autoComplete="tel"
                />
                <TextField
                  label="우편번호"
                  disabled={isOrderRequestPending}
                  value={fields.postalCode}
                  onChange={(event) => updateField('postalCode', event.target.value)}
                  autoComplete="postal-code"
                />
                <TextField
                  label="기본 주소"
                  disabled={isOrderRequestPending}
                  value={fields.address1}
                  onChange={(event) => updateField('address1', event.target.value)}
                  autoComplete="address-line1"
                />
                <TextField
                  label="상세 주소"
                  disabled={isOrderRequestPending}
                  value={fields.address2}
                  onChange={(event) => updateField('address2', event.target.value)}
                  autoComplete="address-line2"
                  className="sm:col-span-2"
                />
              </div>
            ) : null}
            {!selectedShipping && addressMode === 'saved' && !addressesQuery.isPending ? (
              <p className="text-body-s text-text-2">
                선택할 저장 배송지가 없습니다. 배송지를 직접 입력해 주세요.
              </p>
            ) : null}
            {addressMode === 'saved' && !selectedShipping && !addressesQuery.isPending ? (
              <Button
                variant="secondary"
                size="s"
                className="mt-12"
                disabled={isOrderRequestPending}
                onClick={() => setAddressMode('new')}
              >
                새 배송지 입력
              </Button>
            ) : null}
            {formError ? (
              <p role="alert" className="mt-12 text-body-s text-danger">
                {formError}
              </p>
            ) : null}
            <label className="mt-16 flex flex-col gap-8 text-label-m">
              배송 요청사항
              <div className="relative">
                <select
                  disabled={isOrderRequestPending}
                  value={deliveryRequest}
                  onChange={(event) => setDeliveryRequest(event.target.value)}
                  className="h-48 w-full appearance-none rounded-8 border border-line-strong bg-bg pr-40 pl-14 text-body-m focus-ring"
                >
                  <option value="">요청사항을 선택해 주세요</option>
                  {(options?.deliveryRequests ?? [])
                    .filter((option) => option.id !== 'none')
                    .map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
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
          </CheckoutSection>
          <CheckoutSection title="배송 방법" className="p-32">
            <fieldset>
              <legend className="sr-only">배송 방법</legend>
              {(options?.shippingMethods ?? []).map((method) => (
                <label
                  key={method.id}
                  className="flex min-h-56 w-full max-w-[300px] cursor-pointer items-center justify-center gap-8 rounded-8 border-[1.5px] border-text-1 px-20 py-12 text-label-m"
                >
                  <input
                    type="radio"
                    checked
                    readOnly
                    aria-label={`${method.label}, ${method.description}, 배송비 ${shippingFeeLabel}`}
                    className="accent-text-1"
                  />
                  <span>
                    {method.label} ({method.description} · {shippingFeeLabel})
                  </span>
                </label>
              ))}
            </fieldset>
          </CheckoutSection>
        </div>
        <CheckoutOrderSummary
          cartItems={checkoutItems}
          selectedCartItemIds={selectedIds}
          options={options ?? EMPTY_OPTIONS}
          showPointsRow={false}
          amountsStatus={amountsStatus}
          buttonLabel="결제 단계로"
          buttonDisabled={
            isOrderRequestPending ||
            !options ||
            selectedIds.length === 0 ||
            (addressMode === 'saved' && !selectedShipping)
          }
          onSubmit={handleContinue}
          caption="다음 단계에서 약관에 동의한 뒤 결제할 수 있습니다."
        />
      </div>
    </CheckoutPageShell>
  );
}

function resolvePriceDelta(item: CartItem) {
  const option = resolveCartOption(item.product, item.optionId);
  return option.isAvailable ? option.priceDelta : 0;
}

const EMPTY_OPTIONS: CheckoutOptions = {
  freeShippingThreshold: 0,
  shippingFee: 0,
  deliveryRequests: [],
  shippingMethods: [],
  paymentMethods: [],
};
