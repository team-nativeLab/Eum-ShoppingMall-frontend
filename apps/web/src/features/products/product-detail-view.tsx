'use client';

import { createCartOptionId, formatCartOptionLabel } from '@eum/api/cart';
import { canAddToCart, canBuyNow, getPriceDisplay, formatKrw } from '@eum/api/price';
import { sanitizeRedirectPath } from '@eum/api/redirect';
import type { Product, ProductOption } from '@eum/api/types';
import { Breadcrumb } from '@eum/ui/components/Breadcrumb';
import { Button } from '@eum/ui/components/Button';
import { Badge } from '@eum/ui/components/Badge';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { Icon } from '@eum/ui/components/Icon';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { QuantityStepper } from '@eum/ui/components/QuantityStepper';
import { SelectField } from '@eum/ui/components/TextField';
import { getApiFailureKind } from '@eum/api/errors';
import { Heart, PackageOpen, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@/components/page-container';
import { useCart } from '@/features/cart/cart-context';
import { getMemberAuth } from '@/lib/member-auth';
import { useLocalCollections } from './local-collections-context';
import { ProductCard } from './product-card';
import { ProductImage } from './product-image';
import { useCategoriesQuery } from './use-categories-query';
import { useProductQuery } from './use-product-query';
import { useProductsQuery } from './use-products-query';

const QUANTITY_LIMIT = 999;
type DetailTab = 'description' | 'shipping' | 'reviews' | 'questions';

const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: 'description', label: '상품 정보' },
  { id: 'shipping', label: '배송/반품' },
  { id: 'reviews', label: '리뷰' },
  { id: 'questions', label: '상품 문의' },
];

/** W-03 상세·가격 미표시 상태. 데이터 조회 후 최근 본 상품 ID를 저장합니다. */
export function ProductDetailView({ productId }: { productId: string }) {
  const productQuery = useProductQuery(productId);
  const categoriesQuery = useCategoriesQuery();
  const relatedQuery = useProductsQuery({ pageSize: 5 });
  const { recordRecent } = useLocalCollections();

  useEffect(() => {
    if (productQuery.data) recordRecent(productQuery.data.id);
  }, [productQuery.data, recordRecent]);

  if (productQuery.isPending) {
    return (
      <PageContainer className="grid gap-24 py-40 lg:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-12 bg-surface" />
        <div aria-busy="true" className="space-y-16">
          <div className="h-24 w-160 animate-pulse rounded-8 bg-surface" />
          <div className="h-40 w-320 animate-pulse rounded-8 bg-surface" />
          <div className="h-180 animate-pulse rounded-12 bg-surface" />
        </div>
      </PageContainer>
    );
  }

  if (productQuery.isError) {
    const isMissing = getApiFailureKind(productQuery.error) === 'notFound';
    return (
      <PageContainer className="py-40">
        <EmptyState
          icon={isMissing ? SearchX : PackageOpen}
          title={isMissing ? '상품을 찾을 수 없습니다' : '상품을 불러오지 못했습니다'}
          description={isMissing ? '다른 상품을 확인해 주세요.' : '잠시 후 다시 시도해 주세요.'}
          action={
            <Link
              href="/search"
              className="rounded-8 border border-line-strong px-16 py-8 text-label-m focus-ring"
            >
              상품 목록 보기
            </Link>
          }
        />
      </PageContainer>
    );
  }

  return (
    <ProductDetailContent
      product={productQuery.data}
      categories={categoriesQuery.data ?? []}
      relatedProducts={
        relatedQuery.data?.items.filter((item) => item.id !== productQuery.data.id) ?? []
      }
    />
  );
}

