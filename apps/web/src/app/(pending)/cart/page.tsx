import type { Metadata } from 'next';
import { CartPageView } from '@/features/checkout/cart-page';

export const metadata: Metadata = { title: '장바구니' };

export default function CartPage() {
  return <CartPageView />;
}
