'use client';

import { CountBadge } from '@eum/ui/components/CountBadge';
import { Icon } from '@eum/ui/components/Icon';
import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { useCart } from '@/features/cart/cart-context';

/** 장바구니 바로가기와 담긴 수량 배지. 저장된 장바구니 복원이 끝나기 전에는 배지를 숨깁니다. */
export function CartLink() {
  const { totalQuantity, hasRestored } = useCart();
  const badgeCount = hasRestored ? totalQuantity : 0;
  return (
    <Link
      href="/cart"
      className="relative inline-flex size-44 items-center justify-center rounded-8 focus-ring hover:bg-surface"
    >
      <Icon icon={ShoppingCart} size={24} />
      <span className="sr-only">장바구니</span>
      <CountBadge
        count={badgeCount}
        label={`상품 ${badgeCount}개`}
        className="absolute top-6 right-2"
      />
    </Link>
  );
}
