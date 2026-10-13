'use client';

import { queryKeys } from '@eum/api/query-keys';
import { useQuery } from '@tanstack/react-query';
import { getShopApi } from '@/lib/shop-api';

export function useCheckoutOptionsQuery() {
  return useQuery({
    queryKey: queryKeys.checkout.options,
    queryFn: async ({ signal }) => (await getShopApi()).checkout.getOptions({ signal }),
  });
}

export function useAddressesQuery() {
  return useQuery({
    queryKey: queryKeys.addresses.all,
    queryFn: async ({ signal }) => (await getShopApi()).addresses.list({ signal }),
  });
}

export function useCouponsQuery() {
  return useQuery({
    queryKey: queryKeys.coupons.all,
    queryFn: async ({ signal }) => (await getShopApi()).coupons.list({ signal }),
  });
}
