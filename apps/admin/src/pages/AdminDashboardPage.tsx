import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Button } from '@eum/ui/components/Button';
import {
  AdminCountTile,
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  AdminStatusBadge,
  formatAdminCurrency,
  formatAdminDateTime,
} from '@/components/AdminUI';
import { getShopApi } from '@/lib/shop-api';
import { getAdminApiConfig } from '@/lib/api-config';
import { mapSettledWithConcurrency } from '@/lib/settled-concurrency';
import { createAdminRequestScope } from '@/lib/admin-request-lifecycle';
import type { Member, Order, Product } from '@eum/api/types';

type DashboardMember = Pick<Member, 'id' | 'name'>;
type DashboardOrderRecord = Pick<
  Order,
  'id' | 'orderNumber' | 'orderedAt' | 'status' | 'memberId' | 'paymentTotal'
> & { memberId: string };

interface DashboardOrder {
  order: DashboardOrderRecord;
  member: DashboardMember | undefined;
}

interface DashboardData {
  products: Product[];
  productTotalCount: number;
  orders: DashboardOrder[];
  membersById: Map<string, DashboardMember>;
  failedOrderMemberIds: string[];
  pendingQuoteCount: number;
  unavailableOrderMemberCount: number;
  orderListUnavailable: boolean;
}

const DASHBOARD_QUERY_KEY = ['admin', 'dashboard'] as const;

/** 회원별 주문 API와 공용 목록 API의 목 조회값으로 대시보드 데이터를 만듭니다. */
async function loadDashboardData(signal: AbortSignal): Promise<DashboardData> {
  const api = await getShopApi();
  const [productPage, members, quotes] = await Promise.all([
    api.products.list({ page: 1, pageSize: 100 }, { signal }),
    api.members.adminList({ signal }),
    api.quotes.adminList({ signal }),
  ]);
  const orderListUnavailable = getAdminApiConfig().mode === 'real';
  const ordersByMember = orderListUnavailable
    ? []
    : await mapSettledWithConcurrency(
        members,
        5,
        async (member) => ({
          member: { id: member.id, name: member.name },
          orders: await api.orders.listByMember(member.id, { signal }),
        }),
        signal,
      );
  const memberById = new Map(
    members.map((member) => [member.id, { id: member.id, name: member.name }] as const),
  );
  const orders = ordersByMember.flatMap((result) =>
    result.status === 'fulfilled'
      ? result.value.orders.map((order) => ({
          order: {
            id: order.id,
            orderNumber: order.orderNumber,
            orderedAt: order.orderedAt,
            status: order.status,
            memberId: result.value.member.id,
            paymentTotal: order.paymentTotal,
          },
          member: memberById.get(result.value.member.id),
        }))
      : [],
  );
  const pendingQuoteCount = quotes.filter(
    (quote) => quote.status === 'received' || quote.status === 'consulting',
  ).length;
  const failedOrderMemberIds = orderListUnavailable
    ? []
    : ordersByMember.flatMap((result, index) => {
        const member = members[index];
        return result.status === 'rejected' && member ? [member.id] : [];
      });
  return {
    products: productPage.items,
    productTotalCount: productPage.totalCount,
    orders,
    membersById: memberById,
    failedOrderMemberIds,
    pendingQuoteCount,
    unavailableOrderMemberCount: orderListUnavailable
      ? members.length
      : failedOrderMemberIds.length,
    orderListUnavailable,
  };
}

