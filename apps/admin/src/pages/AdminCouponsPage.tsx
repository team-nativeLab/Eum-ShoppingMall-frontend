import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@eum/ui/components/Button';
import { Modal } from '@eum/ui/components/Modal';
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  AdminTabs,
} from '@/components/AdminUI';
import type { AdminCoupon, AdminCouponStatus } from '@eum/api/types';
import { getShopApi } from '@/lib/shop-api';
import type { AdminCouponInput } from '@eum/api/shop-api';
import {
  getBrowserLocalDateKey,
  saveWithGeneratedCouponCode,
  validateAdminCouponDraft,
  type AdminCouponDraft,
} from '@/lib/admin-preview-validation';

const EMPTY_DRAFT: AdminCouponDraft = {
  name: '',
  benefitType: 'rate',
  benefitValue: '',
  maxDiscountAmount: '0',
  minimumOrderAmount: '0',
  startsAt: '',
  endsAt: '',
  notice: '',
  issueMethod: 'automatic',
  target: 'all',
  productScope: 'all',
  issueLimit: '1000',
  issueLimitEnabled: true,
  allowStacking: false,
  validityMode: 'period',
  validityDays: '30',
};
const STATUS_OPTIONS: { value: AdminCouponStatus | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '사용 중' },
  { value: 'scheduled', label: '예약' },
  { value: 'paused', label: '중지' },
  { value: 'ended', label: '종료' },
];

