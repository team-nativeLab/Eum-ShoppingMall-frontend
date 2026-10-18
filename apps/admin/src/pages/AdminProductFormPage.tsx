import { Button, buttonClassName } from '@eum/ui/components/Button';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { Switch } from '@eum/ui/components/Switch';
import { SelectField, TextField } from '@eum/ui/components/TextField';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  AdminError,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  AdminStatusBadge,
} from '@/components/AdminUI';
import { useAdminPriceVisibilityPreview } from '@/lib/admin-price-visibility-preview';
import { getShopApi } from '@/lib/shop-api';
import type {
  AdminProduct,
  AdminProductSku,
  Category,
  ProductImage,
  ProductOption,
} from '@eum/api/types';
import type { AdminProductInput } from '@eum/api/shop-api';

interface ProductEditorData {
  product: AdminProduct | null;
  categories: Category[];
}

/** 등록·수정 폼에 필요한 API 조회를 병렬로 요청합니다. */
async function loadProductEditor(
  productId: string | undefined,
  signal: AbortSignal,
): Promise<ProductEditorData> {
  const api = await getShopApi();
  const [categories, adminProducts] = await Promise.all([
    api.categories.adminList({ signal }),
    productId && productId !== 'new' ? api.products.adminList({ signal }) : Promise.resolve([]),
  ]);
  const product = productId
    ? (adminProducts.find((entry) => entry.id === productId) ?? null)
    : null;
  return { product, categories };
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
  isNew,
}: {
  product: AdminProduct | null;
  categories: Category[];
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
  const [stockStatus, setStockStatus] = useState(product?.stockStatus ?? 'inStock');
  const [salesStatus, setSalesStatus] = useState(product?.salesStatus ?? 'active');
  const [isVisible, setIsVisible] = useState(product?.isVisible ?? true);
  const [options, setOptions] = useState<ProductOption[]>(() =>
    structuredClone(product?.options ?? []),
  );
  const [skuRows, setSkuRows] = useState<AdminProductSku[]>(() =>
    structuredClone(product?.skus ?? []),
  );
  const [images, setImages] = useState<ProductImage[]>(() =>
    structuredClone(product?.images ?? []),
  );
  const [demoMessage, setDemoMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isNewProductPriceVisible, setNewProductPriceVisible] = useState(true);
  const { getPreviewValue, setPreviewValue } = useAdminPriceVisibilityPreview();
  const previewPriceVisible = product ? getPreviewValue(product) : isNewProductPriceVisible;
  const leafOptions = categories.filter((category) => category.parentId === rootCategoryId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const text = (key: string) => String(formData.get(key) ?? '').trim();
    const price = Number(formData.get('price'));
    if (
      !text('name') ||
      !text('brand') ||
      !Number.isFinite(price) ||
      price < 0 ||
      !leafCategoryId
    ) {
      setDemoMessage('상품명, 브랜드, 카테고리와 판매가를 확인해 주세요.');
      return;
    }
    if (isSaving) return;
    const parseNumber = (key: string, fallback: number) => {
      const value = Number(formData.get(key));
      return Number.isFinite(value) ? value : fallback;
    };
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
      listPrice: text('listPrice') ? parseNumber('listPrice', price) : null,
      priceVisible: previewPriceVisible,
      stockStatus,
      stockCount: parseNumber('stockCount', product?.stockCount ?? 0),
      salesStatus,
      isVisible,
      productCode: text('productCode') || product?.productCode || '',
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
        fee: parseNumber('shippingFee', product?.shipping.fee ?? 0),
        countryOfOrigin: text('countryOfOrigin'),
        policy: text('shippingPolicy'),
      },
      detailDescription: text('description'),
      specifications: specificationRows
        .filter((specification) => specification[1].length > 0)
        .map(([label, value]) => ({ label, value })),
      options,
      skus: skuRows,
      images,
      thumbnailUrl: images[0]?.url ?? null,
    };
    setDemoMessage('');
    setIsSaving(true);
    try {
      const api = await getShopApi();
      const savedProduct = await api.products.saveAdmin(nextProduct);
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
    <form onSubmit={handleSave}>
      <AdminPageHeader
        title={isNew ? '상품 등록' : '상품 수정'}
        action={
          <>
            <Link to="/products" className={buttonClassName({ variant: 'secondary' })}>
              목록
            </Link>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? '저장 중…' : '저장'}
            </Button>
          </>
        }
      />
      <div className="mb-16">
        {demoMessage ? (
          <NoticeInline role="status" tone="warning" className="mt-8">
            {demoMessage}
          </NoticeInline>
        ) : null}
      </div>
      <nav
        aria-label="상품 정보 섹션"
        className="mb-16 flex h-44 items-center gap-20 overflow-x-auto border-b border-line text-body-s text-text-2"
      >
        {[
          ['#basic-info', '기본 정보'],
          ['#category-info', '카테고리'],
          ['#price-info', '가격'],
          ['#option-info', '옵션'],
          ['#stock-info', '재고'],
          ['#image-info', '이미지'],
          ['#detail-info', '상세 정보'],
        ].map(([href, label]) => (
          <a key={href} href={href} className="shrink-0 hover:text-text-1">
            {label}
          </a>
        ))}
      </nav>

      <div className="grid grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] items-start gap-16">
        <div className="flex min-w-0 flex-col gap-16">
          <AdminPanel
            id="basic-info"
            title="기본 정보"
            className="scroll-mt-24"
            bodyClassName="grid grid-cols-2 gap-16 p-20"
          >
            <TextField
              label="상품명"
              name="name"
              defaultValue={product?.name ?? ''}
              required
              className="col-span-2"
              placeholder="상품명을 입력해 주세요"
            />
            <TextField
              label="브랜드"
              name="brand"
              defaultValue={product?.brand ?? ''}
              placeholder="브랜드를 입력해 주세요"
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
              defaultValue={product?.id ?? ''}
              readOnly
              helperText={
                product
                  ? '등록된 상품 코드는 변경할 수 없습니다.'
                  : '코드는 상품이 저장될 때 발급됩니다.'
              }
            />
            <TextField
              label="짧은 설명"
              name="summary"
              defaultValue={product?.summary ?? ''}
              className="col-span-2"
              placeholder="상품의 주요 특징을 입력해 주세요"
            />
          </AdminPanel>

          <AdminPanel
            id="category-info"
            title="카테고리"
            className="scroll-mt-24"
            bodyClassName="grid grid-cols-2 gap-16 p-20"
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
            bodyClassName="p-20"
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
                  defaultValue={product?.price ?? ''}
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
                  defaultValue={product?.listPrice ?? ''}
                  placeholder="정가를 입력해 주세요"
                  helperText={
                    product?.listPrice === null
                      ? '실제 금액 미제공: API 응답에 정가가 포함되지 않았습니다.'
                      : undefined
                  }
                />
              </div>
              <AdminNotice tone="info">
                저장한 가격 공개 설정은 구매자 API 응답에 반영됩니다. 실제 서버 저장은 지원하지
                않습니다.
              </AdminNotice>
            </div>
          </AdminPanel>

          <AdminPanel
            title="옵션"
            id="option-info"
            className="scroll-mt-24"
            description="옵션 선택지와 SKU 조합별 코드·추가금·재고·판매 상태·연결 이미지를 관리합니다."
            action={
              <Button
                variant="secondary"
                size="s"
                onClick={() => {
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
            bodyClassName="space-y-12 p-20"
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
                  onClick={() =>
                    setOptions((current) => current.filter((entry) => entry.id !== option.id))
                  }
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
            <div className="border-t border-line pt-12">
              <div className="mb-8 flex items-center justify-between">
                <h3 className="text-label-m">SKU 조합별 판매 설정 ({skuRows.length}개)</h3>
                <Button
                  type="button"
                  variant="secondary"
                  size="s"
                  onClick={() =>
                    setSkuRows((current) => [
                      ...current,
                      {
                        id: `sku-${Date.now()}`,
                        optionLabels: [],
                        productCode: '',
                        priceDelta: 0,
                        stockCount: 0,
                        salesStatus: 'active',
                        imageId: null,
                      },
                    ])
                  }
                >
                  SKU 행 추가
                </Button>
              </div>
              <p className="mb-8 text-caption text-text-3">
                {skuRows.length > 0
                  ? '등록된 SKU 행별로 옵션 조합·코드·추가금·재고를 확인하세요.'
                  : options.length > 0
                    ? '옵션 조합은 자동 생성되지 않습니다. SKU 행 추가를 눌러 각 조합의 코드와 재고를 직접 입력하세요.'
                    : '옵션별 재고를 나누려면 옵션 목록을 먼저 만든 뒤 SKU 행을 추가하세요. 옵션 없는 상품은 SKU 설정을 비워둘 수 있습니다.'}
              </p>
              {skuRows.map((sku, index) => (
                <div
                  key={sku.id}
                  className="mb-8 grid grid-cols-3 gap-8 rounded-8 border border-line p-12"
                >
                  <TextField
                    label="옵션 조합"
                    value={sku.optionLabels.join(' / ')}
                    onChange={(event) =>
                      setSkuRows((current) =>
                        current.map((row) =>
                          row.id === sku.id
                            ? {
                                ...row,
                                optionLabels: event.target.value
                                  .split('/')
                                  .map((label) => label.trim())
                                  .filter(Boolean),
                              }
                            : row,
                        ),
                      )
                    }
                  />
                  <TextField
                    label="SKU 코드"
                    value={sku.productCode}
                    onChange={(event) =>
                      setSkuRows((current) =>
                        current.map((row) =>
                          row.id === sku.id ? { ...row, productCode: event.target.value } : row,
                        ),
                      )
                    }
                  />
                  <TextField
                    label="추가금"
                    type="number"
                    value={sku.priceDelta}
                    onChange={(event) =>
                      setSkuRows((current) =>
                        current.map((row) =>
                          row.id === sku.id
                            ? { ...row, priceDelta: Number(event.target.value) || 0 }
                            : row,
                        ),
                      )
                    }
                  />
                  <TextField
                    label="재고"
                    type="number"
                    min="0"
                    value={sku.stockCount}
                    onChange={(event) =>
                      setSkuRows((current) =>
                        current.map((row) =>
                          row.id === sku.id
                            ? { ...row, stockCount: Math.max(0, Number(event.target.value) || 0) }
                            : row,
                        ),
                      )
                    }
                  />
                  <label className="grid gap-6 text-label-s">
                    판매 상태
                    <select
                      aria-label={`SKU ${index + 1} 판매 상태`}
                      className="h-40 rounded-8 border border-line-control bg-bg px-8"
                      value={sku.salesStatus}
                      onChange={(event) =>
                        setSkuRows((current) =>
                          current.map((row) =>
                            row.id === sku.id
                              ? {
                                  ...row,
                                  salesStatus: event.target.value as AdminProductSku['salesStatus'],
                                }
                              : row,
                          ),
                        )
                      }
                    >
                      <option value="active">판매 중</option>
                      <option value="paused">일시 중지</option>
                      <option value="ended">판매 종료</option>
                    </select>
                  </label>
                  <label className="grid gap-6 text-label-s">
                    연결 이미지
                    <select
                      aria-label={`SKU ${index + 1} 연결 이미지`}
                      className="h-40 rounded-8 border border-line-control bg-bg px-8"
                      value={sku.imageId ?? ''}
                      onChange={(event) =>
                        setSkuRows((current) =>
                          current.map((row) =>
                            row.id === sku.id
                              ? { ...row, imageId: event.target.value || null }
                              : row,
                          ),
                        )
                      }
                    >
                      <option value="">없음</option>
                      {images.map((image, imageIndex) => (
                        <option key={image.id} value={image.id}>
                          이미지 {imageIndex + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="text-label-s text-danger"
                    onClick={() =>
                      setSkuRows((current) => current.filter((row) => row.id !== sku.id))
                    }
                  >
                    SKU 삭제
                  </button>
                </div>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel
            id="stock-info"
            title="재고 · 판매"
            className="scroll-mt-24"
            bodyClassName="grid grid-cols-2 gap-16 p-20"
          >
            <fieldset className="grid gap-8">
              <legend className="text-label-m">판매 상태</legend>
              <div className="flex gap-16">
                {(
                  [
                    ['inStock', '판매중'],
                    ['soldOut', '품절'],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex h-40 items-center gap-8 text-body-s">
                    <input
                      type="radio"
                      name="product-stock-status"
                      value={value}
                      checked={stockStatus === value}
                      onChange={() => setStockStatus(value)}
                      className="size-16 accent-text-1"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <p className="text-caption text-text-3">저장 후 웹 목 상품 응답에도 적용됩니다.</p>
            </fieldset>
            <TextField
              label="재고 수량"
              name="stockCount"
              type="number"
              min="0"
              defaultValue={product?.stockCount ?? 0}
              helperText="목 API 재고 수량입니다."
            />
          </AdminPanel>

          <AdminPanel
            id="image-info"
            title="이미지"
            description="이미지 URL·순서·대표 이미지를 목 API에 저장합니다."
            className="scroll-mt-24"
            bodyClassName="p-20"
          >
            <div className="flex flex-wrap gap-12">
              {images.map((image, index) => (
                <div
                  key={image.id}
                  className="relative flex size-96 items-center justify-center overflow-hidden rounded-8 border border-line bg-surface"
                >
                  <img src={image.url} alt={image.alt} className="size-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-bg/90 px-4 text-caption">
                    <span>{index === 0 ? '대표' : `순서 ${index + 1}`}</span>
                    <span className="flex gap-4">
                      {index > 0 ? (
                        <button
                          type="button"
                          aria-label={`이미지 ${index + 1} 앞당기기`}
                          onClick={() =>
                            setImages((current) => {
                              const precedingImage = current[index - 1];
                              const selectedImage = current[index];
                              if (!precedingImage || !selectedImage) return current;
                              const reorderedImages = [...current];
                              reorderedImages[index - 1] = selectedImage;
                              reorderedImages[index] = precedingImage;
                              return reorderedImages;
                            })
                          }
                        >
                          ↑
                        </button>
                      ) : null}
                      <button
                        type="button"
                        aria-label={`이미지 ${index + 1} 삭제`}
                        className="text-danger"
                        onClick={() =>
                          setImages((current) => current.filter((entry) => entry.id !== image.id))
                        }
                      >
                        ×
                      </button>
                    </span>
                  </div>
                </div>
              ))}
              <label className="flex h-96 w-160 cursor-pointer items-center justify-center rounded-8 border border-dashed border-line-control text-body-s text-text-2 focus-within:ring-2 focus-within:ring-text-1">
                이미지 파일 선택
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={async (event) => {
                    const files = Array.from(event.currentTarget.files ?? []);
                    event.currentTarget.value = '';
                    if (
                      files.some(
                        (file) => !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024,
                      )
                    ) {
                      setDemoMessage('이미지 파일은 파일당 5MB 이하로 등록해 주세요.');
                      return;
                    }
                    try {
                      const loadedImages = await Promise.all(
                        files.map(async (file, index) => ({
                          id: `img-${Date.now()}-${index}`,
                          url: await readImageFile(file),
                          alt: file.name.replace(/\.[^.]+$/, ''),
                        })),
                      );
                      setImages((current) => [...current, ...loadedImages]);
                    } catch (imageError) {
                      setDemoMessage(
                        imageError instanceof Error
                          ? imageError.message
                          : '이미지를 읽지 못했습니다.',
                      );
                    }
                  }}
                />
              </label>
            </div>
          </AdminPanel>

          <AdminPanel
            id="detail-info"
            title="상세 정보 · 고시"
            className="scroll-mt-24"
            bodyClassName="grid grid-cols-2 gap-16 p-20"
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
              label="배송 안내"
              name="shippingEstimate"
              defaultValue={product?.shipping.estimate ?? ''}
              placeholder="배송 안내를 입력해 주세요"
            />
            <TextField
              label="배송비"
              name="shippingFee"
              type="number"
              defaultValue={product?.shipping.fee ?? ''}
              placeholder="배송비를 입력해 주세요"
            />
            <label className="col-span-2 flex flex-col gap-8 text-label-m">
              상세 설명
              <textarea
                name="description"
                rows={5}
                defaultValue={product?.summary ?? ''}
                placeholder="상품 상세 내용을 입력해 주세요"
                className="w-full rounded-8 border border-line-control bg-bg p-14 text-body-m outline-none focus:border-text-1"
              />
            </label>
          </AdminPanel>
        </div>

        <aside className="sticky top-16 flex min-w-0 flex-col gap-16">
          <AdminPanel title="게시 설정" bodyClassName="space-y-16 p-20">
            <div>
              <p className="text-label-m">판매 상태</p>
              <div className="mt-8">
                <AdminStatusBadge status={stockStatus} kind="product" />
              </div>
            </div>
            <label className="flex items-center gap-8 border-t border-line pt-16 text-label-m">
              <input
                type="checkbox"
                checked={isVisible}
                onChange={(event) => setIsVisible(event.target.checked)}
              />
              웹에 노출
            </label>
            <label className="grid gap-6 border-t border-line pt-16 text-label-m">
              판매 운영 상태
              <select
                className="h-40 rounded-8 border border-line-control bg-bg px-12"
                value={salesStatus}
                onChange={(event) => setSalesStatus(event.target.value as typeof salesStatus)}
              >
                <option value="active">판매 중</option>
                <option value="paused">판매 일시 중지</option>
                <option value="ended">판매 종료</option>
              </select>
            </label>
            <div className="border-t border-line pt-16">
              <p className="text-label-m">금액 표시</p>
              <p className="mt-4 text-body-s text-text-3">
                {previewPriceVisible
                  ? '구매자 화면에 상품 금액을 표시합니다.'
                  : '구매자 화면에서 상품 금액을 숨깁니다.'}
              </p>
              <a href="#price-info" className="mt-8 inline-flex text-label-s text-text-2 underline">
                가격 섹션 보기
              </a>
            </div>
          </AdminPanel>
        </aside>
      </div>
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

  const { product, categories } = editorQuery.data;
  return (
    <ProductEditor
      key={productId ?? 'new'}
      product={product}
      categories={categories}
      isNew={isNew}
    />
  );
}
