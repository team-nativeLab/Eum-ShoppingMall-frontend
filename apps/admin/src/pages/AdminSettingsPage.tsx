import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBlocker } from 'react-router';
import { Button } from '@eum/ui/components/Button';
import { Modal } from '@eum/ui/components/Modal';
import {
  AdminError,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
} from '@/components/AdminUI';
import { validateAdminSettingsDraft } from '@/lib/admin-preview-validation';
import { getShopApi } from '@/lib/shop-api';
import type { AdminShopSettings } from '@eum/api/types';

const INITIAL_SETTINGS = {
  baseShippingFee: '0',
  baseFeeMode: 'customer',
  freeShippingEnabled: 'true',
  freeShippingThreshold: '0',
  freeShippingScope: 'all',
  remoteFeeEnabled: 'true',
  jejuFee: '0',
  islandFee: '0',
  returnFee: '0',
  exchangeFee: '0',
  combineReturnShipping: 'true',
  businessDiscountEnabled: 'true',
  businessDiscountRate: '0',
  businessDiscountScope: 'direct',
  businessCouponStacking: 'false',
  firstPurchaseEnabled: 'true',
  firstPurchaseBenefitType: 'rate',
  firstPurchaseBenefitValue: '0',
  firstPurchaseMaxDiscount: '0',
  firstPurchaseMinimumOrder: '0',
  firstPurchasePaymentScope: 'all',
};

type SettingsDraft = typeof INITIAL_SETTINGS;
type SettingKey = keyof SettingsDraft;
interface SettingField {
  key: SettingKey;
  label: string;
  suffix?: string;
}

const SECTION_FIELDS: { title: string; fields: SettingField[] }[] = [
  { title: '기본 배송비', fields: [{ key: 'baseShippingFee', label: '기본 배송비(원)' }] },
  {
    title: '무료배송 기준',
    fields: [{ key: 'freeShippingThreshold', label: '무료배송 기준 금액(원)' }],
  },
  {
    title: '지역 추가 배송비',
    fields: [
      { key: 'jejuFee', label: '제주 추가 배송비(원)' },
      { key: 'islandFee', label: '도서·산간 추가 배송비(원)' },
    ],
  },
  {
    title: '반품·교환 배송비',
    fields: [
      { key: 'returnFee', label: '반품 배송비(편도, 원)' },
      { key: 'exchangeFee', label: '교환 배송비(왕복, 원)' },
    ],
  },
  {
    title: '사업자 회원 할인',
    fields: [{ key: 'businessDiscountRate', label: '할인율(%)', suffix: '%' }],
  },
  {
    title: '첫 구매 할인',
    fields: [
      { key: 'firstPurchaseBenefitValue', label: '할인값' },
      { key: 'firstPurchaseMaxDiscount', label: '최대 할인 금액(원)' },
      { key: 'firstPurchaseMinimumOrder', label: '최소 주문 금액(원)' },
    ],
  },
];
const NUMERIC_SETTING_KEYS = [
  'baseShippingFee',
  'freeShippingThreshold',
  'jejuFee',
  'islandFee',
  'returnFee',
  'exchangeFee',
  'businessDiscountRate',
  'firstPurchaseBenefitValue',
  'firstPurchaseMaxDiscount',
  'firstPurchaseMinimumOrder',
] as const;

function toSettingsDraft(settings: AdminShopSettings): SettingsDraft {
  return {
    baseShippingFee: String(settings.baseShippingFee),
    baseFeeMode: settings.baseFeeMode,
    freeShippingEnabled: String(settings.freeShippingEnabled),
    freeShippingThreshold: String(settings.freeShippingThreshold),
    freeShippingScope: settings.freeShippingScope,
    remoteFeeEnabled: String(settings.remoteFeeEnabled),
    jejuFee: String(settings.jejuFee),
    islandFee: String(settings.islandFee),
    returnFee: String(settings.returnFee),
    exchangeFee: String(settings.exchangeFee),
    combineReturnShipping: String(settings.combineReturnShipping),
    businessDiscountEnabled: String(settings.businessDiscountEnabled),
    businessDiscountRate: String(settings.businessDiscountRate),
    businessDiscountScope: settings.businessDiscountScope,
    businessCouponStacking: String(settings.businessCouponStacking),
    firstPurchaseEnabled: String(settings.firstPurchaseEnabled),
    firstPurchaseBenefitType: settings.firstPurchaseBenefitType,
    firstPurchaseBenefitValue: String(settings.firstPurchaseBenefitValue),
    firstPurchaseMaxDiscount: String(settings.firstPurchaseMaxDiscount),
    firstPurchaseMinimumOrder: String(settings.firstPurchaseMinimumOrder),
    firstPurchasePaymentScope: settings.firstPurchasePaymentScope,
  };
}

