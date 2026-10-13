'use client';

import { queryKeys } from '@eum/api/query-keys';
import type { PageParams } from '@eum/api/shop-api';
import { useQuery } from '@tanstack/react-query';
import { getShopApi } from '@/lib/shop-api';

/** 상품 리뷰 목록을 조회하는 훅(최신순) */
export function useProductReviewsQuery(productId: string, params: PageParams = {}) {
  return useQuery({
    queryKey: queryKeys.products.reviews(productId, params),
    queryFn: async ({ signal }) =>
      (await getShopApi()).products.listReviews(productId, params, { signal }),
    enabled: productId.length > 0,
  });
}
