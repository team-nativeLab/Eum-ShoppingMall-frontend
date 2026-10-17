'use client';

import { resolveCartOption } from '@eum/api/cart';
import type { Product } from '@eum/api/types';
import { Checkbox } from '@eum/ui/components/Checkbox';
import { Button } from '@eum/ui/components/Button';
import { Icon } from '@eum/ui/components/Icon';
import { Radio } from '@eum/ui/components/Radio';
import { TextField } from '@eum/ui/components/TextField';
import { cx } from '@eum/ui/lib/cx';
import { Check, ChevronDown, ChevronRight, Upload, X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import { PageContainer } from '@/components/page-container';
import { useMemberSession } from '@/features/auth/member-session';
import { useProductsQuery } from '@/features/products/use-products-query';
import { CompanyContactSummary } from './company-contact-summary';
import { QuoteDateField } from './quote-date-field';
import { QuoteDetailsField } from './quote-details-field';

const PROCESS_STEPS = [
  { title: '문의 접수', description: '품목·수량·납기를 알려주세요.' },
  { title: '상담', description: '담당자가 요구사항을 확인합니다.' },
  { title: '견적서 발송', description: '맞춤 견적서를 보내드립니다.' },
  { title: '제작·납품', description: '확정 후 제작·납품합니다.' },
] as const;

const CUSTOM_ITEMS = [
  '작업복·유니폼 로고 인쇄',
  '안전모 로고·색상 맞춤',
  '현장 표지판·안전 시설물',
  '대량 정기 납품',
] as const;

const INTEREST_ITEMS = [
  '개인보호장비',
  '작업복/유니폼',
  '교통·도로 안전',
  '소방·방재용품',
  '산업 현장용품',
  '보안·감시',
  '생활 안전용품',
  '맞춤 제작/납품',
] as const;

function InterestItemChoices() {
  return (
    <fieldset className="flex flex-col gap-16">
      <legend className="text-label-m">관심 품목</legend>
      <div className="flex flex-wrap gap-8 pt-[3px]">
        {INTEREST_ITEMS.map((interestItem, index) => (
          <label
            key={interestItem}
            className="relative inline-flex min-h-44 cursor-pointer items-center"
          >
            <input
              type="checkbox"
              name="interestItems"
              value={interestItem}
              defaultChecked={index < 2}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-8 hidden -translate-y-1/2 text-success peer-checked:inline-flex"
            >
              <Icon icon={Check} size={12} />
            </span>
            <span
              className={cx(
                'inline-flex h-36 items-center rounded-capsule border border-line-strong bg-bg px-[11px] text-label-m text-text-2 transition-colors peer-checked:pl-[26px]',
                'peer-checked:border-success peer-checked:bg-success-tint peer-checked:text-success',
                'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-text-1',
              )}
            >
              {interestItem}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

interface QuoteProductSelection {
  selectionId: string;
  productId: string;
  quantity: number;
  optionChoiceIds: Record<string, string>;
}

interface InitialQuoteSelection {
  productId: string;
  optionId: string | null;
  quantity: number;
}

interface QuotePreviewReceipt {
  inquiryNumber: string;
  inquiryType: string;
}

interface LocalAttachmentName {
  id: number;
  name: string;
}

function InquiryProductsPanel({
  products,
  selectedProducts,
  selectedProductId,
  onSelectedProductChange,
  onAddProduct,
  onRemoveProduct,
  onChangeQuantity,
  onChangeOption,
  errorMessage,
}: {
  products: Product[];
  selectedProducts: QuoteProductSelection[];
  selectedProductId: string;
  onSelectedProductChange: (productId: string) => void;
  onAddProduct: () => void;
  onRemoveProduct: (selectionId: string) => void;
  onChangeQuantity: (selectionId: string, quantity: number) => void;
  onChangeOption: (selectionId: string, optionId: string, choiceId: string) => void;
  errorMessage?: string;
}) {
  return (
    <section
      aria-labelledby="inquiry-products-title"
      className="flex flex-col gap-16 rounded-12 border border-line-strong bg-bg p-16 lg:gap-12 lg:p-20"
    >
      <div className="flex flex-col gap-12 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="inquiry-products-title" className="text-label-l">
          문의 상품
        </h2>
        <div className="flex min-w-0 items-center gap-8 sm:max-w-[360px]">
          <label className="sr-only" htmlFor="quote-product-select">
            상품 선택
          </label>
          <div className="relative min-w-0 flex-1 sm:max-w-220">
            <select
              id="quote-product-select"
              value={selectedProductId}
              onChange={(event) => onSelectedProductChange(event.currentTarget.value)}
              disabled={products.length === 0}
              className="w-full min-w-0 appearance-none rounded-8 border border-line-strong bg-bg px-12 py-8 pr-40 text-body-s focus-ring focus-visible:border-success focus-visible:outline-success"
            >
              <option value="">상품을 선택해 주세요</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <Icon
              icon={ChevronDown}
              size={20}
              className={cx(
                'pointer-events-none absolute top-1/2 right-14 -translate-y-1/2',
                products.length === 0 ? 'text-text-disabled' : 'text-text-1',
              )}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="s"
            onClick={onAddProduct}
            disabled={!selectedProductId}
            className="disabled:bg-surface disabled:text-text-3"
          >
            상품 추가
          </Button>
        </div>
      </div>
      {selectedProducts.length > 0 ? (
        <ul className="flex flex-col gap-8">
          {selectedProducts.map((selection, index) => {
            const product = products.find((item) => item.id === selection.productId);
            if (!product) return null;
            const productSelectionCount = selectedProducts.filter(
              (item) => item.productId === selection.productId,
            ).length;
            const productSelectionNumber = selectedProducts
              .slice(0, index + 1)
              .filter((item) => item.productId === selection.productId).length;
            const accessibleProductName =
              productSelectionCount > 1
                ? `${product.name} 선택 ${productSelectionNumber}`
                : product.name;
            return (
              <li
                key={selection.selectionId}
                className="flex flex-col gap-12 rounded-8 border border-success bg-success-tint p-12"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-12">
                  <div className="flex min-w-0 flex-1 items-center gap-12">
                    <span aria-hidden="true" className="size-48 shrink-0 rounded-6 bg-surface" />
                    <div className="min-w-0 flex-1">
                      <p className="text-body-s-medium break-words text-success">{product.name}</p>
                      <p className="mt-2 text-caption text-success">{product.brand}</p>
                    </div>
                  </div>
                  <label className="flex shrink-0 items-center gap-6 text-caption text-text-2">
                    수량
                    <input
                      aria-label={`${accessibleProductName} 수량`}
                      type="number"
                      min={1}
                      max={9999}
                      value={selection.quantity}
                      onChange={(event) =>
                        onChangeQuantity(selection.selectionId, Number(event.currentTarget.value))
                      }
                      className="w-72 rounded-4 border border-line-control px-8 py-6 text-center text-body-s focus-ring"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => onRemoveProduct(selection.selectionId)}
                    aria-label={`${accessibleProductName} 삭제`}
                    className="inline-flex size-32 shrink-0 items-center justify-center rounded-4 focus-ring"
                  >
                    <Icon icon={X} size={16} />
                  </button>
                </div>
                {product.options.map((productOption) => (
                  <label
                    key={productOption.id}
                    className="flex min-w-0 items-center gap-12 text-caption text-text-2"
                  >
                    <span className="w-80 shrink-0">
                      {productOption.label}
                      {productOption.required ? (
                        <span aria-hidden="true" className="ml-4 text-danger">
                          *
                        </span>
                      ) : null}
                    </span>
                    <div className="relative min-w-0 flex-1">
                      <select
                        aria-label={`${accessibleProductName} ${productOption.label}`}
                        required={productOption.required}
                        value={selection.optionChoiceIds[productOption.id] ?? ''}
                        onChange={(event) =>
                          onChangeOption(
                            selection.selectionId,
                            productOption.id,
                            event.currentTarget.value,
                          )
                        }
                        className="w-full min-w-0 appearance-none rounded-8 border border-line-control bg-bg py-8 pr-40 pl-12 text-body-s focus-ring focus-visible:border-success focus-visible:outline-success"
                      >
                        <option value="">
                          {productOption.required ? '옵션을 선택해 주세요' : '선택 사항'}
                        </option>
                        {productOption.choices.map((choice) => (
                          <option key={choice.id} value={choice.id}>
                            {choice.label}
                          </option>
                        ))}
                      </select>
                      <Icon
                        icon={ChevronDown}
                        size={20}
                        className="pointer-events-none absolute top-1/2 right-14 -translate-y-1/2 text-text-1"
                      />
                    </div>
                  </label>
                ))}
              </li>
            );
          })}
        </ul>
      ) : null}
      {errorMessage ? (
        <p role="alert" className="text-body-s text-danger">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}

function CustomItemsPanel() {
  return (
    <section aria-labelledby="custom-items-title" className="flex flex-col gap-8">
      <h2 id="custom-items-title" className="text-h3">
        맞춤 제작 가능 품목
      </h2>
      <ul className="flex flex-col">
        {CUSTOM_ITEMS.map((customItem) => (
          <li key={customItem} className="border-b border-line last:border-b-0">
            <a
              href="#quote-form"
              className="flex min-h-56 items-center justify-between gap-12 rounded-4 text-body-l focus-ring hover:text-text-2"
            >
              <span>{customItem}</span>
              <Icon icon={ChevronRight} size={20} className="shrink-0" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function QuoteFormVisual({
  initialSelections,
  onComplete,
}: {
  initialSelections: InitialQuoteSelection[];
  onComplete: (receipt: QuotePreviewReceipt) => void;
}) {
  const { member } = useMemberSession();
  const productsQuery = useProductsQuery({ pageSize: 100 });
  const [selectedProducts, setSelectedProducts] = useState<QuoteProductSelection[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productError, setProductError] = useState('');
  const [resetVersion, setResetVersion] = useState(0);
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [attachments, setAttachments] = useState<LocalAttachmentName[]>([]);
  const [attachmentAnnouncement, setAttachmentAnnouncement] = useState('');
  const [isAttachmentDropActive, setIsAttachmentDropActive] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const attachmentChooseButtonRef = useRef<HTMLButtonElement>(null);
  const attachmentRemoveButtonRefs = useRef(new Map<number, HTMLButtonElement>());
  const pendingAttachmentFocusId = useRef<number | null | undefined>(undefined);
  const nextAttachmentId = useRef(0);
  const appliedInitialProductKey = useRef('');
  const nextSelectionId = useRef(0);
  const initialProductKey = JSON.stringify(initialSelections);

  useEffect(() => {
    if (!productsQuery.isSuccess || initialSelections.length === 0) return;
    if (appliedInitialProductKey.current === initialProductKey) return;
    appliedInitialProductKey.current = initialProductKey;
    const productsById = new Map(productsQuery.data.items.map((product) => [product.id, product]));
    setSelectedProducts(
      initialSelections.flatMap((selection, index) => {
        const product = productsById.get(selection.productId);
        if (!product) return [];
        const optionIsValid = resolveCartOption(product, selection.optionId).isAvailable;
        return [
          {
            selectionId: `initial-${index}-${product.id}`,
            productId: product.id,
            quantity: selection.quantity,
            optionChoiceIds: optionIsValid ? parseOptionChoiceIds(selection.optionId) : {},
          },
        ];
      }),
    );
  }, [initialSelections, initialProductKey, productsQuery.data, productsQuery.isSuccess]);

  useEffect(() => {
    const targetAttachmentId = pendingAttachmentFocusId.current;
    if (targetAttachmentId === undefined) return;
    pendingAttachmentFocusId.current = undefined;
    if (targetAttachmentId === null) {
      attachmentChooseButtonRef.current?.focus();
      return;
    }
    attachmentRemoveButtonRefs.current.get(targetAttachmentId)?.focus();
  }, [attachments]);

  function handleAddProduct() {
    const product = (productsQuery.data?.items ?? []).find((item) => item.id === selectedProductId);
    if (!product) return;
    if (selectedProducts.some((selection) => selection.productId === product.id)) {
      setProductError('이미 추가한 상품입니다. 수량과 옵션을 변경해 주세요.');
      return;
    }
    setSelectedProducts((current) => [
      ...current,
      {
        selectionId: `manual-${nextSelectionId.current++}`,
        productId: product.id,
        quantity: 1,
        optionChoiceIds: {},
      },
    ]);
    setProductError('');
    setSelectedProductId('');
  }

  function handleAttachmentFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const nextAttachments = Array.from(files, (file) => ({
      id: nextAttachmentId.current++,
      name: file.name,
    }));
    setAttachments((current) => [...current, ...nextAttachments]);
    setAttachmentAnnouncement(
      `선택한 파일 ${nextAttachments.length}개가 화면에만 표시됩니다. 파일은 문의와 함께 전송되지 않습니다.`,
    );
  }

  function handleAttachmentInputChange(changeEvent: ChangeEvent<HTMLInputElement>) {
    handleAttachmentFiles(changeEvent.currentTarget.files);
    changeEvent.currentTarget.value = '';
  }

  function handleAttachmentDrop(dropEvent: DragEvent<HTMLDivElement>) {
    dropEvent.preventDefault();
    setIsAttachmentDropActive(false);
    handleAttachmentFiles(dropEvent.dataTransfer.files);
  }

  function handleRemoveAttachment(attachmentId: number) {
    const attachmentIndex = attachments.findIndex((item) => item.id === attachmentId);
    if (attachmentIndex < 0) return;
    const attachment = attachments[attachmentIndex];
    if (!attachment) return;
    pendingAttachmentFocusId.current =
      attachments[attachmentIndex + 1]?.id ?? attachments[attachmentIndex - 1]?.id ?? null;
    setAttachments((current) => current.filter((item) => item.id !== attachmentId));
    setAttachmentAnnouncement(`${attachment.name} 파일을 제거했습니다.`);
  }

  function handleAttachmentDragLeave(dragEvent: DragEvent<HTMLDivElement>) {
    const nextTarget = dragEvent.relatedTarget;
    if (nextTarget instanceof Node && dragEvent.currentTarget.contains(nextTarget)) return;
    setIsAttachmentDropActive(false);
  }

  function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    if (selectedProducts.length === 0) {
      setProductError('견적을 요청할 상품을 하나 이상 선택해 주세요.');
      document.getElementById('quote-product-select')?.focus();
      return;
    }
    const formData = new FormData(submitEvent.currentTarget);
    const inquiryTypeLabels: Record<string, string> = {
      custom: '맞춤 제작',
      bulk: '대량 구매',
      'regular-supply': '정기 납품',
      other: '기타',
    };
    onComplete({
      inquiryNumber: `PREVIEW-${Date.now().toString(36).toUpperCase()}`,
      inquiryType: inquiryTypeLabels[String(formData.get('inquiryType'))] ?? '맞춤 제작',
    });
  }

  return (
    <section id="quote-form" aria-label="견적 문의 입력" className="min-w-0 scroll-mt-80">
      <form
        className="flex flex-col gap-32 lg:gap-24"
        onSubmit={handleSubmit}
        onReset={() => {
          setSelectedProducts([]);
          setSelectedProductId('');
          setProductError('');
          setCompanyName('');
          setContactName('');
          setPhone('');
          setEmail('');
          setAttachments([]);
          setAttachmentAnnouncement('선택한 파일 목록을 초기화했습니다.');
          setIsAttachmentDropActive(false);
          pendingAttachmentFocusId.current = undefined;
          if (attachmentInputRef.current) attachmentInputRef.current.value = '';
          setResetVersion((version) => version + 1);
        }}
      >
        <div className="flex flex-col gap-12">
          <InquiryProductsPanel
            products={productsQuery.data?.items ?? []}
            selectedProducts={selectedProducts}
            selectedProductId={selectedProductId}
            onSelectedProductChange={setSelectedProductId}
            onAddProduct={handleAddProduct}
            onRemoveProduct={(selectionId) =>
              setSelectedProducts((current) =>
                current.filter((selection) => selection.selectionId !== selectionId),
              )
            }
            onChangeQuantity={(selectionId, quantity) =>
              setSelectedProducts((current) =>
                current.map((selection) =>
                  selection.selectionId === selectionId
                    ? { ...selection, quantity: Math.max(1, Math.min(9999, quantity || 1)) }
                    : selection,
                ),
              )
            }
            onChangeOption={(selectionId, optionId, choiceId) =>
              setSelectedProducts((current) =>
                current.map((selection) =>
                  selection.selectionId === selectionId
                    ? {
                        ...selection,
                        optionChoiceIds: { ...selection.optionChoiceIds, [optionId]: choiceId },
                      }
                    : selection,
                ),
              )
            }
            errorMessage={productError}
          />
          {productsQuery.isPending ? (
            <p role="status" className="text-caption text-text-3">
              상품을 불러오는 중입니다.
            </p>
          ) : null}
          {productsQuery.isError ? (
            <div
              role="alert"
              className="flex items-center justify-between gap-12 text-body-s text-danger"
            >
              <span>상품 목록을 불러오지 못했습니다.</span>
              <Button
                type="button"
                variant="secondary"
                size="s"
                onClick={() => void productsQuery.refetch()}
              >
                다시 시도
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-16 lg:contents">
          <fieldset className="flex flex-col gap-8 lg:gap-12">
            <legend className="text-label-m">
              문의 유형
              <span aria-hidden="true" className="ml-4 text-danger">
                *
              </span>
            </legend>
            <div className="flex flex-wrap gap-x-16 gap-y-8 [&>label>span]:size-14 [&>label>span>span]:size-7">
              <Radio className="min-h-44" name="inquiryType" value="custom" required defaultChecked>
                맞춤 제작
              </Radio>
              <Radio className="min-h-44" name="inquiryType" value="bulk" required>
                대량 구매
              </Radio>
              <Radio className="min-h-44" name="inquiryType" value="regular-supply" required>
                정기 납품
              </Radio>
              <Radio className="min-h-44" name="inquiryType" value="other" required>
                기타
              </Radio>
            </div>
          </fieldset>

          <div className="flex flex-col gap-8 rounded-8 bg-surface px-12 py-12 sm:flex-row sm:items-center sm:justify-between sm:gap-16">
            <p className="min-w-0 text-body-s text-text-2">
              회원 정보를 입력란에 미리 채울 수 있습니다. 입력 후에도 직접 수정할 수 있습니다.
            </p>
            <Button
              type="button"
              size="s"
              variant="secondary"
              disabled={!member}
              onClick={() => {
                if (!member) return;
                setContactName(member.name);
                setEmail(member.email);
                setPhone(member.phone);
              }}
            >
              {member ? '회원 정보로 미리 채우기' : '로그인 후 회원 정보 미리 채우기'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-24 min-[600px]:grid-cols-2">
          <TextField
            label="회사명"
            showRequiredIndicator
            name="companyName"
            autoComplete="organization"
            placeholder="회사명을 입력해 주세요"
            required
            value={companyName}
            onChange={(event) => setCompanyName(event.currentTarget.value)}
          />
          <TextField
            label="담당자명"
            showRequiredIndicator
            name="contactName"
            autoComplete="name"
            placeholder="담당자 이름을 입력해 주세요"
            required
            value={contactName}
            onChange={(event) => setContactName(event.currentTarget.value)}
          />
          <TextField
            label="연락처"
            showRequiredIndicator
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="숫자만 입력해 주세요"
            required
            value={phone}
            onChange={(event) => setPhone(event.currentTarget.value)}
          />
          <TextField
            label="이메일"
            showRequiredIndicator
            name="email"
            type="email"
            autoComplete="email"
            placeholder="example@email.com"
            required
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
        </div>

        <div className="grid grid-cols-1 items-start gap-24 min-[600px]:grid-cols-2">
          <TextField
            label="현장 전체 예상 수량"
            name="quantity"
            type="number"
            min={1}
            placeholder="예: 300"
            helperText="이 문의로 필요한 전체 수량을 입력해 주세요."
          />
          <QuoteDateField key={resetVersion} />
        </div>

        <TextField
          label="납품 지역"
          name="deliveryLocation"
          autoComplete="address-level2"
          placeholder="예: 경기도 00시"
          helperText="여러 지역 납품이면 대표 지역을 적어 주세요."
        />

        <InterestItemChoices />

        <QuoteDetailsField key={resetVersion} />

        <div
          role="group"
          aria-label="견적 파일 첨부"
          onDragEnter={(dragEvent) => {
            dragEvent.preventDefault();
            setIsAttachmentDropActive(true);
          }}
          onDragOver={(dragEvent) => {
            dragEvent.preventDefault();
            setIsAttachmentDropActive(true);
          }}
          onDragLeave={handleAttachmentDragLeave}
          onDrop={handleAttachmentDrop}
          className={cx(
            'flex min-h-120 flex-col items-center justify-center gap-8 rounded-12 border border-dashed border-line-control px-16 py-20 text-center',
            isAttachmentDropActive && 'border-text-1 bg-surface',
          )}
        >
          <Icon icon={Upload} size={24} className="text-text-2" />
          <p className="text-body-s text-text-2">파일을 끌어 놓거나 버튼을 눌러 선택해 주세요.</p>
          <button
            ref={attachmentChooseButtonRef}
            type="button"
            aria-controls="quote-attachment-input"
            aria-describedby="quote-attachment-description"
            onClick={() => attachmentInputRef.current?.click()}
            className="inline-flex min-h-40 items-center justify-center rounded-8 border border-line-strong bg-bg px-12 text-label-s text-text-1 focus-ring hover:bg-surface"
          >
            파일 선택
          </button>
          <input
            ref={attachmentInputRef}
            id="quote-attachment-input"
            type="file"
            multiple
            aria-label="첨부할 파일 선택"
            tabIndex={-1}
            className="sr-only"
            onChange={handleAttachmentInputChange}
          />
          <p id="quote-attachment-description" className="text-caption text-text-3">
            선택한 파일은 현재 화면에만 표시되며 문의와 함께 전송되지 않습니다.
          </p>
          {attachments.length > 0 ? (
            <ul
              aria-label="선택한 파일"
              className="flex w-full max-w-560 flex-col divide-y divide-line text-left"
            >
              {attachments.map((attachment, index) => (
                <li
                  key={attachment.id}
                  className="flex min-w-0 items-center justify-between gap-12 py-8 first:pt-0 last:pb-0"
                >
                  <span className="min-w-0 flex-1 text-body-s break-all text-text-2">
                    {attachment.name}
                  </span>
                  <button
                    ref={(element) => {
                      if (element) attachmentRemoveButtonRefs.current.set(attachment.id, element);
                      else attachmentRemoveButtonRefs.current.delete(attachment.id);
                    }}
                    type="button"
                    aria-label={`${attachment.name} 항목 ${index + 1} 제거`}
                    onClick={() => handleRemoveAttachment(attachment.id)}
                    className="inline-flex size-32 shrink-0 items-center justify-center rounded-4 text-text-2 focus-ring hover:bg-surface"
                  >
                    <Icon icon={X} size={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {attachmentAnnouncement}
          </p>
        </div>

        <div className="flex flex-col gap-12">
          <div className="flex items-center justify-between gap-12">
            <Checkbox name="privacyAgreement" required>
              [필수] 개인정보 수집·이용 동의
            </Checkbox>
          </div>
          <p id="quote-submit-description" className="text-caption text-text-3">
            동의는 화면 확인용입니다. 입력 내용은 실제로 수집·전송·저장되지 않습니다.
          </p>
          <Button type="submit" size="l" isFullWidth aria-describedby="quote-submit-description">
            견적 문의 접수
          </Button>
          <Button type="reset" variant="secondary" size="m" className="self-end">
            취소
          </Button>
        </div>
      </form>
    </section>
  );
}

function parseQuoteQuantity(value: string | undefined) {
  const quantity = Number(value);
  return Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= 9999 ? quantity : 1;
}

function parseOptionChoiceIds(optionId: string | null): Record<string, string> {
  if (!optionId) return {};
  return Object.fromEntries(
    optionId.split('|').flatMap((pair) => {
      const separatorIndex = pair.indexOf(':');
      return separatorIndex > 0
        ? [[pair.slice(0, separatorIndex), pair.slice(separatorIndex + 1)]]
        : [];
    }),
  );
}

/** 안전 솔루션 문의 과정을 소개하고 입력 화면을 보여 줍니다. */
function SolutionsPageContentInner() {
  const searchParams = useSearchParams();
  const optionIds = searchParams.getAll('optionId');
  const quantities = searchParams.getAll('quantity');
  const initialSelections = searchParams.getAll('productId').flatMap((productId, index) => {
    if (!productId.trim()) return [];
    return [
      {
        productId,
        optionId: optionIds[index] || null,
        quantity: parseQuoteQuantity(quantities[index]),
      },
    ];
  });
  const initialSelectionKey = JSON.stringify(initialSelections);
  const [receipt, setReceipt] = useState<QuotePreviewReceipt | null>(null);

  if (receipt) {
    return (
      <PageContainer className="flex min-h-480 flex-col items-center justify-center px-16 py-80 text-center">
        <span
          aria-hidden="true"
          className="inline-flex size-64 items-center justify-center rounded-capsule bg-text-1 text-inverse"
        >
          <Icon icon={Check} size={24} />
        </span>
        <p className="mt-24 text-overline text-text-3">DEMO PREVIEW</p>
        <h1 className="mt-8 text-h1">견적 문의가 접수되었습니다</h1>
        <p className="mt-12 max-w-560 text-body-s text-text-2">
          현재는 화면 확인용 미리보기입니다. 입력값은 서버로 전송되거나 저장되지 않았습니다.
        </p>
        <p className="mt-8 max-w-560 text-caption text-text-3">
          선택한 파일은 현재 화면에만 표시되며 문의와 함께 전송되지 않았습니다.
        </p>
        <dl className="mt-32 grid w-full max-w-560 grid-cols-[120px_minmax(0,1fr)] gap-x-16 gap-y-12 text-left text-body-s">
          <dt className="text-text-3">문의번호</dt>
          <dd className="break-words">{receipt.inquiryNumber}</dd>
          <dt className="text-text-3">문의유형</dt>
          <dd>{receipt.inquiryType}</dd>
          <dt className="text-text-3">상태</dt>
          <dd>접수 완료</dd>
        </dl>
        <ol
          aria-label="문의 진행 상태"
          className="mt-24 grid w-full max-w-560 grid-cols-2 gap-8 text-left sm:grid-cols-4"
        >
          {PROCESS_STEPS.map((step, index) => (
            <li
              key={step.title}
              className={cx(
                'rounded-8 border p-12',
                index === 0 ? 'border-text-1 bg-surface' : 'border-line text-text-3',
              )}
            >
              <p className="text-caption">{index === 0 ? '완료' : '예정'}</p>
              <p className="mt-4 text-label-s">{step.title}</p>
            </li>
          ))}
        </ol>
        <div className="mt-32 flex w-full max-w-560 flex-col gap-12 sm:flex-row">
          <Link
            href="/"
            className="inline-flex min-h-56 flex-1 items-center justify-center rounded-8 border border-line-control px-16 text-label-m focus-ring"
          >
            쇼핑 계속하기
          </Link>
          <Link
            href="/mypage/quotes"
            className="inline-flex min-h-56 flex-1 items-center justify-center rounded-8 border border-line-control px-16 text-label-m focus-ring"
          >
            문의 내역 보기
          </Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="pt-48 pb-64 max-[600px]:px-16 lg:pt-64 lg:pb-120">
      <div className="flex flex-col gap-48 lg:gap-64">
        <section aria-labelledby="solutions-title" className="flex flex-col gap-32 lg:gap-40">
          <div className="flex flex-col gap-12">
            <p className="text-overline tracking-[0.16em] text-text-3">Safety Solution</p>
            <h1 id="solutions-title" className="text-h1 lg:text-[36px] lg:leading-[48px]">
              현장을 위한 맞춤 안전 솔루션
            </h1>
            <p className="max-w-[720px] text-body-s text-text-2 lg:text-body-l">
              필요한 품목·수량·납기를 알려주시면 담당자가 맞춤 견적을 보내드립니다.
            </p>
          </div>

          <ol className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-24">
            {PROCESS_STEPS.map((processStep, index) => (
              <li
                key={processStep.title}
                className="flex min-h-132 flex-col rounded-12 border border-line bg-bg-subtle p-20 lg:p-24"
              >
                <p className="text-overline tracking-[0.16em] text-text-3">
                  Step {String(index + 1).padStart(2, '0')}
                </p>
                <h2 className="mt-8 text-h3">{processStep.title}</h2>
                <p className="mt-4 text-body-s text-text-2">{processStep.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="grid items-start gap-32 lg:grid-cols-[minmax(0,416px)_minmax(0,1fr)] lg:gap-24">
          <aside className="flex min-w-0 flex-col gap-24">
            <CustomItemsPanel />
            <div className="flex flex-col gap-12 rounded-12 border border-line bg-bg-subtle p-24">
              <p className="text-overline tracking-[0.16em] text-text-3">Contact</p>
              <div className="flex flex-col gap-4">
                <h2 className="text-label-l">견적 담당자</h2>
                <CompanyContactSummary variant="quote" />
              </div>
            </div>
          </aside>

          <QuoteFormVisual
            key={initialSelectionKey}
            initialSelections={initialSelections}
            onComplete={setReceipt}
          />
        </div>
      </div>
    </PageContainer>
  );
}

export function SolutionsPageContent() {
  return (
    <Suspense
      fallback={
        <PageContainer className="py-64">
          <p role="status" className="text-body-s text-text-3">
            견적 문의 화면을 불러오는 중입니다.
          </p>
        </PageContainer>
      }
    >
      <SolutionsPageContentInner />
    </Suspense>
  );
}
