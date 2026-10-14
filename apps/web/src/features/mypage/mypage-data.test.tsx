import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryKeys } from '@eum/api/query-keys';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCollectionProductIds, useMyPageData } from './mypage-data';

const apiMocks = vi.hoisted(() => ({
  getShopApi: vi.fn(),
  membersList: vi.fn(),
  ordersList: vi.fn(),
  claimsList: vi.fn(),
  couponsList: vi.fn(),
  pointsList: vi.fn(),
  addressesList: vi.fn(),
  quotesList: vi.fn(),
  productById: vi.fn(),
}));

vi.mock('@/lib/shop-api', () => ({
  getShopApi: apiMocks.getShopApi,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { Wrapper, queryClient };
}

describe('useMyPageData', () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
    apiMocks.membersList.mockResolvedValue([
      { id: 'member-a', name: '목 회원', email: 'member@example.com', pointBalance: 0 },
    ]);
    apiMocks.ordersList.mockResolvedValue([]);
    apiMocks.claimsList.mockResolvedValue([]);
    apiMocks.couponsList.mockResolvedValue([]);
    apiMocks.pointsList.mockResolvedValue([]);
    apiMocks.addressesList.mockResolvedValue([]);
    apiMocks.quotesList.mockResolvedValue([]);
    apiMocks.productById.mockResolvedValue({ id: 'product-a', name: '목 상품' });
    apiMocks.getShopApi.mockResolvedValue({
      members: { list: apiMocks.membersList },
      orders: { listByMember: apiMocks.ordersList },
      claims: { listByMember: apiMocks.claimsList },
      coupons: { list: apiMocks.couponsList },
      points: { list: apiMocks.pointsList },
      addresses: { list: apiMocks.addressesList },
      quotes: { list: apiMocks.quotesList },
      products: { getById: apiMocks.productById },
    });
  });

  it('looks up only product IDs from the active collection section', () => {
    const wishlistIds = ['wish-a', 'wish-b'];
    const recentIds = ['recent-a'];

    expect(getCollectionProductIds('wishlist', wishlistIds, recentIds)).toEqual(wishlistIds);
    expect(getCollectionProductIds('recent', wishlistIds, recentIds)).toEqual(recentIds);
    expect(getCollectionProductIds('orders', wishlistIds, recentIds)).toEqual([]);
  });

  it('collection routes skip member and unrelated API requests', async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useMyPageData(['product-a'], 'wishlist', 'member-a'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.member).toBeNull();
    expect(result.current.data?.products).toEqual([{ id: 'product-a', name: '목 상품' }]);
    expect(apiMocks.membersList).not.toHaveBeenCalled();
    expect(apiMocks.ordersList).not.toHaveBeenCalled();
    expect(apiMocks.productById).toHaveBeenCalledWith('product-a', expect.anything());
  });

  it('a failed product lookup remains visible and can be retried from its warning', async () => {
    apiMocks.productById
      .mockRejectedValueOnce(new Error('상품 API 실패'))
      .mockResolvedValueOnce({ id: 'product-b', name: '목 상품 B' });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useMyPageData(['product-a', 'product-b'], 'recent', 'member-a'),
      {
        wrapper: Wrapper,
      },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.products).toEqual([{ id: 'product-b', name: '목 상품 B' }]);
    expect(result.current.data?.unavailableProductIds).toEqual(['product-a']);
    expect(result.current.data?.loadWarnings).toContain(
      '일부 상품 정보를 불러오지 못했습니다. 다시 시도하거나 해당 항목을 목록에서 삭제할 수 있습니다.',
    );
  });

  it('a relevant endpoint failure reaches the existing query error and retry state', async () => {
    apiMocks.ordersList.mockRejectedValue(new Error('주문 API 일시 오류'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useMyPageData([], 'orders', 'member-a'), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(apiMocks.membersList).toHaveBeenCalledOnce();
    expect(apiMocks.ordersList).toHaveBeenCalledOnce();
    expect(apiMocks.claimsList).not.toHaveBeenCalled();
    expect(apiMocks.couponsList).not.toHaveBeenCalled();
    expect(apiMocks.pointsList).not.toHaveBeenCalled();
    expect(apiMocks.addressesList).not.toHaveBeenCalled();
    expect(apiMocks.quotesList).not.toHaveBeenCalled();
    expect(apiMocks.productById).not.toHaveBeenCalled();
  });

  it('stores member-owned screens in member-specific cache entries', async () => {
    apiMocks.membersList.mockResolvedValue([
      { id: 'member-a', name: '회원 A', email: 'a@example.com', pointBalance: 0 },
      { id: 'member-b', name: '회원 B', email: 'b@example.com', pointBalance: 0 },
    ]);
    const { Wrapper, queryClient } = createWrapper();
    const { result, rerender } = renderHook(
      ({ memberId }: { memberId: string }) => useMyPageData([], 'addresses', memberId),
      { initialProps: { memberId: 'member-a' }, wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender({ memberId: 'member-b' });
    await waitFor(() =>
      expect(
        queryClient.getQueryData([...queryKeys.myPage.byMember('member-b'), 'addresses', []]),
      ).toBeDefined(),
    );

    expect(
      queryClient.getQueryData([...queryKeys.myPage.byMember('member-a'), 'addresses', []]),
    ).toBeDefined();
    expect(apiMocks.addressesList).toHaveBeenCalledTimes(2);
  });

  it('does not fetch member-owned data without a session member ID', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useMyPageData([], 'addresses', null), {
      wrapper: Wrapper,
    });

    expect(result.current.isPending).toBe(true);
    expect(apiMocks.membersList).not.toHaveBeenCalled();
    expect(apiMocks.addressesList).not.toHaveBeenCalled();
  });
});
