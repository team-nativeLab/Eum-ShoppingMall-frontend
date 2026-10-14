import { Link, useParams } from 'react-router';
import {
  AdminEmpty,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  formatAdminCurrency,
} from '@/components/AdminUI';
import { ADMIN_WITHDRAWN_MEMBER_FIXTURES } from '@/lib/admin-preview-fixtures';

/** synthetic fixture의 마스킹된 탈퇴 정보만 읽기 전용으로 보여 줍니다. */
export function AdminWithdrawnMemberDetailPage() {
  const { memberId } = useParams();
  const member = ADMIN_WITHDRAWN_MEMBER_FIXTURES.find((fixture) => fixture.id === memberId);
  if (!member)
    return (
      <AdminEmpty
        title="데모 탈퇴 회원을 찾을 수 없습니다"
        description="실제 회원 상태는 이 화면에서 조회하거나 변경하지 않습니다."
      />
    );
  return (
    <section aria-label="탈퇴 회원 상세">
      <AdminPageHeader
        title={member.name}
        description={`탈퇴 처리일 ${member.withdrawnAt}`}
        action={
          <Link
            to="/members"
            className="rounded-8 border border-line-strong px-12 py-8 text-body-s focus-ring"
          >
            회원 목록
          </Link>
        }
      />
      <AdminNotice className="mb-16" tone="warning">
        이 정보는 합성 데모 fixture입니다. 이메일과 전화번호는 마스킹되어 있으며 실제 회원 정보나
        상태를 변경하지 않습니다.
      </AdminNotice>
      <AdminPanel title="탈퇴 정보">
        <dl className="grid grid-cols-[160px_1fr] gap-12 p-20 text-body-s">
          <dt>회원 번호</dt>
          <dd>{member.memberNumber}</dd>
          <dt>회원 유형</dt>
          <dd>{member.memberType}</dd>
          <dt>이메일</dt>
          <dd>{member.email}</dd>
          <dt>연락처</dt>
          <dd>{member.phone}</dd>
          <dt>회사명</dt>
          <dd>{member.businessName}</dd>
          <dt>탈퇴 구분</dt>
          <dd>{member.withdrawalType}</dd>
          <dt>탈퇴 사유</dt>
          <dd>{member.reason}</dd>
          <dt>처리 담당</dt>
          <dd>{member.processedBy}</dd>
          <dt>보관 종료 예정</dt>
          <dd>{member.retentionUntil}</dd>
        </dl>
      </AdminPanel>
      <div className="mt-16 grid gap-16 lg:grid-cols-[1.5fr_1fr]">
        <div className="grid gap-16">
          <AdminPanel title={`주문 이력 (${member.orders.length})`} bodyClassName="overflow-hidden">
            {member.orders.length === 0 ? (
              <AdminEmpty title="주문 이력이 없습니다" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-560 border-collapse text-left text-body-s">
                  <thead className="bg-surface text-caption text-text-2">
                    <tr>
                      {['주문번호', '주문일', '상품', '결제금액', '상태'].map((label) => (
                        <th key={label} className="px-12 py-10 font-medium">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {member.orders.map((order) => (
                      <tr key={order.id} className="border-t border-line">
                        <td className="px-12 py-12">{order.id}</td>
                        <td className="px-12 py-12">{order.date}</td>
                        <td className="px-12 py-12">{order.productSummary}</td>
                        <td className="px-12 py-12 text-right">
                          {formatAdminCurrency(order.amount)}
                        </td>
                        <td className="px-12 py-12">{order.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminPanel>
          <AdminPanel
            title={`견적 문의 이력 (${member.quotes.length})`}
            bodyClassName="overflow-hidden"
          >
            {member.quotes.length === 0 ? (
              <AdminEmpty title="견적 문의 이력이 없습니다" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-520 border-collapse text-left text-body-s">
                  <thead className="bg-surface text-caption text-text-2">
                    <tr>
                      {['문의번호', '접수일', '유형', '품목', '상태'].map((label) => (
                        <th key={label} className="px-12 py-10 font-medium">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {member.quotes.map((quote) => (
                      <tr key={quote.id} className="border-t border-line">
                        <td className="px-12 py-12">{quote.id}</td>
                        <td className="px-12 py-12">{quote.date}</td>
                        <td className="px-12 py-12">{quote.type}</td>
                        <td className="px-12 py-12">{quote.itemCount}건</td>
                        <td className="px-12 py-12">{quote.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminPanel>
        </div>
        <AdminPanel title="상세 메모">
          <p className="p-20 text-body-s text-text-2">{member.detailedMemo}</p>
          <AdminNotice className="mx-20 mb-20" tone="warning">
            합성 데모 메모입니다. 실제 회원 기록을 표시하거나 수정하지 않습니다.
          </AdminNotice>
        </AdminPanel>
      </div>
    </section>
  );
}
