import { redirect } from 'next/navigation';
import { ProductListingView } from '@/features/products/product-listing-view';
import {
  getBrandFilterValues,
  serializeSearchParams,
  type SearchParamValue,
} from '@/features/products/product-navigation';

/** 검색 결과는 요청마다 최신 상품 가격과 재고를 확인합니다. */
export const dynamic = 'force-dynamic';

/** 검색어 또는 브랜드 필터 값 중 하나라도 비어 있지 않은지 확인합니다. */
function hasSearchParamValue(value: SearchParamValue): boolean {
  const values = Array.isArray(value) ? value : [value];
  return values.some((entry) => entry !== undefined && entry.trim() !== '');
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const params = await searchParams;
  // 예전 GNB 주소는 전용 브랜드 화면으로 이동하되, 상품 검색 의도는 유지합니다.
  const browseValues = Array.isArray(params.browse) ? params.browse : [params.browse];
  if (
    browseValues.includes('brands') &&
    !hasSearchParamValue(params.brand) &&
    !hasSearchParamValue(params.q)
  ) {
    redirect('/brands');
  }
  const initialKeyword = Array.isArray(params.q) ? (params.q[0] ?? '') : (params.q ?? '');
  return (
    <ProductListingView
      key={initialKeyword}
      initialKeyword={initialKeyword}
      initialBrands={getBrandFilterValues(params.brand)}
      initialSearchParams={serializeSearchParams(params)}
    />
  );
}
