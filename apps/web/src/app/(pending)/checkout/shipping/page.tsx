import { ComingSoon, createComingSoonMetadata } from '@/components/coming-soon';

// 준비 중 화면. 실제 화면을 만들 때 이 파일을 교체합니다.
export const metadata = createComingSoonMetadata('주문 · 배송지');

export default function CheckoutShippingPage() {
  return <ComingSoon screenTitle="주문 · 배송지" />;
}
