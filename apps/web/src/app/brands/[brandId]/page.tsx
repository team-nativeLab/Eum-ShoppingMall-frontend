import type { Metadata } from 'next';
import { BrandDetailView } from '@/features/brands/brand-detail-view';

/** 브랜드 상세는 요청마다 브랜드 공개 여부와 상품을 확인합니다(상품 상세와 같은 방식). */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: '브랜드' };

export default async function BrandPage({ params }: { params: Promise<{ brandId: string }> }) {
  const routeParams = await params;
  return <BrandDetailView brandId={routeParams.brandId} />;
}
