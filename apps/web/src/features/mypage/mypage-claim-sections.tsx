'use client';
import type {
  Address,
  ClaimAttachmentMetadata,
  Claim,
  ClaimStatus,
  ClaimType,
  Order,
} from '@eum/api/types';
import { Button } from '@eum/ui/components/Button';
import { Checkbox } from '@eum/ui/components/Checkbox';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { Pagination } from '@eum/ui/components/Pagination';
import { cx } from '@eum/ui/lib/cx';
import { ArrowDownToLine, Check, ChevronDown, Info, Package } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { getWebApiConfig } from '@/lib/api-config';
import { getShopApi } from '@/lib/shop-api';
import { MyPageActionLink } from './mypage-shell';
import { formatMyPageDate, formatMyPagePrice } from './mypage-data';
import {
  calculateSelectedOrderAmount,
  clampReturnQuantity,
  dateInputValue,
  getInitialClaimOrderId,
  shouldShowPresentationRows,
  subtractMonthsClamped,
} from './mypage-utils';
import { DateRangeFilter, StatusBadge, TabBar } from './mypage-ui';
import { CLAIM_LAYOUT_SAMPLE_DETAILS, CLAIM_LAYOUT_SAMPLES } from './mypage-presentation-fixtures';

type ClaimTab = ClaimType | 'all';

const CLAIM_STATUS_META: Record<
  ClaimStatus,
  { label: string; tone: 'dark' | 'warning' | 'outline' | 'success' | 'danger' }
> = {
  requested: { label: '신청 접수', tone: 'warning' },
  processing: { label: '처리중', tone: 'dark' },
  completed: { label: '처리 완료', tone: 'success' },
  rejected: { label: '반려', tone: 'danger' },
};

const CLAIM_TABS: { value: ClaimTab; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'cancel', label: '취소' },
  { value: 'return', label: '반품' },
  { value: 'exchange', label: '교환' },
];

