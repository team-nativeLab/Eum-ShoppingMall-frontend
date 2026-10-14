'use client';

import { CountBadge } from '@eum/ui/components/CountBadge';
import { Icon } from '@eum/ui/components/Icon';
import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { useCart } from '@/features/cart/cart-context';

/** 장바구니 바로가기와 현재 메모리·저장 장바구니 수량 배지. 0개면 배지를 숨깁니다. */
export function CartLink() {
  const { totalQuantity } = useCart();
  return (
    <Link
      href="/cart"
      className="relative inline-flex size-44 items-center justify-center rounded-8 focus-ring hover:bg-surface"
    >
      <Icon icon={ShoppingCart} size={24} />
      <span className="sr-only">장바구니</span>
      <CountBadge
        count={totalQuantity}
        label={`상품 ${totalQuantity}개`}
        className="absolute top-6 right-2"
      />
    </Link>
  );
}
