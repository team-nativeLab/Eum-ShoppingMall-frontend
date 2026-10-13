import type { Metadata } from 'next';
import { PaymentPageView } from '@/features/checkout/payment-page';

export const metadata: Metadata = { title: '주문 · 결제' };

export default function CheckoutPaymentPage() {
  return <PaymentPageView />;
}
