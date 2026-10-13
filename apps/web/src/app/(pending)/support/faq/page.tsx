import { ComingSoon, createComingSoonMetadata } from '@/components/coming-soon';

// 준비 중 화면. 실제 화면을 만들 때 이 파일을 교체합니다.
export const metadata = createComingSoonMetadata('자주 묻는 질문');

export default function FaqPage() {
  return <ComingSoon screenTitle="자주 묻는 질문" />;
}
