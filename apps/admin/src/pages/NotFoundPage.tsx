import { buttonClassName } from '@eum/ui/components/Button';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { SearchX } from 'lucide-react';
import { Link } from 'react-router';

/** 없는 관리자 경로 안내 */
export function NotFoundPage() {
  return (
    <EmptyState
      icon={SearchX}
      title="페이지를 찾을 수 없습니다"
      description="주소를 다시 확인해 주십시오."
      headingLevel="h2"
      action={
        <Link to="/" className={buttonClassName({ variant: 'secondary' })}>
          대시보드로 이동
        </Link>
      }
    />
  );
}
