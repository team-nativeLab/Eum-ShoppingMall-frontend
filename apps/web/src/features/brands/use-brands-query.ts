'use client';

import { queryKeys } from '@eum/api/query-keys';
import { useQuery } from '@tanstack/react-query';
import { getShopApi } from '@/lib/shop-api';

/** 노출 브랜드 전체 목록 조회(W-32 디렉터리, W-16 전체 메뉴). 화면을 떠나면 요청을 취소합니다. */
export function useBrandsQuery() {
  return useQuery({
    queryKey: queryKeys.brands.list,
    queryFn: async ({ signal }) => (await getShopApi()).brands.list({ signal }),
  });
}
