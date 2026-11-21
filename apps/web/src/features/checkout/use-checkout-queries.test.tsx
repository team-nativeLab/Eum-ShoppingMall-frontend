import { queryKeys } from '@eum/api/query-keys';
import type { Address, Coupon, Member } from '@eum/api/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAddressesQuery, useCouponsQuery } from './use-checkout-queries';

const queryMocks = vi.hoisted(() => ({
  getShopApi: vi.fn(),
  useMemberSession: vi.fn(),
  listAddresses: vi.fn(),
  listCoupons: vi.fn(),
}));

vi.mock('@/lib/shop-api', () => ({ getShopApi: queryMocks.getShopApi }));
vi.mock('@/features/auth/member-session', () => ({
  useMemberSession: queryMocks.useMemberSession,
}));

const member: Member = {
  id: 'member-address-test',
  email: 'member@example.com',
  name: '목 회원',
  phone: '',
  joinedAt: '2026-10-01T00:00:00+09:00',
  pointBalance: 0,
};

const address: Address = {
  id: 'address-1',
  label: '기본 배송지',
  recipientName: '목 회원',
  phone: '010-0000-0000',
  postalCode: '00000',
  address1: '서울시 예시구',
  address2: '1층',
  isDefault: true,
};

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  queryMocks.getShopApi.mockResolvedValue({
    addresses: { list: queryMocks.listAddresses },
    coupons: { list: queryMocks.listCoupons },
  });
  queryMocks.listAddresses.mockResolvedValue([address]);
  queryMocks.listCoupons.mockResolvedValue([]);
  queryMocks.useMemberSession.mockReturnValue({ member, status: 'ready' });
});

const memberCoupon: Coupon = {
  id: 'coupon-1',
  name: '회원 쿠폰',
  discountType: 'amount',
  discountValue: 1000,
  minOrderAmount: 0,
  expiresAt: '2027-01-01T00:00:00+09:00',
  isUsed: false,
};

describe('useAddressesQuery member cache', () => {
  it('uses the current session member in its cache key', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAddressesQuery(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(queryKeys.addresses.byMember(member.id))).toEqual([address]);
    expect(queryClient.getQueryData(queryKeys.addresses.all)).toBeUndefined();
  });

  it('does not fetch member addresses without a session member', () => {
    queryMocks.useMemberSession.mockReturnValue({ member: null, status: 'ready' });
    const { result } = renderHook(() => useAddressesQuery(), {
      wrapper: createWrapper(new QueryClient()),
    });

    expect(result.current.isPending).toBe(true);
    expect(queryMocks.listAddresses).not.toHaveBeenCalled();
  });
});

describe('useCouponsQuery member cache', () => {
  it('uses the session member key and fetches coupons for a ready member', async () => {
    queryMocks.listCoupons.mockResolvedValue([memberCoupon]);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useCouponsQuery(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryMocks.listCoupons).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(queryKeys.coupons.byMember(member.id))).toEqual([memberCoupon]);
    expect(queryClient.getQueryData(queryKeys.coupons.all)).toBeUndefined();
  });

  it('does not fetch coupons until a ready session member is available', () => {
    queryMocks.useMemberSession.mockReturnValue({ member: null, status: 'ready' });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useCouponsQuery(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toEqual([]);
    expect(queryMocks.listCoupons).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(queryKeys.coupons.byMember('anonymous'))).toBeUndefined();
  });
});
