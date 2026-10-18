import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@eum/ui/components/Button';
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  formatAdminCurrency,
  formatAdminDateTime,
} from '@/components/AdminUI';
import { getShopApi } from '@/lib/shop-api';

/** 적립금 조정은 사유와 원장을 남기며, 회원 식별 정보는 화면에 최소 표시합니다. */
export function AdminPointsPage() {
  const queryClient = useQueryClient();
  const [memberId, setMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const pointsQuery = useQuery({
    queryKey: ['admin', 'points'],
    queryFn: async ({ signal }) => (await getShopApi()).points.adminList({ signal }),
  });
  const membersQuery = useQuery({
    queryKey: ['admin', 'points', 'members'],
    queryFn: async ({ signal }) => (await getShopApi()).members.adminList({ signal }),
  });
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!memberId || !amount.trim() || !reason.trim()) {
      setMessage('회원, 조정 금액, 사유를 입력해 주세요.');
      return;
    }
    setIsSaving(true);
    setMessage('');
    try {
      await (
        await getShopApi()
      ).points.adjustAdmin({
        memberId,
        amount: Number(amount),
        reason: reason.trim(),
        expiresAt: expiresAt || null,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'points'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'members'] }),
        queryClient.invalidateQueries({ queryKey: ['points'] }),
      ]);
      setMessage('적립금 조정 내역과 회원 잔액을 목 API에 저장했습니다.');
      setAmount('');
      setReason('');
      setExpiresAt('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '적립금 조정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };
  if (pointsQuery.isPending || membersQuery.isPending)
    return <AdminLoading label="적립금 원장을 불러오고 있습니다." />;
  if (pointsQuery.isError || membersQuery.isError)
    return (
      <AdminError
        onRetry={() => {
          void pointsQuery.refetch();
          void membersQuery.refetch();
        }}
      />
    );
  return (
    <section aria-label="적립금 관리">
      <AdminPageHeader
        title="적립금 관리"
        description={`원장 ${pointsQuery.data.length.toLocaleString('ko-KR')}건`}
      />
      <AdminNotice tone="warning" className="mb-16">
        적립금은 선택한 회원의 목 잔액과 원장에 반영됩니다. 계정 인증·실제 결제와의 연결은 제공하지
        않습니다.
      </AdminNotice>
      <form
        onSubmit={(event) => void submit(event)}
        className="mb-20 grid gap-12 rounded-12 border border-line bg-bg p-20 md:grid-cols-2"
      >
        <label className="grid gap-6 text-label-m">
          회원
          <select
            value={memberId}
            onChange={(event) => setMemberId(event.target.value)}
            className="h-40 rounded-8 border border-line-control bg-bg px-12 text-body-s"
          >
            <option value="">회원 선택</option>
            {membersQuery.data.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name} · {member.id}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-6 text-label-m">
          조정 금액 (차감은 음수)
          <input
            type="number"
            step="1"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="h-40 rounded-8 border border-line-control px-12 text-body-s"
          />
        </label>
        <label className="grid gap-6 text-label-m">
          조정 사유
          <input
            maxLength={200}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="h-40 rounded-8 border border-line-control px-12 text-body-s"
          />
        </label>
        <label className="grid gap-6 text-label-m">
          만료일 (선택)
          <input
            type="date"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            className="h-40 rounded-8 border border-line-control px-12 text-body-s"
          />
        </label>
        <div className="flex items-center gap-12 md:col-span-2">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? '저장 중…' : '적립금 조정 저장'}
          </Button>
          {message ? (
            <p role="status" className="text-caption text-info">
              {message}
            </p>
          ) : null}
        </div>
      </form>
      {pointsQuery.data.length === 0 ? (
        <AdminEmpty title="적립금 원장이 비어 있습니다" />
      ) : (
        <div className="overflow-x-auto rounded-12 border border-line bg-bg">
          <table className="w-full min-w-640 border-collapse text-left text-body-s">
            <thead className="bg-surface text-label-s text-text-2">
              <tr>
                <th className="px-16 py-12">회원 ID</th>
                <th className="px-12 py-12">사유</th>
                <th className="px-12 py-12">금액</th>
                <th className="px-12 py-12">처리 시각</th>
                <th className="px-12 py-12">만료일</th>
              </tr>
            </thead>
            <tbody>
              {pointsQuery.data.map((point) => (
                <tr key={point.id} className="border-t border-line">
                  <td className="px-16 py-12">{point.memberId}</td>
                  <td className="px-12 py-12">{point.reason}</td>
                  <td className="px-12 py-12">{formatAdminCurrency(point.amount)}</td>
                  <td className="px-12 py-12">{formatAdminDateTime(point.occurredAt)}</td>
                  <td className="px-12 py-12">{point.expiresAt ?? '만료 없음'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