/** 운영 쿠폰을 프론트엔드 목 API에 저장하고 상태를 관리합니다. */
export function AdminCouponsPage() {
  const queryClient = useQueryClient();
  const couponsQuery = useQuery({
    queryKey: ['admin', 'coupons'],
    queryFn: async ({ signal }) => (await getShopApi()).coupons.adminList({ signal }),
  });
  const [filter, setFilter] = useState<AdminCouponStatus | 'all'>('all');
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const coupons = useMemo(() => couponsQuery.data ?? [], [couponsQuery.data]);
  const visible = useMemo(
    () => coupons.filter((coupon) => filter === 'all' || coupon.status === filter),
    [coupons, filter],
  );
  const close = () => {
    setIsOpen(false);
    setDraft(EMPTY_DRAFT);
    setErrors([]);
  };
  const createPreview = async () => {
    const validationErrors = validateAdminCouponDraft(draft);
    setErrors(validationErrors);
    if (validationErrors.length) return;
    const coupon: Omit<AdminCouponInput, 'code'> = {
      name: draft.name.trim(),
      benefitType: draft.benefitType,
      benefitValue: Number(draft.benefitValue),
      maxDiscountAmount: Number(draft.maxDiscountAmount),
      minimumOrderAmount: Number(draft.minimumOrderAmount),
      productScope: draft.productScope ?? 'all',
      issueLimit: draft.issueLimitEnabled ? Number(draft.issueLimit) : null,
      allowStacking: draft.allowStacking ?? false,
      validityMode: draft.validityMode ?? 'period',
      validityDays: draft.validityMode === 'issueDays' ? Number(draft.validityDays) : null,
      startsAt: draft.validityMode === 'issueDays' ? '발급 후' : draft.startsAt,
      endsAt: draft.validityMode === 'issueDays' ? `${draft.validityDays}일 이내` : draft.endsAt,
      target: draft.target ?? 'all',
      issueMethod: draft.issueMethod ?? 'automatic',
      notice: draft.notice.trim(),
      status:
        draft.validityMode !== 'issueDays' && draft.startsAt > getBrowserLocalDateKey()
          ? 'scheduled'
          : 'active',
    };
    try {
      const api = await getShopApi();
      await saveWithGeneratedCouponCode((code) => api.coupons.saveAdmin({ ...coupon, code }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
        queryClient.invalidateQueries({ queryKey: ['coupons'] }),
      ]);
      setMessage(
        '운영 쿠폰 설정을 프론트엔드 목 API에 저장했습니다. 같은 mock 인스턴스에서 이미 보유한 적격 쿠폰은 주문 할인에 반영됩니다.',
      );
      close();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : '쿠폰을 저장하지 못했습니다.']);
    }
  };
  const updateStatus = async (coupon: AdminCoupon, status: AdminCouponStatus) => {
    try {
      await (await getShopApi()).coupons.saveAdmin({ ...coupon, status });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
        queryClient.invalidateQueries({ queryKey: ['coupons'] }),
      ]);
      setMessage('쿠폰 상태를 목 API에 저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '쿠폰 상태를 저장하지 못했습니다.');
    }
  };

  if (couponsQuery.isPending) return <AdminLoading label="운영 쿠폰을 불러오고 있습니다." />;
  if (couponsQuery.isError) return <AdminError onRetry={() => void couponsQuery.refetch()} />;

  return (
    <section aria-label="쿠폰 관리">
      <AdminPageHeader
        title="쿠폰 관리"
        description={`총 ${coupons.length.toLocaleString('ko-KR')}개`}
        descriptionPlacement="inline"
        action={
          <Button
            onClick={() => {
              setMessage('');
              setIsOpen(true);
            }}
          >
            쿠폰 등록
          </Button>
        }
      />
      <AdminNotice className="mb-16" tone="warning">
        목 동작: 자동 쿠폰은 구매자 쿠폰 조회 시 발급되고, 다운로드 쿠폰은 구매자가 쿠폰 화면에서
        받으며, 코드 쿠폰은 구매자 코드 입력으로 등록합니다. 회원 유형 타깃과 카테고리·상품 한정 및
        발급 rate limit은 지원하지 않습니다. 생성 코드는 브라우저 보안 난수로 만들고 mock API 충돌
        응답 시 새 코드로 최대 3회 재시도합니다.
      </AdminNotice>
      <span role="status" aria-live="polite" className="sr-only">
        {message}
      </span>
      <AdminTabs
        label="쿠폰 상태"
        options={STATUS_OPTIONS.map((option) => ({
          ...option,
          count:
            option.value === 'all'
              ? coupons.length
              : coupons.filter((coupon) => coupon.status === option.value).length,
        }))}
        value={filter}
        onChange={setFilter}
      />
      {visible.length === 0 ? (
        <AdminEmpty title="해당 쿠폰이 없습니다" />
      ) : (
        <div className="mt-16 overflow-x-auto rounded-12 border border-line bg-bg">
          <table className="w-full min-w-760 border-collapse text-left text-body-s">
            <thead className="bg-surface text-caption text-text-2">
              <tr>
                {[
                  '쿠폰명',
                  '혜택',
                  '발급 방식',
                  '대상 / 적용 범위',
                  '사용 기간',
                  '발급 / 사용',
                  '상태',
                  '중복',
                ].map((label) => (
                  <th key={label} className="px-16 py-12 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((coupon) => (
                <tr key={coupon.id} className="border-t border-line">
                  <td className="px-16 py-12 font-medium">
                    {coupon.name}
                    {coupon.notice ? (
                      <span className="mt-4 block max-w-240 text-caption font-normal break-words text-text-3">
                        {coupon.notice}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-16 py-12">
                    <span className="block">
                      {coupon.benefitType === 'rate'
                        ? `${coupon.benefitValue}%`
                        : `${coupon.benefitValue.toLocaleString('ko-KR')}원`}
                    </span>
                    <span className="mt-4 block text-caption whitespace-nowrap text-text-3">
                      최대 할인 {coupon.maxDiscountAmount.toLocaleString('ko-KR')}원
                    </span>
                    <span className="block text-caption whitespace-nowrap text-text-3">
                      최소 주문 {coupon.minimumOrderAmount.toLocaleString('ko-KR')}원
                    </span>
                  </td>
                  <td className="px-16 py-12">
                    {coupon.issueMethod === 'automatic'
                      ? '자동'
                      : coupon.issueMethod === 'download'
                        ? '다운로드'
                        : '코드'}
                  </td>
                  <td className="px-16 py-12">
                    {coupon.target === 'all'
                      ? '전체'
                      : coupon.target === 'business'
                        ? '사업자'
                        : '개인'}{' '}
                    ·{' '}
                    {coupon.productScope === 'all'
                      ? '전체 상품'
                      : coupon.productScope === 'category'
                        ? '카테고리'
                        : '상품 선택'}
                  </td>
                  <td className="px-16 py-12 whitespace-nowrap">
                    {coupon.startsAt} ~ {coupon.endsAt}
                  </td>
                  <td className="px-16 py-12">
                    {coupon.issuedCount} / {coupon.usedCount}
                    <span className="block text-caption text-text-3">
                      제한 {coupon.issueLimit ?? '없음'}
                    </span>
                  </td>
                  <td className="px-16 py-12">
                    {coupon.allowStacking ? '중복 가능' : '중복 불가'}
                  </td>
                  <td className="px-16 py-12">
                    <label className="sr-only" htmlFor={`coupon-status-${coupon.id}`}>
                      {coupon.name} 상태
                    </label>
                    <select
                      id={`coupon-status-${coupon.id}`}
                      value={coupon.status}
                      onChange={(event) =>
                        void updateStatus(coupon, event.target.value as AdminCouponStatus)
                      }
                      className="h-32 rounded-6 border border-line-control bg-bg px-8"
                    >
                      <option value="active">사용 중</option>
                      <option value="scheduled">예약</option>
                      <option value="paused">중지</option>
                      <option value="ended">종료</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal
        isOpen={isOpen}
        onClose={close}
        title="쿠폰 등록"
        actions={
          <>
            <Button variant="secondary" onClick={close}>
              취소
            </Button>
            <Button onClick={() => void createPreview()}>쿠폰 저장</Button>
          </>
        }
      >
        <div className="mt-16 grid max-h-[65vh] gap-12 overflow-y-auto pr-4">
          <label className="grid gap-4 text-body-s">
            쿠폰명
            <input
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({ ...current, name: event.target.value }))
              }
              className="h-40 rounded-8 border border-line-control px-12"
            />
          </label>
          <label className="grid gap-4 text-body-s">
            발급 방식
            <select
              aria-label="발급 방식"
              value={draft.issueMethod}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  issueMethod: event.target.value as AdminCouponDraft['issueMethod'],
                }))
              }
              className="h-40 rounded-8 border border-line-control px-12"
            >
              <option value="automatic">자동 발급</option>
              <option value="download">다운로드</option>
              <option value="code">코드 입력</option>
            </select>
          </label>
          <label className="grid gap-4 text-body-s">
            대상 회원
            <select
              aria-label="대상 회원"
              value={draft.target}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  target: event.target.value as AdminCouponDraft['target'],
                }))
              }
              className="h-40 rounded-8 border border-line-control px-12"
            >
              <option value="all">전체</option>
              <option value="business">사업자</option>
              <option value="personal">개인</option>
            </select>
          </label>
          <label className="grid gap-4 text-body-s">
            적용 상품
            <select
              aria-label="적용 상품"
              value={draft.productScope}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  productScope: event.target.value as AdminCouponDraft['productScope'],
                }))
              }
              className="h-40 rounded-8 border border-line-control px-12"
            >
              <option value="all">전체 상품</option>
              <option value="category">카테고리 선택</option>
              <option value="products">상품 선택</option>
            </select>
            <span className="text-caption text-text-3">
              실제 카테고리·상품 목록은 연결하지 않습니다.
            </span>
          </label>
          <label className="flex items-center gap-8 text-body-s">
            <input
              type="checkbox"
              checked={draft.issueLimitEnabled}
              onChange={(event) =>
                setDraft((current) => ({ ...current, issueLimitEnabled: event.target.checked }))
              }
            />
            발급 수량 제한
          </label>
          {draft.issueLimitEnabled ? (
            <label className="grid gap-4 text-body-s">
              최대 발급 수량
              <input
                type="number"
                min="1"
                value={draft.issueLimit}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, issueLimit: event.target.value }))
                }
                className="h-40 rounded-8 border border-line-control px-12"
              />
            </label>
          ) : null}
          <label className="flex items-center gap-8 text-body-s">
            <input
              type="checkbox"
              checked={draft.allowStacking}
              onChange={(event) =>
                setDraft((current) => ({ ...current, allowStacking: event.target.checked }))
              }
            />
            다른 할인과 중복 사용
          </label>
          <label className="grid gap-4 text-body-s">
            사용 기간 방식
            <select
              value={draft.validityMode}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  validityMode: event.target.value as AdminCouponDraft['validityMode'],
                }))
              }
              className="h-40 rounded-8 border border-line-control px-12"
            >
              <option value="period">기간 지정</option>
              <option value="issueDays">발급일로부터</option>
            </select>
          </label>
          {draft.validityMode === 'issueDays' ? (
            <label className="grid gap-4 text-body-s">
              발급 후 사용 가능 일수
              <input
                type="number"
                min="1"
                value={draft.validityDays}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, validityDays: event.target.value }))
                }
                className="h-40 rounded-8 border border-line-control px-12"
              />
            </label>
          ) : null}
          <label className="grid gap-4 text-body-s">
            혜택 유형
            <select
              value={draft.benefitType}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  benefitType: event.target.value as AdminCouponDraft['benefitType'],
                }))
              }
              className="h-40 rounded-8 border border-line-control px-12"
            >
              <option value="rate">정률 할인</option>
              <option value="amount">정액 할인</option>
            </select>
          </label>
          <label className="grid gap-4 text-body-s">
            혜택 값
            <input
              type="number"
              min="0"
              value={draft.benefitValue}
              onChange={(event) =>
                setDraft((current) => ({ ...current, benefitValue: event.target.value }))
              }
              className="h-40 rounded-8 border border-line-control px-12"
            />
          </label>
          <label className="grid gap-4 text-body-s">
            최대 할인 금액
            <input
              type="number"
              min="0"
              value={draft.maxDiscountAmount}
              onChange={(event) =>
                setDraft((current) => ({ ...current, maxDiscountAmount: event.target.value }))
              }
              className="h-40 rounded-8 border border-line-control px-12"
            />
          </label>
          <label className="grid gap-4 text-body-s">
            최소 주문 금액
            <input
              type="number"
              min="0"
              value={draft.minimumOrderAmount}
              onChange={(event) =>
                setDraft((current) => ({ ...current, minimumOrderAmount: event.target.value }))
              }
              className="h-40 rounded-8 border border-line-control px-12"
            />
          </label>
          {draft.validityMode === 'period' ? (
            <div className="grid grid-cols-2 gap-8">
              <label className="grid gap-4 text-body-s">
                시작일
                <input
                  type="date"
                  value={draft.startsAt}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, startsAt: event.target.value }))
                  }
                  className="h-40 rounded-8 border border-line-control px-12"
                />
              </label>
              <label className="grid gap-4 text-body-s">
                종료일
                <input
                  type="date"
                  value={draft.endsAt}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, endsAt: event.target.value }))
                  }
                  className="h-40 rounded-8 border border-line-control px-12"
                />
              </label>
            </div>
          ) : null}
          <label className="grid gap-4 text-body-s">
            안내 문구
            <textarea
              maxLength={1000}
              value={draft.notice}
              onChange={(event) =>
                setDraft((current) => ({ ...current, notice: event.target.value }))
              }
              className="min-h-80 rounded-8 border border-line-control p-12"
            />
            <span className="text-caption text-text-3">{draft.notice.length}/1,000자</span>
          </label>
          {errors.length ? (
            <ul role="alert" className="grid gap-4 text-body-s text-danger">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </Modal>
    </section>
  );
}
