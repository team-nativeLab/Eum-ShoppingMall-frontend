/** 페이지 번호 줄의 한 칸 */
export type PaginationItem =
  { kind: 'page'; page: number; key: string } | { kind: 'ellipsis'; key: string };

/**
 * 페이지 번호 줄을 계산하는 함수. 첫·마지막 페이지는 항상 보이고, 사이가 멀면 "…"로 줄입니다.
 * 예: (1, 10, 2) → 1 2 3 4 5 … 10 (Figma 예시와 같은 모양)
 */
export function getPaginationItems(
  currentPage: number,
  totalPages: number,
  siblingCount = 2,
): PaginationItem[] {
  if (totalPages <= 0) return [];
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  // 현재 페이지 주변 창 크기를 일정하게 유지하려고 양 끝에서는 창을 안쪽으로 밀어 줍니다.
  const windowSize = siblingCount * 2 + 1;
  let windowStart = Math.max(1, safeCurrentPage - siblingCount);
  let windowEnd = Math.min(totalPages, windowStart + windowSize - 1);
  windowStart = Math.max(1, Math.min(windowStart, windowEnd - windowSize + 1));
  windowEnd = Math.min(totalPages, Math.max(windowEnd, windowStart + windowSize - 1));

  const paginationItems: PaginationItem[] = [];
  if (windowStart > 1) {
    paginationItems.push({ kind: 'page', page: 1, key: 'page-1' });
    if (windowStart > 2) paginationItems.push({ kind: 'ellipsis', key: 'ellipsis-start' });
  }
  for (let page = windowStart; page <= windowEnd; page += 1) {
    paginationItems.push({ kind: 'page', page, key: `page-${page}` });
  }
  if (windowEnd < totalPages) {
    if (windowEnd < totalPages - 1) paginationItems.push({ kind: 'ellipsis', key: 'ellipsis-end' });
    paginationItems.push({ kind: 'page', page: totalPages, key: `page-${totalPages}` });
  }
  return paginationItems;
}
