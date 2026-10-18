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
import type { AdminClaim, ClaimStatus, ClaimType } from '@eum/api/types';

const CLAIM_TYPES: Record<ClaimType, string> = { cancel: '취소', return: '반품', exchange: '교환' };
const CLAIM_STATUSES: { value: ClaimStatus; label: string }[] = [
  { value: 'requested', label: '접수' },
  { value: 'processing', label: '처리중' },
  { value: 'completed', label: '완료' },
  { value: 'rejected', label: '반려' },
];
const CLAIM_STATUS_LABELS = Object.fromEntries(
  CLAIM_STATUSES.map((item) => [item.value, item.label]),
);
const CLAIM_STATUS_GUIDANCE: Record<ClaimStatus, string> = {
  requested: '접수 상태입니다. 신청 내용을 확인한 뒤 처리중 또는 반려로 저장하세요.',
  processing:
    '처리중 상태입니다. 실제 진행 결과를 기록한 뒤 완료 또는 반려로 변경하세요. 상태 변경은 목 기록만 갱신합니다.',
  completed: '완료는 관리자 처리 기록입니다. 실제 환불·회수·택배 작업은 실행되지 않았습니다.',
  rejected: '반려 상태로 저장하면 구매자 신청 내역에 반려로 표시됩니다.',
};

function formatClaimItems(items: AdminClaim['items']): string {
  return items?.length
    ? items
        .map((item) =>
          [
            item.productId,
            item.skuId ? `SKU ${item.skuId}` : '',
            item.optionLabel ? `옵션 ${item.optionLabel}` : '',
            `${item.quantity}개`,
          ]
            .filter(Boolean)
            .join(' · '),
        )
        .join(', ')
    : '상품 정보 없음';
}

function formatAttachmentSize(sizeBytes: number): string {
  return sizeBytes < 1024 ? `${sizeBytes} B` : `${Math.ceil(sizeBytes / 1024)} KB`;
}

