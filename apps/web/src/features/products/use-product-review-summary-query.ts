'use client';

import { queryKeys } from '@eum/api/query-keys';
import { useQuery } from '@tanstack/react-query';
import { getShopApi } from '@/lib/shop-api';

export function useProductReviewSummaryQuery(productId: string) {
  return useQuery({
    queryKey: queryKeys.products.reviewSummary(productId),
    queryFn: async ({ signal }) =>
      (await getShopApi()).products.getReviewSummary(productId, { signal }),
    enabled: productId.length > 0,
  });
}
