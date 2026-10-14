export type SearchParamValue = string | string[] | undefined;

export type PrimaryNavigationKey = 'products' | 'brands' | 'solutions' | 'support' | 'about';

export interface PrimaryNavigationItem {
  key: PrimaryNavigationKey;
  label: string;
  href: string;
}

/** Parse brand filters from repeated App Router search parameters. */
export function getBrandFilterValues(value: SearchParamValue): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(values.map((brand) => brand.trim()).filter(Boolean))];
}

/** Brand browse is a temporary UI intent used to open the existing brand filter on entry. */
export function isBrandBrowseMode(value: SearchParamValue): boolean {
  return (Array.isArray(value) ? value : [value]).includes('brands');
}

/** Serialize page search parameters without dropping repeated values. */
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

/** Build the all-brand or brand-specific destination used by both desktop and mobile menus. */
export function buildBrandBrowseHref(brand?: string): string {
  const params = new URLSearchParams();
  if (brand) params.set('brand', brand);
  params.set('browse', 'brands');
  return '/search?' + params.toString();
}

/** Keep the current route filters and keyword when a user adds or removes selected brands. */
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

/** Primary links share one product listing and treat selected brands as the brand browsing state. */
export function getPrimaryNavigationItems(): PrimaryNavigationItem[] {
  return [
    { key: 'products', label: '제품', href: '/search' },
    { key: 'brands', label: '브랜드', href: buildBrandBrowseHref() },
    { key: 'solutions', label: '안전 솔루션', href: '/solutions' },
    { key: 'support', label: '고객지원', href: '/support/notices' },
    { key: 'about', label: '회사소개', href: '/about' },
  ];
}

/** Determine the active primary item from the route and selected brand filters. */
export function isPrimaryNavigationItemActive(
  item: PrimaryNavigationItem,
  pathname: string,
  selectedBrands: readonly string[],
  searchParamsReady = true,
): boolean {
  const isProductListingRoute = pathname === '/search' || pathname.startsWith('/category/');
  const isBrandBrowsing = isProductListingRoute && selectedBrands.length > 0;

  if (item.key === 'products') {
    if (isBrandBrowsing) return false;
    if (pathname.startsWith('/category/') || pathname.startsWith('/products/')) return true;
    return pathname === '/search' && searchParamsReady;
  }
  if (item.key === 'brands') {
    return isBrandBrowsing;
  }
  const activePathPrefixes: Partial<Record<PrimaryNavigationKey, string[]>> = {
    solutions: ['/solutions'],
    support: ['/support'],
    about: ['/about'],
  };
  return (activePathPrefixes[item.key] ?? []).some((pathPrefix) => pathname.startsWith(pathPrefix));
}
