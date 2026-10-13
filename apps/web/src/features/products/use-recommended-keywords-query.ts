'use client';

import { queryKeys } from '@eum/api/query-keys';
import { useQuery } from '@tanstack/react-query';
import { getShopApi } from '@/lib/shop-api';

/** 검색 결과가 없을 때 보여 줄 추천 검색어를 조회하는 훅 */
export function useRecommendedKeywordsQuery() {
  return useQuery({
    queryKey: queryKeys.search.recommendedKeywords,
    queryFn: async ({ signal }) => (await getShopApi()).search.recommendedKeywords({ signal }),
  });
}
