import { useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Button } from '@eum/ui/components/Button';
import { Pagination } from '@eum/ui/components/Pagination';
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
import { mapSettledWithConcurrency } from '@/lib/settled-concurrency';
import type { Member, Order, OrderStatus } from '@eum/api/types';

type OrderTab = 'all' | OrderStatus;
interface AdminOrdersData {
  orders: Order[];
  membersById: Map<string, Member>;
  failedMemberCount: number;
  orderListUnavailable: boolean;
}

const ORDER_TABS: { value: OrderTab; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'paymentPending', label: '결제대기' },
  { value: 'paid', label: '결제완료' },
  { value: 'preparing', label: '배송준비' },
  { value: 'shipping', label: '배송중' },
  { value: 'delivered', label: '배송완료' },
  { value: 'canceled', label: '취소·반품' },
];

/** 현재 API의 회원별 주문 조회를 모아 관리자 주문 목록을 만듭니다. */
async function loadAdminOrders(signal: AbortSignal): Promise<AdminOrdersData> {
  if (getAdminApiConfig().mode === 'real') {
    return { orders: [], membersById: new Map(), failedMemberCount: 0, orderListUnavailable: true };
  }
  const api = await getShopApi();
  const members = await api.members.list({ signal });
  const memberOrders = await mapSettledWithConcurrency(
    members,
    5,
    async (member) => ({
      member,
      orders: await api.orders.listByMember(member.id, { signal }),
    }),
    signal,
  );
  return {
    orders: memberOrders.flatMap((result) =>
      result.status === 'fulfilled' ? result.value.orders : [],
    ),
    membersById: new Map(members.map((member) => [member.id, member])),
    failedMemberCount: memberOrders.filter((result) => result.status === 'rejected').length,
    orderListUnavailable: false,
  };
}

/** 주문을 검색하고 상태·기간별로 좁혀서 표시합니다. */
export function AdminOrdersPage() {
  const [searchInput, setSearchInput] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tab, setTab] = useState<OrderTab>('all');
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest'>('recent');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const ordersQuery = useQuery({
    queryKey: ['admin', 'orders', 'list'],
    queryFn: ({ signal }) => loadAdminOrders(signal),
  });
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
  if (ordersQuery.isError) {
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
  };
  const handleReset = () => {
    setSearchInput('');
    setSearchKeyword('');
    setStartDate('');
    setEndDate('');
    setTab('all');
    setPage(1);
  };

  return (
    <section aria-label="주문 관리">
      <AdminPageHeader
        title="주문 관리"
        description={`총 ${matchingOrders.length.toLocaleString('ko-KR')}건`}
      />
      <AdminNotice
        className="mb-16"
        tone={ordersQuery.data.orderListUnavailable ? 'warning' : 'info'}
      >
        {ordersQuery.data.orderListUnavailable
          ? '실제 운영 API에는 주문 목록 조회가 연결되지 않았습니다. 주문 목록을 표시할 수 없습니다.'
          : '전체 주문 조회 API가 없어 등록 회원별 조회 결과를 모아 표시합니다. 결제수단 정보와 변경 기능은 제공되지 않습니다.'}
      </AdminNotice>
      {ordersQuery.data.failedMemberCount > 0 ? (
        <AdminNotice tone="warning" className="mb-16">
          회원 {ordersQuery.data.failedMemberCount.toLocaleString('ko-KR')}명의 주문 조회에
          실패했습니다. 현재 목록은 조회가 완료된 회원의 부분 결과입니다.
        </AdminNotice>
      ) : null}
      <AdminTabs
        label="주문 상태 필터"
        options={tabOptions}
        value={tab}
        onChange={(nextTab) => {
          setTab(nextTab);
          setPage(1);
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
              onChange={(event) => setSortOrder(event.target.value as 'recent' | 'oldest')}
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
              }}
              className="h-36 rounded-8 border border-line-control bg-bg px-12 text-body-s"
            >
              <option value={20}>20개씩</option>
              <option value={50}>50개씩</option>
              <option value={100}>100개씩</option>
            </select>
          </div>
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
        onPageChange={setPage}
        className="mt-20 flex justify-center"
      />
    </section>
  );
}
