'use client';

import { queryKeys } from '@eum/api/query-keys';
import type {
  Address,
  Claim,
  Coupon,
  CouponOffer,
  Member,
  Order,
  Point,
  Product,
  Quote,
} from '@eum/api/types';
import { useQuery } from '@tanstack/react-query';
import { getShopApi } from '@/lib/shop-api';

export type MyPageDataScope =
  | 'dashboard'
  | 'orders'
  | 'order-detail'
  | 'claims'
  | 'claim-new'
  | 'wishlist'
  | 'recent'
  | 'coupons'
  | 'points'
  | 'profile'
  | 'profile-edit'
  | 'addresses'
  | 'quotes'
  | 'quote-detail';

export interface MyPageData {
  member: Member | null;
  orders: Order[];
  claims: Claim[];
  coupons: Coupon[];
  couponOffers: CouponOffer[];
  points: Point[];
  addresses: Address[];
  quotes: Quote[];
  products: Product[];
  unavailableProductIds: string[];
  loadWarnings: string[];
}

/** 컬렉션 화면은 현재 활성 탭의 상품만 조회합니다. */
export function getCollectionProductIds(
  scope: MyPageDataScope,
  wishlistIds: string[],
  recentIds: string[],
) {
  if (scope === 'wishlist') return wishlistIds;
  if (scope === 'recent') return recentIds;
  return [];
}

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
          quotes: [],
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
      const needsQuotes = scope === 'quotes' || scope === 'quote-detail';

      const [orders, claims, coupons, points, addresses, allQuotes] = await Promise.all([
        needsOrders ? api.orders.listByMember(member.id, { signal }) : Promise.resolve([]),
        needsClaims ? api.claims.listByMember(member.id, { signal }) : Promise.resolve([]),
        needsCoupons
          ? scope === 'coupons'
            ? api.coupons.historyList({ signal })
            : api.coupons.list({ signal })
          : Promise.resolve([]),
        needsPoints ? api.points.list({ signal }) : Promise.resolve([]),
        needsAddresses ? api.addresses.list({ signal }) : Promise.resolve([]),
        needsQuotes ? api.quotes.listByMember(member.id, { signal }) : Promise.resolve([]),
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
        quotes: allQuotes,
        products: [],
        unavailableProductIds: [],
        loadWarnings: [],
      };
    },
  });
}

export function formatMyPageDate(dateValue: string, options: Intl.DateTimeFormatOptions = {}) {
  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) return '—';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options,
  }).format(parsedDate);
}

export function formatMyPagePrice(amount: number) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(amount);
}
