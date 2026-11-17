import { describe, expect, it } from 'vitest';
import {
  buildBrandHref,
  buildBrandProductsHref,
  buildBrandSelectionHref,
  getBrandFilterValues,
  getPrimaryNavigationItems,
  isPrimaryNavigationItemActive,
  type PrimaryNavigationItem,
} from './product-navigation';

// 주요 메뉴 항목을 key로 찾는 함수(없으면 테스트 실패)
function findNavigationItem(key: PrimaryNavigationItem['key']): PrimaryNavigationItem {
  const navigationItem = getPrimaryNavigationItems().find((item) => item.key === key);
  if (!navigationItem) throw new Error(`${key} 메뉴가 없습니다.`);
  return navigationItem;
}

// 경로에서 활성인 주요 메뉴 key 목록
function getActiveKeys(pathname: string): string[] {
  return getPrimaryNavigationItems()
    .filter((navigationItem) => isPrimaryNavigationItemActive(navigationItem, pathname))
    .map((navigationItem) => navigationItem.key);
}

describe('product and brand navigation', () => {
  it('provides all-product, best, recommended, brand and inquiry routes', () => {
    expect(findNavigationItem('products').href).toBe('/search');
    expect(findNavigationItem('best').href).toBe('/best');
    expect(findNavigationItem('recommended').href).toBe('/recommended');
    expect(findNavigationItem('brands').href).toBe('/brands');
    expect(findNavigationItem('inquiry').href).toBe('/support/inquiry');
  });

  it('builds brand directory, brand detail and brand product listing destinations', () => {
    expect(buildBrandHref()).toBe('/brands');
    expect(buildBrandHref('brd-1')).toBe('/brands/brd-1');
    expect(buildBrandHref('a/b c')).toBe('/brands/a%2Fb%20c');
    expect(buildBrandProductsHref('3M & Co')).toBe('/search?brand=3M+%26+Co');
    expect(buildBrandProductsHref('세이프가드')).toBe(
      '/search?brand=%EC%84%B8%EC%9D%B4%ED%94%84%EA%B0%80%EB%93%9C',
    );
  });

  it('reads repeated brand parameters as unique selected filters', () => {
    expect(getBrandFilterValues(['3M', '동아', '3M', ' '])).toEqual(['3M', '동아']);
  });

  it('updates brand filters while retaining other search parameters', () => {
    expect(buildBrandSelectionHref('/search', 'q=hand+glove&brand=old', ['new', 'another'])).toBe(
      '/search?q=hand+glove&brand=new&brand=another',
    );
    expect(buildBrandSelectionHref('/search', 'q=glove&brand=old', [])).toBe('/search?q=glove');
  });

  it('activates Brand only on /brands and its detail routes', () => {
    const brandsItem = findNavigationItem('brands');
    expect(isPrimaryNavigationItemActive(brandsItem, '/brands')).toBe(true);
    expect(isPrimaryNavigationItemActive(brandsItem, '/brands/brd-1')).toBe(true);
    expect(isPrimaryNavigationItemActive(brandsItem, '/brandsx')).toBe(false);
    expect(isPrimaryNavigationItemActive(brandsItem, '/search')).toBe(false);
    expect(isPrimaryNavigationItemActive(brandsItem, '/')).toBe(false);
  });

  it('activates navigation items by path and keeps the home section link inactive', () => {
    // 활성 판단은 경로만 보므로 /search?brand=X, /category/*?brand=X는 모두 「전체상품」입니다.
    expect(getActiveKeys('/search')).toEqual(['products']);
    expect(getActiveKeys('/category/gloves')).toEqual(['products']);
    expect(getActiveKeys('/products/prd-1001')).toEqual(['products']);
    expect(getActiveKeys('/brands')).toEqual(['brands']);
    expect(getActiveKeys('/brands/brd-1')).toEqual(['brands']);
    expect(getActiveKeys('/about')).toEqual([]);
    expect(getActiveKeys('/support/faq')).toEqual(['inquiry']);
    expect(getActiveKeys('/support/inquiry')).toEqual(['inquiry']);
    expect(getActiveKeys('/best')).toEqual(['best']);
    expect(getActiveKeys('/today')).toEqual([]);
    expect(getActiveKeys('/')).toEqual([]);
  });

  it('activates Recommended only on /recommended and its sub-paths', () => {
    const recommendedItem = findNavigationItem('recommended');
    expect(isPrimaryNavigationItemActive(recommendedItem, '/recommended')).toBe(true);
    expect(isPrimaryNavigationItemActive(recommendedItem, '/recommended/x')).toBe(true);
    expect(isPrimaryNavigationItemActive(recommendedItem, '/recommendedx')).toBe(false);
    expect(isPrimaryNavigationItemActive(recommendedItem, '/')).toBe(false);
    expect(getActiveKeys('/recommended')).toEqual(['recommended']);
    expect(getActiveKeys('/recommendedx')).toEqual([]);
  });
});
