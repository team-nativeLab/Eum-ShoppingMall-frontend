'use client';

import { queryKeys } from '@eum/api/query-keys';
import { useQuery } from '@tanstack/react-query';
import { getShopApi } from '@/lib/shop-api';

/** 홈 배너·서비스 안내·베스트 상품을 서버 응답으로 가져옵니다. */
export function useHomeQuery() {
  return useQuery({
    queryKey: queryKeys.home.content,
    queryFn: async ({ signal }) => (await getShopApi()).home.getContent({ signal }),
  });
}
