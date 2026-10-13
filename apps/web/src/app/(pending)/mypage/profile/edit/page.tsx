import { ComingSoon, createComingSoonMetadata } from '@/components/coming-soon';

// 준비 중 화면. 실제 화면을 만들 때 이 파일을 교체합니다.
export const metadata = createComingSoonMetadata('내 정보 수정');

export default function ProfileEditPage() {
  return <ComingSoon screenTitle="내 정보 수정" />;
}
