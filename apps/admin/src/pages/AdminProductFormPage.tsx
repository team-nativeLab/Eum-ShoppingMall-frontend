import { Button, buttonClassName } from '@eum/ui/components/Button';
import { Modal } from '@eum/ui/components/Modal';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { Switch } from '@eum/ui/components/Switch';
import { SelectField, TextField } from '@eum/ui/components/TextField';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bold, ChevronLeft, ImagePlus, Italic, Link2, List, Underline } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router';
import {
  AdminError,
  AdminLoading,
  AdminEmpty,
  AdminPageHeader,
  AdminPanel,
} from '@/components/AdminUI';
import { useAdminPriceVisibilityPreview } from '@/lib/admin-price-visibility-preview';
import { getShopApi } from '@/lib/shop-api';
import type {
  AdminProduct,
  AdminBrand,
  Category,
  ProductImage,
  ProductOption,
} from '@eum/api/types';
import type { AdminProductInput } from '@eum/api/shop-api';

interface ProductEditorData {
  product: AdminProduct | null;
  categories: Category[];
  brands: AdminBrand[];
}

const productSections = [
  { id: 'basic-info', label: '기본 정보' },
  { id: 'category-info', label: '카테고리' },
  { id: 'price-info', label: '가격' },
  { id: 'option-info', label: '옵션' },
  { id: 'stock-info', label: '재고' },
  { id: 'image-info', label: '이미지' },
  { id: 'detail-info', label: '상세 정보' },
] as const;

type ProductSectionId = (typeof productSections)[number]['id'];
type VisibleSalesState = 'active' | 'soldOut' | 'paused';

/** 등록·수정 폼에 필요한 API 조회를 병렬로 요청합니다. */
async function loadProductEditor(
  productId: string | undefined,
  signal: AbortSignal,
): Promise<ProductEditorData> {
  const api = await getShopApi();
  const [categories, brands, adminProducts] = await Promise.all([
    api.categories.adminList({ signal }),
    api.brands.adminList({ signal }),
    productId && productId !== 'new' ? api.products.adminList({ signal }) : Promise.resolve([]),
  ]);
  const product = productId
    ? (adminProducts.find((entry) => entry.id === productId) ?? null)
    : null;
  return { product, categories, brands };
}

function createStableId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function getVisibleSalesState(product: AdminProduct | null): VisibleSalesState {
  if (product?.salesStatus === 'paused' || product?.salesStatus === 'ended') return 'paused';
  return product?.stockStatus === 'soldOut' ? 'soldOut' : 'active';
}

/** 선택한 이미지 파일을 목 API에서 사용할 수 있는 데이터 URL로 바꿉니다. */
function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('이미지를 읽지 못했습니다.'));
    });
    reader.addEventListener('error', () => reject(new Error('이미지를 읽지 못했습니다.')));
    reader.readAsDataURL(file);
  });
}

