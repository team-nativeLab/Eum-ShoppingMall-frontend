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
  AdminTabs,
  formatAdminDate,
  getAdminLocalDateKey,
  isInvalidAdminDateInput,
  parseAdminDateInput,
} from '@/components/AdminUI';
import { getShopApi } from '@/lib/shop-api';
import { getAdminApiConfig } from '@/lib/api-config';
import { mapSettledWithConcurrency } from '@/lib/settled-concurrency';
import type { Member } from '@eum/api/types';
import { ADMIN_WITHDRAWN_MEMBER_FIXTURES } from '@/lib/admin-preview-fixtures';

interface MemberOrderCounts {
  countByMemberId: Map<string, number>;
  failedMemberIds: Set<string>;
  orderCountApiUnavailable: boolean;
}

/** 관리자 목록의 연락처 가운데 자리를 가려 노출 범위를 줄입니다. */
function maskPhone(phone: string): string {
  const match = phone.trim().match(/^(\d{2,3})[-\s]?(\d{3,4})[-\s]?(\d{4})$/);
  return match ? `${match[1]}-****-${match[3]}` : '연락처 형식 확인 필요';
}

/** 주문 API가 지원하는 회원별 조회를 이용해 목록의 주문 건수를 셉니다. */
async function loadMemberOrderCounts(
  members: Member[],
  signal: AbortSignal,
): Promise<MemberOrderCounts> {
  const api = await getShopApi();
  const orderCountApiUnavailable = getAdminApiConfig().mode === 'real';
  if (orderCountApiUnavailable) {
    return {
      countByMemberId: new Map<string, number>(),
      failedMemberIds: new Set(members.map((member) => member.id)),
      orderCountApiUnavailable: true,
    };
  }
  const memberOrders = await mapSettledWithConcurrency(
    members,
    5,
    async (member) => ({
      memberId: member.id,
      orders: await api.orders.listByMember(member.id, { signal }),
    }),
    signal,
  );
  const countByMemberId = new Map<string, number>();
  const failedMemberIds = new Set<string>();
  memberOrders.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      countByMemberId.set(result.value.memberId, result.value.orders.length);
    } else {
      const failedMember = members[index];
      if (failedMember) failedMemberIds.add(failedMember.id);
    }
  });
  return {
    countByMemberId,
    failedMemberIds,
    orderCountApiUnavailable,
  };
}

