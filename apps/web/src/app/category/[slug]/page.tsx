import { ProductListingView } from '@/features/products/product-listing-view';

/** 카테고리 상품은 요청마다 최신 가격과 재고를 확인합니다. */
export const dynamic = 'force-dynamic';

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const routeParams = await params;
  return <ProductListingView categorySlug={routeParams.slug} />;
}
