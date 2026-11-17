export type SearchParamValue = string | string[] | undefined;

export type PrimaryNavigationKey = 'products' | 'best' | 'recommended' | 'brands' | 'inquiry';

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

/** 브랜드 목록 또는 상세 화면 경로를 만듭니다. */
export function buildBrandHref(brandId?: string): string {
  return brandId ? '/brands/' + encodeURIComponent(brandId) : '/brands';
}

/** 상세 화면의 전체 제품 CTA가 기존 이름 기반 제품 필터를 엽니다. */
export function buildBrandProductsHref(brandName: string): string {
  const params = new URLSearchParams();
  params.set('brand', brandName);
  return '/search?' + params.toString();
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
  const activePathPrefixes: Record<PrimaryNavigationKey, string[]> = {
    products: ['/search', '/category', '/products'],
    best: ['/best'],
    recommended: ['/recommended'],
    brands: ['/brands'],
    inquiry: ['/support'],
  };
  return activePathPrefixes[item.key].some((pathPrefix) => isPathWithin(pathname, pathPrefix));
}