/** 회원 검색, 가입일 필터, 정렬 및 페이지 이동을 제공합니다. */
export function AdminMembersPage() {
  const [memberTab, setMemberTab] = useState<'all' | 'withdrawn'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest'>('recent');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const membersQuery = useQuery({
    queryKey: ['admin', 'members', 'list'],
    queryFn: async ({ signal }) => (await getShopApi()).members.adminList({ signal }),
  });
  const memberOrderCountsQuery = useQuery({
    queryKey: ['admin', 'members', 'order-counts', membersQuery.data?.map((member) => member.id)],
    enabled: membersQuery.data !== undefined,
    queryFn: ({ signal }) => loadMemberOrderCounts(membersQuery.data ?? [], signal),
  });
  const hasInvalidDateFilter =
    isInvalidAdminDateInput(startDate) || isInvalidAdminDateInput(endDate);

  const matchingMembers = useMemo(() => {
    if (!membersQuery.data || hasInvalidDateFilter) return [];
    const normalizedKeyword = searchKeyword.toLocaleLowerCase('ko-KR');
    const startDateKey = parseAdminDateInput(startDate);
    const endDateKey = parseAdminDateInput(endDate);
    return membersQuery.data
      .filter((member) =>
        [member.name, member.email, member.phone].some((field) =>
          field.toLocaleLowerCase('ko-KR').includes(normalizedKeyword),
        ),
      )
      .filter((member) => {
        const joinedDate = getAdminLocalDateKey(member.joinedAt);
        return (
          (!startDateKey || joinedDate >= startDateKey) && (!endDateKey || joinedDate <= endDateKey)
        );
      })
      .toSorted((left, right) =>
        sortOrder === 'recent'
          ? right.joinedAt.localeCompare(left.joinedAt)
          : left.joinedAt.localeCompare(right.joinedAt),
      );
  }, [endDate, hasInvalidDateFilter, membersQuery.data, searchKeyword, sortOrder, startDate]);

  if (membersQuery.isPending) return <AdminLoading label="회원 목록을 불러오고 있습니다." />;
  if (membersQuery.isError) {
    return (
      <AdminError
        title="회원 목록을 불러오지 못했습니다"
        description="회원 조회 API가 연결되어 있는지 확인한 뒤 다시 시도해 주세요."
        onRetry={() => void membersQuery.refetch()}
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(matchingMembers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleMembers = matchingMembers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
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
    setPage(1);
  };

  return (
    <section aria-label="회원 관리">
      <AdminPageHeader
        title="회원 관리"
        description={`총 ${matchingMembers.length.toLocaleString('ko-KR')}명`}
      />
      <AdminNotice className="mb-16">
        회원 유형·사업자 정보·계정 상태와 탈퇴 상태는 회원 API에서 제공하지 않습니다. 해당 항목은
        임의로 분류하지 않습니다.
      </AdminNotice>
      {memberOrderCountsQuery.data?.orderCountApiUnavailable ? (
        <AdminNotice tone="warning" className="mb-16">
          실제 운영 API에는 회원별 주문 조회가 아직 연결되지 않았습니다. 주문 수는 미제공으로
          표시합니다.
        </AdminNotice>
      ) : memberOrderCountsQuery.data?.failedMemberIds.size ? (
        <AdminNotice
          tone="warning"
          className="mb-16"
          action={
            <Button
              type="button"
              variant="secondary"
              size="s"
              onClick={() => void memberOrderCountsQuery.refetch()}
            >
              다시 조회
            </Button>
          }
        >
          {memberOrderCountsQuery.data.failedMemberIds.size.toLocaleString('ko-KR')}명의 주문 수를
          조회하지 못했습니다. 해당 회원은 0건으로 간주하지 않습니다.
        </AdminNotice>
      ) : null}
      <AdminTabs
        label="회원 유형 필터"
        options={[
          { value: 'all', label: '전체', count: matchingMembers.length },
          {
            value: 'withdrawn',
            label: '탈퇴 회원 (데모)',
            count: ADMIN_WITHDRAWN_MEMBER_FIXTURES.length,
          },
        ]}
        value={memberTab}
        onChange={(value) => {
          setMemberTab(value);
          setPage(1);
        }}
      />
      {memberTab === 'withdrawn' ? (
        <section
          aria-label="합성 탈퇴 회원 목록"
          className="mt-16 overflow-x-auto rounded-12 border border-line bg-bg"
        >
          <AdminNotice className="m-12" tone="warning">
            아래는 Admin 전용 합성 fixture이며 실제 회원을 탈퇴 상태로 분류하지 않습니다. 이메일과
            연락처는 마스킹했습니다.
          </AdminNotice>
          <table className="w-full min-w-760 border-collapse text-left text-body-s">
            <thead className="bg-surface text-caption text-text-2">
              <tr>
                {['회원 번호', '이름', '유형', '이메일', '연락처', '탈퇴 구분', '탈퇴일'].map(
                  (label) => (
                    <th key={label} className="px-16 py-12 font-medium">
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {ADMIN_WITHDRAWN_MEMBER_FIXTURES.map((member) => (
                <tr key={member.id} className="border-t border-line">
                  <td className="px-16 py-12">
                    <Link
                      to={`/members/withdrawn/${member.id}`}
                      className="focus-ring hover:underline"
                    >
                      {member.memberNumber}
                    </Link>
                  </td>
                  <td className="px-16 py-12">{member.name}</td>
                  <td className="px-16 py-12">{member.memberType}</td>
                  <td className="px-16 py-12">{member.email}</td>
                  <td className="px-16 py-12">{member.phone}</td>
                  <td className="px-16 py-12">{member.withdrawalType}</td>
                  <td className="px-16 py-12">{formatAdminDate(member.withdrawnAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {memberTab === 'all' ? (
        <form
          className="mt-16 flex flex-wrap items-center gap-8 rounded-12 border border-line bg-bg p-12"
          onSubmit={handleSearch}
        >
          <label className="flex h-40 min-w-240 flex-1 items-center rounded-8 border border-line-control px-12">
            <span className="sr-only">이름·이메일·연락처 검색</span>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="이름 · 이메일 · 연락처"
              className="w-full min-w-0 border-0 bg-transparent text-body-s outline-none placeholder:text-text-3"
            />
          </label>
          <div className="flex h-40 items-center gap-8 rounded-8 border border-line-control px-12 text-caption text-text-3">
            <span>가입일</span>
            <AdminDateInput
              label="가입 시작일"
              value={startDate}
              invalid={isInvalidAdminDateInput(startDate)}
              errorMessageId="member-date-filter-error"
              onChange={(nextValue) => {
                setStartDate(nextValue);
                setPage(1);
              }}
              className="w-132"
            />
            <span aria-hidden="true">~</span>
            <AdminDateInput
              label="가입 종료일"
              value={endDate}
              invalid={isInvalidAdminDateInput(endDate)}
              errorMessageId="member-date-filter-error"
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
      ) : null}
      {memberTab === 'all' && hasInvalidDateFilter ? (
        <p id="member-date-filter-error" role="alert" className="mt-8 text-caption text-danger">
          시작일과 종료일은 YYYY.MM.DD 형식의 유효한 날짜여야 합니다. 날짜를 수정하면 해당 조건으로
          결과를 다시 표시합니다.
        </p>
      ) : null}
      {memberTab === 'all' ? (
        <section
          className="mt-16 overflow-hidden rounded-12 border border-line bg-bg"
          aria-label="회원 검색 결과"
        >
          <div className="flex min-h-48 flex-wrap items-center justify-between gap-12 border-b border-line px-20 py-8">
            <p className="text-body-s text-text-2">
              검색 결과 {matchingMembers.length.toLocaleString('ko-KR')}명
            </p>
            <div className="flex items-center gap-8">
              <label className="sr-only" htmlFor="admin-member-sort">
                정렬 기준
              </label>
              <select
                id="admin-member-sort"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as 'recent' | 'oldest')}
                className="h-36 rounded-8 border border-line-control bg-bg px-12 text-body-s"
              >
                <option value="recent">최근 가입순</option>
                <option value="oldest">오래된 순</option>
              </select>
              <label className="sr-only" htmlFor="admin-member-page-size">
                페이지당 표시 수
              </label>
              <select
                id="admin-member-page-size"
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
          {visibleMembers.length === 0 ? (
            <AdminEmpty
              title={hasInvalidDateFilter ? '가입일 입력을 확인해 주세요' : '회원이 없습니다'}
              description={
                hasInvalidDateFilter
                  ? '올바른 날짜를 입력하면 검색 결과가 표시됩니다.'
                  : '검색어나 가입일 범위를 확인해 주세요.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-800 border-collapse text-left text-body-s">
                <thead className="bg-surface text-label-s text-text-2">
                  <tr>
                    <th scope="col" className="px-20 py-12 font-medium">
                      이름 / 이메일
                    </th>
                    <th scope="col" className="px-12 py-12 font-medium">
                      유형
                    </th>
                    <th scope="col" className="px-12 py-12 font-medium">
                      회사명
                    </th>
                    <th scope="col" className="px-12 py-12 font-medium">
                      연락처
                    </th>
                    <th scope="col" className="px-12 py-12 text-right font-medium">
                      주문 수
                    </th>
                    <th scope="col" className="px-12 py-12 font-medium whitespace-nowrap">
                      가입일
                    </th>
                    <th scope="col" className="px-20 py-12 font-medium">
                      상태
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMembers.map((member) => (
                    <tr key={member.id} className="border-t border-line hover:bg-bg-subtle">
                      <td className="px-20 py-12">
                        <Link
                          to={`/members/${member.id}`}
                          className="block font-medium focus-ring hover:underline"
                        >
                          {member.name}
                        </Link>
                        <span className="mt-2 block text-caption text-text-3">{member.email}</span>
                      </td>
                      <td className="px-12 py-12 text-text-3">미제공</td>
                      <td className="px-12 py-12 text-text-3">미제공</td>
                      <td className="px-12 py-12 whitespace-nowrap">{maskPhone(member.phone)}</td>
                      <td className="px-12 py-12 text-right">
                        {memberOrderCountsQuery.data
                          ? memberOrderCountsQuery.data.orderCountApiUnavailable
                            ? '미제공'
                            : memberOrderCountsQuery.data.failedMemberIds.has(member.id)
                              ? '조회 실패'
                              : (memberOrderCountsQuery.data.countByMemberId.get(member.id) ?? 0)
                          : memberOrderCountsQuery.isError
                            ? '미제공'
                            : '불러오는 중'}
                      </td>
                      <td className="px-12 py-12 whitespace-nowrap text-text-2">
                        {formatAdminDate(member.joinedAt)}
                      </td>
                      <td className="px-20 py-12 text-text-3">미제공</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
      {memberTab === 'all' ? (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
          className="mt-20 flex justify-center"
        />
      ) : null}
    </section>
  );
}
