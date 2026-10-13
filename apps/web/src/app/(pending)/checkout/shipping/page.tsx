import type { Metadata } from 'next';
import { ShippingPageView } from '@/features/checkout/shipping-page';

export const metadata: Metadata = { title: '주문 · 배송지' };

export default function CheckoutShippingPage() {
  return <ShippingPageView />;
}
