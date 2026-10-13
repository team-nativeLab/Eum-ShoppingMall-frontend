import type { Metadata } from 'next';
import { CompletionPageView } from '@/features/checkout/completion-page';

export const metadata: Metadata = { title: '주문 완료' };

export default function CheckoutCompletePage() {
  return <CompletionPageView />;
}
