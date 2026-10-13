import { describe, expect, it } from 'vitest';
import { getPaginationItems, type PaginationItem } from './pagination';

// 테스트 비교용으로 칸을 문자열로 바꾸는 함수
const toLabels = (paginationItems: PaginationItem[]) =>
  paginationItems.map((paginationItem) =>
    paginationItem.kind === 'page' ? String(paginationItem.page) : '…',
  );

describe('getPaginationItems', () => {
  it('첫 페이지에서 Figma 예시와 같은 모양을 만듭니다', () => {
    expect(toLabels(getPaginationItems(1, 10))).toEqual(['1', '2', '3', '4', '5', '…', '10']);
  });

  it('가운데에서는 양쪽을 줄입니다', () => {
    expect(toLabels(getPaginationItems(6, 12))).toEqual([
      '1',
      '…',
      '4',
      '5',
      '6',
      '7',
      '8',
      '…',
      '12',
    ]);
  });

  it('페이지가 적으면 모두 보여 줍니다', () => {
    expect(toLabels(getPaginationItems(2, 3))).toEqual(['1', '2', '3']);
  });

  it('페이지가 없으면 빈 배열입니다', () => {
    expect(getPaginationItems(1, 0)).toEqual([]);
  });
});