/** 마지막 14일 주문 건수를 비율에 맞춰 그리는 가벼운 막대 차트입니다. */
function AdminDashboardCharts({
  orders,
  unavailable,
}: {
  orders: DashboardOrder[];
  unavailable: boolean;
}) {
  const dailyTotals = new Map<string, { count: number; amount: number }>();
  for (const { order } of orders) {
    const date = new Date(order.orderedAt);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const total = dailyTotals.get(key) ?? { count: 0, amount: 0 };
    const isPaid =
      order.status === 'paid' ||
      order.status === 'preparing' ||
      order.status === 'shipping' ||
      order.status === 'delivered';
    dailyTotals.set(key, {
      count: total.count + 1,
      amount: total.amount + (isPaid ? order.paymentTotal : 0),
    });
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dailyValues = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - 13 + index);
    return (
      dailyTotals.get(`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`) ?? {
        count: 0,
        amount: 0,
      }
    );
  });
  const maxCount = Math.max(...dailyValues.map((dailyValue) => dailyValue.count), 1);
  const totalCount = dailyValues.reduce((sum, dailyValue) => sum + dailyValue.count, 0);
  const totalAmount = dailyValues.reduce((sum, dailyValue) => sum + dailyValue.amount, 0);
  const maxAmount = Math.max(...dailyValues.map((dailyValue) => dailyValue.amount), 1);
  const formatChartDay = (daysBeforeToday: number) => {
    const date = new Date(today);
    date.setDate(today.getDate() - daysBeforeToday);
    return new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit' }).format(date);
  };
  const linePoints = dailyValues
    .map(
      (dailyValue, index) => `${(index / 13) * 520},${88 - (dailyValue.amount / maxAmount) * 72}`,
    )
    .join(' L ');

  return (
    <div className="mt-16 grid grid-cols-2 gap-16">
      <AdminPanel title="일별 주문 건수" description="최근 14일 · 회원별 주문 조회">
        {unavailable ? (
          <AdminEmpty
            title="주문 건수 데이터 미제공"
            description="운영 주문 목록 API가 연결되면 표시됩니다."
          />
        ) : (
          <>
            <div className="flex h-180 items-end gap-8 px-20 py-16">
              <div
                className="flex h-full flex-col justify-between pb-16 text-caption text-text-3"
                aria-hidden="true"
              >
                <span>{maxCount}건</span>
                <span>{Math.round(maxCount / 2)}건</span>
                <span>0건</span>
              </div>
              <div
                role="img"
                aria-label={`최근 14일 주문 ${totalCount.toLocaleString('ko-KR')}건`}
                className="relative flex h-full flex-1 items-end justify-between border-y border-line bg-[linear-gradient(to_bottom,transparent_49%,var(--color-line)_50%,transparent_51%)] px-8"
              >
                {dailyValues.map((dailyValue, index) => (
                  <span
                    key={index}
                    aria-hidden="true"
                    className={`w-12 rounded-t-4 ${index === 13 ? 'bg-info' : 'bg-info-tint'}`}
                    style={{ height: `${Math.max(4, (dailyValue.count / maxCount) * 120)}px` }}
                  />
                ))}
              </div>
              <span className="self-start text-label-s">
                {totalCount.toLocaleString('ko-KR')}건
              </span>
            </div>
            <div
              className="-mt-12 ml-52 flex justify-between px-28 pb-12 text-caption text-text-3"
              aria-hidden="true"
            >
              <span>{formatChartDay(13)}</span>
              <span>{formatChartDay(6)}</span>
              <span>{formatChartDay(0)}</span>
            </div>
          </>
        )}
      </AdminPanel>
      <AdminPanel title="일별 결제 금액" description="최근 14일 · 결제된 주문 금액 기준">
        {unavailable ? (
          <AdminEmpty
            title="매출 데이터 미제공"
            description="운영 주문 목록 API가 연결되면 표시됩니다."
          />
        ) : (
          <>
            <div className="flex h-180 items-end gap-8 px-20 py-16">
              <div
                className="flex h-full flex-col justify-between pb-16 text-caption text-text-3"
                aria-hidden="true"
              >
                <span>{formatAdminCurrency(maxAmount)}</span>
                <span>{formatAdminCurrency(Math.round(maxAmount / 2))}</span>
                <span>₩0</span>
              </div>
              <svg
                role="img"
                aria-label={`최근 14일 결제 금액 ${formatAdminCurrency(totalAmount)}`}
                viewBox="0 0 520 96"
                preserveAspectRatio="none"
                className="h-full min-w-0 flex-1 border-y border-line"
              >
                <path d="M0 48H520" stroke="var(--color-line)" strokeDasharray="3 4" />
                <path
                  d={`M ${linePoints} L 520,96 L 0,96 Z`}
                  fill="var(--color-danger-tint)"
                  opacity=".8"
                />
                <path
                  d={`M ${linePoints}`}
                  fill="none"
                  stroke="var(--color-danger)"
                  strokeWidth="2"
                />
              </svg>
              <span className="self-start text-label-s">{formatAdminCurrency(totalAmount)}</span>
            </div>
            <div
              className="-mt-12 ml-52 flex justify-between px-28 pb-12 text-caption text-text-3"
              aria-hidden="true"
            >
              <span>{formatChartDay(13)}</span>
              <span>{formatChartDay(6)}</span>
              <span>{formatChartDay(0)}</span>
            </div>
          </>
        )}
      </AdminPanel>
    </div>
  );
}

