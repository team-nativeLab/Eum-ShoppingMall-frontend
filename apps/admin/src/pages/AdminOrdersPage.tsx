import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Button } from '@eum/ui/components/Button';
import { Pagination } from '@eum/ui/components/Pagination';
import { Modal } from '@eum/ui/components/Modal';
import {
  AdminEmpty,
  AdminDateInput,
  AdminError,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTabs,
  formatAdminCurrency,
  formatAdminDateTime,
  getAdminLocalDateKey,
  isInvalidAdminDateInput,
  parseAdminDateInput,
} from '@/components/AdminUI';
import { getShopApi } from '@/lib/shop-api';
import { getAdminApiConfig } from '@/lib/api-config';
import { createAdminRequestScope } from '@/lib/admin-request-lifecycle';
import { mapSettledWithConcurrency } from '@/lib/settled-concurrency';
import {
  ADMIN_TRACKING_MAX_CHARACTERS,
  validateAdminTrackingRows,
} from '@/lib/admin-preview-validation';
import type { AdminOrder, Member, Order, OrderStatus } from '@eum/api/types';

type OrderTab = 'all' | OrderStatus;
type AdminOrderMember = Pick<Member, 'id' | 'name' | 'email' | 'phone'>;
type AdminOrderSummary = Pick<
  Order,
  'id' | 'orderNumber' | 'orderedAt' | 'status' | 'memberId' | 'paymentTotal'
> & { memberId: string } & {
  lines: Pick<Order['lines'][number], 'productName'>[];
};

interface AdminOrdersData {
  orders: AdminOrderSummary[];
  membersById: Map<string, AdminOrderMember>;
  failedMemberIds: string[];
  failedMemberCount: number;
  orderListUnavailable: boolean;
}

const ADMIN_ORDERS_QUERY_KEY = ['admin', 'orders', 'list'] as const;

const ORDER_TABS: { value: OrderTab; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'paymentPending', label: '결제대기' },
  { value: 'paid', label: '결제완료' },
  { value: 'preparing', label: '배송준비' },
  { value: 'shipping', label: '배송중' },
  { value: 'delivered', label: '배송완료' },
  { value: 'canceled', label: '취소·반품' },
];

function toAdminOrderSummary(order: Order & { memberId: string }): AdminOrderSummary {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    orderedAt: order.orderedAt,
    status: order.status,
    memberId: order.memberId,
    paymentTotal: order.paymentTotal,
    lines: order.lines.map(({ productName }) => ({ productName })),
  };
}

/** 관리자 전용 주문 API와 회원 표시 정보를 함께 불러옵니다. */
async function loadAdminOrders(signal: AbortSignal): Promise<AdminOrdersData> {
  if (getAdminApiConfig().mode === 'real') {
    return {
      orders: [],
      membersById: new Map(),
      failedMemberIds: [],
      failedMemberCount: 0,
      orderListUnavailable: true,
    };
  }
  const api = await getShopApi();
  const members = await api.members.adminList({ signal });
  if (typeof api.orders.adminList !== 'function') {
    // Transitional compatibility for partial API adapters; the production mock
    // and real API contracts use adminList directly.
    const memberResults = await mapSettledWithConcurrency(
      members,
      4,
      (member) => api.orders.listByMember(member.id, { signal }),
      signal,
    );
    const legacyOrders: (Order & { memberId: string })[] = [];
    const failedMemberIds: string[] = [];
    memberResults.forEach((result, index) => {
      const member = members[index];
      if (result.status === 'fulfilled' && member) {
        legacyOrders.push(...result.value.map((order) => ({ ...order, memberId: member.id })));
      } else if (member) failedMemberIds.push(member.id);
    });
    return {
      orders: legacyOrders.map(toAdminOrderSummary),
      membersById: new Map(
        members.map((member) => [
          member.id,
          { id: member.id, name: member.name, email: member.email, phone: member.phone },
        ]),
      ),
      failedMemberIds,
      failedMemberCount: failedMemberIds.length,
      orderListUnavailable: false,
    };
  }
  const adminOrders = await api.orders.adminList({ signal });
  return {
    orders: adminOrders.map(toAdminOrderSummary),
    membersById: new Map(
      members.map(
        (member) =>
          [
            member.id,
            {
              id: member.id,
              name: member.name,
              email: member.email,
              phone: member.phone,
            },
          ] as const,
      ),
    ),
    failedMemberIds: [],
    failedMemberCount: 0,
    orderListUnavailable: false,
  };
}

