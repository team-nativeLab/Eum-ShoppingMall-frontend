import { Button, buttonClassName } from '@eum/ui/components/Button';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { Switch } from '@eum/ui/components/Switch';
import { SelectField, TextField } from '@eum/ui/components/TextField';
import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
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
import type { Category, Product } from '@eum/api/types';

interface ProductEditorData {
  product: Product | null;
  categories: Category[];
}

/** 등록·수정 폼에 필요한 API 조회를 병렬로 요청합니다. */
async function loadProductEditor(
  productId: string | undefined,
  signal: AbortSignal,
): Promise<ProductEditorData> {
  const api = await getShopApi();
  const [categories, product] = await Promise.all([
    api.categories.list({ signal }),
    productId && productId !== 'new'
      ? api.products.getById(productId, { signal })
      : Promise.resolve(null),
  ]);
  return { product, categories };
}

/** 입력·파일 선택은 폼이 열려 있는 동안만 유지하며 서버 변경을 호출하지 않습니다. */
function ProductEditor({
  product,
  categories,
  isNew,
}: {
  product: Product | null;
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
  const [extraOptionRows, setExtraOptionRows] = useState(0);
  const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);
  const [demoMessage, setDemoMessage] = useState('');
  const [isNewProductPriceVisible, setNewProductPriceVisible] = useState(true);
  const { getPreviewValue, setPreviewValue } = useAdminPriceVisibilityPreview();
  const previewPriceVisible = product ? getPreviewValue(product) : isNewProductPriceVisible;
  const leafOptions = categories.filter((category) => category.parentId === rootCategoryId);

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDemoMessage('데모 화면에서는 입력한 내용이 저장되지 않습니다.');
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
            <Button type="submit">저장</Button>
          </>
        }
      />
      <div className="mb-16">
        <AdminNotice tone="info">
          이 폼의 입력은 화면 확인용입니다. 저장을 눌러도 서버에는 반영되지 않습니다.
        </AdminNotice>
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
              <AdminNotice tone="warning">
                이 스위치는 현재 관리자 세션 미리보기만 바꿉니다. 서버에 저장되지 않으며 구매자
                화면·장바구니·주문에는 반영되지 않습니다. 새로고침 또는 로그아웃하면 초기화됩니다.
              </AdminNotice>
            </div>
          </AdminPanel>

          <AdminPanel
            title="옵션"
            id="option-info"
            className="scroll-mt-24"
            description="상품별 선택 옵션을 확인합니다. 입력한 변경은 화면에서만 유지됩니다."
            action={
              <Button
                variant="secondary"
                size="s"
                onClick={() => setExtraOptionRows((count) => count + 1)}
              >
                옵션 목록 만들기
              </Button>
            }
            bodyClassName="space-y-12 p-20"
          >
            {(product?.options ?? []).map((option) => (
              <div
                key={option.id}
                className="grid grid-cols-[1fr_2fr] gap-12 rounded-8 border border-line p-12"
              >
                <TextField label="옵션명" defaultValue={option.label} />
                <TextField
                  label="선택지"
                  defaultValue={option.choices.map((choice) => choice.label).join(', ')}
                />
                {option.choices.map((choice) => (
                  <span key={choice.id} className="col-span-2 text-caption text-text-3">
                    {choice.label} · 추가 금액 {choice.priceDelta.toLocaleString('ko-KR')}원
                  </span>
                ))}
              </div>
            ))}
            {Array.from({ length: extraOptionRows }, (_, index) => (
              <div
                key={'new-option-' + index}
                className="grid grid-cols-[1fr_2fr] gap-12 rounded-8 border border-dashed border-line-strong p-12"
              >
                <TextField label="새 옵션명" placeholder="옵션명을 입력해 주세요" />
                <TextField label="선택지" placeholder="쉼표로 구분해 입력해 주세요" />
              </div>
            ))}
            {!product?.options.length && extraOptionRows === 0 ? (
              <p className="text-body-s text-text-3">등록된 옵션이 없습니다.</p>
            ) : null}
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
              <p className="text-caption text-text-3">
                현재 설정은 브라우저 화면에서만 유지됩니다.
              </p>
            </fieldset>
            <TextField
              label="재고 수량"
              name="stockCount"
              placeholder="재고 수량 API 미제공"
              disabled
              helperText="실제 재고 수량은 아직 조회되지 않습니다."
            />
          </AdminPanel>

          <AdminPanel
            id="image-info"
            title="이미지"
            description="선택 파일명만 브라우저 화면에 임시 표시합니다."
            className="scroll-mt-24"
            bodyClassName="p-20"
          >
            <div className="flex flex-wrap gap-12">
              {(product?.images ?? []).map((image) => (
                <div
                  key={image.id}
                  className="flex size-96 items-center justify-center overflow-hidden rounded-8 border border-line bg-surface"
                >
                  <img src={image.url} alt={image.alt} className="size-full object-cover" />
                </div>
              ))}
              {selectedFileNames.map((fileName) => (
                <div
                  key={fileName}
                  className="flex h-96 w-160 items-center justify-center rounded-8 border border-dashed border-line-control px-12 text-center text-caption text-text-2"
                >
                  {fileName}
                </div>
              ))}
              <label className="flex h-96 w-160 cursor-pointer items-center justify-center rounded-8 border border-dashed border-line-control text-body-s text-text-2 focus-within:ring-2 focus-within:ring-text-1">
                이미지 파일 선택
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(event) =>
                    setSelectedFileNames(
                      Array.from(event.target.files ?? []).map((file) => file.name),
                    )
                  }
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
              label="인증번호"
              defaultValue={product?.certifications.join(', ') ?? ''}
              placeholder="인증 정보를 입력해 주세요"
            />
            <TextField
              label="원산지"
              defaultValue={product?.shipping.countryOfOrigin ?? ''}
              placeholder="원산지를 입력해 주세요"
            />
            <TextField
              label="배송 안내"
              defaultValue={product?.shipping.estimate ?? ''}
              placeholder="배송 안내를 입력해 주세요"
            />
            <TextField
              label="배송비"
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
            <div className="border-t border-line pt-16">
              <p className="text-label-m">금액 표시</p>
              <p className="mt-4 text-body-s text-text-3">
                {previewPriceVisible
                  ? '표시 상태로 관리자 미리보기 중입니다.'
                  : '미표시 상태로 관리자 미리보기 중입니다.'}
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
