'use client';

import { useQuery } from '@tanstack/react-query';
import type { Product } from '@eum/api/types';
import { getShopApi } from '@/lib/shop-api';
import type { DirectCheckoutLine } from './checkout-selection-storage';
import { resolveDirectCheckoutItems } from './direct-checkout-items';

/** 직접 주문에 포함된 상품을 다시 조회해 가격·재고·옵션을 최신 응답으로 확인합니다. */
export function useDirectCheckoutItems(
  directLines: readonly DirectCheckoutLine[],
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['checkout', 'direct-items', directLines],
    enabled: enabled && directLines.length > 0,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async ({ signal }) => {
      const productIds = [...new Set(directLines.map((line) => line.productId))];
      const api = await getShopApi();
      const productEntries = await Promise.all(
        productIds.map(async (productId): Promise<[string, Product]> => [
          productId,
          await api.products.getById(productId, { signal }),
        ]),
      );
      return resolveDirectCheckoutItems(directLines, new Map(productEntries));
    },
  });
}
