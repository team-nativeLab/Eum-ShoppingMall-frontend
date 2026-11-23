import type { Category } from '@eum/api/types';

/**
 * 카테고리 링크 주소. 적용 범위는 헤더 메가메뉴, 카테고리 바, 카테고리 목록(상품 목록의 칩·브레드크럼),
 * 상품 상세의 카테고리 링크와 관련 상품 「전체 보기」입니다.
 * 각 카테고리는 해당 상품 목록으로 연결합니다.
 */
export function getCategoryHref(category: Pick<Category, 'slug'>): string {
  return '/category/' + encodeURIComponent(category.slug);
}

/**
 * 현재 경로에 대응하는 메뉴 링크 주소. 카테고리 상세 경로는 메뉴에 표시되는 가장 가까운 최상위 카테고리의 주소로 돌립니다.
 * 그 밖의 경로는 그대로 돌려주며, 메가메뉴는 이 값과 같은 주소를 가진 첫 링크 하나만 현재 항목으로 표시합니다.
 */
export function getCurrentMenuHref(categories: readonly Category[], pathname: string): string {
  const categorySlug = pathname.match(/^\/category\/([^/]+)\/?$/)?.[1];
  if (!categorySlug) return pathname;

  let decodedCategorySlug = categorySlug;
  try {
    decodedCategorySlug = decodeURIComponent(categorySlug);
  } catch {
    // 잘못된 인코딩이면 원래 문자열로 조회해 다른 메뉴의 활성 상태를 바꾸지 않습니다.
  }

  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  let activeCategory = categories.find((category) => category.slug === decodedCategorySlug);
  if (!activeCategory) return pathname;

  const visitedIds = new Set([activeCategory.id]);
  while (activeCategory.parentId) {
    const parentCategory = categoriesById.get(activeCategory.parentId);
    if (!parentCategory || visitedIds.has(parentCategory.id)) break;
    visitedIds.add(parentCategory.id);
    activeCategory = parentCategory;
  }

  return getCategoryHref(activeCategory);
}
