import type { Product } from '@eum/api/types';
import { describe, expect, it } from 'vitest';
import { filterProductsByCategoryTree } from './best-seller-filter';

const categories = [
  { id: 'cat-ppe', parentId: null },
  { id: 'cat-head', parentId: 'cat-ppe' },
  { id: 'cat-foot', parentId: 'cat-ppe' },
  { id: 'cat-road', parentId: null },
];

// 필터에 필요한 값만 채운 테스트 상품
function buildFeaturedProduct(id: string, categoryId: string): Product {
  return {
    id,
    name: id,
    brand: '브랜드',
    categoryId,
    price: 1000,
    listPrice: null,
    priceVisible: true,
    stockStatus: 'inStock',
    thumbnailUrl: null,
    summary: '',
    images: [],
    options: [],
    specifications: [],
    certifications: [],
    shipping: { method: '일반 배송', estimate: '', fee: 0, countryOfOrigin: '' },
    rating: null,
    reviewCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    isFeatured: true,
  };
}

const featuredProducts = [
  buildFeaturedProduct('helmet', 'cat-head'),
  buildFeaturedProduct('boots', 'cat-foot'),
  buildFeaturedProduct('ppe-kit', 'cat-ppe'),
  buildFeaturedProduct('cone', 'cat-road'),
];

describe('filterProductsByCategoryTree', () => {
  it('상위 카테고리 탭은 하위 카테고리 상품까지 포함합니다', () => {
    expect(
      filterProductsByCategoryTree(featuredProducts, categories, 'cat-ppe').map(({ id }) => id),
    ).toEqual(['helmet', 'boots', 'ppe-kit']);
  });

  it('전체 탭(null)은 모든 상품을 돌려줍니다', () => {
    expect(filterProductsByCategoryTree(featuredProducts, categories, null)).toHaveLength(4);
  });

  it('카테고리 목록이 비어 있으면 해당 카테고리에 바로 속한 상품만 남깁니다', () => {
    expect(
      filterProductsByCategoryTree(featuredProducts, [], 'cat-road').map(({ id }) => id),
    ).toEqual(['cone']);
  });
});