/** 상품 기본정보·옵션·SKU·이미지를 목 API에 저장합니다. */
function ProductEditor({
  product,
  categories,
  brands,
  isNew,
}: {
  product: AdminProduct | null;
  categories: Category[];
  brands: AdminBrand[];
  isNew: boolean;
}) {
  const currentCategory = categories.find((category) => category.id === product?.categoryId);
  const parentCategory = currentCategory?.parentId
    ? categories.find((category) => category.id === currentCategory.parentId)
    : undefined;
  const rootOptions = categories.filter((category) => category.parentId === null);
  const initialRootId = parentCategory?.id ?? currentCategory?.id ?? '';
  const [rootCategoryId, setRootCategoryId] = useState(initialRootId);
  const [leafCategoryId, setLeafCategoryId] = useState(product?.categoryId ?? '');
  const [salesState, setSalesState] = useState<VisibleSalesState>(() =>
    getVisibleSalesState(product),
  );
  const [stockStatus, setStockStatus] = useState(product?.stockStatus ?? 'inStock');
  const [salesStatus, setSalesStatus] = useState(product?.salesStatus ?? 'active');
  const [autoSoldOut, setAutoSoldOut] = useState(product?.autoSoldOut ?? true);
  const [isVisible, setIsVisible] = useState(product?.isVisible ?? true);
  const [productName, setProductName] = useState(product?.name ?? '');
  const [options, setOptions] = useState<ProductOption[]>(() =>
    structuredClone(product?.options ?? []),
  );
  const [images, setImages] = useState<ProductImage[]>(() =>
    structuredClone(product?.images ?? []),
  );
  const [demoMessage, setDemoMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const shouldBlockNavigation = useRef(false);
  const [isReadingImages, setIsReadingImages] = useState(false);
  const [imageMessage, setImageMessage] = useState('');
  const [activeSection, setActiveSection] = useState<ProductSectionId>('basic-info');
  const [productCode] = useState(() => product?.productCode ?? createStableId('PRD').toUpperCase());
  const [salePrice, setSalePrice] = useState(String(product?.price ?? ''));
  const [listPrice, setListPrice] = useState(String(product?.listPrice ?? ''));
  const [detailDescription, setDetailDescription] = useState(product?.detailDescription ?? '');
  const [isRichDescription, setIsRichDescription] = useState(
    () => product?.detailDescriptionFormat === 'rich-v1',
  );
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const imageFingerprints = useRef(new Map<string, string>());
  const [isNewProductPriceVisible, setNewProductPriceVisible] = useState(true);
  const { getPreviewValue, setPreviewValue } = useAdminPriceVisibilityPreview();
  const previewPriceVisible = product ? getPreviewValue(product) : isNewProductPriceVisible;
  const webBaseUrl = import.meta.env.VITE_WEB_BASE_URL?.trim().replace(/\/+$/, '');
  const buyerPreviewHref =
    product && webBaseUrl ? `${webBaseUrl}/products/${encodeURIComponent(product.id)}` : null;
  const hasSkuInventory = Boolean(product?.skus?.length);
  const skuStockCount = product?.skus?.reduce((total, sku) => total + sku.stockCount, 0);
  const leafOptions = categories.filter((category) => category.parentId === rootCategoryId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const blocker = useBlocker(() => shouldBlockNavigation.current);

  const handleContinueEditing = () => {
    if (blocker.state === 'blocked') blocker.reset();
  };
  const handleLeaveEditor = () => {
    if (blocker.state === 'blocked') blocker.proceed();
  };

  const markDirty = () => {
    shouldBlockNavigation.current = true;
    setIsDirty(true);
  };

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        const visibleSections = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);
        const visibleSection = visibleSections[0]?.target.id;
        if (productSections.some((section) => section.id === visibleSection)) {
          setActiveSection(visibleSection as ProductSectionId);
        }
      },
      { rootMargin: '-12% 0px -72% 0px', threshold: 0 },
    );
    productSections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) sectionObserver.observe(element);
    });
    return () => sectionObserver.disconnect();
  }, []);

  const handleVisibleSalesStateChange = (nextState: VisibleSalesState) => {
    markDirty();
    setSalesState(nextState);
    setStockStatus(nextState === 'soldOut' ? 'soldOut' : 'inStock');
    setSalesStatus(nextState === 'paused' ? 'paused' : 'active');
  };

  const handleFormatDescription = (prefix: string, suffix = prefix) => {
    markDirty();
    setIsRichDescription(true);
    const textarea = descriptionRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = detailDescription.slice(start, end);
    const replacement = `${prefix}${selectedText || '텍스트'}${suffix}`;
    const nextValue = `${detailDescription.slice(0, start)}${replacement}${detailDescription.slice(end)}`;
    setDetailDescription(nextValue);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + replacement.length - suffix.length);
    });
  };

  const handleImageFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;
    const fingerprints = files.map(
      (file) => `${file.name}:${file.size}:${file.type}:${file.lastModified}`,
    );
    if (
      new Set(fingerprints).size !== fingerprints.length ||
      fingerprints.some((fingerprint) => imageFingerprints.current.has(fingerprint))
    ) {
      setImageMessage('이미 선택한 이미지가 포함되어 있습니다. 중복 이미지를 제외해 주세요.');
      return;
    }
    if (images.length + files.length > 10) {
      setImageMessage('이미지는 최대 10장까지 등록할 수 있습니다.');
      return;
    }
    if (files.some((file) => !['image/jpeg', 'image/png'].includes(file.type))) {
      setImageMessage('JPG 또는 PNG 이미지 파일만 등록할 수 있습니다.');
      return;
    }
    if (files.some((file) => file.size > 10 * 1024 * 1024)) {
      setImageMessage('이미지 파일은 파일당 10MB 이하로 등록해 주세요.');
      return;
    }
    setIsReadingImages(true);
    setImageMessage('');
    try {
      const loadedImages = await Promise.all(
        files.map(async (file, index) => ({
          id: createStableId('img'),
          url: await readImageFile(file),
          alt: file.name.replace(/\.[^.]+$/, ''),
          fingerprint: fingerprints[index],
        })),
      );
      loadedImages.forEach(({ id, fingerprint }) => {
        if (fingerprint) imageFingerprints.current.set(fingerprint, id);
      });
      setImages((current) => [
        ...current,
        ...loadedImages.map(({ fingerprint: _fingerprint, ...image }) => image),
      ]);
      markDirty();
    } catch (error) {
      setImageMessage(error instanceof Error ? error.message : '이미지를 읽지 못했습니다.');
    } finally {
      setIsReadingImages(false);
    }
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const text = (key: string) => String(formData.get(key) ?? '').trim();
    const rawPrice = text('price');
    const rawListPrice = text('listPrice');
    const rawStockCount = text('stockCount');
    const rawShippingFee = text('shippingFee');
    const price = Number(rawPrice);
    const stockCount = Number(rawStockCount);
    const shippingFee = Number(rawShippingFee);
    const normalizedListPrice = rawListPrice ? Number(rawListPrice) : null;
    if (!text('name') || !text('brand') || !leafCategoryId) {
      setDemoMessage('상품명, 브랜드와 2차 카테고리를 입력해 주세요.');
      return;
    }
    if (rawPrice === '' || !Number.isFinite(price) || price < 0) {
      setDemoMessage('판매가를 0 이상의 숫자로 입력해 주세요.');
      return;
    }
    if (
      (rawListPrice !== '' &&
        (!Number.isFinite(normalizedListPrice) || (normalizedListPrice ?? -1) < 0)) ||
      (!hasSkuInventory &&
        (rawStockCount === '' || !Number.isInteger(stockCount) || stockCount < 0)) ||
      rawShippingFee === '' ||
      !Number.isInteger(shippingFee) ||
      shippingFee < 0
    ) {
      setDemoMessage('정가, 재고 수량과 배송비를 0 이상의 숫자로 입력해 주세요.');
      return;
    }
    if (isSaving) return;
    const specificationRows: [string, string][] = [
      ['제조사', text('manufacturer')],
      ['재질', text('material')],
      ['크기', text('dimensions')],
      ['중량', text('weight')],
      ['원산지', text('countryOfOrigin')],
    ];
    const nextProduct: AdminProductInput = {
      ...(product ?? {
        name: '',
        brand: '',
        categoryId: leafCategoryId,
        price,
        listPrice: null,
        priceVisible: true,
        stockStatus,
        thumbnailUrl: null,
        summary: '',
        modelName: null,
        images: [],
        options: [],
        specifications: [],
        certifications: [],
        shipping: { method: '', estimate: '', fee: 0, countryOfOrigin: '', policy: '' },
        purchaseNotices: [],
        rating: null,
        reviewCount: 0,
        isFeatured: false,
      }),
      ...(product ? { id: product.id } : {}),
      name: text('name'),
      brand: text('brand'),
      categoryId: leafCategoryId,
      price,
      listPrice: normalizedListPrice,
      priceVisible: previewPriceVisible,
      stockStatus,
      stockCount: hasSkuInventory ? (skuStockCount ?? 0) : stockCount,
      autoSoldOut,
      salesStatus,
      isVisible,
      productCode: text('productCode') || productCode,
      modelName: text('modelName') || null,
      summary: text('summary'),
      certifications: text('certifications')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
      shipping: {
        ...(product?.shipping ?? {
          method: '',
          estimate: '',
          fee: 0,
          countryOfOrigin: '',
          policy: '',
        }),
        estimate: text('shippingEstimate'),
        fee: shippingFee,
        countryOfOrigin: text('countryOfOrigin'),
      },
      detailDescription,
      detailDescriptionFormat: isRichDescription ? 'rich-v1' : 'plain',
      specifications: specificationRows
        .filter((specification) => specification[1].length > 0)
        .map(([label, value]) => ({ label, value })),
      options,
      images,
      thumbnailUrl: images[0]?.url ?? null,
    };
    setDemoMessage('');
    setIsSaving(true);
    try {
      const api = await getShopApi();
      const savedProduct = await api.products.saveAdmin(nextProduct);
      shouldBlockNavigation.current = false;
      setIsDirty(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'product-editor'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['home', 'content'] }),
      ]);
      setDemoMessage('프론트엔드 목 API에 저장했습니다. 실제 서버 데이터는 변경되지 않았습니다.');
      if (!product) navigate(`/products/${savedProduct.id}`, { replace: true });
    } catch (saveError) {
      setDemoMessage(
        saveError instanceof Error ? saveError.message : '상품을 저장하지 못했습니다.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} onChangeCapture={markDirty}>
      <AdminPageHeader
        title={isNew ? '상품 등록' : '상품 수정'}
        leading={
          <Link
            to="/products"
            aria-label="상품 목록으로 돌아가기"
            className="flex size-32 shrink-0 items-center justify-center rounded-8 border border-line-strong focus-ring"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </Link>
        }
        titleAdornment={
          <span className="rounded-4 bg-surface-2 px-6 py-2 text-label-xs text-text-2">
            작성 중
          </span>
        }
        action={
          <>
            <Link to="/products" className={buttonClassName({ variant: 'secondary' })}>
              취소
            </Link>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? '저장 중…' : '저장'}
            </Button>
          </>
        }
      />
      {demoMessage ? (
        <NoticeInline role="status" tone="warning" className="mb-16">
          {demoMessage}
        </NoticeInline>
      ) : null}
      <nav
        aria-label="상품 정보 섹션"
        className="mb-20 flex h-48 items-center overflow-x-auto border-b border-line text-body-s"
      >
        {productSections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            aria-current={activeSection === section.id ? 'location' : undefined}
            onClick={() => {
              setActiveSection(section.id);
            }}
            className={`inline-flex h-full shrink-0 items-center border-b-2 px-16 focus-ring ${activeSection === section.id ? 'border-text-1 text-text-1' : 'border-transparent text-text-2 hover:text-text-1'}`}
          >
            {section.label}
          </a>
        ))}
      </nav>

      <div className="grid grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] items-start gap-16">
        <div className="flex min-w-0 flex-col gap-16">
          <AdminPanel
            id="basic-info"
            title="기본 정보"
            className="scroll-mt-24"
            bodyClassName="grid grid-cols-2 gap-16 p-24"
          >
            <TextField
              label="상품명"
              name="name"
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
              required
              className="col-span-2"
              placeholder="상품명을 입력해 주세요"
            />
            <SelectField
              label="브랜드"
              name="brand"
              defaultValue={product?.brand ?? ''}
              options={brands.map((brand) => ({ value: brand.name, label: brand.name }))}
              placeholder="브랜드를 선택해 주세요"
              required
            />
            <TextField
              label="모델명"
              name="modelName"
              defaultValue={product?.modelName ?? ''}
              placeholder="모델명을 입력해 주세요"
            />
            <TextField
              label="상품 코드"
              name="productCode"
              defaultValue={productCode}
              helperText={
                product
                  ? '상품 코드를 직접 수정할 수 있습니다.'
                  : '자동 생성된 코드이며 직접 수정할 수 있습니다.'
              }
            />
            <TextField
              label="짧은 설명"
              name="summary"
              defaultValue={product?.summary ?? ''}
              placeholder="상품의 주요 특징을 입력해 주세요"
            />
          </AdminPanel>

          <AdminPanel
            id="category-info"
            title="카테고리"
            className="scroll-mt-24"
            bodyClassName="grid grid-cols-2 gap-16 p-24"
          >
            <SelectField
              label="1차 카테고리"
              value={rootCategoryId}
              onChange={(event) => {
                setRootCategoryId(event.target.value);
                setLeafCategoryId('');
              }}
              options={rootOptions.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
              placeholder="카테고리를 선택해 주세요"
            />
            <SelectField
              label="2차 카테고리"
              name="categoryId"
              value={leafCategoryId}
              onChange={(event) => setLeafCategoryId(event.target.value)}
              options={(leafOptions.length
                ? leafOptions
                : rootOptions.filter((category) => category.id === rootCategoryId)
              ).map((category) => ({ value: category.id, label: category.name }))}
              placeholder="카테고리를 선택해 주세요"
            />
          </AdminPanel>

          <AdminPanel
            id="price-info"
            title="가격"
            description="판매가와 금액 표시 상태를 함께 확인합니다."
            className="scroll-mt-24"
            bodyClassName="p-24"
          >
            <div className="space-y-16">
              <div
                role="group"
                aria-label="판매가 및 금액 표시"
                className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-16 rounded-8 border border-line bg-surface p-16"
              >
                <TextField
                  label="판매가"
                  name="price"
                  type="number"
                  min="0"
                  value={salePrice}
                  onChange={(event) => setSalePrice(event.target.value)}
                  placeholder="판매가를 입력해 주세요"
                  helperText={
                    product?.price === null
                      ? '실제 금액 미제공: API 응답에 판매가가 포함되지 않았습니다.'
                      : undefined
                  }
                />
                <Switch
                  label="금액 표시"
                  isChecked={previewPriceVisible}
                  onCheckedChange={(nextValue) => {
                    markDirty();
                    if (product) {
                      setPreviewValue([product], nextValue);
                    } else {
                      setNewProductPriceVisible(nextValue);
                    }
                  }}
                  onText="표시"
                  offText="미표시"
                />
              </div>
              <div className="max-w-400 border-t border-line pt-12">
                <p className="mb-8 text-caption text-text-3">정가</p>
                <TextField
                  label="정가"
                  isLabelHidden
                  name="listPrice"
                  type="number"
                  min="0"
                  value={listPrice}
                  onChange={(event) => setListPrice(event.target.value)}
                  placeholder="정가를 입력해 주세요"
                  helperText={
                    product?.listPrice === null
                      ? '실제 금액 미제공: API 응답에 정가가 포함되지 않았습니다.'
                      : undefined
                  }
                />
              </div>
              <p className="text-caption text-text-3">
                금액 표시를 끄면 구매자 화면에서 가격이 숨겨집니다.
              </p>
              <NoticeInline tone="warning">
                금액을 미표시로 바꾸면 사용자 화면에 ‘구매 불가’로 표시되고, 장바구니에서는 ‘주문할
                수 없는 상품’으로 분류됩니다. 가격 값은 유지됩니다.
              </NoticeInline>
            </div>
          </AdminPanel>

          <AdminPanel
            title="옵션"
            id="option-info"
            className="scroll-mt-24"
            description="상품을 구매할 때 선택하는 옵션을 등록합니다."
            action={
              <Button
                variant="secondary"
                size="s"
                onClick={() => {
                  markDirty();
                  const optionId = `option-${Date.now()}`;
                  setOptions((current) => [
                    ...current,
                    { id: optionId, label: '', required: false, choices: [] },
                  ]);
                }}
              >
                옵션 목록 만들기
              </Button>
            }
            bodyClassName="space-y-12 p-24"
          >
            {options.map((option) => (
              <div
                key={option.id}
                className="grid grid-cols-[1fr_2fr_auto] gap-12 rounded-8 border border-line p-12"
              >
                <TextField
                  label="옵션명"
                  value={option.label}
                  onChange={(event) =>
                    setOptions((current) =>
                      current.map((entry) =>
                        entry.id === option.id ? { ...entry, label: event.target.value } : entry,
                      ),
                    )
                  }
                />
                <TextField
                  label="선택지 (쉼표 구분)"
                  value={option.choices.map((choice) => choice.label).join(', ')}
                  onChange={(event) => {
                    const labels = event.target.value
                      .split(',')
                      .map((label) => label.trim())
                      .filter(Boolean);
                    setOptions((current) =>
                      current.map((entry) =>
                        entry.id === option.id
                          ? {
                              ...entry,
                              choices: labels.map((label, index) => ({
                                id: entry.choices[index]?.id ?? `${entry.id}-choice-${index + 1}`,
                                label,
                                priceDelta: entry.choices[index]?.priceDelta ?? 0,
                              })),
                            }
                          : entry,
                      ),
                    );
                  }}
                />
                <button
                  type="button"
                  className="text-label-s text-danger"
                  onClick={() => {
                    markDirty();
                    setOptions((current) => current.filter((entry) => entry.id !== option.id));
                  }}
                >
                  옵션 삭제
                </button>
                <label className="col-span-3 flex items-center gap-8 text-body-s">
                  <input
                    type="checkbox"
                    checked={option.required}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((entry) =>
                          entry.id === option.id
                            ? { ...entry, required: event.target.checked }
                            : entry,
                        ),
                      )
                    }
                  />
                  필수 옵션
                </label>
              </div>
            ))}
            {options.length === 0 ? (
              <p className="text-body-s text-text-3">등록된 옵션이 없습니다.</p>
            ) : null}
          </AdminPanel>

          <AdminPanel
            id="stock-info"
            title="재고"
            className="scroll-mt-24"
            bodyClassName="space-y-16 p-24"
          >
            <TextField
              label="재고 수량"
              name="stockCount"
              type="number"
              min="0"
              defaultValue={skuStockCount ?? product?.stockCount ?? 0}
              step="1"
              readOnly={hasSkuInventory}
              helperText={
                hasSkuInventory
                  ? 'SKU 재고 수량의 합계입니다.'
                  : '상품 전체 재고 수량을 입력합니다.'
              }
            />
            <label className="flex items-start gap-8 text-body-s">
              <input
                type="checkbox"
                checked={autoSoldOut}
                onChange={(event) => setAutoSoldOut(event.target.checked)}
                className="mt-2 size-16 accent-text-1"
              />
              <span>재고 0 옵션은 품절, 모든 옵션 품절 시 상품 전체 품절</span>
            </label>
          </AdminPanel>

          <AdminPanel
            id="image-info"
            title="이미지"
            description="첫 번째 이미지가 대표 이미지입니다. JPG, PNG · 파일당 10MB 이하 · 최대 10장"
            className="scroll-mt-24"
            bodyClassName="p-24"
          >
            <div className="mb-12 flex items-center justify-between text-body-s text-text-2">
              <span>이미지를 드래그하거나 이동 버튼으로 순서를 바꿀 수 있습니다.</span>
              <span>{images.length}/10</span>
            </div>
            <div className="grid grid-cols-5 gap-8">
              {images.map((image, index) => (
                <div
                  key={image.id}
                  role="group"
                  aria-label={`상품 이미지 ${index + 1}`}
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData('text/plain', String(index))}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    markDirty();
                    const fromIndex = Number(event.dataTransfer.getData('text/plain'));
                    setImages((current) => {
                      const reordered = [...current];
                      const [movedImage] = reordered.splice(fromIndex, 1);
                      if (movedImage) reordered.splice(index, 0, movedImage);
                      return reordered;
                    });
                  }}
                  className="relative flex size-120 cursor-grab items-center justify-center overflow-hidden rounded-8 border border-line bg-surface active:cursor-grabbing"
                >
                  <img src={image.url} alt={image.alt} className="size-full object-cover" />
                  {index === 0 ? (
                    <span className="absolute top-4 left-4 rounded-4 bg-text-1 px-6 py-2 text-caption text-bg">
                      대표
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-label={`이미지 ${index + 1} 위로 이동`}
                    disabled={index === 0}
                    className="absolute bottom-4 left-4 rounded-4 bg-bg px-6 py-2 text-label-s disabled:opacity-40"
                    onClick={() => {
                      markDirty();
                      setImages((current) => {
                        if (index < 1 || index >= current.length) return current;
                        const reordered = [...current];
                        const [movedImage] = reordered.splice(index, 1);
                        if (movedImage) reordered.splice(index - 1, 0, movedImage);
                        return reordered;
                      });
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`이미지 ${index + 1} 아래로 이동`}
                    disabled={index === images.length - 1}
                    className="absolute bottom-4 left-32 rounded-4 bg-bg px-6 py-2 text-label-s disabled:opacity-40"
                    onClick={() => {
                      markDirty();
                      setImages((current) => {
                        if (index < 0 || index >= current.length - 1) return current;
                        const reordered = [...current];
                        const [movedImage] = reordered.splice(index, 1);
                        if (movedImage) reordered.splice(index + 1, 0, movedImage);
                        return reordered;
                      });
                    }}
                  >
                    ↓
                  </button>
                  {index > 0 ? (
                    <button
                      type="button"
                      aria-label={`이미지 ${index + 1}을 대표 이미지로 설정`}
                      className="absolute bottom-4 left-60 rounded-4 bg-bg px-6 py-2 text-label-s"
                      onClick={() => {
                        markDirty();
                        setImages((current) => {
                          if (index < 1 || index >= current.length) return current;
                          const reordered = [...current];
                          const [representative] = reordered.splice(index, 1);
                          if (representative) reordered.unshift(representative);
                          return reordered;
                        });
                      }}
                    >
                      대표
                    </button>
                  ) : null}
                  <button
                    type="button"
                    aria-label={`이미지 ${index + 1} 삭제`}
                    className="absolute top-4 right-4 rounded-4 bg-bg px-6 py-2 text-label-s text-danger"
                    onClick={() => {
                      markDirty();
                      for (const [fingerprint, imageId] of imageFingerprints.current) {
                        if (imageId === image.id) imageFingerprints.current.delete(fingerprint);
                      }
                      setImages((current) => current.filter((entry) => entry.id !== image.id));
                    }}
                  >
                    삭제
                  </button>
                </div>
              ))}
              {Array.from(
                { length: images.length < 10 ? Math.max(5 - images.length, 1) : 0 },
                (_, slotIndex) => (
                  <label
                    key={`upload-image-${slotIndex}`}
                    aria-label={`이미지 추가 슬롯 ${slotIndex + 1}`}
                    className="flex size-120 cursor-pointer flex-col items-center justify-center gap-8 rounded-8 border border-dashed border-line-control bg-surface text-body-s text-text-2 focus-within:ring-2 focus-within:ring-text-1"
                  >
                    <ImagePlus size={24} aria-hidden="true" />
                    <span>{isReadingImages ? '불러오는 중' : '이미지 추가'}</span>
                    <span className="text-caption">{images.length}/10</span>
                    <input
                      type="file"
                      aria-label={`이미지 슬롯 ${slotIndex + 1} 파일 선택`}
                      accept="image/jpeg,image/png"
                      multiple
                      className="sr-only"
                      disabled={isReadingImages}
                      onChange={handleImageFiles}
                    />
                  </label>
                ),
              )}
            </div>
            {imageMessage ? (
              <p role="alert" className="mt-12 text-body-s text-danger">
                {imageMessage}
              </p>
            ) : null}
          </AdminPanel>

          <AdminPanel
            id="detail-info"
            title="상세 정보 · 고시"
            className="scroll-mt-24"
            bodyClassName="grid grid-cols-2 gap-16 p-24"
          >
            <TextField
              label="제조사"
              name="manufacturer"
              defaultValue={product?.manufacturer ?? ''}
              placeholder="제조사를 입력해 주세요"
            />
            <TextField
              label="재질"
              name="material"
              defaultValue={product?.material ?? ''}
              placeholder="재질을 입력해 주세요"
            />
            <TextField
              label="크기"
              name="dimensions"
              defaultValue={product?.dimensions ?? ''}
              placeholder="크기를 입력해 주세요"
            />
            <TextField
              label="중량"
              name="weight"
              defaultValue={product?.weight ?? ''}
              placeholder="중량을 입력해 주세요"
            />
            <TextField
              label="인증번호"
              name="certifications"
              defaultValue={product?.certifications.join(', ') ?? ''}
              placeholder="인증 정보를 입력해 주세요"
            />
            <TextField
              label="원산지"
              name="countryOfOrigin"
              defaultValue={product?.shipping.countryOfOrigin ?? ''}
              placeholder="원산지를 입력해 주세요"
            />
            <TextField
              label="배송 예정"
              name="shippingEstimate"
              defaultValue={product?.shipping.estimate ?? ''}
              placeholder="배송 일정을 입력해 주세요"
            />
            <TextField
              label="배송비"
              name="shippingFee"
              type="number"
              min="0"
              step="1"
              defaultValue={product?.shipping.fee ?? 0}
              placeholder="배송비를 입력해 주세요"
            />
            <div className="col-span-2 overflow-hidden rounded-8 border border-line-control">
              <div
                role="toolbar"
                aria-label="상세 설명 서식"
                className="flex h-44 items-center gap-4 border-b border-line bg-surface px-8"
              >
                <button
                  type="button"
                  aria-label="굵게"
                  className="rounded-4 p-8 focus-ring hover:bg-bg"
                  onClick={() => handleFormatDescription('**')}
                >
                  <Bold size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="기울임"
                  className="rounded-4 p-8 focus-ring hover:bg-bg"
                  onClick={() => handleFormatDescription('*')}
                >
                  <Italic size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="밑줄"
                  className="rounded-4 p-8 focus-ring hover:bg-bg"
                  onClick={() => handleFormatDescription('++')}
                >
                  <Underline size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="목록"
                  className="rounded-4 p-8 focus-ring hover:bg-bg"
                  onClick={() => handleFormatDescription('\n- ', '')}
                >
                  <List size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="링크"
                  className="rounded-4 p-8 focus-ring hover:bg-bg"
                  onClick={() => handleFormatDescription('[', '](https://)')}
                >
                  <Link2 size={16} aria-hidden="true" />
                </button>
              </div>
              <label className="sr-only" htmlFor="product-detail-description">
                상세 설명
              </label>
              <textarea
                id="product-detail-description"
                ref={descriptionRef}
                name="description"
                rows={8}
                value={detailDescription}
                onChange={(event) => setDetailDescription(event.target.value)}
                placeholder="상품의 상세 설명을 입력해 주세요"
                className="w-full resize-y bg-bg p-16 text-body-m outline-none focus-visible:ring-2 focus-visible:ring-text-1"
              />
            </div>
          </AdminPanel>
        </div>

        <aside className="sticky top-16 flex min-w-0 flex-col gap-16">
          <AdminPanel title="게시 설정" bodyClassName="space-y-16 p-24">
            <fieldset>
              <legend className="text-label-m">판매 상태</legend>
              <div className="mt-8 flex flex-col gap-12">
                {(
                  [
                    ['active', '판매 중'],
                    ['soldOut', '품절'],
                    ['paused', '판매 중단'],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-8 text-body-s">
                    <input
                      type="radio"
                      name="visible-sales-state"
                      value={value}
                      checked={salesState === value}
                      onChange={() => handleVisibleSalesStateChange(value)}
                      className="size-16 accent-text-1"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="border-t border-line pt-16">
              <Switch
                label="쇼핑몰 노출"
                isChecked={isVisible}
                onCheckedChange={(nextValue) => {
                  markDirty();
                  setIsVisible(nextValue);
                }}
                onText="노출"
                offText="미노출"
              />
              <p className="mt-4 text-body-s text-text-3">
                노출을 끄면 구매자 화면에서 상품이 보이지 않습니다.
              </p>
            </div>
            <div className="border-t border-line pt-16">
              <p className="text-label-m">금액 표시 · {previewPriceVisible ? '표시' : '미표시'}</p>
              <p className="mt-4 text-body-s text-text-3">
                {previewPriceVisible
                  ? '구매자 화면에 상품 금액을 표시합니다.'
                  : '구매자 화면에서 상품 금액을 숨깁니다.'}
              </p>
              <a
                href="#price-info"
                className="mt-8 inline-flex text-label-s text-text-2 underline"
                onClick={() => setActiveSection('price-info')}
              >
                가격에서 변경
              </a>
            </div>
            <div className="border-t border-line pt-16">
              {buyerPreviewHref ? (
                <a
                  href={buyerPreviewHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex text-label-m text-text-1 underline focus-ring"
                >
                  사용자 화면 미리보기 ↗
                </a>
              ) : (
                <span className="text-body-s text-text-3">
                  저장 후 사용자 화면을 미리볼 수 있습니다.
                </span>
              )}
            </div>
          </AdminPanel>
        </aside>
      </div>
      <Modal
        isOpen={blocker.state === 'blocked'}
        onClose={handleContinueEditing}
        title="작성 중인 내용을 버리고 나갈까요?"
        actions={
          <>
            <Button type="button" variant="secondary" onClick={handleContinueEditing}>
              계속 작성
            </Button>
            <Button type="button" onClick={handleLeaveEditor}>
              나가기
            </Button>
          </>
        }
      >
        <NoticeInline tone="info" className="mt-16">
          저장하지 않고 나가면 상품 등록 화면을 닫습니다.
        </NoticeInline>
      </Modal>
    </form>
  );
}

/** 신규·수정 라우트에 따라 API 데이터를 읽고 같은 폼 구조를 제공합니다. */
export function AdminProductFormPage() {
  const { productId } = useParams();
  const isNew = !productId || productId === 'new';
  const editorQuery = useQuery({
    queryKey: ['admin', 'product-editor', productId ?? 'new'],
    queryFn: ({ signal }) => loadProductEditor(productId, signal),
  });

  if (editorQuery.isPending) return <AdminLoading label="상품 정보를 불러오고 있습니다." />;
  if (editorQuery.isError)
    return (
      <AdminError
        title="상품 정보를 불러오지 못했습니다"
        onRetry={() => void editorQuery.refetch()}
      />
    );

  const { product, categories, brands } = editorQuery.data;
  if (!isNew && !product)
    return (
      <AdminEmpty title="상품을 찾을 수 없습니다" description="상품 목록에서 다시 선택해 주세요." />
    );
  return (
    <ProductEditor
      key={productId ?? 'new'}
      product={product}
      categories={categories}
      brands={brands}
      isNew={isNew}
    />
  );
}
