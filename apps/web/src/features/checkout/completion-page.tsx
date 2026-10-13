'use client';

import { formatKrw } from '@eum/api/price';
import { Button, buttonClassName } from '@eum/ui/components/Button';
import { CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckoutPageShell, MockOnlyNotice } from './checkout-common';
import { useCheckout } from './checkout-context';

/** W-08 목 주문 완료 결과를 메모리 receipt로만 표시합니다. */
export function CompletionPageView() {
  const checkout = useCheckout();
  const router = useRouter();
  const receipt = checkout.receipt;

  const handleContinueShopping = () => {
    checkout.resetCheckout();
    router.push('/search');
  };

  if (!receipt) {
    return (
      <CheckoutPageShell>
        <section className="rounded-16 mx-auto max-w-640 border border-line p-24 text-center sm:p-40">
          <h1 className="text-h1">주문 결과를 찾을 수 없습니다</h1>
          <p className="mt-12 text-body-m text-text-2">
            완료 정보는 현재 화면을 여는 동안에만 유지됩니다.
          </p>
          <Link href="/search" className={buttonClassName({ size: 'm' }) + ' mt-24'}>
            상품 둘러보기
          </Link>
        </section>
      </CheckoutPageShell>
    );
  }

  return (
    <CheckoutPageShell>
      <section className="rounded-16 mx-auto max-w-720 border border-line p-24 sm:p-40">
        <div className="text-center">
          <CircleCheck
            aria-hidden="true"
            className="mx-auto text-success"
            size={56}
            strokeWidth={1.5}
          />
          <h1 className="mt-16 text-h1">주문이 완료되었습니다</h1>
          <p className="mt-8 text-body-m text-text-2">
            데모 주문 내역을 만들었습니다. 실제 주문이나 결제는 처리되지 않았습니다.
          </p>
          <MockOnlyNotice>
            이 주문 번호는 현재 브라우저 세션에서만 표시되는 예시이며 서버에 저장되지 않습니다.
          </MockOnlyNotice>
        </div>
        <dl className="mt-28 grid gap-16 rounded-12 bg-bg-subtle p-20 sm:grid-cols-2">
          <div>
            <dt className="text-caption text-text-2">주문 번호</dt>
            <dd className="mt-4 text-label-l">{receipt.orderNumber}</dd>
          </div>
          <div>
            <dt className="text-caption text-text-2">결제 수단</dt>
            <dd className="mt-4 text-label-l">{receipt.paymentMethodLabel}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-caption text-text-2">배송지</dt>
            <dd className="mt-4 text-body-s">
              <strong>{receipt.shippingAddress.recipientName}</strong>
              <span className="ml-8 text-text-2">{receipt.shippingAddress.phone}</span>
              <span className="mt-4 block">
                {receipt.shippingAddress.postalCode} {receipt.shippingAddress.address1}{' '}
                {receipt.shippingAddress.address2}
              </span>
            </dd>
          </div>
        </dl>
        <dl className="mt-24 flex flex-col gap-12">
          <div className="flex justify-between gap-12 text-body-s">
            <dt className="text-text-2">상품 금액</dt>
            <dd>{formatKrw(receipt.productTotal)}</dd>
          </div>
          <div className="flex justify-between gap-12 text-body-s">
            <dt className="text-text-2">할인</dt>
            <dd>-{formatKrw(receipt.discountTotal)}</dd>
          </div>
          <div className="flex justify-between gap-12 text-body-s">
            <dt className="text-text-2">배송비</dt>
            <dd>{formatKrw(receipt.shippingFee)}</dd>
          </div>
          <div className="flex justify-between gap-12 text-body-s">
            <dt className="text-text-2">사용 적립금</dt>
            <dd>-{formatKrw(receipt.pointsUsed)}</dd>
          </div>
          <div className="mt-4 flex justify-between gap-12 border-t border-line-strong pt-16">
            <dt className="text-label-l">결제 예정 금액</dt>
            <dd className="text-price-l">{formatKrw(receipt.paymentTotal)}</dd>
          </div>
        </dl>
        <div className="mt-28 grid gap-12 sm:grid-cols-2">
          <Button variant="secondary" size="m" onClick={handleContinueShopping}>
            쇼핑 계속하기
          </Button>
          <Link href="/mypage/orders" className={buttonClassName({ size: 'm' })}>
            주문 내역 보기
          </Link>
        </div>
      </section>
    </CheckoutPageShell>
  );
}
