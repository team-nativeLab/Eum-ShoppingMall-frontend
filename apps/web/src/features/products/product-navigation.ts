export type SearchParamValue = string | string[] | undefined;

export type PrimaryNavigationKey = 'products' | 'brands' | 'solutions' | 'support' | 'about';

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

/** 주요 GNB 항목. 브랜드는 분리된 디렉터리로 이동합니다. */
export function getPrimaryNavigationItems(): PrimaryNavigationItem[] {
  return [
    { key: 'products', label: '제품', href: '/search' },
    { key: 'brands', label: '브랜드', href: buildBrandHref() },
    { key: 'solutions', label: '안전 솔루션', href: '/solutions' },
    { key: 'support', label: '고객지원', href: '/support/notices' },
    { key: 'about', label: '회사소개', href: '/about' },
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
    brands: ['/brands'],
    solutions: ['/solutions'],
    support: ['/support'],
    about: ['/about'],
  };
  return activePathPrefixes[item.key].some((pathPrefix) => isPathWithin(pathname, pathPrefix));
}
