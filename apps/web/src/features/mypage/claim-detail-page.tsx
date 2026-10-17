'use client';

import { getApiFailureKind, type ApiFailureKind } from '@eum/api/errors';
import { queryKeys } from '@eum/api/query-keys';
import type { Claim, Order } from '@eum/api/types';
import { Badge } from '@eum/ui/components/Badge';
import { Button } from '@eum/ui/components/Button';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemberSession } from '@/features/auth/member-session';
import { getShopApi } from '@/lib/shop-api';
import { formatMyPageDate, formatMyPagePrice } from './mypage-data';
import { MyPageShell } from './mypage-shell';

const CLAIM_TYPE_LABEL = { cancel: '취소', return: '반품', exchange: '교환' } as const;
const CLAIM_STATUS = {
  requested: { label: '신청 접수', tone: 'warning' as const },
  processing: { label: '처리 중', tone: 'neutral' as const },
  completed: { label: '처리 완료', tone: 'success' as const },
  rejected: { label: '반려', tone: 'danger' as const },
};

const CLAIM_STEPS = {
  cancel: ['신청 접수', '취소 확인', '결제 취소', '환불 완료'],
  return: ['신청 접수', '상품 회수', '상품 검수', '환불 완료'],
  exchange: ['신청 접수', '상품 회수', '상품 검수', '교환 상품 발송'],
} as const;

const CLAIM_PROCESSING_STATE = {
  cancel: {
    activeStep: 2,
    description: '결제 취소를 진행하고 있습니다.',
  },
  return: {
    activeStep: 1,
    description: '반품 상품 회수를 진행하고 있습니다.',
  },
  exchange: {
    activeStep: 2,
    description: '회수된 상품을 검수하고 있습니다.',
  },
} as const;

function getClaimActiveStep(type: Claim['type'], status: Claim['status']) {
  if (status === 'requested') return 0;
  if (status === 'processing') return CLAIM_PROCESSING_STATE[type].activeStep;
  if (status === 'completed') return 3;
  return -1;
}

type ClaimOrderResult =
  { status: 'loaded'; order?: Order } | { status: 'error'; kind: ApiFailureKind };

interface ClaimDetailData {
  claim: Claim;
  orderResult: ClaimOrderResult;
}

