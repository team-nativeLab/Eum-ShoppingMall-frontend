import { BrandDetailView } from '@/features/brands/brand-detail-view';

/** 브랜드 페이지의 상품 목록은 요청마다 최신 가격과 재고를 확인합니다. */
export const dynamic = 'force-dynamic';

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const routeParams = await params;
  return <BrandDetailView brandId={routeParams.brandId} />;
}
