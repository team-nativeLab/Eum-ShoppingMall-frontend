import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { Button } from '@eum/ui/components/Button';
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  AdminStatusBadge,
  formatAdminCurrency,
  formatAdminDate,
} from '@/components/AdminUI';
import { getShopApi } from '@/lib/shop-api';
import type { Member } from '@eum/api/types';

/** 반환된 회원 정보와 회원별 주문·견적 조회 결과를 표시합니다. */
export function AdminMemberDetailPage() {
  const { memberId } = useParams();
  const memberQuery = useQuery({
    queryKey: ['admin', 'members', 'detail', memberId],
    enabled: Boolean(memberId),
    queryFn: async ({ signal }) => {
      if (!memberId) throw new Error('회원 번호가 없습니다.');
      const members = await (await getShopApi()).members.list({ signal });
      return members.find((member) => member.id === memberId);
    },
  });
  const ordersQuery = useQuery({
    queryKey: ['admin', 'members', 'detail-orders', memberQuery.data?.id],
    enabled: Boolean(memberQuery.data?.id),
    queryFn: async ({ signal }) => {
      const currentMemberId = memberQuery.data?.id;
      if (!currentMemberId) return [];
      return (await getShopApi()).orders.listByMember(currentMemberId, { signal });
    },
  });
  const quotesQuery = useQuery({
    queryKey: ['admin', 'members', 'detail-quotes', memberQuery.data?.id],
    enabled: Boolean(memberQuery.data?.id),
    queryFn: async ({ signal }) => {
      const currentMemberId = memberQuery.data?.id;
      if (!currentMemberId) return [];
      const quotes = await (await getShopApi()).quotes.list({ signal });
      return quotes.filter((quote) => quote.memberId === currentMemberId);
    },
  });

  if (memberQuery.isPending) return <AdminLoading label="회원 상세 정보를 불러오고 있습니다." />;
  if (memberQuery.isError) {
    return (
      <AdminError
        title="회원 정보를 불러오지 못했습니다"
        description="회원 조회 API가 연결되어 있는지 확인한 뒤 다시 시도해 주세요."
        onRetry={() => void memberQuery.refetch()}
      />
    );
  }
  if (!memberQuery.data) {
    return (
      <AdminEmpty
        title="회원을 찾을 수 없습니다"
        description="회원 목록으로 돌아가 다른 회원을 선택해 주세요."
      />
    );
  }

  const member: Member = memberQuery.data;
  const orders = ordersQuery.data ?? [];
  const quotes = quotesQuery.data ?? [];

  return (
    <section aria-label="회원 상세">
      <AdminPageHeader
        title={member.name}
        description={`가입일 ${formatAdminDate(member.joinedAt)}`}
        action={
          <Link
            to="/members"
            className="inline-flex h-36 items-center rounded-8 border border-line-strong px-12 text-body-s focus-ring hover:bg-surface"
          >
            회원 목록
          </Link>
        }
      />
      <AdminNotice className="mb-16">
        회원 유형, 사업자 정보, 계정 상태, 관리자 메모 및 계정 변경 API가 제공되지 않습니다. 아래
        관리 기능은 조회 전용입니다.
      </AdminNotice>

      <div className="grid grid-cols-[minmax(0,1.9fr)_minmax(300px,1fr)] items-start gap-16">
        <div className="grid min-w-0 gap-16">
          <div className="grid grid-cols-2 gap-16">
            <AdminPanel title="기본 정보">
              <dl className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-12 gap-y-10 px-20 py-16 text-body-s">
                <dt className="text-text-3">이메일</dt>
                <dd className="break-all">{member.email}</dd>
                <dt className="text-text-3">연락처</dt>
                <dd>{member.phone}</dd>
                <dt className="text-text-3">가입일</dt>
                <dd>{formatAdminDate(member.joinedAt)}</dd>
                <dt className="text-text-3">보유 포인트</dt>
                <dd>{formatAdminCurrency(member.pointBalance)}</dd>
                <dt className="text-text-3">최근 로그인</dt>
                <dd className="text-text-3">미제공</dd>
                <dt className="text-text-3">마케팅 수신</dt>
                <dd className="text-text-3">미제공</dd>
              </dl>
            </AdminPanel>
            <AdminPanel title="사업자 정보">
              <AdminEmpty
                title="사업자 정보가 없습니다"
                description="회원 API 응답에 회사명·사업자번호·담당 부서가 포함되어 있지 않습니다."
                className="min-h-184 px-16"
              />
            </AdminPanel>
          </div>

          <AdminPanel
            title={ordersQuery.data ? `주문 이력 (${orders.length})` : '주문 이력'}
            description={ordersQuery.isError ? '주문 조회 API를 사용할 수 없습니다.' : undefined}
            action={
              <Link to="/orders" className="text-label-s hover:underline">
                전체 보기
              </Link>
            }
            bodyClassName="overflow-hidden"
          >
            {ordersQuery.isPending ? (
              <div className="px-20 py-16 text-body-s text-text-3" role="status">
                주문 이력을 불러오고 있습니다.
              </div>
            ) : ordersQuery.isError ? (
              <AdminError
                title="주문 이력을 불러오지 못했습니다"
                description="주문 조회 API 연결을 확인해 주세요."
                onRetry={() => void ordersQuery.refetch()}
              />
            ) : orders.length === 0 ? (
              <AdminEmpty title="주문 이력이 없습니다" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-600 border-collapse text-left text-body-s">
                  <thead className="bg-surface text-caption text-text-2">
                    <tr>
                      <th scope="col" className="px-20 py-10 font-normal">
                        주문번호
                      </th>
                      <th scope="col" className="px-12 py-10 font-normal">
                        주문일
                      </th>
                      <th scope="col" className="px-12 py-10 font-normal">
                        상품
                      </th>
                      <th scope="col" className="px-12 py-10 text-right font-normal">
                        결제금액
                      </th>
                      <th scope="col" className="px-20 py-10 font-normal">
                        상태
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders
                      .toSorted((left, right) => right.orderedAt.localeCompare(left.orderedAt))
                      .map((order) => {
                        const firstLine = order.lines[0];
                        const summary = firstLine
                          ? `${firstLine.productName}${order.lines.length > 1 ? ` 외 ${order.lines.length - 1}건` : ''}`
                          : '상품 정보 없음';
                        return (
                          <tr key={order.id} className="border-t border-line">
                            <td className="px-20 py-12 whitespace-nowrap">
                              <Link
                                to={`/orders/${order.id}`}
                                className="focus-ring hover:underline"
                              >
                                {order.orderNumber}
                              </Link>
                            </td>
                            <td className="px-12 py-12 whitespace-nowrap text-text-3">
                              {formatAdminDate(order.orderedAt)}
                            </td>
                            <td className="max-w-180 truncate px-12 py-12" title={summary}>
                              {summary}
                            </td>
                            <td className="px-12 py-12 text-right whitespace-nowrap">
                              {formatAdminCurrency(order.paymentTotal)}
                            </td>
                            <td className="px-20 py-12 whitespace-nowrap">
                              <AdminStatusBadge status={order.status} kind="order" />
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </AdminPanel>

          <AdminPanel
            title={quotesQuery.data ? `견적 문의 이력 (${quotes.length})` : '견적 문의 이력'}
            description={
              quotesQuery.isError ? '견적 문의 조회 API를 사용할 수 없습니다.' : undefined
            }
            action={
              <Link to="/quotes" className="text-label-s hover:underline">
                전체 보기
              </Link>
            }
            bodyClassName="overflow-hidden"
          >
            {quotesQuery.isPending ? (
              <div className="px-20 py-16 text-body-s text-text-3" role="status">
                견적 문의 이력을 불러오고 있습니다.
              </div>
            ) : quotesQuery.isError ? (
              <AdminError
                title="견적 문의 이력을 불러오지 못했습니다"
                description="견적 문의 조회 API 연결을 확인해 주세요."
                onRetry={() => void quotesQuery.refetch()}
              />
            ) : quotes.length === 0 ? (
              <AdminEmpty title="견적 문의 이력이 없습니다" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-520 border-collapse text-left text-body-s">
                  <thead className="bg-surface text-caption text-text-2">
                    <tr>
                      <th scope="col" className="px-20 py-10 font-normal">
                        문의번호 / 제목
                      </th>
                      <th scope="col" className="px-12 py-10 font-normal">
                        회사명
                      </th>
                      <th scope="col" className="px-12 py-10 font-normal">
                        접수일
                      </th>
                      <th scope="col" className="px-20 py-10 font-normal">
                        상태
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes
                      .toSorted((left, right) => right.requestedAt.localeCompare(left.requestedAt))
                      .map((quote) => (
                        <tr key={quote.id} className="border-t border-line">
                          <td className="px-20 py-12">
                            <span className="block font-medium">{quote.id}</span>
                            <span className="mt-2 block text-caption text-text-3">
                              {quote.title}
                            </span>
                          </td>
                          <td className="px-12 py-12">{quote.companyName}</td>
                          <td className="px-12 py-12 whitespace-nowrap text-text-3">
                            {formatAdminDate(quote.requestedAt)}
                          </td>
                          <td className="px-20 py-12">
                            <AdminStatusBadge status={quote.status} kind="quote" />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminPanel>
        </div>

        <aside className="grid gap-16">
          <MemberAccountPanel key={member.id} />
          <AdminPanel title="회원 요약">
            <dl className="grid grid-cols-[1fr_auto] gap-12 px-20 py-16 text-body-s">
              <dt className="text-text-3">이름</dt>
              <dd>{member.name}</dd>
              <dt className="text-text-3">회원 구분</dt>
              <dd className="text-text-3">미제공</dd>
              <dt className="text-text-3">보유 포인트</dt>
              <dd>{formatAdminCurrency(member.pointBalance)}</dd>
            </dl>
          </AdminPanel>
        </aside>
      </div>
    </section>
  );
}

function MemberAccountPanel() {
  const [accountState, setAccountState] = useState('unchanged');
  const [memo, setMemo] = useState('');
  const [message, setMessage] = useState('');

  return (
    <AdminPanel title="계정 관리">
      <div className="grid gap-16 px-20 py-16">
        <AdminNotice tone="warning">
          계정 관리 값은 현재 화면에서만 미리보기로 유지됩니다. 회원 계정 변경이나 메일 발송은
          실행되지 않습니다.
        </AdminNotice>
        <label className="grid gap-6 text-label-s">
          계정 상태 미리보기
          <select
            value={accountState}
            onChange={(event) => setAccountState(event.target.value)}
            className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
          >
            <option value="unchanged">상태 미선택</option>
            <option value="active">활성 · 미리보기</option>
            <option value="restricted">이용 제한 · 미리보기</option>
          </select>
        </label>
        <label className="grid gap-6 text-label-s">
          관리자 메모 미리보기
          <textarea
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            placeholder="메모를 입력해 주세요"
            rows={3}
            className="resize-y rounded-8 border border-line-control bg-bg px-12 py-10 text-body-s"
          />
        </label>
        <Button
          onClick={() =>
            setMessage('입력값은 이 화면에만 유지됩니다. 회원 데이터는 변경되지 않았습니다.')
          }
        >
          화면에 임시 반영
        </Button>
        <div className="border-t border-line pt-16">
          <p className="text-label-s">계정 동작 미리보기</p>
          <Button
            variant="secondary"
            isFullWidth
            className="mt-10"
            onClick={() => setMessage('비밀번호 재설정 API가 없어 메일은 발송되지 않았습니다.')}
          >
            비밀번호 재설정 안내 미리보기
          </Button>
        </div>
        <div className="border-t border-line pt-16">
          <p className="text-label-s">회원 탈퇴 처리</p>
          <p className="mt-6 text-caption text-text-3">실제 탈퇴 처리 API는 연결되지 않았습니다.</p>
          <Button
            variant="danger"
            isFullWidth
            className="mt-10"
            onClick={() =>
              setMessage('탈퇴 처리는 실행되지 않았습니다. 실제 회원 데이터는 변경되지 않았습니다.')
            }
          >
            탈퇴 처리 안내
          </Button>
        </div>
        {message ? (
          <p role="status" className="text-caption text-warning">
            {message}
          </p>
        ) : null}
      </div>
    </AdminPanel>
  );
}