function ProductDetailContent({
  product,
  categories,
  relatedProducts,
}: {
  product: Product;
  categories: { id: string; slug: string; name: string; parentId: string | null }[];
  relatedProducts: Product[];
}) {
  const router = useRouter();
  const { addToCart } = useCart();
  const { wishlistIds, toggleWishlist } = useLocalCollections();
  const [quantity, setQuantity] = useState(1);
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState<DetailTab>('description');
  const priceDisplay = getPriceDisplay(product);
  const selectedOptions = useMemo(
    () =>
      product.options.flatMap((productOption) => {
        const choiceId = selectedChoices[productOption.id];
        const choice = productOption.choices.find((productChoice) => productChoice.id === choiceId);
        return choice ? [{ productOption, choice }] : [];
      }),
    [product.options, selectedChoices],
  );
  const missingRequiredOption = product.options.some(
    (productOption) => productOption.required && !selectedChoices[productOption.id],
  );
  // 장바구니 줄 식별자·문구 형식은 @eum/api/cart가 정하며, 복원 시 같은 규칙으로 다시 해석합니다.
  const optionIdentity = createCartOptionId(
    selectedOptions.map(({ productOption, choice }) => ({
      optionId: productOption.id,
      choiceId: choice.id,
    })),
  );
  const optionLabel = formatCartOptionLabel(
    selectedOptions.map(({ productOption, choice }) => ({
      optionLabel: productOption.label,
      choiceLabel: choice.label,
    })),
  );
  const category = categories.find((item) => item.id === product.categoryId);
  const isWishlisted = wishlistIds.includes(product.id);
  const isPurchasable = canBuyNow(product);
  const isAddable = canAddToCart(product) && !missingRequiredOption;
  const imageUrls =
    product.images.length > 0
      ? product.images
      : product.thumbnailUrl
        ? [{ id: 'thumbnail', url: product.thumbnailUrl, alt: product.name }]
        : [];
  const [activeImageId, setActiveImageId] = useState<string | null>(imageUrls[0]?.id ?? null);
  const activeImage = imageUrls.find((image) => image.id === activeImageId) ?? imageUrls[0];
  const selectedPriceDelta = priceDisplay.isPriceVisible
    ? selectedOptions.reduce(
        (priceSum, selectedOption) => priceSum + selectedOption.choice.priceDelta,
        0,
      )
    : 0;
  const selectedProductPrice =
    product.priceVisible && product.price !== null
      ? formatKrw(product.price + selectedPriceDelta)
      : priceDisplay.text;

  const handleAddToCart = () => {
    if (!canAddToCart(product)) return;
    if (missingRequiredOption) {
      setNotice('필수 옵션을 선택해 주세요.');
      return;
    }
    addToCart(product, quantity, optionIdentity, optionLabel);
    setNotice('장바구니에 담았습니다.');
  };

  const handleBuyNow = async () => {
    if (!isPurchasable || missingRequiredOption) {
      if (missingRequiredOption) setNotice('필수 옵션을 선택해 주세요.');
      return;
    }
    addToCart(product, quantity, optionIdentity, optionLabel);
    const returnPath = sanitizeRedirectPath('/checkout/shipping');
    try {
      const currentMember = await (await getMemberAuth()).getCurrentUser();
      router.push(currentMember ? returnPath : '/login?redirect=' + encodeURIComponent(returnPath));
    } catch {
      // real 인증 연동 전에는 로그인으로 보내고, 실제 주문 권한은 서버가 확인합니다.
      router.push('/login?redirect=' + encodeURIComponent(returnPath));
    }
  };

  const selectTab = (tabId: DetailTab) => {
    setActiveTab(tabId);
    document
      .getElementById('product-tab-' + tabId)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <PageContainer className="pt-20 pb-80 lg:pt-24 lg:pb-64">
        <div className="hidden lg:block">
          <Breadcrumb
            items={[
              { label: '홈', href: '/' },
              { label: '제품', href: '/search' },
              ...(category ? [{ label: category.name, href: '/category/' + category.slug }] : []),
              { label: product.name },
            ]}
            renderLink={(item, className) => (
              <Link href={item.href} className={className}>
                {item.label}
              </Link>
            )}
          />
        </div>

        <div className="grid gap-24 lg:mt-32 lg:grid-cols-[minmax(0,1.1fr)_minmax(400px,0.9fr)] lg:gap-48">
          <ProductGallery
            images={imageUrls}
            activeImage={activeImage}
            onSelect={setActiveImageId}
            productName={product.name}
          />
          <section aria-labelledby="product-title" className="min-w-0 px-16 lg:px-0">
            <p className="text-caption text-text-3">{product.brand}</p>
            <div className="mt-4 flex flex-wrap items-center gap-8">
              <h1 id="product-title" className="text-h2">
                {product.name}
              </h1>
              {!priceDisplay.isPriceVisible ? <Badge tone="outline">금액 미표시</Badge> : null}
              {product.stockStatus === 'soldOut' ? <Badge tone="soldout">품절</Badge> : null}
            </div>
            <div className="mt-8 flex items-center gap-8 text-body-s text-text-3">
              <span
                aria-label={product.rating === null ? '평점 없음' : '평점 ' + product.rating + '점'}
                className="text-line-control"
              >
                {product.rating === null ? '☆☆☆☆☆' : '★★★★★'}
              </span>
              <span>({product.reviewCount.toLocaleString('ko-KR')})</span>
            </div>
            <div className="mt-12 border-b border-line pb-20">
              <p
                className={
                  priceDisplay.isPriceVisible ? 'text-web-price-xl' : 'text-h2 text-text-2'
                }
              >
                {selectedProductPrice}
              </p>
              {priceDisplay.listPriceText ? (
                <p className="mt-4 text-body-s text-text-3 line-through">
                  {priceDisplay.listPriceText}
                </p>
              ) : null}
            </div>

            <dl className="grid grid-cols-[88px_1fr] gap-x-16 gap-y-8 border-b border-line py-20 text-body-s">
              <dt className="text-text-3">배송</dt>
              <dd>{product.shipping.method}</dd>
              <dt className="text-text-3">안전인증</dt>
              <dd>
                {product.certifications.length
                  ? product.certifications.join(', ')
                  : '인증 정보 없음'}
              </dd>
              <dt className="text-text-3">원산지</dt>
              <dd>{product.shipping.countryOfOrigin}</dd>
            </dl>

            {product.options.map((productOption) => (
              <OptionSelect
                key={productOption.id}
                option={productOption}
                value={selectedChoices[productOption.id] ?? ''}
                priceVisible={priceDisplay.isPriceVisible}
                onChange={(choiceId) => {
                  setSelectedChoices((currentChoices) => ({
                    ...currentChoices,
                    [productOption.id]: choiceId,
                  }));
                  setNotice('');
                }}
              />
            ))}

            {selectedOptions.length > 0 ? (
              <div className="mt-16 space-y-8">
                {selectedOptions.map(({ productOption, choice }) => (
                  <div
                    key={productOption.id}
                    className="flex items-center justify-between rounded-8 bg-surface px-12 py-8 text-body-s"
                  >
                    <span>
                      {productOption.label}: {choice.label}
                      {priceDisplay.isPriceVisible && choice.priceDelta !== 0
                        ? ' (' +
                          (choice.priceDelta > 0 ? '+' : '') +
                          formatKrw(choice.priceDelta) +
                          ')'
                        : ''}
                    </span>
                    <button
                      type="button"
                      aria-label={productOption.label + ' 선택 취소'}
                      onClick={() =>
                        setSelectedChoices((currentChoices) => {
                          const nextChoices = { ...currentChoices };
                          delete nextChoices[productOption.id];
                          return nextChoices;
                        })
                      }
                      className="rounded-4 px-8 text-text-3 focus-ring hover:text-text-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-16 flex items-center justify-between gap-12">
              <span className="text-body-s text-text-2">수량</span>
              <QuantityStepper
                value={quantity}
                onValueChange={setQuantity}
                max={QUANTITY_LIMIT}
                label={product.name + ' 수량'}
              />
            </div>

            <div className="mt-16 flex flex-wrap items-center justify-between gap-12 rounded-8 border border-line px-12 py-8">
              <span className="text-body-s">총 상품 금액 ({quantity}개)</span>
              <span className="text-price-m">
                {product.priceVisible && product.price !== null
                  ? formatKrw((product.price + selectedPriceDelta) * quantity)
                  : priceDisplay.text}
              </span>
            </div>

            <div className="mt-16 hidden gap-8 lg:flex">
              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                aria-label={isWishlisted ? '찜 취소' : '찜하기'}
                aria-pressed={isWishlisted}
                className="inline-flex size-48 shrink-0 items-center justify-center rounded-8 border border-line-strong focus-ring hover:bg-surface"
              >
                <Icon icon={Heart} size={20} fill={isWishlisted ? 'currentColor' : 'none'} />
              </button>
              <Button
                variant="primary"
                size="m"
                isFullWidth
                disabled={!isAddable}
                onClick={handleAddToCart}
              >
                장바구니 담기
              </Button>
              <Button
                variant="secondary"
                size="m"
                isFullWidth
                disabled={!isPurchasable || missingRequiredOption}
                onClick={() => void handleBuyNow()}
              >
                바로 구매
              </Button>
            </div>
            {!priceDisplay.isPriceVisible ? (
              <NoticeInline tone="neutral" className="mt-12 hidden lg:flex">
                금액이 표시되지 않아 온라인 바로 구매가 불가능합니다. 견적 문의를 이용해 주세요.
              </NoticeInline>
            ) : null}
            {product.stockStatus === 'soldOut' ? (
              <NoticeInline tone="neutral" className="mt-12 hidden lg:flex">
                현재 품절된 상품입니다.
              </NoticeInline>
            ) : null}
            {notice ? (
              <p role="status" className="mt-8 text-body-s text-success">
                {notice}
              </p>
            ) : null}

            <div className="mt-20 rounded-12 bg-surface px-16 py-16 text-body-s">
              <p className="text-label-m">함께 구매 전 확인해 주세요</p>
              <dl className="mt-12 grid grid-cols-[80px_1fr] gap-x-12 gap-y-8">
                <dt className="text-text-3">출고</dt>
                <dd>{product.shipping.estimate}</dd>
                <dt className="text-text-3">결제</dt>
                <dd>결제 후 주문 상태에서 확인할 수 있습니다.</dd>
                <dt className="text-text-3">교환·반품</dt>
                <dd>상품 상태와 배송 기준에 따라 안내됩니다.</dd>
              </dl>
            </div>
          </section>
        </div>

        <nav
          aria-label="상품 상세 탭"
          className="sticky top-48 z-20 mt-32 flex overflow-x-auto border-b border-line bg-bg lg:top-72"
        >
          {DETAIL_TABS.map((detailTab) => (
            <button
              key={detailTab.id}
              type="button"
              aria-current={activeTab === detailTab.id ? 'page' : undefined}
              onClick={() => selectTab(detailTab.id)}
              className={
                activeTab === detailTab.id
                  ? 'h-48 shrink-0 border-b-2 border-text-1 px-16 text-label-m focus-ring lg:px-24'
                  : 'h-48 shrink-0 px-16 text-body-s text-text-2 focus-ring lg:px-24'
              }
            >
              {detailTab.label}
              {detailTab.id === 'reviews' ? ' (' + product.reviewCount + ')' : ''}
            </button>
          ))}
        </nav>

        <div className="grid gap-32 pt-24 lg:grid-cols-[minmax(0,2fr)_minmax(280px,0.8fr)] lg:gap-48">
          <div className="min-w-0">
            <section
              id="product-tab-description"
              aria-labelledby="product-description-heading"
              className="scroll-mt-80"
            >
              <h2 id="product-description-heading" className="text-title">
                상품 정보
              </h2>
              <p className="mt-12 text-body-s whitespace-pre-line text-text-2">{product.summary}</p>
              <div className="mt-20 overflow-hidden rounded-12 bg-surface">
                {activeImage ? (
                  <ProductImage
                    src={activeImage.url}
                    alt={activeImage.alt}
                    className="max-h-640 min-h-320 object-contain lg:min-h-560"
                  />
                ) : (
                  <ProductImage
                    src={null}
                    alt={product.name + ' 상품 이미지'}
                    className="h-320 lg:h-560"
                  />
                )}
              </div>
              {product.specifications.length > 0 ? (
                <div className="mt-24">
                  <h3 className="text-body-s-medium">제품 사양</h3>
                  <dl className="mt-12 border-t border-text-2">
                    {product.specifications.map((specification) => (
                      <div
                        key={specification.label}
                        className="grid grid-cols-[120px_1fr] border-b border-line text-body-s"
                      >
                        <dt className="bg-surface px-12 py-10 text-text-2">
                          {specification.label}
                        </dt>
                        <dd className="px-12 py-10">{specification.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}
            </section>

            <section
              id="product-tab-shipping"
              aria-labelledby="shipping-heading"
              className="mt-40 scroll-mt-80"
            >
              <h2 id="shipping-heading" className="text-title">
                배송/반품 안내
              </h2>
              <p className="mt-12 text-body-s text-text-2">{product.shipping.estimate}</p>
              <dl className="mt-12 grid grid-cols-[120px_1fr] border-t border-line text-body-s">
                <dt className="border-b border-line bg-surface px-12 py-10 text-text-2">
                  배송 방법
                </dt>
                <dd className="border-b border-line px-12 py-10">{product.shipping.method}</dd>
                <dt className="border-b border-line bg-surface px-12 py-10 text-text-2">배송비</dt>
                <dd className="border-b border-line px-12 py-10">
                  {product.shipping.fee === 0 ? '무료' : formatKrw(product.shipping.fee)}
                </dd>
                <dt className="border-b border-line bg-surface px-12 py-10 text-text-2">원산지</dt>
                <dd className="border-b border-line px-12 py-10">
                  {product.shipping.countryOfOrigin}
                </dd>
              </dl>
            </section>

            <section
              id="product-tab-reviews"
              aria-labelledby="reviews-heading"
              className="mt-40 scroll-mt-80"
            >
              <h2 id="reviews-heading" className="text-title">
                리뷰 ({product.reviewCount})
              </h2>
              <EmptyState
                icon={PackageOpen}
                title={
                  product.reviewCount > 0
                    ? '리뷰를 불러오는 중입니다'
                    : '아직 작성된 리뷰가 없습니다'
                }
                description={
                  product.reviewCount > 0 ? undefined : '구매 후 상품 리뷰를 남겨 주세요.'
                }
                headingLevel="h3"
                className="py-32"
              />
            </section>

            <section
              id="product-tab-questions"
              aria-labelledby="questions-heading"
              className="mt-40 scroll-mt-80"
            >
              <div className="flex flex-wrap items-center justify-between gap-12">
                <h2 id="questions-heading" className="text-title">
                  상품 문의
                </h2>
                <Link
                  href="/login?redirect=%2Fproducts%2F"
                  className="rounded-4 text-label-s underline focus-ring"
                >
                  문의하기
                </Link>
              </div>
              <EmptyState
                icon={PackageOpen}
                title="등록된 상품 문의가 없습니다"
                headingLevel="h3"
                className="py-32"
              />
            </section>
          </div>

          <aside className="hidden lg:block" aria-label="구매 요약">
            <div className="sticky top-96 rounded-12 border border-line p-20">
              <p className="text-body-s-medium">{product.name}</p>
              <p className="mt-4 text-caption text-text-3">{product.brand}</p>
              <div className="mt-12 flex items-center justify-between gap-8">
                <span className="text-caption text-text-3">총 금액</span>
                <span className="text-price-m">
                  {product.priceVisible && product.price !== null
                    ? formatKrw((product.price + selectedPriceDelta) * quantity)
                    : priceDisplay.text}
                </span>
              </div>
              <div className="mt-12 flex gap-8">
                <button
                  type="button"
                  onClick={() => toggleWishlist(product.id)}
                  aria-label={isWishlisted ? '찜 취소' : '찜하기'}
                  aria-pressed={isWishlisted}
                  className="inline-flex size-40 items-center justify-center rounded-8 border border-line-strong focus-ring hover:bg-surface"
                >
                  <Icon icon={Heart} size={20} fill={isWishlisted ? 'currentColor' : 'none'} />
                </button>
                <Button
                  variant="primary"
                  size="s"
                  isFullWidth
                  disabled={!isAddable}
                  onClick={handleAddToCart}
                >
                  장바구니
                </Button>
                <Button
                  variant="secondary"
                  size="s"
                  isFullWidth
                  disabled={!isPurchasable || missingRequiredOption}
                  onClick={() => void handleBuyNow()}
                >
                  바로 구매
                </Button>
              </div>
              {!priceDisplay.isPriceVisible ? (
                <NoticeInline tone="neutral" className="mt-12">
                  온라인 구매가 불가한 상품입니다. 견적 문의를 이용해 주세요.
                </NoticeInline>
              ) : null}
            </div>
            {relatedProducts.length > 0 ? (
              <section className="mt-24" aria-labelledby="related-heading">
                <h2 id="related-heading" className="text-body-s-medium">
                  함께 구매하면 좋은 제품
                </h2>
                <ul className="mt-12 space-y-12">
                  {relatedProducts.slice(0, 2).map((relatedProduct) => (
                    <li key={relatedProduct.id}>
                      <ProductCard product={relatedProduct} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </aside>
        </div>

        {relatedProducts.length > 0 ? (
          <section className="mt-48 lg:hidden" aria-labelledby="related-mobile-heading">
            <div className="flex items-center justify-between">
              <h2 id="related-mobile-heading" className="text-title">
                함께 구매하면 좋은 제품
              </h2>
              <Link href="/search" className="text-caption underline focus-ring">
                전체 보기
              </Link>
            </div>
            <ul className="mt-16 grid grid-cols-2 gap-12">
              {relatedProducts.slice(0, 4).map((relatedProduct) => (
                <li key={relatedProduct.id} className="min-w-0">
                  <ProductCard product={relatedProduct} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </PageContainer>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg lg:hidden">
        {!priceDisplay.isPriceVisible ? (
          <NoticeInline isFullBleed className="text-caption">
            온라인 구매가 불가한 상품입니다.
          </NoticeInline>
        ) : null}
        <div className="flex items-center gap-8 px-16 py-8 pb-[max(env(safe-area-inset-bottom),8px)]">
          <button
            type="button"
            onClick={() => toggleWishlist(product.id)}
            aria-label={isWishlisted ? '찜 취소' : '찜하기'}
            aria-pressed={isWishlisted}
            className="inline-flex size-48 shrink-0 items-center justify-center rounded-8 border border-line-strong focus-ring"
          >
            <Icon icon={Heart} size={24} fill={isWishlisted ? 'currentColor' : 'none'} />
          </button>
          <Button
            variant="primary"
            size="m"
            isFullWidth
            disabled={!isAddable}
            onClick={handleAddToCart}
          >
            장바구니 담기
          </Button>
          <Button
            variant="secondary"
            size="m"
            isFullWidth
            disabled={!isPurchasable || missingRequiredOption}
            onClick={() => void handleBuyNow()}
          >
            바로 구매
          </Button>
        </div>
      </div>
    </>
  );
}

function ProductGallery({
  images,
  activeImage,
  onSelect,
  productName,
}: {
  images: Product['images'] | { id: string; url: string; alt: string }[];
  activeImage: { id: string; url: string; alt: string } | undefined;
  onSelect: (imageId: string) => void;
  productName: string;
}) {
  return (
    <div className="min-w-0">
      <div className="relative aspect-square max-h-640 overflow-hidden bg-surface lg:rounded-12">
        {activeImage ? (
          <ProductImage src={activeImage.url} alt={activeImage.alt} />
        ) : (
          <ProductImage src={null} alt={productName + ' 상품 이미지'} />
        )}
        <span className="absolute right-16 bottom-16 rounded-capsule bg-text-1/60 px-12 py-4 text-caption text-inverse lg:hidden">
          {activeImage
            ? images.findIndex((image) => image.id === activeImage.id) + 1 + ' / ' + images.length
            : '1 / 1'}
        </span>
      </div>
      {images.length > 1 ? (
        <ul className="mt-12 hidden grid-cols-5 gap-8 lg:grid">
          {images.map((image) => (
            <li key={image.id}>
              <button
                type="button"
                aria-label={image.alt + ' 이미지 보기'}
                aria-pressed={image.id === activeImage?.id}
                onClick={() => onSelect(image.id)}
                className={
                  image.id === activeImage?.id
                    ? 'aspect-square w-full overflow-hidden rounded-8 border border-text-1 focus-ring'
                    : 'aspect-square w-full overflow-hidden rounded-8 border border-line focus-ring'
                }
              >
                <ProductImage src={image.url} alt="" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function OptionSelect({
  option,
  value,
  priceVisible,
  onChange,
}: {
  option: ProductOption;
  value: string;
  priceVisible: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mt-16">
      <SelectField
        label={option.label}
        value={value}
        onChange={(changeEvent) => onChange(changeEvent.target.value)}
        placeholder={option.required ? option.label + '을(를) 선택해 주세요' : '선택 사항'}
        options={option.choices.map((choice) => ({
          value: choice.id,
          label:
            priceVisible && choice.priceDelta !== 0
              ? choice.label +
                ' (' +
                (choice.priceDelta > 0 ? '+' : '') +
                formatKrw(choice.priceDelta) +
                ')'
              : choice.label,
        }))}
      />
    </div>
  );
}
