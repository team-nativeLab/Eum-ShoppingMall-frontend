import type { Category } from '@eum/api/types';
import { describe, expect, it } from 'vitest';
import { getCategoryHref, getCurrentMenuHref } from './category-href';

const categories: Category[] = [
  {
    id: 'cat-gear',
    slug: 'safety/gear',
    name: '안전 장비',
    parentId: null,
    description: null,
    iconKey: null,
  },
  {
    id: 'cat-gear-sub',
    slug: 'gear-sub',
    name: '장비 하위',
    parentId: 'cat-gear',
    description: null,
    iconKey: null,
  },
];

describe('getCategoryHref', () => {
  it('links other categories to their encoded category page', () => {
    expect(getCategoryHref({ slug: 'safety/gear' })).toBe('/category/safety%2Fgear');
  });
});

describe('getCurrentMenuHref', () => {
  it('maps a child category route to the top-level category', () => {
    expect(getCurrentMenuHref(categories, '/category/gear-sub')).toBe('/category/safety%2Fgear');
  });

  it('keeps unknown category routes unchanged for the not-found screen', () => {
    expect(getCurrentMenuHref(categories, '/category/unknown')).toBe('/category/unknown');
  });

  it('keeps other category routes on their encoded category address', () => {
    expect(getCurrentMenuHref(categories, '/category/safety%2Fgear')).toBe(
      '/category/safety%2Fgear',
    );
  });
});
