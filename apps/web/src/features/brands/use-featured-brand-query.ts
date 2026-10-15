'use client';

import { queryKeys } from '@eum/api/query-keys';
import { useQuery } from '@tanstack/react-query';
import { getShopApi } from '@/lib/shop-api';

/** W-32 "이달의 브랜드" 조회. 지정한 브랜드가 없으면 data가 null입니다. */
export function useFeaturedBrandQuery() {
  return useQuery({
    queryKey: queryKeys.brands.featured,
    queryFn: async ({ signal }) => (await getShopApi()).brands.getFeatured({ signal }),
  });
}
