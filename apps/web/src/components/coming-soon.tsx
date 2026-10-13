import { buttonClassName } from '@eum/ui/components/Button';
import { Icon } from '@eum/ui/components/Icon';
import { Construction } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageContainer } from './page-container';

/**
 * 아직 구현하지 않은 화면의 메타데이터. 검색 엔진이 빈 화면을 색인하지 않게 합니다.
 * 각 단계에서 실제 화면을 만들면 해당 page.tsx를 바꾸면서 이 메타데이터도 함께 교체합니다.
 */
export function createComingSoonMetadata(screenTitle: string): Metadata {
  return { title: screenTitle, robots: { index: false } };
}

/** 헤더·푸터·메뉴가 가리키지만 아직 만들지 않은 화면에 보여 주는 공통 "준비 중" 안내입니다. */
export function ComingSoon({ screenTitle }: { screenTitle: string }) {
  return (
    <PageContainer className="flex flex-col items-center py-80 text-center lg:py-120">
      <div className="flex size-64 items-center justify-center rounded-capsule bg-surface text-text-2">
        <Icon icon={Construction} size={28} />
      </div>
      <h1 className="mt-20 text-h3 text-text-1">{screenTitle}</h1>
      <p className="mt-8 text-body-s text-text-2">이 화면은 준비하고 있습니다.</p>
      <Link href="/" className={`${buttonClassName({ variant: 'secondary', size: 'm' })} mt-24`}>
        홈으로 가기
      </Link>
    </PageContainer>
  );
}
