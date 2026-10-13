import type { Category } from '../types';

/** 목 카테고리. 실제 값은 서버에서 옵니다. */
export const mockCategories: Category[] = [
  { id: 'cat-head', slug: 'head-protection', name: '머리 보호구', parentId: null },
  { id: 'cat-foot', slug: 'foot-protection', name: '발 보호구', parentId: null },
  { id: 'cat-hand', slug: 'hand-protection', name: '손 보호구', parentId: null },
  { id: 'cat-fall', slug: 'fall-protection', name: '추락 방지', parentId: null },
  { id: 'cat-fire', slug: 'fire-safety', name: '소방·방재', parentId: null },
  { id: 'cat-sign', slug: 'safety-signs', name: '안전 표지', parentId: null },
];
