import { ComingSoon, createComingSoonMetadata } from '@/components/coming-soon';

// 준비 중 화면. 실제 화면을 만들 때 이 파일을 교체합니다.
export const metadata = createComingSoonMetadata('회사소개');

export default function AboutPage() {
  return <ComingSoon screenTitle="회사소개" />;
}
