import { describe, expect, it } from 'vitest';
import {
  buildBrandBrowseHref,
  buildBrandSelectionHref,
  getBrandFilterValues,
  getPrimaryNavigationItems,
  isBrandBrowseMode,
  isPrimaryNavigationItemActive,
} from './product-navigation';

describe('product and brand navigation', () => {
  it('opens the complete product listing and the brand browser from the primary navigation', () => {
    const items = getPrimaryNavigationItems();

    expect(items.find((item) => item.key === 'products')?.href).toBe('/search');
    expect(items.find((item) => item.key === 'brands')?.href).toBe('/search?browse=brands');
  });

  it('uses the brand filter for a brand-specific menu destination', () => {
    expect(buildBrandBrowseHref('3M & Co')).toBe('/search?brand=3M+%26+Co&browse=brands');
  });

  it('reads repeated brand parameters as unique selected filters', () => {
    expect(getBrandFilterValues(['3M', '동아', '3M', ' '])).toEqual(['3M', '동아']);
    expect(isBrandBrowseMode(['other', 'brands'])).toBe(true);
    expect(isBrandBrowseMode('products')).toBe(false);
  });

  it('updates brand filters while retaining other search parameters', () => {
    expect(
      buildBrandSelectionHref('/search', 'q=hand+glove&browse=brands&brand=old', [
        'new',
        'another',
      ]),
    ).toBe('/search?q=hand+glove&browse=brands&brand=new&brand=another');
    expect(buildBrandSelectionHref('/search', 'q=glove&browse=brands&brand=old', [])).toBe(
      '/search?q=glove&browse=brands',
    );
  });

  it('marks only the matching product or brand browsing mode active', () => {
    const items = getPrimaryNavigationItems();
    const productsItem = items.find((item) => item.key === 'products');
    const brandsItem = items.find((item) => item.key === 'brands');

    expect(productsItem).toBeDefined();
    expect(brandsItem).toBeDefined();
    expect(isPrimaryNavigationItemActive(productsItem!, '/', [])).toBe(false);
    expect(isPrimaryNavigationItemActive(brandsItem!, '/', [])).toBe(false);
    expect(isPrimaryNavigationItemActive(productsItem!, '/search', [])).toBe(true);
    expect(isPrimaryNavigationItemActive(brandsItem!, '/search', ['3M'])).toBe(true);
    expect(isPrimaryNavigationItemActive(productsItem!, '/search', ['3M'])).toBe(false);
  });

  it('marks only the brand active when a category has a selected brand filter', () => {
    const items = getPrimaryNavigationItems();
    const productsItem = items.find((item) => item.key === 'products');
    const brandsItem = items.find((item) => item.key === 'brands');

    expect(productsItem).toBeDefined();
    expect(brandsItem).toBeDefined();
    expect(isPrimaryNavigationItemActive(productsItem!, '/category/gloves', ['3M'])).toBe(false);
    expect(isPrimaryNavigationItemActive(brandsItem!, '/category/gloves', ['3M'])).toBe(true);
    expect(isPrimaryNavigationItemActive(productsItem!, '/category/gloves', [])).toBe(true);
    expect(isPrimaryNavigationItemActive(brandsItem!, '/category/gloves', [])).toBe(false);
  });
});
