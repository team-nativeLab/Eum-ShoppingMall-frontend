import type { Category } from './types';

type CategoryNode = Pick<Category, 'id' | 'parentId'>;

/**
 * 지정한 카테고리와 그 아래 모든 하위 카테고리 ID를 모으는 함수.
 * 상위 카테고리 탭·필터가 하위 카테고리 상품까지 포함해야 할 때 씁니다.
 * 부모 순서와 무관하게 동작하고, 순환 참조가 있어도 같은 ID를 다시 넣지 않아 끝납니다.
 */
export function collectCategoryIdsWithDescendants(
  categories: readonly CategoryNode[],
  rootCategoryId: string,
): Set<string> {
  const childIdsByParentId = new Map<string, string[]>();
  for (const category of categories) {
    if (category.parentId === null) continue;
    const siblingIds = childIdsByParentId.get(category.parentId) ?? [];
    siblingIds.push(category.id);
    childIdsByParentId.set(category.parentId, siblingIds);
  }
  const collectedIds = new Set([rootCategoryId]);
  const pendingIds = [rootCategoryId];
  while (pendingIds.length > 0) {
    const parentId = pendingIds.pop();
    if (parentId === undefined) break;
    for (const childId of childIdsByParentId.get(parentId) ?? []) {
      if (collectedIds.has(childId)) continue;
      collectedIds.add(childId);
      pendingIds.push(childId);
    }
  }
  return collectedIds;
}