/** 주문을 검색하고 상태·기간별로 좁혀서 표시합니다. */
export function AdminOrdersPage() {
  const [orderRetryAnnouncement, setOrderRetryAnnouncement] = useState('');
  const [isRetryingOrders, setIsRetryingOrders] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tab, setTab] = useState<OrderTab>('all');
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest'>('recent');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkMessage, setBulkMessage] = useState('');
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [trackingInput, setTrackingInput] = useState('');
  const retryScopeRef = useRef<ReturnType<typeof createAdminRequestScope> | null>(null);
  const queryClient = useQueryClient();
  const ordersQuery = useQuery({
    queryKey: ADMIN_ORDERS_QUERY_KEY,
    queryFn: ({ signal }) => loadAdminOrders(signal),
  });

  useEffect(
    () => () => {
      retryScopeRef.current?.cancel();
    },
    [],
  );

  const handleRetryOrders = async () => {
    setSelectedOrderIds([]);
    const cachedOrderData = ordersQuery.data;
    const failedMemberIds = cachedOrderData?.failedMemberIds;
    if (!cachedOrderData || !failedMemberIds?.length) {
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
      let refreshedOrders: AdminOrder[];
      if (typeof api.orders.adminList === 'function') {
        refreshedOrders = await api.orders.adminList({ signal: requestScope.signal });
      } else {
        const retryMembers = [...cachedOrderData.membersById.values()].filter((member) =>
          failedMemberIds.includes(member.id),
        );
        const results = await mapSettledWithConcurrency(
          retryMembers,
          4,
          (member) => api.orders.listByMember(member.id, { signal: requestScope.signal }),
          requestScope.signal,
        );
        const successfulOrders: (Order & { memberId: string })[] = [];
        const stillFailedMemberIds: string[] = [];
        results.forEach((result, index) => {
          const member = retryMembers[index];
          if (result.status === 'fulfilled' && member) {
            successfulOrders.push(
              ...result.value.map((order) => ({ ...order, memberId: member.id })),
            );
          } else if (member) stillFailedMemberIds.push(member.id);
        });
        if (!requestScope.isCurrent()) return;
        queryClient.setQueryData<AdminOrdersData>(ADMIN_ORDERS_QUERY_KEY, (currentData) => {
          if (!currentData) return currentData;
          const retainedOrders = currentData.orders.filter(
            (order) => !retryMembers.some((member) => member.id === order.memberId),
          );
          return {
            ...currentData,
            orders: [...retainedOrders, ...successfulOrders.map(toAdminOrderSummary)],
            failedMemberIds: stillFailedMemberIds,
            failedMemberCount: stillFailedMemberIds.length,
          };
        });
        if (stillFailedMemberIds.length) {
          if (!requestScope.isCurrent()) return;
          setOrderRetryAnnouncement(
            `주문 재조회 후에도 회원 ${stillFailedMemberIds.length}명의 주문 조회에 실패했습니다.`,
          );
          return;
        }
        if (!requestScope.isCurrent()) return;
        setOrderRetryAnnouncement('회원별 주문 재조회가 완료되었습니다.');
        return;
      }
      if (!requestScope.isCurrent()) return;
      queryClient.setQueryData<AdminOrdersData>(ADMIN_ORDERS_QUERY_KEY, (currentData) =>
        currentData
          ? {
              ...currentData,
              orders: refreshedOrders.map(toAdminOrderSummary),
            }
          : undefined,
      );

      if (!requestScope.isCurrent()) return;
      setOrderRetryAnnouncement('회원별 주문 재조회가 완료되었습니다.');
    } catch {
      if (!requestScope.isCurrent()) return;
      setOrderRetryAnnouncement('주문 재조회에 실패했습니다. 기존 목록과 경고를 유지합니다.');
    } finally {
      if (retryScopeRef.current === requestScope) {
        retryScopeRef.current = null;
      }
      requestScope.dispose();
      if (requestScope.isCurrent()) setIsRetryingOrders(false);
    }
  };
  const hasInvalidDateFilter =
    isInvalidAdminDateInput(startDate) || isInvalidAdminDateInput(endDate);

  const matchingOrders = useMemo(() => {
    if (!ordersQuery.data || hasInvalidDateFilter) return [];
    const normalizedKeyword = searchKeyword.toLocaleLowerCase('ko-KR');
    const startDateKey = parseAdminDateInput(startDate);
    const endDateKey = parseAdminDateInput(endDate);
    return ordersQuery.data.orders
      .filter((order) => tab === 'all' || order.status === tab)
      .filter((order) => {
        if (!normalizedKeyword) return true;
        const member = ordersQuery.data.membersById.get(order.memberId);
        const searchableText = [order.orderNumber, member?.name, member?.email, member?.phone]
          .filter((entry): entry is string => entry !== undefined)
          .join(' ')
          .toLocaleLowerCase('ko-KR');
        return searchableText.includes(normalizedKeyword);
      })
      .filter((order) => {
        const orderedDate = getAdminLocalDateKey(order.orderedAt);
        return (
          (!startDateKey || orderedDate >= startDateKey) &&
          (!endDateKey || orderedDate <= endDateKey)
        );
      })
      .toSorted((left, right) =>
        sortOrder === 'recent'
          ? right.orderedAt.localeCompare(left.orderedAt)
          : left.orderedAt.localeCompare(right.orderedAt),
      );
  }, [endDate, hasInvalidDateFilter, ordersQuery.data, searchKeyword, sortOrder, startDate, tab]);

  if (ordersQuery.isPending) return <AdminLoading label="주문 목록을 불러오고 있습니다." />;
  if (ordersQuery.isError && !ordersQuery.data) {
    return (
      <AdminError
        title="주문 목록을 불러오지 못했습니다"
        description="회원별 주문 조회 API가 연결되어 있는지 확인해 주세요."
        onRetry={() => void ordersQuery.refetch()}
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(matchingOrders.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleOrders = matchingOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const tabOptions = ORDER_TABS.map((option) => ({
    ...option,
    count:
      option.value === 'all'
        ? ordersQuery.data.orders.length
        : ordersQuery.data.orders.filter((order) => order.status === option.value).length,
  }));
  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchKeyword(searchInput.trim());
    setPage(1);
    setSelectedOrderIds([]);
  };
  const handleReset = () => {
    setSearchInput('');
    setSearchKeyword('');
    setStartDate('');
    setEndDate('');
    setTab('all');
    setPage(1);
    setSelectedOrderIds([]);
  };
  const trackingValidation = validateAdminTrackingRows(trackingInput, selectedOrderIds);
  const applyPreparing = async () => {
    try {
      const api = await getShopApi();
      const results = await Promise.allSettled(
        selectedOrderIds.map((id) => api.orders.updateAdmin(id, { status: 'preparing' })),
      );
      const savedCount = results.filter((result) => result.status === 'fulfilled').length;
      await queryClient.invalidateQueries({ queryKey: ADMIN_ORDERS_QUERY_KEY });
      setBulkMessage(`${savedCount}건을 배송 준비 상태로 목 API에 저장했습니다.`);
      setSelectedOrderIds([]);
    } catch (error) {
      setBulkMessage(error instanceof Error ? error.message : '주문 상태를 저장하지 못했습니다.');
    }
  };
  const applyTrackingPreview = async () => {
    if (!trackingValidation.validRows.length) return;
    try {
      const api = await getShopApi();
      const results = await Promise.allSettled(
        trackingValidation.validRows.map((row) =>
          api.orders.updateAdmin(row.orderId, {
            trackingCarrier: row.carrier,
            trackingNumber: row.trackingNumber,
            status: 'shipping',
          }),
        ),
      );
      const successCount = results.filter((result) => result.status === 'fulfilled').length;
      await queryClient.invalidateQueries({ queryKey: ADMIN_ORDERS_QUERY_KEY });
      setBulkMessage(
        `${successCount}건의 송장과 배송 상태를 목 API에 저장했습니다.${trackingValidation.errors.length ? ` ${trackingValidation.errors.length}개 입력 오류를 제외했습니다.` : ''}`,
      );
      setIsTrackingModalOpen(false);
      setTrackingInput('');
      setSelectedOrderIds([]);
    } catch (error) {
      setBulkMessage(error instanceof Error ? error.message : '송장 정보를 저장하지 못했습니다.');
    }
  };

  return (
    <section aria-label="주문 관리">
      <AdminPageHeader
        title="주문 관리"
        description={`총 ${matchingOrders.length.toLocaleString('ko-KR')}건`}
        descriptionPlacement="inline"
      />
      <AdminNotice
        className="mb-16"
        tone={ordersQuery.data.orderListUnavailable ? 'warning' : 'info'}
      >
        {ordersQuery.data.orderListUnavailable
          ? '실제 운영 API에는 주문 관리가 연결되지 않았습니다. 주문 목록을 표시할 수 없습니다.'
          : '주문 취소·환불과 택배사 전송은 이 화면에서 지원하지 않습니다.'}
      </AdminNotice>
      {ordersQuery.data.failedMemberCount > 0 ? (
        <AdminNotice
          tone="warning"
          className="mb-16"
          action={
            <Button
              type="button"
              variant="secondary"
              size="s"
              disabled={isRetryingOrders || ordersQuery.isFetching}
              onClick={() => void handleRetryOrders()}
            >
              {isRetryingOrders || ordersQuery.isFetching ? '조회 중…' : '다시 조회'}
            </Button>
          }
        >
          회원 {ordersQuery.data.failedMemberCount.toLocaleString('ko-KR')}명의 주문 조회에
          실패했습니다. 현재 목록은 조회가 완료된 회원의 부분 결과입니다.
        </AdminNotice>
      ) : null}
      <span role="status" aria-live="polite" className="sr-only">
        {orderRetryAnnouncement}
      </span>
      <AdminTabs
        label="주문 상태 필터"
        options={tabOptions}
        value={tab}
        onChange={(nextTab) => {
          setTab(nextTab);
          setPage(1);
          setSelectedOrderIds([]);
        }}
      />
      <form
        className="mt-16 flex flex-wrap items-center gap-8 rounded-12 border border-line bg-bg p-12"
        onSubmit={handleSearch}
      >
        <label className="flex h-40 min-w-240 flex-1 items-center rounded-8 border border-line-control px-12">
          <span className="sr-only">주문번호·주문자·연락처 검색</span>
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="주문번호 · 주문자 · 연락처"
            className="w-full min-w-0 border-0 bg-transparent text-body-s outline-none placeholder:text-text-3"
          />
        </label>
        <div className="flex h-40 items-center gap-8 rounded-8 border border-line-control px-12 text-caption text-text-3">
          <span>주문일</span>
          <AdminDateInput
            label="주문 시작일"
            value={startDate}
            invalid={isInvalidAdminDateInput(startDate)}
            errorMessageId="order-date-filter-error"
            onChange={(nextValue) => {
              setStartDate(nextValue);
              setPage(1);
              setSelectedOrderIds([]);
            }}
            className="w-132"
          />
          <span aria-hidden="true">~</span>
          <AdminDateInput
            label="주문 종료일"
            value={endDate}
            invalid={isInvalidAdminDateInput(endDate)}
            errorMessageId="order-date-filter-error"
            onChange={(nextValue) => {
              setEndDate(nextValue);
              setPage(1);
              setSelectedOrderIds([]);
            }}
            className="w-132"
          />
        </div>
        <Button type="button" variant="ghost" size="s" onClick={handleReset}>
          초기화
        </Button>
        <Button type="submit" size="s">
          검색
        </Button>
      </form>
      {hasInvalidDateFilter ? (
        <p id="order-date-filter-error" role="alert" className="mt-8 text-caption text-danger">
          시작일과 종료일은 YYYY.MM.DD 형식의 유효한 날짜여야 합니다. 날짜를 수정하면 해당 조건으로
          결과를 다시 표시합니다.
        </p>
      ) : null}
      <section
        className="mt-16 overflow-hidden rounded-12 border border-line bg-bg"
        aria-label="주문 검색 결과"
      >
        <div className="flex min-h-48 flex-wrap items-center justify-between gap-12 border-b border-line px-20 py-8">
          <p className="text-body-s text-text-2">
            검색 결과 {matchingOrders.length.toLocaleString('ko-KR')}건
          </p>
          <div className="flex items-center gap-8">
            <label className="sr-only" htmlFor="admin-order-sort">
              정렬 기준
            </label>
            <select
              id="admin-order-sort"
              value={sortOrder}
              onChange={(event) => {
                setSortOrder(event.target.value as 'recent' | 'oldest');
                setSelectedOrderIds([]);
              }}
              className="h-36 rounded-8 border border-line-control bg-bg px-12 text-body-s"
            >
              <option value="recent">최근 주문순</option>
              <option value="oldest">오래된 순</option>
            </select>
            <label className="sr-only" htmlFor="admin-order-page-size">
              페이지당 표시 수
            </label>
            <select
              id="admin-order-page-size"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
                setSelectedOrderIds([]);
              }}
              className="h-36 rounded-8 border border-line-control bg-bg px-12 text-body-s"
            >
              <option value={20}>20개씩</option>
              <option value={50}>50개씩</option>
              <option value={100}>100개씩</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-8 border-b border-line px-20 py-10">
          <span className="text-body-s text-text-2">선택 {selectedOrderIds.length}건</span>
          <Button
            type="button"
            size="s"
            variant="secondary"
            disabled={!selectedOrderIds.length}
            onClick={() => void applyPreparing()}
          >
            배송준비로 변경
          </Button>
          <Button
            type="button"
            size="s"
            variant="secondary"
            disabled={!selectedOrderIds.length}
            onClick={() => setIsTrackingModalOpen(true)}
          >
            송장 일괄 등록
          </Button>
          <Button
            type="button"
            size="s"
            variant="secondary"
            disabled
            aria-describedby="order-export-help"
          >
            엑셀 다운로드
          </Button>
          <span id="order-export-help" className="text-caption text-text-3">
            실제 파일 다운로드는 제공하지 않습니다.
          </span>
          <span role="status" aria-live="polite" className="text-caption text-warning">
            {bulkMessage}
          </span>
        </div>
        {visibleOrders.length === 0 ? (
          <AdminEmpty
            title={hasInvalidDateFilter ? '주문일 입력을 확인해 주세요' : '주문 내역이 없습니다'}
            description={
              hasInvalidDateFilter
                ? '올바른 날짜를 입력하면 검색 결과가 표시됩니다.'
                : ordersQuery.data.orderListUnavailable
                  ? '실제 주문 API가 연결되면 이곳에 주문이 표시됩니다.'
                  : ordersQuery.data.failedMemberCount
                    ? '검색 조건에 맞는 주문이 없거나 일부 회원의 주문을 조회하지 못했습니다.'
                    : '검색어나 주문 상태를 확인해 주세요.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-880 border-collapse text-left text-body-s">
              <thead className="bg-surface text-label-s text-text-2">
                <tr>
                  <th scope="col" className="px-12 py-12 font-medium">
                    <span className="sr-only">선택</span>
                  </th>
                  <th scope="col" className="px-20 py-12 font-medium">
                    주문번호
                  </th>
                  <th scope="col" className="px-12 py-12 font-medium">
                    주문일시
                  </th>
                  <th scope="col" className="px-12 py-12 font-medium">
                    주문자
                  </th>
                  <th scope="col" className="px-12 py-12 font-medium">
                    상품
                  </th>
                  <th scope="col" className="px-12 py-12 text-right font-medium">
                    결제금액
                  </th>
                  <th scope="col" className="px-12 py-12 font-medium">
                    결제수단
                  </th>
                  <th scope="col" className="px-20 py-12 font-medium">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((order) => {
                  const member = ordersQuery.data.membersById.get(order.memberId);
                  const firstLine = order.lines[0];
                  const additionalLineCount = Math.max(0, order.lines.length - 1);
                  const productSummary = firstLine
                    ? `${firstLine.productName}${additionalLineCount > 0 ? ` 외 ${additionalLineCount}건` : ''}`
                    : '상품 정보 없음';
                  return (
                    <tr key={order.id} className="border-t border-line hover:bg-bg-subtle">
                      <td className="px-12 py-12">
                        <input
                          type="checkbox"
                          aria-label={`${order.orderNumber} 선택`}
                          checked={selectedOrderIds.includes(order.id)}
                          onChange={(event) =>
                            setSelectedOrderIds((ids) =>
                              event.target.checked
                                ? [...ids, order.id]
                                : ids.filter((id) => id !== order.id),
                            )
                          }
                        />
                      </td>
                      <td className="px-20 py-12">
                        <Link
                          to={`/orders/${order.id}`}
                          className="font-medium focus-ring hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-12 py-12 whitespace-nowrap text-text-3">
                        {formatAdminDateTime(order.orderedAt)}
                      </td>
                      <td className="px-12 py-12">
                        <span className="block">{member?.name ?? '회원 정보 없음'}</span>
                        <span className="mt-2 block text-caption text-text-3">
                          {member?.phone ?? '연락처 미제공'}
                        </span>
                      </td>
                      <td className="max-w-240 truncate px-12 py-12" title={productSummary}>
                        {productSummary}
                      </td>
                      <td className="px-12 py-12 text-right whitespace-nowrap">
                        {formatAdminCurrency(order.paymentTotal)}
                      </td>
                      <td className="px-12 py-12 text-text-3">미제공</td>
                      <td className="px-20 py-12">
                        <AdminStatusBadge status={order.status} kind="order" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(nextPage) => {
          setPage(nextPage);
          setSelectedOrderIds([]);
        }}
        className="mt-20 flex justify-center"
      />
      <Modal
        isOpen={isTrackingModalOpen}
        onClose={() => {
          setIsTrackingModalOpen(false);
          setTrackingInput('');
        }}
        title="송장 일괄 등록"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setIsTrackingModalOpen(false);
                setTrackingInput('');
              }}
            >
              취소
            </Button>
            <Button
              disabled={!trackingValidation.validRows.length}
              onClick={() => void applyTrackingPreview()}
            >
              유효 행 저장
            </Button>
          </>
        }
      >
        <div className="mt-16 grid gap-12 text-body-s">
          <AdminNotice tone="warning">
            주문 ID, 택배사, 송장번호를 쉼표로 구분해 한 줄씩 입력합니다. 유효한 값은 목 API에
            저장되며 실제 택배사로 전송되지 않습니다.
          </AdminNotice>
          <textarea
            maxLength={ADMIN_TRACKING_MAX_CHARACTERS + 1}
            value={trackingInput}
            onChange={(event) => setTrackingInput(event.target.value)}
            rows={6}
            placeholder="order-demo-001, 택배사, 1234567890"
            className="resize-y rounded-8 border border-line-control p-12"
          />
          {trackingValidation.errors.length ? (
            <ul role="alert" className="grid gap-4 text-danger">
              {trackingValidation.errors.map((error, index) => (
                <li key={`${error}-${index}`}>{error}</li>
              ))}
            </ul>
          ) : null}
          <p>유효한 미리보기 행 {trackingValidation.validRows.length}건</p>
        </div>
      </Modal>
    </section>
  );
}
