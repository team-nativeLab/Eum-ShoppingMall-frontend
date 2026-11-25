import { BrandProductsView } from '@/features/brands/brand-products-view';

/** 브랜드 제품 목록은 요청마다 최신 가격과 재고를 확인합니다. */
export const dynamic = 'force-dynamic';

export default async function BrandProductsPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const routeParams = await params;
  return <BrandProductsView brandId={routeParams.brandId} />;
}