function ClaimDetailContent({
  data,
  onRetryOrder,
  isRetrying,
}: {
  data: ClaimDetailData;
  onRetryOrder: () => void;
  isRetrying: boolean;
}) {
  const { claim } = data;
  const orderFailureKind = data.orderResult.status === 'error' ? data.orderResult.kind : undefined;
  const orderLookupFailed = orderFailureKind !== undefined;
  const canRetryOrder = orderFailureKind === 'temporary';
  const isOrderApiUnimplemented = orderFailureKind === 'notImplemented';
  const availableOrder = data.orderResult.status === 'loaded' ? data.orderResult.order : undefined;
  const activeStep = getClaimActiveStep(claim.type, claim.status);
  const requestedAt = formatMyPageDate(claim.requestedAt);
  const shippingAddress = availableOrder?.shippingAddress;
  const recoveryAddress = [shippingAddress?.address1, shippingAddress?.address2]
    .filter(Boolean)
    .join(' ');
  return (
    <article className="space-y-20 lg:space-y-24">
      <div className="grid gap-20 lg:grid-cols-[minmax(0,1fr)_410px] lg:gap-24">
        <div className="space-y-20">
          <section
            aria-labelledby="claim-application-heading"
            className="rounded-12 border border-line p-16 sm:p-20"
          >
            <h2 id="claim-application-heading" className="text-label-l">
              신청 내용
            </h2>
            <dl className="mt-16 grid gap-x-16 gap-y-12 sm:grid-cols-3">
              <div>
                <dt className="text-caption text-text-3">신청번호</dt>
                <dd className="mt-4 text-body-s-medium">{claim.id}</dd>
              </div>
              <div>
                <dt className="text-caption text-text-3">신청일</dt>
                <dd className="mt-4 text-body-s-medium">{requestedAt}</dd>
              </div>
              <div>
                <dt className="text-caption text-text-3">신청 유형</dt>
                <dd className="mt-4 text-body-s-medium">{CLAIM_TYPE_LABEL[claim.type]}</dd>
              </div>
            </dl>
            <div className="mt-16 border-t border-line pt-16">
              <div className="flex flex-wrap items-baseline justify-between gap-8">
                <h3 className="text-label-m">신청 상품</h3>
                <p className="text-caption text-text-3">
                  주문번호{' '}
                  {orderLookupFailed
                    ? isOrderApiUnimplemented
                      ? '준비 중'
                      : '조회 실패'
                    : (availableOrder?.orderNumber ?? '정보 미제공')}
                </p>
              </div>
              {orderLookupFailed ? (
                <NoticeInline
                  tone={canRetryOrder ? 'danger' : 'warning'}
                  role={canRetryOrder ? 'alert' : 'status'}
                  className="mt-12"
                >
                  <div className="flex flex-wrap items-center justify-between gap-12">
                    <span>
                      {isOrderApiUnimplemented
                        ? '주문 정보를 준비하고 있습니다.'
                        : '주문 정보를 불러오지 못했습니다.'}
                    </span>
                    {canRetryOrder ? (
                      <Button
                        variant="secondary"
                        size="s"
                        disabled={isRetrying}
                        onClick={onRetryOrder}
                      >
                        다시 시도
                      </Button>
                    ) : null}
                  </div>
                </NoticeInline>
              ) : null}
              <ul className="mt-12 space-y-8">
                {availableOrder?.lines.map((line) => (
                  <li
                    key={`${line.productId}-${line.productName}`}
                    className="flex flex-wrap justify-between gap-8 text-body-s"
                  >
                    <span>{line.productName}</span>
                    <span className="text-text-2">
                      {line.quantity.toLocaleString('ko-KR')}개 ·{' '}
                      {formatMyPagePrice(line.unitPrice)}
                    </span>
                  </li>
                ))}
                {!availableOrder ? (
                  <li className="text-body-s text-text-3">
                    {orderLookupFailed
                      ? isOrderApiUnimplemented
                        ? '주문 상품 정보를 준비하고 있습니다.'
                        : '주문 상품 정보를 불러오지 못했습니다.'
                      : '주문 상품 정보를 제공하지 않습니다.'}
                  </li>
                ) : null}
              </ul>
            </div>
          </section>

          <section
            aria-labelledby="claim-reason-heading"
            className="rounded-12 border border-line p-16 sm:p-20"
          >
            <h2 id="claim-reason-heading" className="text-label-l">
              신청 사유
            </h2>
            <p className="mt-16 text-body-s text-text-2">{claim.reason}</p>
            {claim.description ? (
              <p className="mt-8 text-body-s text-text-2">{claim.description}</p>
            ) : null}
          </section>
        </div>

        <section
          aria-labelledby="claim-progress-heading"
          className="rounded-12 border border-line p-16 sm:p-20"
        >
          <h2 id="claim-progress-heading" className="text-label-l">
            처리 현황
          </h2>
          {claim.status === 'rejected' ? (
            <div className="mt-20 rounded-8 bg-danger-tint p-16">
              <p className="text-label-m text-danger">신청이 반려되었습니다.</p>
              <p className="mt-8 text-body-s text-text-2">
                자세한 내용은 1:1 문의를 이용해 주세요.
              </p>
            </div>
          ) : (
            <ol aria-label="신청 진행 상태" className="mt-20 space-y-0">
              {CLAIM_STEPS[claim.type].map((step, index) => {
                const isComplete = index < activeStep;
                const isCurrent = index === activeStep;
                const currentDescription =
                  claim.status === 'processing' && isCurrent
                    ? CLAIM_PROCESSING_STATE[claim.type].description
                    : claim.status === 'processing' && claim.type === 'exchange' && index === 3
                      ? '검수 완료 후 안내'
                      : undefined;
                return (
                  <li
                    key={step}
                    aria-current={isCurrent ? 'step' : undefined}
                    className="relative flex gap-12 pb-20 last:pb-0"
                  >
                    <span
                      aria-hidden="true"
                      className={`relative z-10 mt-2 size-12 shrink-0 rounded-capsule border ${isComplete ? 'border-success bg-success' : isCurrent ? 'border-success bg-bg' : 'border-line-strong bg-bg'}`}
                    />
                    {index < CLAIM_STEPS[claim.type].length - 1 ? (
                      <span
                        aria-hidden="true"
                        className={`absolute top-12 bottom-0 left-5 border-l ${isComplete ? 'border-success' : 'border-line'}`}
                      />
                    ) : null}
                    <div className="min-w-0">
                      <p
                        className={`text-body-s-medium ${isComplete || isCurrent ? 'text-text-1' : 'text-text-3'}`}
                      >
                        {step}
                      </p>
                      {index === 0 ? (
                        <time
                          dateTime={claim.requestedAt}
                          className="mt-4 block text-caption text-text-3"
                        >
                          {requestedAt}
                        </time>
                      ) : currentDescription ? (
                        <p className="mt-4 text-caption text-text-3">{currentDescription}</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {claim.type !== 'cancel' ? (
        <section
          aria-labelledby="claim-recovery-heading"
          className="rounded-12 border border-line p-16 sm:p-20"
        >
          <h2 id="claim-recovery-heading" className="text-label-l">
            회수 및 교환 정보
          </h2>
          <dl className="mt-16 grid gap-16 sm:grid-cols-2">
            <div>
              <dt className="text-caption text-text-3">회수 주소</dt>
              <dd className="mt-4 text-body-s">
                {orderLookupFailed
                  ? isOrderApiUnimplemented
                    ? '주문 배송 정보를 준비하고 있습니다.'
                    : '주문 조회 실패로 회수 주소를 확인할 수 없습니다.'
                  : recoveryAddress || '주문 배송지 정보 미제공'}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-text-3">회수 방법</dt>
              <dd className="mt-4 text-body-s">정보 미제공</dd>
            </div>
          </dl>
          {claim.type === 'exchange' ? (
            <p className="mt-16 border-t border-line pt-12 text-caption text-text-3">
              교환 배송은 상품별 정책에 따라 안내됩니다.
            </p>
          ) : null}
        </section>
      ) : null}
      <NoticeInline className="mt-20">
        상태와 환불 정보는 목 데모 데이터입니다. 실제 회수·환불 처리는 진행되지 않습니다.
      </NoticeInline>
      <div className="mt-24 flex flex-col items-start gap-12 sm:flex-row sm:items-center">
        <Link
          href="/mypage/claims"
          className="inline-flex min-h-48 items-center rounded-8 border border-line-strong px-20 text-label-m focus-ring"
        >
          취소·반품 내역으로
        </Link>
        <p className="text-caption text-text-3">
          신청 정보가 다르거나 추가 문의가 필요하면{' '}
          <Link href="/mypage/inquiries" className="rounded-4 underline focus-ring">
            1:1 문의
          </Link>
          를 이용해 주세요.
        </p>
      </div>
    </article>
  );
}

function ClaimStatusBadge({ claim }: { claim: Claim }) {
  const status = CLAIM_STATUS[claim.status];
  if (claim.status === 'processing') {
    const label = claim.type === 'exchange' ? '교환 · 검수 중' : status.label;
    return (
      <span className="inline-flex h-28 shrink-0 items-center rounded-capsule bg-[#f3f8f6] px-10 text-label-s font-bold text-[#0a6e57]">
        {label}
      </span>
    );
  }
  return <Badge tone={status.tone}>{status.label}</Badge>;
}

export function ClaimDetailPage({ claimId }: { claimId: string }) {
  const { member, status: memberStatus, refreshMember } = useMemberSession();
  const detailQuery = useQuery({
    queryKey: [...queryKeys.myPage.byMember(member?.id ?? 'anonymous'), 'claim-detail', claimId],
    enabled: Boolean(member?.id && claimId),
    queryFn: async ({ signal }): Promise<ClaimDetailData | null> => {
      if (!member?.id) return null;
      const api = await getShopApi();
      const claims = await api.claims.listByMember(member.id, { signal });
      const claim = claims.find((candidate) => candidate.id === claimId);
      if (!claim) return null;

      let orderResult: ClaimOrderResult;
      try {
        const orders = await api.orders.listByMember(member.id, { signal });
        orderResult = {
          status: 'loaded',
          order: orders.find((candidate) => candidate.id === claim.orderId),
        };
      } catch (error) {
        if (signal.aborted) throw error;
        orderResult = { status: 'error', kind: getApiFailureKind(error) };
      }

      return { claim, orderResult };
    },
  });

  return (
    <MyPageShell
      activeSection="claims"
      title="신청 상세"
      titleDescription="접수하신 취소·반품·교환 신청의 진행 상황과 신청 내용을 확인할 수 있습니다."
      titleAction={
        detailQuery.data ? <ClaimStatusBadge claim={detailQuery.data.claim} /> : undefined
      }
      breadcrumbTrail={[
        { label: '취소·반품 내역', href: '/mypage/claims' },
        { label: '신청 상세' },
      ]}
      hideNavigation
    >
      {memberStatus === 'loading' ? (
        <p role="status" className="py-56 text-center text-body-s text-text-3">
          회원 정보를 확인하는 중입니다.
        </p>
      ) : null}
      {memberStatus === 'error' ? (
        <section className="py-40 text-center">
          <p role="alert" className="text-body-s">
            회원 정보를 확인하지 못했습니다.
          </p>
          <Button
            className="mt-12"
            variant="secondary"
            size="s"
            onClick={() => void refreshMember()}
          >
            다시 시도
          </Button>
        </section>
      ) : null}
      {memberStatus === 'ready' && !member ? (
        <section className="py-40 text-center">
          <p className="text-body-s text-text-2">로그인 후 신청 정보를 확인할 수 있습니다.</p>
          <Link
            href={`/login?redirect=${encodeURIComponent(`/mypage/claims/${claimId}`)}`}
            className="mt-16 inline-flex min-h-44 items-center rounded-8 bg-text-1 px-16 text-label-m text-inverse focus-ring"
          >
            로그인
          </Link>
        </section>
      ) : null}
      {member && detailQuery.isPending ? (
        <p role="status" className="py-56 text-center text-body-s text-text-3">
          신청 정보를 불러오는 중입니다.
        </p>
      ) : null}
      {member && detailQuery.isError ? (
        <NoticeInline tone="danger" role="alert">
          <div className="flex flex-wrap items-center justify-between gap-12">
            <span>
              {getApiFailureKind(detailQuery.error) === 'notImplemented'
                ? '신청 상세 기능을 준비하고 있습니다.'
                : '신청 정보를 불러오지 못했습니다.'}
            </span>
            {getApiFailureKind(detailQuery.error) === 'temporary' ? (
              <Button variant="secondary" size="s" onClick={() => void detailQuery.refetch()}>
                다시 시도
              </Button>
            ) : null}
          </div>
        </NoticeInline>
      ) : null}
      {member && detailQuery.isSuccess && !detailQuery.data ? (
        <section className="py-56 text-center">
          <h2 className="text-h3">신청 내역을 찾을 수 없습니다.</h2>
          <p className="mt-8 text-body-s text-text-2">
            주소가 올바르지 않거나 현재 회원의 신청 내역이 아닙니다.
          </p>
          <Link
            href="/mypage/claims"
            className="mt-24 inline-flex min-h-48 items-center rounded-8 border border-line-strong px-20 text-label-m focus-ring"
          >
            목록으로
          </Link>
        </section>
      ) : null}
      {member && detailQuery.data ? (
        <ClaimDetailContent
          data={detailQuery.data}
          onRetryOrder={() => void detailQuery.refetch()}
          isRetrying={detailQuery.isFetching}
        />
      ) : null}
    </MyPageShell>
  );
}