function toShopSettings(draft: SettingsDraft): AdminShopSettings {
  return {
    baseShippingFee: Number(draft.baseShippingFee),
    baseFeeMode: draft.baseFeeMode === 'included' ? 'included' : 'customer',
    freeShippingEnabled: draft.freeShippingEnabled === 'true',
    freeShippingThreshold: Number(draft.freeShippingThreshold),
    freeShippingScope: draft.freeShippingScope === 'cart' ? 'cart' : 'all',
    remoteFeeEnabled: draft.remoteFeeEnabled === 'true',
    jejuFee: Number(draft.jejuFee),
    islandFee: Number(draft.islandFee),
    returnFee: Number(draft.returnFee),
    exchangeFee: Number(draft.exchangeFee),
    combineReturnShipping: draft.combineReturnShipping === 'true',
    businessDiscountEnabled: draft.businessDiscountEnabled === 'true',
    businessDiscountRate: Number(draft.businessDiscountRate),
    businessDiscountScope: draft.businessDiscountScope === 'category' ? 'category' : 'direct',
    businessCouponStacking: draft.businessCouponStacking === 'true',
    firstPurchaseEnabled: draft.firstPurchaseEnabled === 'true',
    firstPurchaseBenefitType: draft.firstPurchaseBenefitType === 'amount' ? 'amount' : 'rate',
    firstPurchaseBenefitValue: Number(draft.firstPurchaseBenefitValue),
    firstPurchaseMaxDiscount: Number(draft.firstPurchaseMaxDiscount),
    firstPurchaseMinimumOrder: Number(draft.firstPurchaseMinimumOrder),
    firstPurchasePaymentScope: draft.firstPurchasePaymentScope === 'newOnly' ? 'newOnly' : 'all',
  };
}

