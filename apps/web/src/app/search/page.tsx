import { ProductListingView } from '@/features/products/product-listing-view';
import {
  getBrandFilterValues,
  isBrandBrowseMode,
  serializeSearchParams,
  type SearchParamValue,
} from '@/features/products/product-navigation';

/** 검색 결과는 요청마다 최신 상품 가격과 재고를 확인합니다. */
export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const params = await searchParams;
  const initialKeyword = Array.isArray(params.q) ? (params.q[0] ?? '') : (params.q ?? '');
  return (
    <ProductListingView
      key={initialKeyword}
      initialKeyword={initialKeyword}
      initialBrands={getBrandFilterValues(params.brand)}
      initialBrowseBrands={isBrandBrowseMode(params.browse)}
      initialSearchParams={serializeSearchParams(params)}
    />
  );
}
