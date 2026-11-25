import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BrandDirectoryView } from '@/features/brands/brand-directory-view';

export const metadata: Metadata = { title: '브랜드' };

/**
 * W-32 브랜드 목록. 브랜드·상품 수는 BrandDirectoryView가 브라우저에서 요청마다 조회하므로
 * 이 페이지 껍데기는 정적으로 만들어도 오래된 값이 서버 HTML에 남지 않습니다.
 */
export default function BrandsPage() {
  // 선택 브랜드는 URL 쿼리에서 읽으므로(useSearchParams) 정적 생성 경계를 Suspense로 감쌉니다.
  return (
    <Suspense fallback={null}>
      <BrandDirectoryView />
    </Suspense>
  );
}
