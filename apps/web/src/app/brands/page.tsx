import type { Metadata } from 'next';
import { BrandDirectoryView } from '@/features/brands/brand-directory-view';

export const metadata: Metadata = { title: '브랜드' };

/**
 * W-32 브랜드 목록. 브랜드·상품 수는 BrandDirectoryView가 브라우저에서 요청마다 조회하므로
 * 이 페이지 껍데기는 정적으로 만들어도 오래된 값이 서버 HTML에 남지 않습니다.
 */
export default function BrandsPage() {
  return <BrandDirectoryView />;
}
