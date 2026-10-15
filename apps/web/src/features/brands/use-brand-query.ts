'use client';

import { queryKeys } from '@eum/api/query-keys';
import { useQuery } from '@tanstack/react-query';
import { getShopApi } from '@/lib/shop-api';

/** 브랜드 상세 조회(W-33). 화면을 떠날 때 현재 요청을 취소합니다. */
export function useBrandQuery(brandId: string) {
  return useQuery({
    queryKey: queryKeys.brands.detail(brandId),
    queryFn: async ({ signal }) => (await getShopApi()).brands.getById(brandId, { signal }),
    enabled: brandId.length > 0,
  });
}
