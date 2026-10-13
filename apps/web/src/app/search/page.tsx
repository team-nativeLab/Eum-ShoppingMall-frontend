import { ProductListingView } from '@/features/products/product-listing-view';

/** 검색 결과는 요청마다 최신 상품 가격과 재고를 확인합니다. */
export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  return <ProductListingView key={params.q ?? ''} initialKeyword={params.q ?? ''} />;
}