/** 운영 설정의 상세 항목과 화면 내 임시 미리보기만 제공합니다. */
export function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ['admin', 'settings', 'shipping-discount'],
    queryFn: async ({ signal }) => (await getShopApi()).settings.getAdmin({ signal }),
  });
  const [draft, setDraft] = useState<SettingsDraft>(INITIAL_SETTINGS);
  const [savedPreview, setSavedPreview] = useState<SettingsDraft>(INITIAL_SETTINGS);
  const [announcement, setAnnouncement] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const numericDraft = Object.fromEntries(NUMERIC_SETTING_KEYS.map((key) => [key, draft[key]]));
  if (draft.firstPurchaseEnabled === 'true' && draft.firstPurchaseBenefitType === 'rate') {
    numericDraft.firstPurchaseRate = draft.firstPurchaseBenefitValue;
  }
  const validationErrors = validateAdminSettingsDraft(numericDraft);
  const isDirty = Object.keys(draft).some(
    (key) => draft[key as SettingKey] !== savedPreview[key as SettingKey],
  );
  const blocker = useBlocker(isDirty);

  useEffect(() => {
    if (settingsQuery.data) {
      const loadedDraft = toSettingsDraft(settingsQuery.data);
      setDraft(loadedDraft);
      setSavedPreview(loadedDraft);
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const update = (key: SettingKey, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setAnnouncement('');
  };
  const reset = () => {
    setDraft(savedPreview);
    setAnnouncement('변경 사항을 취소하고 현재 화면의 저장 미리보기로 되돌렸습니다.');
  };
  const previewSave = async () => {
    const values = Object.fromEntries(NUMERIC_SETTING_KEYS.map((key) => [key, draft[key]]));
    if (draft.firstPurchaseEnabled === 'true' && draft.firstPurchaseBenefitType === 'rate')
      values.firstPurchaseRate = draft.firstPurchaseBenefitValue;
    const errors = validateAdminSettingsDraft(values);
    if (errors.length) {
      setAnnouncement('입력 오류를 수정한 뒤 다시 저장해 주세요.');
      return;
    }
    setIsSaving(true);
    try {
      const settings = await (await getShopApi()).settings.saveAdmin(toShopSettings(draft));
      const savedDraft = toSettingsDraft(settings);
      setSavedPreview(savedDraft);
      setDraft(savedDraft);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 'shipping-discount'] }),
        queryClient.invalidateQueries({ queryKey: ['checkout', 'options'] }),
      ]);
      setAnnouncement(
        '배송·할인 설정을 목 API에 저장했습니다. 주문서 화면도 같은 mock API 인스턴스의 배송비 정책을 사용합니다.',
      );
    } catch (error) {
      setAnnouncement(error instanceof Error ? error.message : '운영 설정을 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };
  const input = (field: SettingField) => (
    <label key={field.key} className="grid gap-6 text-body-s">
      {field.label}
      <div className="flex items-center gap-8">
        <input
          aria-label={field.label}
          type="number"
          min="0"
          max={field.key.toLowerCase().includes('rate') ? 100 : undefined}
          value={draft[field.key]}
          onChange={(event) => update(field.key, event.target.value)}
          className="h-40 w-full max-w-320 rounded-8 border border-line-control bg-bg px-12"
        />
        {field.suffix ? <span className="text-text-3">{field.suffix}</span> : null}
      </div>
    </label>
  );
  const toggle = (key: SettingKey, label: string) => (
    <label className="flex items-center gap-8 text-body-s">
      <input
        type="checkbox"
        checked={draft[key] === 'true'}
        onChange={(event) => update(key, String(event.target.checked))}
      />
      {label}
    </label>
  );
  const choice = (key: SettingKey, label: string, options: [string, string][]) => (
    <fieldset className="grid gap-8 text-body-s">
      <legend>{label}</legend>
      <div className="flex flex-wrap gap-16">
        {options.map(([value, optionLabel]) => (
          <label key={value} className="flex items-center gap-6">
            <input
              type="radio"
              name={key}
              checked={draft[key] === value}
              onChange={() => update(key, value)}
            />
            {optionLabel}
          </label>
        ))}
      </div>
    </fieldset>
  );

  if (settingsQuery.isPending) return <AdminLoading label="배송·할인 설정을 불러오고 있습니다." />;
  if (settingsQuery.isError) return <AdminError onRetry={() => void settingsQuery.refetch()} />;

  return (
    <section aria-label="배송·할인 설정">
      <AdminPageHeader
        title="배송·할인 설정"
        description="배송비와 할인 기준을 수정하고 화면에서 미리봅니다."
      />
      <AdminNotice className="mb-16" tone="warning">
        입력한 값과 미리보기는 현재 화면에만 유지되며 실제 주문 계산·운영 설정에 반영되지 않습니다.
      </AdminNotice>
      {SECTION_FIELDS.map((section) => (
        <AdminPanel
          key={section.title}
          className="mb-16"
          title={section.title}
          description={
            isDirty ? '저장되지 않은 변경 사항이 있습니다.' : '현재 목 API에 저장된 설정입니다.'
          }
          action={
            section.title.includes('무료') ||
            section.title.includes('지역') ||
            section.title.includes('사업자') ||
            section.title.includes('첫 구매')
              ? toggle(
                  (
                    {
                      '무료배송 기준': 'freeShippingEnabled',
                      '지역 추가 배송비': 'remoteFeeEnabled',
                      '사업자 회원 할인': 'businessDiscountEnabled',
                      '첫 구매 할인': 'firstPurchaseEnabled',
                    } as Record<string, SettingKey>
                  )[section.title] ?? 'freeShippingEnabled',
                  '표시',
                )
              : undefined
          }
        >
          <div className="grid gap-16 p-20 md:grid-cols-2">
            {section.fields.map(input)}
            {section.title === '기본 배송비'
              ? choice('baseFeeMode', '기본 배송비 처리', [
                  ['customer', '주문자 별도 부담'],
                  ['included', '상품별 부과'],
                ])
              : null}
            {section.title === '무료배송 기준' ? (
              <>
                {choice('freeShippingScope', '무료배송 적용 범위', [
                  ['all', '할인 전 금액 기준'],
                  ['cart', '장바구니 금액 기준'],
                ])}
              </>
            ) : null}
            {section.title === '지역 추가 배송비' ? (
              <p className="text-caption text-text-3">
                지역별 추가 배송비는 데모 설정 두 항목으로만 미리봅니다.
              </p>
            ) : null}
            {section.title === '반품·교환 배송비'
              ? toggle('combineReturnShipping', '무료배송 주문 반품 시 최초 배송비 청구')
              : null}
            {section.title === '사업자 회원 할인' ? (
              <>
                {choice('businessDiscountScope', '적용 범위', [
                  ['direct', '금액 표시 상품 전체'],
                  ['category', '카테고리 선택'],
                ])}
                {toggle('businessCouponStacking', '쿠폰과 중복 적용')}
              </>
            ) : null}
            {section.title === '첫 구매 할인' ? (
              <>
                {choice('firstPurchaseBenefitType', '혜택 유형', [
                  ['rate', '정률(%)'],
                  ['amount', '정액(원)'],
                ])}
                {choice('firstPurchasePaymentScope', '결제 적용 범위', [
                  ['all', '결제 시 사용 적용'],
                  ['newOnly', '가입 시 쿠폰 발급'],
                ])}
              </>
            ) : null}
          </div>
        </AdminPanel>
      ))}
      <AdminPanel title="사용자 화면 미리보기" className="mb-16">
        <dl className="grid grid-cols-[200px_1fr] gap-12 p-20 text-body-s">
          <dt>기본 배송비</dt>
          <dd>
            {savedPreview.baseShippingFee}원 ·{' '}
            {savedPreview.baseFeeMode === 'customer' ? '주문자 별도 부담' : '상품별 부과'}
          </dd>
          <dt>무료배송 기준</dt>
          <dd>
            {savedPreview.freeShippingEnabled === 'true'
              ? `${savedPreview.freeShippingThreshold}원 · ${savedPreview.freeShippingScope === 'all' ? '할인 전 금액 기준' : '장바구니 금액 기준'}`
              : '사용 안 함'}
          </dd>
          <dt>제주 / 도서산간</dt>
          <dd>
            {savedPreview.remoteFeeEnabled === 'true'
              ? `${savedPreview.jejuFee}원 / ${savedPreview.islandFee}원`
              : '사용 안 함'}
          </dd>
          <dt>반품 / 교환</dt>
          <dd>
            {savedPreview.returnFee}원 / {savedPreview.exchangeFee}원 · 최초 배송비 청구{' '}
            {savedPreview.combineReturnShipping === 'true' ? '포함' : '미포함'}
          </dd>
          <dt>사업자 할인</dt>
          <dd>
            {savedPreview.businessDiscountEnabled === 'true'
              ? `${savedPreview.businessDiscountRate}% · ${savedPreview.businessDiscountScope === 'direct' ? '금액 표시 상품 전체' : '카테고리 선택'} · 쿠폰 ${savedPreview.businessCouponStacking === 'true' ? '중복 적용' : '중복 불가'}`
              : '사용 안 함'}
          </dd>
          <dt>첫 구매 혜택</dt>
          <dd>
            {savedPreview.firstPurchaseEnabled === 'true'
              ? `${savedPreview.firstPurchaseBenefitValue}${savedPreview.firstPurchaseBenefitType === 'rate' ? '%' : '원'} · 최대 ${savedPreview.firstPurchaseMaxDiscount}원 · 최소 주문 ${savedPreview.firstPurchaseMinimumOrder}원 · ${savedPreview.firstPurchasePaymentScope === 'all' ? '결제 시 사용' : '가입 시 쿠폰 발급'}`
              : '사용 안 함'}
          </dd>
        </dl>
      </AdminPanel>
      <div className="flex justify-end gap-8 rounded-12 border border-line bg-bg p-12">
        <span className="mr-auto self-center text-caption text-text-3">
          {isDirty ? '저장되지 않은 변경 사항이 있습니다.' : '설정은 목 API에 저장됩니다.'}
        </span>
        <Button variant="secondary" onClick={reset} disabled={!isDirty}>
          변경 취소
        </Button>
        <Button
          onClick={() => void previewSave()}
          disabled={!isDirty || validationErrors.length > 0 || isSaving}
        >
          {isSaving ? '저장 중…' : '설정 저장'}
        </Button>
      </div>
      {validationErrors.length ? (
        <ul role="alert" className="mt-12 grid gap-4 text-body-s text-danger">
          {validationErrors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      <p role="status" aria-live="polite" className="mt-8 text-body-s text-text-2">
        {announcement}
      </p>
      <Modal
        isOpen={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        title="저장하지 않은 변경 사항이 있습니다"
        actions={
          <>
            <Button variant="secondary" onClick={() => blocker.reset?.()}>
              계속 편집
            </Button>
            <Button
              onClick={() => {
                reset();
                blocker.proceed?.();
              }}
            >
              변경 취소 후 이동
            </Button>
          </>
        }
      >
        <p className="mt-16 text-body-s text-text-2">
          현재 변경한 값은 저장되지 않았습니다. 이동하면 현재 화면의 입력값이 사라집니다.
        </p>
      </Modal>
    </section>
  );
}
