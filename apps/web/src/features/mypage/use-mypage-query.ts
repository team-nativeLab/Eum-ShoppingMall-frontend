'use client';
import { queryKeys } from '@eum/api/query-keys';
import { useQuery } from '@tanstack/react-query';
import { getShopApi } from '@/lib/shop-api';
import type { MyPageData, MyPageDataScope } from './mypage-data';

/** 현재 화면에서 사용하는 API만 요청해 무관한 실패가 화면에 섞이지 않게 합니다. */
export function useMyPageData(
  productIds: string[],
  scope: MyPageDataScope,
  memberId: string | null,
) {
  const uniqueProductIds = [...new Set(productIds)].sort();
  const isCollection = scope === 'wishlist' || scope === 'recent';
  return useQuery({
    queryKey: isCollection
      ? [...queryKeys.members.all, 'mypage', scope, uniqueProductIds]
      : [...queryKeys.myPage.byMember(memberId ?? 'anonymous'), scope, uniqueProductIds],
    enabled: isCollection || Boolean(memberId),
    queryFn: async ({ signal }): Promise<MyPageData> => {
      const api = await getShopApi();
      const uniqueProductIds = [...new Set(productIds)];

      if (isCollection) {
        const productResults = await Promise.allSettled(
          uniqueProductIds.map((productId) => api.products.getById(productId, { signal })),
        );
        if (signal.aborted) {
          const rejectedProduct = productResults.find((result) => result.status === 'rejected');
          if (rejectedProduct?.status === 'rejected') throw rejectedProduct.reason;
        }
        const products = productResults.flatMap((result) =>
          result.status === 'fulfilled' ? [result.value] : [],
        );
        const unavailableProductIds: string[] = [];
        productResults.forEach((result, index) => {
          const productId = uniqueProductIds[index];
          if (result.status === 'rejected' && productId) unavailableProductIds.push(productId);
        });

        return {
          member: null,
          orders: [],
          claims: [],
          coupons: [],
          couponOffers: [],
          points: [],
          addresses: [],
          products,
          unavailableProductIds,
          loadWarnings: unavailableProductIds.length
            ? [
                '일부 상품 정보를 불러오지 못했습니다. 다시 시도하거나 해당 항목을 목록에서 삭제할 수 있습니다.',
              ]
            : [],
        };
      }

      const member = await api.members.getCurrent({ signal });

      const needsOrders =
        scope === 'dashboard' ||
        scope === 'orders' ||
        scope === 'order-detail' ||
        scope === 'claims' ||
        scope === 'claim-new';
      const needsClaims = scope === 'claims';
      const needsCoupons = scope === 'dashboard' || scope === 'coupons';
      const needsPoints = scope === 'points';
      const needsAddresses = scope === 'addresses' || scope === 'claim-new';

      const [orders, claims, coupons, points, addresses] = await Promise.all([
        needsOrders ? api.orders.listByMember(member.id, { signal }) : Promise.resolve([]),
        needsClaims ? api.claims.listByMember(member.id, { signal }) : Promise.resolve([]),
        needsCoupons
          ? scope === 'coupons'
            ? api.coupons.historyList({ signal })
            : api.coupons.list({ signal })
          : Promise.resolve([]),
        needsPoints ? api.points.list({ signal }) : Promise.resolve([]),
        needsAddresses ? api.addresses.list({ signal }) : Promise.resolve([]),
      ]);
      const couponOffers = scope === 'coupons' ? await api.coupons.availableList({ signal }) : [];

      return {
        member,
        orders,
        claims,
        coupons,
        couponOffers,
        points,
        addresses,
        products: [],
        unavailableProductIds: [],
        loadWarnings: [],
      };
    },
  });
}
