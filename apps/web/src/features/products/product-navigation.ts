export type SearchParamValue = string | string[] | undefined;

export type PrimaryNavigationKey =
  'products' | 'best' | 'recommended' | 'discounts' | 'brands' | 'inquiry';

/** 추천상품 전용 화면 경로입니다. */
export const RECOMMENDED_PAGE_HREF = '/recommended';

export interface PrimaryNavigationItem {
  key: PrimaryNavigationKey;
  label: string;
  href: string;
}

/** 반복된 URL 브랜드 필터를 중복 없이 정리합니다. */
export function getBrandFilterValues(value: SearchParamValue): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(values.map((brand) => brand.trim()).filter(Boolean))];
}

/** 페이지의 검색 매개변수를 반복 값까지 보존해 직렬화합니다. */
export function serializeSearchParams(searchParams: Record<string, SearchParamValue>): string {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
    } else if (value !== undefined) {
      params.append(key, value);
    }
  });
  return params.toString();
}

/** 브랜드 목록 화면 경로입니다. 브랜드 카드를 모아 보여 주며, 선택 브랜드는 쿼리로 고릅니다. */
export function buildBrandHref(): string {
  return '/brands';
}

/** 「제품 보기」가 여는 브랜드 전용 제품 목록 경로입니다. 브랜드 카드 목록 없이 그 브랜드의 제품만 보여 줍니다. */
export function buildBrandProductsHref(brandId: string): string {
  return `/brands/${encodeURIComponent(brandId)}/products`;
}

/** 브랜드 전용 제품 목록 경로(/brands/[brandId]/products)인지 확인합니다. */
export function isBrandProductsPath(pathname: string): boolean {
  return /^\/brands\/[^/]+\/products$/.test(pathname);
}

/** 현재 상품 목록의 필터와 검색어를 보존하면서 브랜드 선택을 갱신합니다. */
export function buildBrandSelectionHref(
  pathname: string,
  currentSearchParams: string,
  selectedBrands: readonly string[],
): string {
  const params = new URLSearchParams(currentSearchParams);
  params.delete('brand');
  getBrandFilterValues([...selectedBrands]).forEach((brand) => params.append('brand', brand));
  const query = params.toString();
  return query ? pathname + '?' + query : pathname;
}

/** 안전맛집 주요 탐색 링크 (전체상품 · 베스트 · 추천상품 · 브랜드 · 문의사항) */
export function getPrimaryNavigationItems(): PrimaryNavigationItem[] {
  return [
    { key: 'products', label: '전체상품', href: '/search' },
    { key: 'best', label: '베스트', href: '/best' },
    { key: 'recommended', label: '추천상품', href: RECOMMENDED_PAGE_HREF },
    { key: 'discounts', label: '할인 상품', href: '/discounts' },
    { key: 'brands', label: '브랜드', href: buildBrandHref() },
    { key: 'inquiry', label: '문의사항', href: '/support/inquiry' },
  ];
}

/** 경로가 기준 경로 또는 그 하위 경로인지 확인합니다. */
function isPathWithin(pathname: string, pathPrefix: string): boolean {
  return pathname === pathPrefix || pathname.startsWith(pathPrefix + '/');
}

/** 경로만으로 현재 GNB 항목을 정합니다. 상품 브랜드 필터는 제품 목록 상태입니다. */
export function isPrimaryNavigationItemActive(
  item: PrimaryNavigationItem,
  pathname: string,
): boolean {
  // 브랜드 전용 제품 목록은 「전체상품」 탭이 활성입니다(경로가 /brands 아래라도 브랜드 탭은 꺼 둡니다).
  if (isBrandProductsPath(pathname)) {
    return item.key === 'products';
  }
  const activePathPrefixes: Record<PrimaryNavigationKey, string[]> = {
    products: ['/search', '/category', '/products'],
    best: ['/best'],
    recommended: ['/recommended'],
    discounts: ['/discounts'],
    brands: ['/brands'],
    inquiry: ['/support'],
  };
  return activePathPrefixes[item.key].some((pathPrefix) => isPathWithin(pathname, pathPrefix));
}