/** 목 데이터 집계와 접근 가능한 간단 차트를 보여 줍니다. */
export function AdminDashboardPage() {
  const [orderRetryAnnouncement, setOrderRetryAnnouncement] = useState('');
  const [isRetryingOrders, setIsRetryingOrders] = useState(false);
  const retryScopeRef = useRef<ReturnType<typeof createAdminRequestScope> | null>(null);
  const queryClient = useQueryClient();
  const dashboardQuery = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: ({ signal }) => loadDashboardData(signal),
  });

  useEffect(
    () => () => {
      retryScopeRef.current?.cancel();
    },
    [],
  );

  const handleRetryOrders = async () => {
    const cachedDashboardData = dashboardQuery.data;
    const failedOrderMemberIds = cachedDashboardData?.failedOrderMemberIds;
    if (!cachedDashboardData || !failedOrderMemberIds?.length) {
      setOrderRetryAnnouncement('주문 재조회 대상을 확인하지 못했습니다. 현재 결과를 유지합니다.');
      return;
    }

    retryScopeRef.current?.cancel();
    retryScopeRef.current = null;
    const requestScope = createAdminRequestScope();
    if (!requestScope.isCurrent()) {
      requestScope.dispose();
      return;
    }
    retryScopeRef.current = requestScope;
    setIsRetryingOrders(true);
    setOrderRetryAnnouncement('회원별 주문을 다시 조회하고 있습니다.');
    try {
      const api = await getShopApi();
      if (!requestScope.isCurrent()) return;
      const retryResults = await mapSettledWithConcurrency(
        failedOrderMemberIds,
        5,
        async (memberId) => ({
          memberId,
          orders: await api.orders.listByMember(memberId, { signal: requestScope.signal }),
        }),
        requestScope.signal,
      );
      if (!requestScope.isCurrent()) return;
      const resolvedMemberIds = new Set(
        retryResults.flatMap((result) =>
          result.status === 'fulfilled' ? [result.value.memberId] : [],
        ),
      );
      const stillFailedMemberIds = retryResults.flatMap((result, index) => {
        const memberId = failedOrderMemberIds[index];
        return result.status === 'rejected' && memberId ? [memberId] : [];
      });
      const retriedOrders = retryResults.flatMap((result) =>
        result.status === 'fulfilled'
          ? result.value.orders.map((order) => ({
              order: {
                id: order.id,
                orderNumber: order.orderNumber,
                orderedAt: order.orderedAt,
                status: order.status,
                memberId: result.value.memberId,
                paymentTotal: order.paymentTotal,
              },
              member: cachedDashboardData.membersById.get(result.value.memberId),
            }))
          : [],
      );

      if (!requestScope.isCurrent()) return;
      queryClient.setQueryData<DashboardData>(DASHBOARD_QUERY_KEY, (currentData) => {
        if (!currentData) return undefined;
        const failedOrderMemberIds = new Set(
          currentData.failedOrderMemberIds.filter((memberId) => !resolvedMemberIds.has(memberId)),
        );
        stillFailedMemberIds.forEach((memberId) => failedOrderMemberIds.add(memberId));

        return {
          ...currentData,
          orders: [
            ...currentData.orders.filter(({ order }) => !resolvedMemberIds.has(order.memberId)),
            ...retriedOrders,
          ],
          failedOrderMemberIds: [...failedOrderMemberIds],
          unavailableOrderMemberCount: currentData.orderListUnavailable
            ? currentData.unavailableOrderMemberCount
            : failedOrderMemberIds.size,
        };
      });

      if (!requestScope.isCurrent()) return;
      setOrderRetryAnnouncement(
        stillFailedMemberIds.length > 0
          ? `주문 재조회 후에도 회원 ${stillFailedMemberIds.length.toLocaleString('ko-KR')}명의 주문 조회에 실패했습니다.`
          : '회원별 주문 재조회가 완료되었습니다.',
      );
    } catch {
      if (!requestScope.isCurrent()) return;
      setOrderRetryAnnouncement('주문 재조회에 실패했습니다. 기존 결과와 경고를 유지합니다.');
    } finally {
      if (retryScopeRef.current === requestScope) {
        retryScopeRef.current = null;
      }
      requestScope.dispose();
      if (requestScope.isCurrent()) setIsRetryingOrders(false);
    }
  };

  if (dashboardQuery.isPending) return <AdminLoading label="대시보드 현황을 불러오고 있습니다." />;
  if (!dashboardQuery.data) return <AdminError onRetry={() => void dashboardQuery.refetch()} />;

  const {
    products,
    productTotalCount,
    orders,
    pendingQuoteCount,
    unavailableOrderMemberCount,
    orderListUnavailable,
  } = dashboardQuery.data;
  const isProductAggregationPartial = productTotalCount > products.length;
  const productAggregationHint = isProductAggregationPartial
    ? `${products.length.toLocaleString('ko-KR')}개 조회분 · 전체 ${productTotalCount.toLocaleString('ko-KR')}개`
    : '전체 상품 기준';
  const activeProducts = products.filter((product) => product.stockStatus === 'inStock');
  const soldOutProducts = products.filter((product) => product.stockStatus === 'soldOut');
  const hiddenPriceProducts = products.filter((product) => !product.priceVisible);
  const recentOrders = [...orders]
    .sort((left, right) => right.order.orderedAt.localeCompare(left.order.orderedAt))
    .slice(0, 5);

  return (
    <section>
      <AdminPageHeader
        title="대시보드"
        description={`기준 ${formatAdminDateTime(new Date().toISOString())}`}
      />
      {isProductAggregationPartial ? (
        <AdminNotice tone="warning" className="mb-16">
          상품 지표는 전체 {productTotalCount.toLocaleString('ko-KR')}개 중 첫{' '}
          {products.length.toLocaleString('ko-KR')}개 조회분만 집계한 부분 결과입니다.
          판매중·품절·금액 미표시 수와 아래 재고 표는 전체 상품 기준이 아닙니다.
        </AdminNotice>
      ) : null}
      <div className="grid grid-cols-6 gap-12">
        <AdminCountTile
          label="판매중 상품"
          value={activeProducts.length}
          href="/products"
          hint={productAggregationHint}
        />
        <AdminCountTile
          label="품절 상품"
          value={soldOutProducts.length}
          href="/products"
          hint={productAggregationHint}
        />
        <AdminCountTile
          label="재고 부족"
          value="—"
          href="/products"
          hint="재고 수량 API 없음"
          emphasis
        />
        <AdminCountTile
          label="금액 미표시 상품"
          value={hiddenPriceProducts.length}
          href="/products"
          hint={productAggregationHint}
        />
        <AdminCountTile
          label="신규 주문"
          value={orderListUnavailable ? '—' : orders.length}
          href="/orders"
          hint={orderListUnavailable ? '주문 조회 API 미제공' : undefined}
        />
        <AdminCountTile
          label="미처리 견적 문의"
          value={pendingQuoteCount}
          href="/quotes"
          emphasis
        />
      </div>

      {orderListUnavailable ? (
        <AdminNotice tone="warning" className="mt-16">
          실제 운영 API에는 주문 목록 조회가 아직 연결되지 않았습니다. 주문 건수와 매출 차트는
          표시하지 않습니다.
        </AdminNotice>
      ) : unavailableOrderMemberCount > 0 ? (
        <AdminNotice
          tone="warning"
          className="mt-16"
          action={
            <Button
              type="button"
              variant="secondary"
              size="s"
              disabled={isRetryingOrders || dashboardQuery.isFetching}
              onClick={() => void handleRetryOrders()}
            >
              {isRetryingOrders || dashboardQuery.isFetching ? '조회 중…' : '주문 다시 조회'}
            </Button>
          }
        >
          회원 {unavailableOrderMemberCount.toLocaleString('ko-KR')}명의 주문 조회에 실패해 부분
          결과만 표시합니다.
        </AdminNotice>
      ) : null}
      <span role="status" aria-live="polite" className="sr-only">
        {orderRetryAnnouncement}
      </span>

      <AdminDashboardCharts orders={orders} unavailable={orderListUnavailable} />

      <div className="mt-16 grid grid-cols-2 gap-16">
        <AdminPanel
          title="상품 재고 상태"
          description={`${isProductAggregationPartial ? `첫 ${products.length.toLocaleString('ko-KR')}개 조회분 · ` : ''}수량 API가 없어 품절 여부만 표시합니다.`}
          action={
            <Link to="/products" className="text-label-s hover:underline">
              전체 보기
            </Link>
          }
          bodyClassName="overflow-hidden"
        >
          {products.length === 0 ? (
            <AdminEmpty title="등록된 상품이 없습니다" />
          ) : (
            <table className="w-full border-collapse text-left text-body-s">
              <thead className="bg-surface text-label-s text-text-2">
                <tr>
                  <th scope="col" className="px-20 py-10 font-medium">
                    상품명
                  </th>
                  <th scope="col" className="px-12 py-10 font-medium">
                    재고 수량
                  </th>
                  <th scope="col" className="px-20 py-10 text-right font-medium">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.slice(0, 5).map((product) => (
                  <tr key={product.id} className="border-t border-line">
                    <td className="px-20 py-10">
                      <Link to={`/products/${product.id}`} className="hover:underline">
                        {product.name}
                      </Link>
                    </td>
                    <td className="px-12 py-10 text-text-3">미제공</td>
                    <td className="px-20 py-10 text-right">
                      <AdminStatusBadge status={product.stockStatus} kind="product" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </AdminPanel>
        <AdminPanel
          title="최근 주문"
          action={
            <Link to="/orders" className="text-label-s hover:underline">
              전체 보기
            </Link>
          }
          bodyClassName="overflow-hidden"
        >
          {recentOrders.length === 0 ? (
            <AdminEmpty
              title={orderListUnavailable ? '주문 목록 API 미제공' : '주문 내역이 없습니다'}
              description={
                orderListUnavailable ? '실제 주문 데이터를 불러올 수 없습니다.' : undefined
              }
            />
          ) : (
            <table className="w-full border-collapse text-left text-body-s">
              <thead className="bg-surface text-label-s text-text-2">
                <tr>
                  <th scope="col" className="px-20 py-10 font-medium">
                    주문번호
                  </th>
                  <th scope="col" className="px-12 py-10 font-medium">
                    주문자
                  </th>
                  <th scope="col" className="px-12 py-10 text-right font-medium">
                    결제금액
                  </th>
                  <th scope="col" className="px-20 py-10 text-right font-medium">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(({ order, member }) => (
                  <tr key={order.id} className="border-t border-line">
                    <td className="px-20 py-10">
                      <Link to={`/orders/${order.id}`} className="hover:underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-12 py-10">{member?.name ?? '회원 정보 없음'}</td>
                    <td className="px-12 py-10 text-right">
                      {formatAdminCurrency(order.paymentTotal)}
                    </td>
                    <td className="px-20 py-10 text-right">
                      <AdminStatusBadge status={order.status} kind="order" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </AdminPanel>
      </div>
    </section>
  );
}
