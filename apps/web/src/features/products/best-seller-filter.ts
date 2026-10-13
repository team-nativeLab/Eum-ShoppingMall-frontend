import { collectCategoryIdsWithDescendants } from '@eum/api/category-tree';
import type { Category, Product } from '@eum/api/types';

/**
 * 베스트 셀러 상품을 상위 카테고리 탭으로 거르는 함수.
 * 상품은 하위 카테고리(예: 안전모)에 속하므로 탭 카테고리와 그 하위 카테고리를 모두 포함합니다.
 * categoryId가 null이면 "전체" 탭으로 보고 모든 상품을 돌려줍니다.
 */
export function filterProductsByCategoryTree(
  products: readonly Product[],
  categories: readonly Pick<Category, 'id' | 'parentId'>[],
  categoryId: string | null,
): Product[] {
  if (categoryId === null) return [...products];
  const categoryIds = collectCategoryIdsWithDescendants(categories, categoryId);
  return products.filter((product) => categoryIds.has(product.categoryId));
}
