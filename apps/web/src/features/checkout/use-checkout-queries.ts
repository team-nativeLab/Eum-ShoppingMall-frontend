'use client';

import { queryKeys } from '@eum/api/query-keys';
import { useQuery } from '@tanstack/react-query';
import { useMemberSession } from '@/features/auth/member-session';
import { getShopApi } from '@/lib/shop-api';

export function useCheckoutOptionsQuery() {
  return useQuery({
    queryKey: queryKeys.checkout.options,
    queryFn: async ({ signal }) => (await getShopApi()).checkout.getOptions({ signal }),
  });
}

export function useAddressesQuery() {
  const { member, status } = useMemberSession();
  return useQuery({
    queryKey: queryKeys.addresses.byMember(member?.id ?? 'anonymous'),
    queryFn: async ({ signal }) => (await getShopApi()).addresses.list({ signal }),
    enabled: status === 'ready' && Boolean(member),
  });
}

export function useCouponsQuery() {
  return useQuery({
    queryKey: queryKeys.coupons.all,
    queryFn: async ({ signal }) => (await getShopApi()).coupons.list({ signal }),
  });
}
