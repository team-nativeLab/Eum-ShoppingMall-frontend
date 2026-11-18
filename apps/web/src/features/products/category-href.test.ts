import type { Category } from '@eum/api/types';
import { describe, expect, it } from 'vitest';
import { getCategoryHref, getCurrentMenuHref } from './category-href';

const categories: Category[] = [
  {
    id: 'cat-custom',
    slug: 'custom-order',
    name: '맞춤 제작/납품',
    parentId: null,
    description: null,
    iconKey: null,
  },
  {
    id: 'cat-custom-sub',
    slug: 'custom-order-sub',
    name: '맞춤 하위',
    parentId: 'cat-custom',
    description: null,
    iconKey: null,
  },
  {
    id: 'cat-gear',
    slug: 'safety/gear',
    name: '안전 장비',
    parentId: null,
    description: null,
    iconKey: null,
  },
];

describe('getCategoryHref', () => {
  it('links the custom-order category to the solutions page', () => {
    expect(getCategoryHref({ slug: 'custom-order' })).toBe('/solutions');
  });

  it('links other categories to their encoded category page', () => {
    expect(getCategoryHref({ slug: 'safety/gear' })).toBe('/category/safety%2Fgear');
  });
});

describe('getCurrentMenuHref', () => {
  it('maps a direct custom-order category visit to the solutions menu address', () => {
    expect(getCurrentMenuHref(categories, '/category/custom-order')).toBe('/solutions');
  });

  it('keeps a direct /solutions visit on the same menu address', () => {
    expect(getCurrentMenuHref(categories, '/solutions')).toBe('/solutions');
  });

  it('climbs a custom-order subcategory route to the solutions menu address', () => {
    expect(getCurrentMenuHref(categories, '/category/custom-order-sub')).toBe('/solutions');
  });

  it('keeps other category routes on their encoded category address', () => {
    expect(getCurrentMenuHref(categories, '/category/safety%2Fgear')).toBe(
      '/category/safety%2Fgear',
    );
  });
});
