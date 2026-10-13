import { ComingSoon, createComingSoonMetadata } from '@/components/coming-soon';

// 준비 중 화면. 실제 화면을 만들 때 이 파일을 교체합니다.
export const metadata = createComingSoonMetadata('배송지 관리');

export default function AddressesPage() {
  return <ComingSoon screenTitle="배송지 관리" />;
}
