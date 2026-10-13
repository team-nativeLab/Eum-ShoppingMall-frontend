import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { buttonClassName } from '@eum/ui/components/Button';

/** 요청한 페이지 경로가 없을 때 보여 주는 공통 404 화면입니다. */
export default function NotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="페이지를 찾을 수 없습니다"
      description="주소를 확인하거나 상품 목록으로 이동해 주세요."
      action={
        <Link href="/search" className={buttonClassName({ variant: 'secondary', size: 'm' })}>
          상품 둘러보기
        </Link>
      }
    />
  );
}
