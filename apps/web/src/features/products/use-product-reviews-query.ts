'use client';

import { queryKeys } from '@eum/api/query-keys';
import type { PageParams } from '@eum/api/shop-api';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getShopApi } from '@/lib/shop-api';

/**
 * 상품 리뷰 목록을 조회하는 훅(최신순).
 * 페이지를 옮기는 동안 이전 페이지를 그대로 두어(isPlaceholderData) 페이지 이동 버튼이 사라지지 않게 합니다.
 */
export function useProductReviewsQuery(productId: string, params: PageParams = {}) {
  return useQuery({
    queryKey: queryKeys.products.reviews(productId, params),
    queryFn: async ({ signal }) =>
      (await getShopApi()).products.listReviews(productId, params, { signal }),
    enabled: productId.length > 0,
    placeholderData: keepPreviousData,
  });
}
