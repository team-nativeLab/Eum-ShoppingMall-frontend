'use client';

import { useQuery } from '@tanstack/react-query';
import { getShopApi } from '@/lib/shop-api';

/** 공개 상품 문의와 운영 답변을 상품 상세에서 조회합니다. */
export function useProductQuestionsQuery(productId: string) {
  return useQuery({
    queryKey: ['product-questions', productId],
    queryFn: async ({ signal }) =>
      (await getShopApi()).products.listQuestions(productId, { signal }),
    enabled: productId.length > 0,
  });
}
