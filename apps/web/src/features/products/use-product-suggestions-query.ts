'use client';

import { queryKeys } from '@eum/api/query-keys';
import { useQuery } from '@tanstack/react-query';
import { getShopApi } from '@/lib/shop-api';

/** 검색 자동완성 결과. 한 글자부터 요청해도 빈 검색어는 API가 무시합니다. */
export function useProductSuggestionsQuery(keyword: string, enabled = true) {
  const normalizedKeyword = keyword.trim();
  return useQuery({
    queryKey: queryKeys.products.suggestions(normalizedKeyword),
    queryFn: async ({ signal }) =>
      (await getShopApi()).products.suggest(normalizedKeyword, { signal }),
    enabled: enabled && normalizedKeyword.length > 0,
    staleTime: 15_000,
  });
}