export function ClaimsView({ claims, orders }: { claims: Claim[]; orders: Order[] }) {
  const today = new Date();
  const [startDate, setStartDate] = useState(() => dateInputValue(subtractMonthsClamped(today, 1)));
  const [endDate, setEndDate] = useState(() => dateInputValue(today));
  const [selectedPreset, setSelectedPreset] = useState<number | null>(1);
  const [appliedRange, setAppliedRange] = useState(() => ({
    start: dateInputValue(subtractMonthsClamped(today, 1)),
    end: dateInputValue(today),
  }));
  const [tab, setTab] = useState<ClaimTab>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const labels: Record<ClaimType, string> = { cancel: '취소', return: '반품', exchange: '교환' };
  const dateFilteredClaims = claims.filter((claim) => {
    const day = dateInputValue(new Date(claim.requestedAt));
    return day >= appliedRange.start && day <= appliedRange.end;
  });
  const filteredClaims = dateFilteredClaims.filter((claim) => tab === 'all' || claim.type === tab);
  const pageClaims = filteredClaims.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showLayoutSamples =
    shouldShowPresentationRows(getWebApiConfig().mode) &&
    appliedRange.start === dateInputValue(subtractMonthsClamped(today, 1)) &&
    appliedRange.end === dateInputValue(today);
  const displayClaims = [
    ...pageClaims.map((claim) => ({ kind: 'claim' as const, claim })),
    ...(showLayoutSamples
      ? CLAIM_LAYOUT_SAMPLES.filter((claim) => tab === 'all' || claim.type === tab).map(
          (claim) => ({ kind: 'sample' as const, claim }),
        )
      : []),
  ];
  const counts = Object.fromEntries(
    CLAIM_TABS.map((item) => [
      item.value,
      item.value === 'all'
        ? dateFilteredClaims.length
        : dateFilteredClaims.filter((claim) => claim.type === item.value).length,
    ]),
  );
  return (
    <div className="space-y-16 lg:space-y-20">
      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={(value) => {
          setStartDate(value);
          setSelectedPreset(null);
          setCurrentPage(1);
        }}
        onEndDateChange={(value) => {
          setEndDate(value);
          setSelectedPreset(null);
          setCurrentPage(1);
        }}
        selectedPreset={selectedPreset}
        onPreset={(months) => {
          const now = new Date();
          setSelectedPreset(months);
          setStartDate(dateInputValue(subtractMonthsClamped(now, months)));
          setEndDate(dateInputValue(now));
          setCurrentPage(1);
        }}
        onApply={() => {
          setAppliedRange({ start: startDate, end: endDate });
          setCurrentPage(1);
        }}
      />
      <TabBar
        options={CLAIM_TABS}
        value={tab}
        onChange={(next) => {
          setTab(next);
          setCurrentPage(1);
        }}
        label="신청 종류"
        counts={counts}
      />
      {displayClaims.length === 0 ? (
        <EmptyState
          icon={Package}
          title="신청 내역이 없습니다."
          description="주문 내역에서 취소·반품·교환을 신청할 수 있습니다."
          action={
            <MyPageActionLink href="/mypage/orders" variant="primary">
              주문 내역 보기
            </MyPageActionLink>
          }
        />
      ) : (
        <>
          <div className="hidden grid-cols-[128px_52px_minmax(140px,1.2fr)_minmax(132px,1fr)_72px_58px_112px_96px_104px] gap-12 border-y border-line bg-surface px-12 py-12 text-label-s text-text-2 lg:grid">
            <span>신청일 · 주문번호</span>
            <span aria-hidden="true" />
            <span>상품 정보</span>
            <span>신청 사유</span>
            <span>구분</span>
            <span className="text-center">수량</span>
            <span className="text-right">환불 금액</span>
            <span>상태</span>
            <span className="text-center">관리</span>
          </div>
          <ul className="divide-y divide-line">
            {displayClaims.map((row) => {
              if (row.kind === 'sample') {
                return (
                  <li
                    key={row.claim.key}
                    className="grid gap-10 py-16 lg:grid-cols-[128px_52px_minmax(140px,1.2fr)_minmax(132px,1fr)_72px_58px_112px_96px_104px] lg:items-center lg:px-12"
                  >
                    <div>
                      <time className="text-body-s">{CLAIM_LAYOUT_SAMPLE_DETAILS.date}</time>
                      <p className="mt-4 text-caption text-text-3">
                        {CLAIM_LAYOUT_SAMPLE_DETAILS.orderNumber}
                      </p>
                    </div>
                    <div
                      aria-hidden="true"
                      className="flex size-48 items-center justify-center rounded-8 bg-surface text-text-3"
                    >
                      <Package size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-label-m">
                        {CLAIM_LAYOUT_SAMPLE_DETAILS.productName}
                      </p>
                      <p className="mt-4 truncate text-caption text-text-3">
                        {CLAIM_LAYOUT_SAMPLE_DETAILS.optionName}
                      </p>
                    </div>
                    <p className="truncate text-body-s text-text-2">—</p>
                    <p className="text-body-s">{labels[row.claim.type]}</p>
                    <p className="text-body-s lg:text-center">
                      {CLAIM_LAYOUT_SAMPLE_DETAILS.quantity}
                    </p>
                    <p className="text-body-s lg:text-right">{row.claim.refund}</p>
                    <div>
                      <StatusBadge
                        label={row.claim.statusLabel}
                        tone={CLAIM_STATUS_META[row.claim.status].tone}
                      />
                    </div>
                    <div className="lg:justify-self-center">
                      <Button size="s" variant="secondary" disabled>
                        {row.claim.action}
                      </Button>
                    </div>
                  </li>
                );
              }
              const claim = row.claim;
              const order = orders.find((candidate) => candidate.id === claim.orderId);
              return (
                <li
                  key={claim.id}
                  className="grid gap-10 py-16 lg:grid-cols-[128px_52px_minmax(140px,1.2fr)_minmax(132px,1fr)_72px_58px_112px_96px_104px] lg:items-center lg:px-12"
                >
                  <div>
                    <time className="text-body-s">{formatMyPageDate(claim.requestedAt)}</time>
                    <p className="mt-4 text-caption text-text-3">
                      {order?.orderNumber ?? claim.orderId}
                    </p>
                  </div>
                  <div
                    aria-hidden="true"
                    className="flex size-48 items-center justify-center rounded-8 bg-surface text-text-3"
                  >
                    <Package size={20} />
                  </div>
                  <p className="truncate text-label-m">
                    {order?.lines.length
                      ? order.lines.map((line) => line.productName).join(', ')
                      : '상품 정보 미제공'}
                  </p>
                  <p className="truncate text-body-s text-text-2">{claim.reason}</p>
                  <p className="text-body-s">{labels[claim.type]}</p>
                  <p className="text-body-s lg:text-center">{order?.lines[0]?.quantity ?? '—'}개</p>
                  <p className="text-body-s text-text-3 lg:text-right">미제공</p>
                  <div>
                    <StatusBadge {...CLAIM_STATUS_META[claim.status]} />
                  </div>
                  <div className="lg:justify-self-center">
                    <Link
                      href={`/mypage/claims/${encodeURIComponent(claim.id)}`}
                      className="inline-flex min-h-44 items-center justify-center rounded-8 border border-line-strong px-12 text-label-m focus-ring"
                    >
                      신청 상세
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {filteredClaims.length > pageSize ? (
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(filteredClaims.length / pageSize)}
          onPageChange={setCurrentPage}
        />
      ) : null}
    </div>
  );
}

export function ClaimFormView({
  orders,
  addresses,
  preferredOrderId,
  preferredClaimType,
  memberId,
}: {
  orders: Order[];
  addresses: Address[];
  preferredOrderId?: string;
  preferredClaimType?: ClaimType;
  memberId: string;
}) {
  const router = useRouter();
  const [claimType, setClaimType] = useState<ClaimType>(preferredClaimType ?? 'return');
  const eligibleStatuses =
    claimType === 'cancel' ? ['paymentPending', 'paid', 'preparing'] : ['shipping', 'delivered'];
  const eligible = orders.filter((order) => eligibleStatuses.includes(order.status));
  const [orderId, setOrderId] = useState(() =>
    getInitialClaimOrderId(
      eligible.map((order) => order.id),
      preferredOrderId,
    ),
  );
  const [isOrderSelectionInvalid, setIsOrderSelectionInvalid] = useState(false);
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [attachment, setAttachment] = useState<ClaimAttachmentMetadata | null>(null);
  const [returnMethod, setReturnMethod] = useState<'pickup' | 'direct'>('pickup');
  const [addressId, setAddressId] = useState(
    addresses.find((address) => address.isDefault)?.id ?? addresses[0]?.id ?? '',
  );
  const [submittedClaimId, setSubmittedClaimId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const order = eligible.find((candidate) => candidate.id === orderId);
  const reasonOptions =
    claimType === 'cancel'
      ? ['주문 변경', '주문 실수', '배송 지연', '기타']
      : ['단순 변심', '상품 불량·파손', '오배송', '배송 지연', '기타'];
  const selectedAmount = calculateSelectedOrderAmount(
    order?.lines ?? [],
    selectedLines,
    claimType === 'return' ? returnQuantities : {},
  );
  const isReasonValid = reasonOptions.includes(reason);
  const needsReturnAddress = claimType !== 'cancel';
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      isSubmitting ||
      !(
        order &&
        selectedLines.length > 0 &&
        isReasonValid &&
        details.trim() &&
        (!needsReturnAddress ||
          (Boolean(returnMethod) && addresses.some((address) => address.id === addressId)))
      )
    )
      return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const items = order.lines.flatMap((line, index) => {
        const lineId = `${line.productId}-${index}`;
        if (!selectedLines.includes(lineId)) return [];
        return [
          {
            productId: line.productId,
            quantity:
              claimType === 'return'
                ? clampReturnQuantity(returnQuantities[lineId] ?? line.quantity, line.quantity)
                : line.quantity,
            ...(line.skuId ? { skuId: line.skuId } : {}),
          },
        ];
      });
      const api = await getShopApi();
      const returnAddress = needsReturnAddress
        ? addresses.find((address) => address.id === addressId)
        : undefined;
      const claim = await api.claims.submit({
        orderId: order.id,
        type: claimType,
        reason,
        description: details.trim(),
        items,
        ...(needsReturnAddress && returnAddress
          ? {
              returnMethod,
              returnAddress: {
                recipientName: returnAddress.recipientName,
                phone: returnAddress.phone,
                postalCode: returnAddress.postalCode,
                address1: returnAddress.address1,
                address2: returnAddress.address2,
              },
            }
          : {}),
        ...(attachment ? { attachments: [attachment] } : {}),
      });
      const buyerClaims = await api.claims.listByMember(memberId);
      if (!buyerClaims.some((buyerClaim) => buyerClaim.id === claim.id)) {
        throw new Error(
          '신청은 접수했지만 신청 내역을 다시 불러오지 못했습니다. 신청 내역에서 새로고침해 주세요.',
        );
      }
      setSubmittedClaimId(claim.id);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '신청을 접수하지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedClaimId)
    return (
      <div className="mx-auto max-w-560 rounded-12 border border-line p-24 text-center lg:p-40">
        <div className="mx-auto flex size-56 items-center justify-center rounded-capsule bg-success-tint text-success">
          <Check size={28} aria-hidden="true" />
        </div>
        <h2 className="mt-16 text-h3">신청이 접수되었습니다.</h2>
        <p className="mt-8 text-body-s text-text-2">
          신청번호 {submittedClaimId} · 현재 mock API에 저장했습니다. 실제 회수·환불 처리는 실행되지
          않습니다.
        </p>
        <Button className="mt-24" onClick={() => router.push('/mypage/claims')}>
          신청 내역 보기
        </Button>
      </div>
    );

  return (
    <form onSubmit={handleSubmit} className="space-y-20">
      <div className="flex flex-wrap items-center gap-8 text-body-s text-text-2">
        <span>주문번호</span>
        <div className="relative max-w-full">
          <select
            aria-label="주문 선택"
            value={orderId}
            onChange={(event) => {
              setOrderId(event.target.value);
              setIsOrderSelectionInvalid(false);
              setSelectedLines([]);
              setReturnQuantities({});
            }}
            className="h-40 max-w-full appearance-none rounded-8 border border-line-strong bg-bg pr-40 pl-12 text-body-s focus-ring"
          >
            <option value="">주문을 선택해 주세요</option>
            {eligible.map((option) => (
              <option key={option.id} value={option.id}>
                {option.orderNumber} · {formatMyPageDate(option.orderedAt)}
              </option>
            ))}
          </select>
          <ChevronDown
            size={20}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-14 -translate-y-1/2 text-text-1"
          />
        </div>
      </div>
      {!order && (isOrderSelectionInvalid || !eligible.length) ? (
        <NoticeInline tone="warning" role="status">
          {claimType === 'cancel'
            ? '취소 신청은 입금대기·결제완료·배송준비 주문에서만 가능합니다.'
            : '반품·교환 신청은 배송중·배송완료 주문에서만 가능합니다.'}{' '}
          {eligible.length
            ? '신청할 수 있는 주문을 선택해 주세요.'
            : '현재 신청 가능한 주문이 없습니다.'}
        </NoticeInline>
      ) : null}
      <TabBar
        options={[
          { value: 'cancel', label: '취소' },
          { value: 'return', label: '반품' },
          { value: 'exchange', label: '교환' },
        ]}
        value={claimType}
        onChange={(nextType) => {
          setClaimType(nextType);
          setReason('');
          const matchingOrder = orders.find((candidate) => candidate.id === orderId);
          const isMatchingOrderEligible = matchingOrder
            ? nextType === 'cancel'
              ? ['paymentPending', 'paid', 'preparing'].includes(matchingOrder.status)
              : ['shipping', 'delivered'].includes(matchingOrder.status)
            : false;
          if (!isMatchingOrderEligible) {
            setOrderId('');
            setIsOrderSelectionInvalid(Boolean(matchingOrder));
          } else {
            setIsOrderSelectionInvalid(false);
          }
          setSelectedLines([]);
          setReturnQuantities({});
        }}
        label="신청 종류"
      />
      {order ? (
        <>
          <ClaimFormSection title="상품 선택">
            <ul className="divide-y divide-line">
              {order.lines.map((line, index) => {
                const lineId = `${line.productId}-${index}`;
                const isSelected = selectedLines.includes(lineId);
                const selectedQuantity = clampReturnQuantity(
                  returnQuantities[lineId] ?? line.quantity,
                  line.quantity,
                );
                return (
                  <li key={lineId} className="flex flex-wrap items-center gap-12 py-14">
                    <Checkbox
                      aria-label={`${line.productName} 선택`}
                      checked={isSelected}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedLines((previous) =>
                            previous.includes(lineId) ? previous : [...previous, lineId],
                          );
                          setReturnQuantities((previous) => ({
                            ...previous,
                            [lineId]: previous[lineId] ?? line.quantity,
                          }));
                          return;
                        }
                        setSelectedLines((previous) => previous.filter((id) => id !== lineId));
                        setReturnQuantities((previous) => {
                          const next = { ...previous };
                          delete next[lineId];
                          return next;
                        });
                      }}
                    />
                    <div
                      aria-hidden="true"
                      className="flex size-48 shrink-0 items-center justify-center rounded-8 bg-surface text-text-3"
                    >
                      <Package size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-label-m">{line.productName}</p>
                      {line.optionLabel ? (
                        <p className="mt-4 text-caption text-text-2">옵션 {line.optionLabel}</p>
                      ) : null}
                      <p className="mt-4 text-caption text-text-2">
                        주문 {line.quantity}개 · {formatMyPagePrice(line.unitPrice)}
                      </p>
                    </div>
                    {claimType === 'return' && isSelected ? (
                      <div className="ml-auto flex shrink-0 items-center gap-8">
                        <Button
                          type="button"
                          size="s"
                          variant="secondary"
                          aria-label={`${line.productName} 수량 감소`}
                          disabled={selectedQuantity <= 1}
                          onClick={() =>
                            setReturnQuantities((previous) => ({
                              ...previous,
                              [lineId]: clampReturnQuantity(selectedQuantity - 1, line.quantity),
                            }))
                          }
                        >
                          −
                        </Button>
                        <span aria-live="polite" className="min-w-32 text-center text-body-s">
                          {selectedQuantity}개
                        </span>
                        <Button
                          type="button"
                          size="s"
                          variant="secondary"
                          aria-label={`${line.productName} 수량 증가`}
                          disabled={selectedQuantity >= line.quantity}
                          onClick={() =>
                            setReturnQuantities((previous) => ({
                              ...previous,
                              [lineId]: clampReturnQuantity(selectedQuantity + 1, line.quantity),
                            }))
                          }
                        >
                          +
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </ClaimFormSection>
          <ClaimFormSection title="사유">
            <div
              role="radiogroup"
              aria-label="사유"
              className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4"
            >
              {reasonOptions.map((option) => (
                <label
                  key={option}
                  className={cx(
                    'flex min-h-44 cursor-pointer items-center justify-center rounded-8 border px-12 text-center text-body-s focus-within:ring-2 focus-within:ring-text-1',
                    reason === option
                      ? 'border-text-1 bg-bg text-text-1'
                      : reason
                        ? 'border-line bg-surface text-text-2'
                        : 'border-line bg-bg text-text-1',
                  )}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="claim-reason"
                    value={option}
                    checked={reason === option}
                    onChange={() => setReason(option)}
                  />
                  {option}
                </label>
              ))}
            </div>
            <label className="mt-12 block">
              <span className="sr-only">상세 사유</span>
              <textarea
                value={details}
                maxLength={500}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="상세 사유를 입력해 주세요."
                className="min-h-104 w-full resize-y rounded-8 border border-line-strong p-12 text-body-s outline-none placeholder:text-text-3 focus:border-text-1 focus:ring-1 focus:ring-text-1"
              />
              <span className="mt-4 block text-right text-caption text-text-3">
                {details.length}/500
              </span>
            </label>
          </ClaimFormSection>
          <ClaimFormSection title="사진 첨부">
            <label className="mt-12 flex min-h-96 cursor-pointer flex-col items-center justify-center rounded-8 border border-dashed border-line-strong px-16 py-20 text-center focus-within:ring-2 focus-within:ring-text-1">
              <ArrowDownToLine size={20} aria-hidden="true" className="text-text-2" />
              <span className="mt-8 text-body-s">사진을 선택해 첨부할 수 있습니다.</span>
              <span className="mt-4 text-caption text-text-3">
                파일 바이트는 전송하지 않고 파일 정보만 목 API에 전달합니다.
              </span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  const selectedFile = event.target.files?.[0];
                  setAttachment(
                    selectedFile
                      ? {
                          fileName: selectedFile.name,
                          mimeType: selectedFile.type,
                          sizeBytes: selectedFile.size,
                        }
                      : null,
                  );
                }}
              />
            </label>
            {attachment ? (
              <p className="mt-8 flex items-center gap-6 text-caption text-text-2">
                <Info size={14} aria-hidden="true" />
                {attachment.fileName} · {attachment.mimeType || 'MIME type 미제공'} ·{' '}
                {(attachment.sizeBytes / 1024).toFixed(1)} KB
              </p>
            ) : null}
          </ClaimFormSection>
          {needsReturnAddress ? (
            <ClaimFormSection title="상품 회수 방법">
              <div className="mt-12 grid gap-8 sm:grid-cols-2">
                {[
                  { value: 'pickup' as const, label: '택배 회수 신청' },
                  { value: 'direct' as const, label: '직접 발송' },
                ].map((method) => (
                  <label
                    key={method.value}
                    className={cx(
                      'flex min-h-48 cursor-pointer items-center gap-8 rounded-8 border px-14 text-body-s focus-within:ring-2 focus-within:ring-text-1',
                      returnMethod === method.value ? 'border-text-1' : 'border-line',
                    )}
                  >
                    <input
                      type="radio"
                      name="return-method"
                      value={method.value}
                      checked={returnMethod === method.value}
                      onChange={() => setReturnMethod(method.value)}
                    />
                    {method.label}
                  </label>
                ))}
              </div>
              <label className="mt-16 block max-w-560">
                <span className="mb-8 block text-label-m">회수 주소</span>
                {addresses.length ? (
                  <div className="relative w-full">
                    <select
                      aria-label="회수 주소 선택"
                      value={addressId}
                      onChange={(event) => setAddressId(event.target.value)}
                      className="h-48 w-full appearance-none rounded-8 border border-line-strong bg-bg pr-40 pl-14 text-body-m focus-ring"
                    >
                      {addresses.map((address) => (
                        <option key={address.id} value={address.id}>
                          {address.label} · {address.recipientName} · {address.address1}{' '}
                          {address.address2}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={20}
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 right-14 -translate-y-1/2 text-text-1"
                    />
                  </div>
                ) : (
                  <span className="block rounded-8 border border-line p-12 text-body-s text-text-3">
                    등록된 회수 주소가 없습니다. 배송지 관리에서 주소를 추가해 주세요.
                  </span>
                )}
              </label>
            </ClaimFormSection>
          ) : null}
          <ClaimFormSection title="환불 예상액">
            <div className="rounded-12 bg-surface p-16 lg:p-20">
              <dl className="divide-y divide-line text-body-s">
                <div className="flex items-center justify-between gap-12 py-10 first:pt-0">
                  <dt className="text-text-3">상품 금액</dt>
                  <dd>{selectedLines.length ? formatMyPagePrice(selectedAmount) : '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-12 py-10">
                  <dt className="text-text-3">배송비</dt>
                  <dd>미제공</dd>
                </div>
                <div className="flex items-center justify-between gap-12 py-10">
                  <dt className="font-medium">예정 환불액</dt>
                  <dd className="text-web-price-xl">
                    {selectedLines.length ? formatMyPagePrice(selectedAmount) : '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-12 py-10 last:pb-0">
                  <dt className="text-text-3">환불 수단</dt>
                  <dd>미제공</dd>
                </div>
              </dl>
              <p className="mt-12 border-t border-line pt-12 text-caption text-text-2">
                예정 환불액은 선택 상품 금액 기준입니다. 배송비·할인 조정과 실제 환불은 현재
                연결되어 있지 않습니다.
              </p>
            </div>
          </ClaimFormSection>
          <NoticeInline tone="warning">
            신청은 mock API에 접수됩니다. 첨부는 파일명·형식·크기만 전달하며 실제 파일
            전송·회수·환불은 지원하지 않습니다.
          </NoticeInline>
          {submitError ? (
            <p role="alert" className="text-body-s text-danger">
              {submitError}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-center gap-8 pt-4">
            <Button variant="secondary" size="l" onClick={() => router.push('/mypage/orders')}>
              취소
            </Button>
            <Button
              type="submit"
              size="l"
              disabled={
                isSubmitting ||
                selectedLines.length === 0 ||
                !isReasonValid ||
                !details.trim() ||
                (needsReturnAddress && !addresses.some((address) => address.id === addressId))
              }
            >
              {isSubmitting ? '접수 중…' : '신청하기'}
            </Button>
          </div>
        </>
      ) : null}
    </form>
  );
}

function ClaimFormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-12 border-b border-line pb-20 lg:grid-cols-[140px_minmax(0,1fr)] lg:gap-24">
      <h2 className="text-label-m lg:pt-12">{title}</h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
