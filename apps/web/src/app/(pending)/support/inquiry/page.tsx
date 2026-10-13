import { ComingSoon, createComingSoonMetadata } from '@/components/coming-soon';

// 준비 중 화면. 실제 화면을 만들 때 이 파일을 교체합니다.
export const metadata = createComingSoonMetadata('1:1 문의');

export default function InquiryPage() {
  return <ComingSoon screenTitle="1:1 문의" />;
}
