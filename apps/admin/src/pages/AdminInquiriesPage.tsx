import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@eum/ui/components/Button';
import { Badge } from '@eum/ui/components/Badge';
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  formatAdminDateTime,
} from '@/components/AdminUI';
import { getShopApi } from '@/lib/shop-api';
import type { InquiryStatus } from '@eum/api/types';

/** 공개 답변과 관리자 내부 메모를 분리해 1:1 문의를 처리합니다. */
export function AdminInquiriesPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [memo, setMemo] = useState<string | null>(null);
  const [status, setStatus] = useState<InquiryStatus | null>(null);
  const [message, setMessage] = useState('');
  const inquiriesQuery = useQuery({
    queryKey: ['admin', 'inquiries'],
    queryFn: async ({ signal }) => (await getShopApi()).inquiries.adminList({ signal }),
  });
  if (inquiriesQuery.isPending) return <AdminLoading label="1:1 문의를 불러오고 있습니다." />;
  if (inquiriesQuery.isError) return <AdminError onRetry={() => void inquiriesQuery.refetch()} />;
  const inquiries = inquiriesQuery.data;
  const active = inquiries.find((item) => item.id === selectedId) ?? inquiries[0];
  const activeStatus = status ?? active?.status ?? 'waiting';
  const activeAnswer = answer ?? active?.answer ?? '';
  const activeMemo = memo ?? active?.adminMemo ?? '';
  const save = async () => {
    if (!active) return;
    setMessage('');
    try {
      await (
        await getShopApi()
      ).inquiries.updateAdmin(active.id, {
        status: activeStatus,
        answer: activeAnswer.trim() || null,
        adminMemo: activeMemo,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'inquiries'] }),
        queryClient.invalidateQueries({ queryKey: ['inquiries'] }),
      ]);
      setAnswer(null);
      setMemo(null);
      setStatus(null);
      setMessage('공개 답변과 내부 메모를 목 API에 저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '문의를 저장하지 못했습니다.');
    }
  };
  return (
    <section aria-label="1:1 문의 관리">
      <AdminPageHeader
        title="1:1 문의"
        description={`전체 ${inquiries.length.toLocaleString('ko-KR')}건`}
      />
      <AdminNotice tone="warning" className="mb-16">
        고객에게 보낼 답변과 내부 처리 메모를 별도로 저장합니다. 회원 연락처는 이 목록에 표시하지
        않습니다.
      </AdminNotice>
      <div className="grid items-start gap-16 xl:grid-cols-[minmax(360px,1fr)_minmax(420px,1.2fr)]">
        <section aria-label="문의 목록" className="rounded-12 border border-line bg-bg">
          {inquiries.length ? (
            <ul className="divide-y divide-line">
              {inquiries.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={active?.id === item.id}
                    onClick={() => {
                      setSelectedId(item.id);
                      setAnswer(null);
                      setMemo(null);
                      setStatus(null);
                      setMessage('');
                    }}
                    className="w-full p-16 text-left focus-ring hover:bg-surface"
                  >
                    <span className="flex items-center justify-between gap-8">
                      <span className="font-medium">{item.title}</span>
                      <Badge tone={item.status === 'answered' ? 'success' : 'warning'}>
                        {item.status === 'answered' ? '답변 완료' : '답변 대기'}
                      </Badge>
                    </span>
                    <span className="mt-4 block text-caption text-text-3">
                      회원 {item.memberId} · {formatAdminDateTime(item.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <AdminEmpty title="접수된 문의가 없습니다" />
          )}
        </section>
        {active ? (
          <section aria-label="문의 상세" className="rounded-12 border border-line bg-bg p-24">
            <h2 className="text-h3">{active.title}</h2>
            <p className="mt-8 text-caption text-text-3">
              회원 ID {active.memberId} · {formatAdminDateTime(active.createdAt)}
            </p>
            <p className="mt-20 text-body-s whitespace-pre-wrap">{active.body}</p>
            {active.attachments?.length ? (
              <ul className="mt-12 grid gap-4 text-caption">
                {active.attachments.map((file) => (
                  <li key={file.id}>
                    {file.fileName} · {(file.sizeBytes / 1024 / 1024).toFixed(1)}MB
                  </li>
                ))}
              </ul>
            ) : null}
            <label className="mt-20 grid gap-8 text-label-m">
              고객 공개 답변
              <textarea
                value={activeAnswer}
                onChange={(event) => setAnswer(event.target.value)}
                maxLength={5000}
                className="min-h-120 rounded-8 border border-line-control p-12 text-body-s"
              />
            </label>
            <label className="mt-16 grid gap-8 text-label-m">
              내부 메모
              <textarea
                value={activeMemo}
                onChange={(event) => setMemo(event.target.value)}
                maxLength={2000}
                className="min-h-80 rounded-8 border border-line-control p-12 text-body-s"
              />
            </label>
            <label className="mt-16 grid gap-8 text-label-m">
              처리 상태
              <select
                value={activeStatus}
                onChange={(event) => setStatus(event.target.value as InquiryStatus)}
                className="h-40 rounded-8 border border-line-control bg-bg px-12"
              >
                <option value="waiting">답변 대기</option>
                <option value="answered">답변 완료</option>
              </select>
            </label>
            <div className="mt-16 flex items-center justify-between">
              <span className="text-caption text-text-3">
                처리 이력 {active.statusHistory.length}건
              </span>
              <Button onClick={() => void save()}>답변 저장</Button>
            </div>
            <ol
              aria-label="문의 처리 이력"
              className="mt-12 grid gap-8 border-t border-line pt-12 text-caption"
            >
              {active.statusHistory.map((entry, index) => (
                <li key={`${entry.occurredAt}-${index}`}>
                  {entry.status === 'answered' ? '답변 완료' : '답변 대기'} ·{' '}
                  {formatAdminDateTime(entry.occurredAt)} · {entry.note}
                </li>
              ))}
            </ol>
            {message ? (
              <p role="status" className="mt-12 text-caption text-info">
                {message}
              </p>
            ) : null}
          </section>
        ) : (
          <AdminEmpty title="문의를 선택해 주세요" />
        )}
      </div>
    </section>
  );
}
