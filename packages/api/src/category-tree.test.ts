import { describe, expect, it } from 'vitest';
import { collectCategoryIdsWithDescendants } from './category-tree';

const categoryNodes = [
  { id: 'grandchild', parentId: 'child' },
  { id: 'root', parentId: null },
  { id: 'child', parentId: 'root' },
  { id: 'other-root', parentId: null },
  { id: 'other-child', parentId: 'other-root' },
];

describe('collectCategoryIdsWithDescendants', () => {
  it('상위 카테고리와 모든 하위(손자 포함) 카테고리 ID를 모읍니다', () => {
    expect(collectCategoryIdsWithDescendants(categoryNodes, 'root')).toEqual(
      new Set(['root', 'child', 'grandchild']),
    );
  });

  it('하위가 없는 카테고리는 자기 자신만 돌려줍니다', () => {
    expect(collectCategoryIdsWithDescendants(categoryNodes, 'grandchild')).toEqual(
      new Set(['grandchild']),
    );
  });

  it('순환 참조가 있어도 끝납니다', () => {
    const cyclicNodes = [
      { id: 'a', parentId: 'b' },
      { id: 'b', parentId: 'a' },
    ];
    expect(collectCategoryIdsWithDescendants(cyclicNodes, 'a')).toEqual(new Set(['a', 'b']));
  });
});
