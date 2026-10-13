'use client';

import { queryKeys } from '@eum/api/query-keys';
import { useQuery } from '@tanstack/react-query';
import { getShopApi } from '@/lib/shop-api';

/** 상품 탐색에 쓰는 카테고리 목록을 서버에서 가져옵니다. */
export function useCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: async ({ signal }) => (await getShopApi()).categories.list({ signal }),
  });
}