/** 취소·반품·교환 접수와 내부 처리 메모를 목 API에 저장합니다. */
export function AdminClaimsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [draftStatus, setDraftStatus] = useState<ClaimStatus | null>(null);
  const [draftMemo, setDraftMemo] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCompletingCancellation, setIsCompletingCancellation] = useState(false);
  const [message, setMessage] = useState('');
  const claimsQuery = useQuery({
    queryKey: ['admin', 'claims'],
    queryFn: async ({ signal }) => (await getShopApi()).claims.adminList({ signal }),
  });
  if (claimsQuery.isPending)
    return <AdminLoading label="취소·반품·교환 목록을 불러오는 중입니다." />;
  if (claimsQuery.isError) return <AdminError onRetry={() => void claimsQuery.refetch()} />;

  const claims = claimsQuery.data;
  const activeClaim = claims.find((claim) => claim.id === selectedId) ?? claims[0];
  const status = draftStatus ?? activeClaim?.status ?? 'requested';
  const memo = draftMemo ?? activeClaim?.adminMemo ?? '';
  const save = async () => {
    if (!activeClaim) return;
    setMessage('');
    try {
      await (
        await getShopApi()
      ).claims.updateAdmin(activeClaim.id, {
        ...(activeClaim.type === 'cancel' && status === 'completed' ? {} : { status }),
        adminMemo: memo,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'claims'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
      ]);
      setDraftStatus(null);
      setDraftMemo(null);
      setMessage('처리 상태와 내부 메모를 프론트엔드 목 API에 저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '클레임을 저장하지 못했습니다.');
    }
  };
  const completeCancellation = async () => {
    if (
      !activeClaim ||
      activeClaim.type !== 'cancel' ||
      !cancelReason.trim() ||
      isCompletingCancellation
    )
      return;
    setIsCompletingCancellation(true);
    setMessage('');
    try {
      await (
        await getShopApi()
      ).claims.completeOrderCancellation(activeClaim.orderId, activeClaim.id, cancelReason.trim());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'claims'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'members'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'points'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['points'] }),
        queryClient.invalidateQueries({ queryKey: ['coupons'] }),
      ]);
      setCancelReason('');
      setMessage(
        '주문 취소와 재고·쿠폰·적립금 복원을 목 API에 저장했습니다. 실제 환불은 실행되지 않습니다.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '주문 취소를 처리하지 못했습니다.');
    } finally {
      setIsCompletingCancellation(false);
    }
  };

  return (
    <section aria-label="취소·반품·교환 관리">
      <AdminPageHeader
        title="취소·반품·교환"
        description={`접수 ${claims.length.toLocaleString('ko-KR')}건`}
      />
      <AdminNotice tone="warning" className="mb-16">
        이 화면은 상태와 내부 메모만 목 데이터로 기록합니다. 실제 환불·회수·택배사 전송은 실행되지
        않습니다.
      </AdminNotice>
      <div className="grid items-start gap-16 xl:grid-cols-[minmax(360px,1fr)_minmax(420px,1.2fr)]">
        <section
          aria-label="클레임 목록"
          className="overflow-hidden rounded-12 border border-line bg-bg"
        >
          {claims.length === 0 ? (
            <AdminEmpty
              title="접수된 클레임이 없습니다"
              description="구매자의 취소·반품·교환 신청이 이곳에 표시됩니다."
            />
          ) : (
            <ul className="divide-y divide-line">
              {claims.map((claim) => (
                <li key={claim.id}>
                  <button
                    type="button"
                    aria-pressed={activeClaim?.id === claim.id}
                    onClick={() => {
                      setSelectedId(claim.id);
                      setDraftStatus(null);
                      setDraftMemo(null);
                      setMessage('');
                    }}
                    className="w-full px-16 py-14 text-left focus-ring hover:bg-surface"
                  >
                    <span className="flex items-center justify-between gap-8">
                      <span className="font-medium">
                        {CLAIM_TYPES[claim.type]} · 주문 {claim.orderId}
                      </span>
                      <Badge
                        tone={
                          claim.status === 'completed'
                            ? 'success'
                            : claim.status === 'rejected'
                              ? 'danger'
                              : 'outline'
                        }
                      >
                        {CLAIM_STATUS_LABELS[claim.status]}
                      </Badge>
                    </span>
                    <span className="mt-4 block text-caption text-text-3">
                      {claim.id} · {formatAdminDateTime(claim.requestedAt)}
                    </span>
                    <span className="mt-4 block truncate text-body-s text-text-2">
                      {claim.reason}
                    </span>
                    <span className="mt-4 block truncate text-caption text-text-3">
                      {formatClaimItems(claim.items)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        {activeClaim ? (
          <ClaimDetails
            claim={activeClaim}
            status={status}
            memo={memo}
            message={message}
            cancelReason={cancelReason}
            isCompletingCancellation={isCompletingCancellation}
            onStatusChange={setDraftStatus}
            onMemoChange={setDraftMemo}
            onCancelReasonChange={setCancelReason}
            onCompleteCancellation={() => void completeCancellation()}
            onSave={() => void save()}
          />
        ) : (
          <div className="rounded-12 border border-line bg-bg p-24">
            <AdminEmpty
              title="클레임을 선택해 주세요"
              description="목록에서 신청 건을 선택하면 상세와 처리 이력을 확인할 수 있습니다."
            />
          </div>
        )}
      </div>
    </section>
  );
}

function ClaimDetails({
  claim,
  status,
  memo,
  message,
  cancelReason,
  isCompletingCancellation,
  onStatusChange,
  onMemoChange,
  onCancelReasonChange,
  onCompleteCancellation,
  onSave,
}: {
  claim: AdminClaim;
  status: ClaimStatus;
  memo: string;
  message: string;
  cancelReason: string;
  isCompletingCancellation: boolean;
  onStatusChange: (status: ClaimStatus) => void;
  onMemoChange: (memo: string) => void;
  onCancelReasonChange: (reason: string) => void;
  onCompleteCancellation: () => void;
  onSave: () => void;
}) {
  return (
    <section aria-label="클레임 상세" className="rounded-12 border border-line bg-bg p-24">
      <h2 className="text-h3">{CLAIM_TYPES[claim.type]} 신청 상세</h2>
      <dl className="mt-16 grid grid-cols-[96px_minmax(0,1fr)] gap-8 text-body-s">
        <dt className="text-text-3">주문 번호</dt>
        <dd>
          <a className="underline" href={`/orders/${encodeURIComponent(claim.orderId)}`}>
            {claim.orderId}
          </a>
        </dd>
        <dt className="text-text-3">접수 시각</dt>
        <dd>{formatAdminDateTime(claim.requestedAt)}</dd>
        <dt className="text-text-3">신청 사유</dt>
        <dd>{claim.reason}</dd>
        <dt className="text-text-3">상세 내용</dt>
        <dd className="whitespace-pre-wrap">{claim.description || '상세 내용 없음'}</dd>
        <dt className="text-text-3">신청 상품</dt>
        <dd>{formatClaimItems(claim.items)}</dd>
        {claim.type !== 'cancel' ? (
          <>
            <dt className="text-text-3">회수 방법</dt>
            <dd>
              {claim.returnMethod === 'pickup'
                ? '택배 회수 신청'
                : claim.returnMethod === 'direct'
                  ? '직접 발송'
                  : '미제공'}
            </dd>
            <dt className="text-text-3">회수 주소</dt>
            <dd>
              {claim.returnAddress
                ? `${claim.returnAddress.recipientName} · ${claim.returnAddress.phone} · (${claim.returnAddress.postalCode}) ${claim.returnAddress.address1} ${claim.returnAddress.address2}`
                : '미제공'}
            </dd>
          </>
        ) : null}
        {claim.attachments?.length ? (
          <>
            <dt className="text-text-3">첨부 파일</dt>
            <dd className="grid gap-4">
              {claim.attachments.map((attachment, index) => (
                <span key={`${attachment.fileName}-${index}`}>
                  {attachment.fileName} · {attachment.mimeType || 'MIME type 미제공'} ·{' '}
                  {formatAttachmentSize(attachment.sizeBytes)}
                </span>
              ))}
            </dd>
          </>
        ) : null}
      </dl>
      <fieldset className="mt-24 grid gap-8">
        <label htmlFor="claim-status" className="text-label-m">
          처리 상태
        </label>
        <select
          id="claim-status"
          value={status}
          disabled={claim.type === 'cancel' && status === 'completed'}
          onChange={(event) => onStatusChange(event.target.value as ClaimStatus)}
          className="h-44 rounded-8 border border-line-control bg-bg px-12 text-body-s"
        >
          {CLAIM_STATUSES.filter((option) => {
            if (claim.type !== 'cancel') return true;
            return claim.status === 'completed'
              ? option.value === 'completed'
              : option.value === 'requested' || option.value === 'rejected';
          }).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {claim.type === 'cancel' ? (
          <p className="text-caption text-text-3">
            취소 완료는 주문·재고·쿠폰·적립금을 함께 처리하는 전용 동작으로만 진행합니다.
          </p>
        ) : (
          <p className="text-caption text-text-3">{CLAIM_STATUS_GUIDANCE[status]}</p>
        )}
      </fieldset>
      <label htmlFor="claim-memo" className="mt-16 grid gap-8 text-label-m">
        내부 처리 메모
        <textarea
          id="claim-memo"
          value={memo}
          onChange={(event) => onMemoChange(event.target.value)}
          maxLength={2000}
          className="min-h-96 rounded-8 border border-line-control p-12 text-body-s"
        />
      </label>
      {claim.type === 'cancel' && claim.status === 'requested' ? (
        <fieldset className="mt-16 grid gap-8 rounded-8 border border-line p-12">
          <label htmlFor="cancel-completion-reason" className="text-label-m">
            취소 처리 사유
          </label>
          <textarea
            id="cancel-completion-reason"
            value={cancelReason}
            onChange={(event) => onCancelReasonChange(event.target.value)}
            maxLength={500}
            className="min-h-72 rounded-8 border border-line-control p-12 text-body-s"
          />
          <Button
            type="button"
            disabled={!cancelReason.trim() || isCompletingCancellation}
            onClick={onCompleteCancellation}
          >
            {isCompletingCancellation ? '취소 처리 중…' : '주문 취소 및 복원 처리'}
          </Button>
        </fieldset>
      ) : null}
      <div className="mt-16 flex items-center justify-between gap-8">
        <span className="text-caption text-text-3">이력 {claim.statusHistory.length}건</span>
        <Button type="button" onClick={onSave}>
          처리 내용 저장
        </Button>
      </div>
      <ol
        aria-label="클레임 처리 이력"
        className="mt-16 grid gap-8 border-t border-line pt-16 text-body-s"
      >
        {claim.statusHistory.map((entry, index) => (
          <li key={`${entry.occurredAt}-${index}`}>
            <span className="font-medium">
              {CLAIM_STATUSES.find((item) => item.value === entry.status)?.label ?? entry.status}
            </span>
            <span className="ml-8 text-caption text-text-3">
              {formatAdminDateTime(entry.occurredAt)}
            </span>
            {entry.note ? <p className="mt-2 text-text-2">{entry.note}</p> : null}
          </li>
        ))}
      </ol>
      {message ? (
        <p role="status" className="mt-12 text-caption text-info">
          {message}
        </p>
      ) : null}
    </section>
  );
}
