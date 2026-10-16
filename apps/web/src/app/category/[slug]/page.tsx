import { ProductListingView } from '@/features/products/product-listing-view';
import {
  getBrandFilterValues,
  serializeSearchParams,
  type SearchParamValue,
} from '@/features/products/product-navigation';

/** 카테고리 상품은 요청마다 최신 가격과 재고를 확인합니다. */
export const dynamic = 'force-dynamic';

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const [routeParams, queryParams] = await Promise.all([params, searchParams]);
  return (
    <ProductListingView
      categorySlug={routeParams.slug}
      initialBrands={getBrandFilterValues(queryParams.brand)}
      initialSearchParams={serializeSearchParams(queryParams)}
    />
  );
}
