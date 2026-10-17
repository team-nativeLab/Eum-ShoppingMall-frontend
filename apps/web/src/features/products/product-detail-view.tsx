'use client';

import { getApiFailureKind } from '@eum/api/errors';
import { canAddToCart, canBuyNow, formatKrw, getPriceDisplay } from '@eum/api/price';
import { sanitizeRedirectPath } from '@eum/api/redirect';
import type { Category, Product, ProductOption } from '@eum/api/types';
import { CART_MAX_QUANTITY } from '@eum/api/cart';
import { Badge } from '@eum/ui/components/Badge';
import { Breadcrumb } from '@eum/ui/components/Breadcrumb';
import { Button } from '@eum/ui/components/Button';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { Icon, type IconSize } from '@eum/ui/components/Icon';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { QuantityStepper } from '@eum/ui/components/QuantityStepper';
import { SelectField } from '@eum/ui/components/TextField';
import { cx } from '@eum/ui/lib/cx';
import { Heart, PackageOpen, SearchX, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react';
import { PageContainer } from '@/components/page-container';
import { useCart } from '@/features/cart/cart-context';
import { getMemberAuth } from '@/lib/member-auth';
import {
  DESKTOP_QUERY,
  getScrollBehavior,
  useMediaQuery,
  usePrefersReducedMotion,
} from '@/lib/use-media-query';
import { useLocalCollections } from './local-collections-context';
import { buildQuoteInquiryHref } from '@/features/company-pages/quote-inquiry-link';
import { ProductCarouselSection } from './product-carousel';
import { ProductImage } from './product-image';
import { ProductRatingStars } from './product-rating-stars';
import { ProductReviewsSection } from './product-reviews-section';
import { useCategoriesQuery } from './use-categories-query';
import { useProductQuery } from './use-product-query';
import {
  addPurchaseLine,
  BASE_LINE_ID,
  buildPurchaseLine,
  createInitialPurchaseLines,
  getMissingRequiredOptions,
  getOptionCommitMode,
  type OptionChoices,
  type PurchaseLine,
} from './purchase-lines';
import { useRelatedProductsQuery } from './use-related-products-query';

/** 함께 구매하면 좋은 제품 최대 수(5열 × 2페이지) */
const RELATED_PRODUCT_LIMIT = 10;
/** 금액 미표시 상품 안내(데스크톱 구매 영역·모바일 하단 바 공통) */
const PRICE_HIDDEN_NOTICE =
  '금액 미공개 상품이라 바로 구매할 수 없습니다. 장바구니 담기·견적 문의만 가능합니다.';
/** 상세 탭 순서(스크롤 위치에 따라 현재 탭을 고를 때도 이 순서를 씁니다) */
const DETAIL_TAB_IDS = ['description', 'shipping', 'reviews', 'questions'] as const;

type DetailTab = (typeof DETAIL_TAB_IDS)[number];

const DETAIL_TABS: { id: DetailTab; label: string; mobileLabel: string }[] = [
  { id: 'description', label: '제품 정보', mobileLabel: '제품 정보' },
  { id: 'shipping', label: '배송/교환/반품', mobileLabel: '배송/반품' },
  { id: 'reviews', label: '리뷰', mobileLabel: '리뷰' },
  { id: 'questions', label: '상품 문의', mobileLabel: '상품 문의' },
];

/** 상세 갤러리 이미지 한 장(서버 이미지가 없으면 대표 이미지로 대체) */
interface GalleryImage {
  id: string;
  url: string;
  alt: string;
}

/** W-03 상세·금액 미표시 상태. 데이터 조회 후 최근 본 상품 ID를 저장합니다. */
export function ProductDetailView({ productId }: { productId: string }) {
  const productQuery = useProductQuery(productId);
  const categoriesQuery = useCategoriesQuery();
  const relatedQuery = useRelatedProductsQuery(productId, { limit: RELATED_PRODUCT_LIMIT });
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
          <div className="h-40 max-w-320 animate-pulse rounded-8 bg-surface" />
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
    // 상품이 바뀌면 옵션·수량 선택을 처음 상태로 되돌립니다.
    <ProductDetailContent
      key={productQuery.data.id}
      product={productQuery.data}
      categories={categoriesQuery.data ?? []}
      relatedProducts={relatedQuery.data ?? []}
    />
  );
}

/**
 * 스크롤 위치에 맞춰 현재 상세 탭을 고르는 훅.
 * sticky 헤더+탭 아래 기준선(topOffsetPx)을 지난 마지막 섹션을 현재 탭으로 봅니다.
 * IntersectionObserver가 섹션 경계를 지날 때만 다시 계산하므로 스크롤마다 상태를 바꾸지 않습니다.
 */
function useActiveDetailTab(topOffsetPx: number) {
  const [activeTab, setActiveTab] = useState<DetailTab>('description');

  useEffect(() => {
    const sectionElements = DETAIL_TAB_IDS.flatMap((tabId) => {
      const sectionElement = document.getElementById('product-tab-' + tabId);
      return sectionElement ? [{ tabId, sectionElement }] : [];
    });
    if (sectionElements.length === 0) return;
    // 기준선을 지난(위쪽 경계가 기준선보다 위인) 섹션 중 마지막을 현재 탭으로 고르는 함수
    const updateActiveTab = () => {
      let nextTab: DetailTab = DETAIL_TAB_IDS[0];
      for (const { tabId, sectionElement } of sectionElements) {
        if (sectionElement.getBoundingClientRect().top <= topOffsetPx + 1) nextTab = tabId;
      }
      setActiveTab(nextTab);
    };
    const sectionObserver = new IntersectionObserver(updateActiveTab, {
      // 기준선 바로 아래 1px 띠만 관찰해 섹션 경계가 기준선을 지날 때 알림을 받습니다.
      rootMargin: `-${topOffsetPx}px 0px -${Math.max(0, window.innerHeight - topOffsetPx - 1)}px 0px`,
    });
    for (const { sectionElement } of sectionElements) sectionObserver.observe(sectionElement);
    updateActiveTab();
    return () => sectionObserver.disconnect();
  }, [topOffsetPx]);

  return [activeTab, setActiveTab] as const;
}

/** sticky 헤더(모바일 56, 데스크톱 72+경계선 1)와 탭(56) 높이 합 */
const MOBILE_STICKY_OFFSET_PX = 112;
const DESKTOP_STICKY_OFFSET_PX = 129;

function ProductDetailContent({
  product,
  categories,
  relatedProducts,
}: {
  product: Product;
  categories: Category[];
  relatedProducts: Product[];
}) {
  const router = useRouter();
  const { addToCart } = useCart();
  const { wishlistIds, toggleWishlist } = useLocalCollections();
  const [purchaseLines, setPurchaseLines] = useState<PurchaseLine[]>(() =>
    createInitialPurchaseLines(product),
  );
  // 줄로 확정하기 전까지 모아 두는 선택값(옵션 ID → 선택지 ID). 선택 옵션도 여기 모였다가 함께 줄이 됩니다.
  const [pendingChoices, setPendingChoices] = useState<OptionChoices>({});
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; message: string } | null>(
    null,
  );
  const [requiredOptionErrorId, setRequiredOptionErrorId] = useState<string | null>(null);
  const focusNextRequiredOptionRef = useRef(false);
  // 바로 구매 처리 중(로그인 확인·이동) 연타 방지. ref는 같은 틱 안의 중복 클릭까지 막습니다.
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  const isBuyingNowRef = useRef(false);
  const optionsContainerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [activeTab, setActiveTab] = useActiveDetailTab(
    isDesktop ? DESKTOP_STICKY_OFFSET_PX : MOBILE_STICKY_OFFSET_PX,
  );
  const optionCommitMode = getOptionCommitMode(product);
  const priceDisplay = getPriceDisplay(product);
  const isPriceVisible = priceDisplay.isPriceVisible && product.price !== null;
  const category = categories.find((categoryItem) => categoryItem.id === product.categoryId);
  const isWishlisted = wishlistIds.includes(product.id);
  const isSoldOut = product.stockStatus === 'soldOut';
  const isPurchasable = canBuyNow(product);
  const isAddable = canAddToCart(product);
  const selectedPurchaseLines = purchaseLines.filter(
    (line) => product.options.length > 0 || line.lineId !== BASE_LINE_ID || line.quantity !== 1,
  );
  const totalQuantity = purchaseLines.reduce((quantitySum, line) => quantitySum + line.quantity, 0);
  const galleryImages: GalleryImage[] =
    product.images.length > 0
      ? product.images
      : product.thumbnailUrl
        ? [{ id: 'thumbnail', url: product.thumbnailUrl, alt: product.name }]
        : [];

  // 선택 줄 금액(단가 + 옵션 추가금) × 수량. 금액 미표시 상품은 계산하지 않습니다.
  const getLineAmount = (line: PurchaseLine): number | null =>
    isPriceVisible && product.price !== null
      ? (product.price + line.priceDelta) * line.quantity
      : null;
  const totalAmount = isPriceVisible
    ? purchaseLines.reduce((amountSum, line) => amountSum + (getLineAmount(line) ?? 0), 0)
    : null;
  // 금액 공개 상품에서 아직 고른 줄이 없으면 합계 대신 "–"를 보여 줍니다(₩0으로 오해하지 않게).
  const totalAmountText =
    totalAmount === null
      ? priceDisplay.text
      : purchaseLines.length === 0
        ? '–'
        : formatKrw(totalAmount);
  // 옵션 선택값을 모으고, 필수 옵션이 모두 채워지면(auto) 모은 선택 옵션과 함께 한 줄로 확정하는 함수
  const handleChoiceChange = (productOption: ProductOption, choiceId: string) => {
    const hadRequiredOptionError = requiredOptionErrorId !== null;
    setNotice(null);
    const nextChoices = { ...pendingChoices, [productOption.id]: choiceId };
    if (optionCommitMode !== 'auto') {
      setPendingChoices(nextChoices);
      return;
    }
    const lineDraft = buildPurchaseLine(product, nextChoices);
    if (!lineDraft) {
      setPendingChoices(nextChoices);
      if (hadRequiredOptionError) {
        const firstMissingOption = getMissingRequiredOptions(product, nextChoices)[0];
        setRequiredOptionErrorId(firstMissingOption?.id ?? null);
        focusNextRequiredOptionRef.current = Boolean(firstMissingOption);
      }
      return;
    }
    setRequiredOptionErrorId(null);
    focusNextRequiredOptionRef.current = false;
    setPendingChoices({});
    setPurchaseLines((currentLines) => addPurchaseLine(currentLines, lineDraft));
  };

  // 선택 옵션만 있는 상품(manual)에서 "추가" 버튼으로 지금 고른 구성을 줄로 확정하는 함수
  const commitPendingChoices = () => {
    const lineDraft = buildPurchaseLine(product, pendingChoices);
    if (!lineDraft) return;
    setNotice(null);
    setPendingChoices({});
    setPurchaseLines((currentLines) => addPurchaseLine(currentLines, lineDraft));
  };

  // 옵션 셀렉트로 스크롤하고 포커스를 주는 함수. reduced-motion 설정도 반영합니다.
  const focusOption = useCallback(
    (option?: ProductOption) => {
      if (!option) return;
      const selectElements = [
        ...(optionsContainerRef.current?.querySelectorAll<HTMLSelectElement>('select') ?? []),
      ];
      const targetIndex = product.options.indexOf(option);
      const targetSelect = selectElements[Math.max(0, targetIndex)];
      if (!targetSelect) return;
      targetSelect.scrollIntoView({
        behavior: getScrollBehavior(prefersReducedMotion),
        block: 'center',
      });
      targetSelect.focus({ preventScroll: true });
    },
    [prefersReducedMotion, product.options],
  );

  // 비어 있는 필수 옵션(없으면 첫 옵션) 셀렉트로 스크롤하고 포커스를 주는 함수
  const focusFirstMissingOption = () => {
    focusOption(getMissingRequiredOptions(product, pendingChoices)[0] ?? product.options[0]);
  };

  useEffect(() => {
    if (!focusNextRequiredOptionRef.current) return;
    focusNextRequiredOptionRef.current = false;
    focusOption(getMissingRequiredOptions(product, pendingChoices)[0]);
  }, [focusOption, pendingChoices, product]);

  const changeLineQuantity = (lineId: string, quantity: number) => {
    setPurchaseLines((currentLines) =>
      currentLines.map((line) => (line.lineId === lineId ? { ...line, quantity } : line)),
    );
  };

  const removeLine = (lineId: string) => {
    setPurchaseLines((currentLines) => currentLines.filter((line) => line.lineId !== lineId));
  };

  // 선택 줄을 모두 장바구니에 담는 함수. 담을 줄이 없으면 옵션 선택을 안내하고 옵션 셀렉트로 이동합니다.
  const addLinesToCart = (): boolean => {
    if (purchaseLines.length === 0) {
      const firstMissingOption = getMissingRequiredOptions(product, pendingChoices)[0];
      if (firstMissingOption) {
        setNotice(null);
        setRequiredOptionErrorId(firstMissingOption.id);
        focusOption(firstMissingOption);
      } else {
        setRequiredOptionErrorId(null);
        setNotice({ tone: 'danger', message: '옵션을 고른 뒤 추가 버튼을 눌러 주세요.' });
        focusFirstMissingOption();
      }
      return false;
    }
    setRequiredOptionErrorId(null);
    for (const line of purchaseLines) {
      addToCart(product, line.quantity, line.optionId, line.optionLabel);
    }
    return true;
  };

  const handleAddToCart = () => {
    if (!isAddable) return;
    if (addLinesToCart()) setNotice({ tone: 'success', message: '장바구니에 담았습니다.' });
  };

  // 바로 구매: 처리 중이면 무시하고, 담은 뒤 로그인 여부에 따라 주문서 또는 로그인으로 보냅니다.
  const handleBuyNow = async () => {
    if (!isPurchasable || isBuyingNowRef.current || !addLinesToCart()) return;
    isBuyingNowRef.current = true;
    setIsBuyingNow(true);
    const returnPath = sanitizeRedirectPath('/checkout/shipping');
    try {
      const currentMember = await (await getMemberAuth()).getCurrentUser();
      router.push(currentMember ? returnPath : '/login?redirect=' + encodeURIComponent(returnPath));
    } catch {
      // real 인증 연동 전에는 로그인으로 보내고, 실제 주문 권한은 서버가 확인합니다.
      router.push('/login?redirect=' + encodeURIComponent(returnPath));
    } finally {
      // 이동이 끝나면 화면이 바뀌지만, 이동이 막혀 머무는 경우를 위해 다시 누를 수 있게 풉니다.
      isBuyingNowRef.current = false;
      setIsBuyingNow(false);
    }
  };

  const selectTab = (tabId: DetailTab) => {
    setActiveTab(tabId);
    document
      .getElementById('product-tab-' + tabId)
      ?.scrollIntoView({ behavior: getScrollBehavior(prefersReducedMotion), block: 'start' });
  };
  const isBuyNowDisabled = !isPurchasable || isBuyingNow;
  const noticeClassName = cx(
    'text-body-s',
    notice?.tone === 'danger' ? 'text-danger' : 'text-success',
  );

  const wishButtonLabel = isWishlisted ? '찜 취소' : '찜하기';
  const shippingSummary =
    product.shipping.method +
    ' · ' +
    (product.shipping.fee === 0 ? '무료' : formatKrw(product.shipping.fee));
  const certificationText = product.certifications.length
    ? product.certifications.join(', ')
    : '인증 정보 없음';

  return (
    <>
      <PageContainer className="pb-56 lg:pt-24 lg:pb-56">
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

        <div className="grid lg:mt-24 lg:grid-cols-[minmax(0,636fr)_minmax(0,612fr)] lg:gap-48">
          <ProductGallery images={galleryImages} productName={product.name} />

          <div className="min-w-0">
            <section aria-labelledby="product-title" className="py-24 lg:py-0">
              <div className="flex items-center gap-6">
                <p className="text-caption-medium text-text-3">{product.brand}</p>
                {!priceDisplay.isPriceVisible ? <Badge tone="outline">금액 미표시</Badge> : null}
                {isSoldOut ? <Badge tone="soldout">품절</Badge> : null}
              </div>
              <h1 id="product-title" className="mt-6 text-h2 lg:mt-8 lg:text-web-h2">
                {product.name}
              </h1>
              <div className="mt-8 flex items-center gap-8 lg:mt-12 lg:gap-4">
                <ProductRatingStars rating={product.rating} />
                <span className="text-caption text-text-3">
                  ({product.reviewCount.toLocaleString('ko-KR')})
                </span>
              </div>
              <div className="mt-12 lg:mt-20">
                {priceDisplay.listPriceText ? (
                  <p className="text-body-s text-text-3 line-through">
                    <span className="sr-only">정가 </span>
                    {priceDisplay.listPriceText}
                  </p>
                ) : null}
                <div className="mt-4 flex items-baseline gap-8">
                  {priceDisplay.discountRateLabel !== null ? (
                    <span className="text-title text-danger">{priceDisplay.discountRateLabel}</span>
                  ) : null}
                  <p
                    className={cx(
                      'text-price-l lg:text-web-price-xl',
                      priceDisplay.discountRateLabel !== null && 'text-danger',
                      !priceDisplay.isPriceVisible && 'text-text-2',
                    )}
                  >
                    {priceDisplay.listPriceText ? <span className="sr-only">판매가 </span> : null}
                    {priceDisplay.text}
                  </p>
                </div>
              </div>

              {/* 모바일(W-03m): 배송·인증·원산지 요약 박스 */}
              <dl className="mt-20 flex flex-col gap-8 rounded-12 border border-line bg-bg-subtle p-16 text-body-s lg:hidden">
                <InfoRow label="배송" labelClassName="w-72" value={shippingSummary} />
                <InfoRow label="안전인증" labelClassName="w-72" value={certificationText} />
                <InfoRow
                  label="원산지"
                  labelClassName="w-72"
                  value={product.shipping.countryOfOrigin}
                />
              </dl>

              {/* 데스크톱(W-03): 구분선 아래 정보 표 */}
              <div className="mt-24 hidden border-t border-line pt-24 lg:block">
                <dl className="flex flex-col gap-12 text-body-s">
                  {product.modelName ? (
                    <InfoRow label="모델명" labelClassName="w-96" value={product.modelName} />
                  ) : null}
                  <InfoRow label="안전인증" labelClassName="w-96" value={certificationText} />
                  <InfoRow
                    label="원산지"
                    labelClassName="w-96"
                    value={product.shipping.countryOfOrigin}
                  />
                  <InfoRow label="배송" labelClassName="w-96" value={shippingSummary} />
                </dl>
              </div>

              <div ref={optionsContainerRef} className="mt-24 flex flex-col gap-12">
                {product.options.map((productOption) => (
                  <OptionSelect
                    key={productOption.id}
                    option={productOption}
                    value={pendingChoices[productOption.id] ?? ''}
                    isPriceVisible={isPriceVisible}
                    errorMessage={
                      requiredOptionErrorId === productOption.id
                        ? '필수 옵션을 선택해 주세요.'
                        : undefined
                    }
                    onChange={(choiceId) => handleChoiceChange(productOption, choiceId)}
                  />
                ))}

                {optionCommitMode === 'manual' ? (
                  <Button
                    variant="secondary"
                    size="m"
                    disabled={!isAddable}
                    onClick={commitPendingChoices}
                    className="self-start"
                  >
                    선택한 구성 추가
                  </Button>
                ) : null}

                {purchaseLines.length > 0 ? (
                  <ul aria-label="선택한 옵션" className="flex flex-col gap-8">
                    {purchaseLines.map((line) => {
                      const lineAmount = getLineAmount(line);
                      const canRemoveLine = line.lineId !== BASE_LINE_ID;
                      return (
                        <li
                          key={line.lineId}
                          className="flex flex-wrap items-center gap-x-16 gap-y-8 rounded-8 border border-line bg-bg-subtle p-16"
                        >
                          <span className="min-w-0 flex-1 text-body-s">{line.displayLabel}</span>
                          <div className="flex items-center gap-16">
                            <QuantityStepper
                              value={line.quantity}
                              onValueChange={(quantity) =>
                                changeLineQuantity(line.lineId, quantity)
                              }
                              max={CART_MAX_QUANTITY}
                              label={line.displayLabel + ' 수량'}
                              isDisabled={!isAddable}
                              className="self-center"
                            />
                            {lineAmount !== null ? (
                              <span className="min-w-72 text-right text-price-m">
                                {formatKrw(lineAmount)}
                              </span>
                            ) : null}
                            {canRemoveLine ? (
                              <button
                                type="button"
                                aria-label={line.displayLabel + ' 선택 취소'}
                                onClick={() => removeLine(line.lineId)}
                                className="inline-flex size-28 items-center justify-center rounded-4 text-text-2 focus-ring hover:text-text-1"
                              >
                                <Icon icon={X} size={20} />
                              </button>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>

              {isPriceVisible && purchaseLines.length > 0 ? (
                <div className="mt-24 flex items-center justify-between gap-12">
                  <span className="text-title">총 금액 ({totalQuantity}개)</span>
                  <span className="text-price-l">{totalAmountText}</span>
                </div>
              ) : null}

              <div className="mt-20 hidden grid-cols-[56px_minmax(0,1fr)_minmax(0,1fr)] gap-8 lg:grid">
                <WishButton
                  isWishlisted={isWishlisted}
                  label={wishButtonLabel}
                  onToggle={() => toggleWishlist(product.id)}
                  className="size-56"
                />
                <Button variant="primary" size="l" disabled={!isAddable} onClick={handleAddToCart}>
                  장바구니 담기
                </Button>
                <Button
                  variant="secondary"
                  size="l"
                  disabled={isBuyNowDisabled}
                  onClick={() => void handleBuyNow()}
                >
                  바로 구매
                </Button>
              </div>
              {!priceDisplay.isPriceVisible ? (
                <NoticeInline tone="neutral" className="mt-12 hidden lg:flex">
                  {PRICE_HIDDEN_NOTICE}
                </NoticeInline>
              ) : null}
              {isSoldOut ? (
                <NoticeInline tone="neutral" className="mt-12">
                  현재 품절된 상품입니다.
                </NoticeInline>
              ) : null}
              {/* 데스크톱 알림. 모바일은 하단 바 위에 같은 알림을 띄웁니다(숨긴 쪽은 읽히지 않음). */}
              <p role="status" className={cx(noticeClassName, 'hidden lg:block', notice && 'mt-8')}>
                {notice?.message}
              </p>
              <Link
                href={
                  selectedPurchaseLines.length > 0
                    ? buildQuoteInquiryHref(
                        selectedPurchaseLines.map((line) => ({
                          productId: product.id,
                          optionId: line.optionId,
                          quantity: line.quantity,
                        })),
                      )
                    : `/solutions?productId=${encodeURIComponent(product.id)}`
                }
                className="mt-16 inline-flex rounded-4 text-label-m focus-ring hover:text-text-2 hover:underline hover:underline-offset-2 focus-visible:underline focus-visible:underline-offset-2"
              >
                대량 구매는 견적 문의 →
              </Link>
            </section>

            {product.purchaseNotices.length > 0 ? (
              <dl
                aria-label="구매 전 안내"
                className="mt-20 hidden flex-col gap-12 rounded-12 border border-line bg-bg-subtle p-20 lg:flex"
              >
                {product.purchaseNotices.map((purchaseNotice) => (
                  <div key={purchaseNotice.label} className="flex items-center gap-16">
                    <dt className="w-72 shrink-0 text-body-s-medium">{purchaseNotice.label}</dt>
                    <dd className="min-w-0 text-caption text-text-3">
                      {purchaseNotice.description}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </div>

        <div className="mt-40 min-w-0 lg:mt-96">
          <nav
            aria-label="상품 상세 탭"
            className="sticky top-56 z-20 -mx-20 grid grid-cols-4 border-b border-line bg-bg lg:top-72 lg:mx-0"
          >
            {DETAIL_TABS.map((detailTab) => {
              const isActive = activeTab === detailTab.id;
              const reviewSuffix = detailTab.id === 'reviews' ? ` (${product.reviewCount})` : '';
              return (
                <a
                  key={detailTab.id}
                  href={'#product-tab-' + detailTab.id}
                  aria-current={isActive ? 'location' : undefined}
                  onClick={(clickEvent) => {
                    clickEvent.preventDefault();
                    selectTab(detailTab.id);
                  }}
                  className={cx(
                    'inline-flex h-56 min-w-0 items-center justify-center px-4 text-label-l whitespace-nowrap focus-ring lg:px-24',
                    isActive
                      ? 'border-b-2 border-text-1 text-text-1'
                      : 'text-text-3 hover:text-text-1',
                  )}
                >
                  <span className="truncate lg:hidden">{detailTab.mobileLabel + reviewSuffix}</span>
                  <span className="hidden truncate lg:inline">
                    {detailTab.label + reviewSuffix}
                  </span>
                </a>
              );
            })}
          </nav>

          <div className="mt-24 flex flex-col gap-48 lg:mt-40 lg:gap-64">
            <section
              id="product-tab-description"
              aria-labelledby="product-description-heading"
              className="scroll-mt-120 lg:scroll-mt-136"
            >
              <h2 id="product-description-heading" className="sr-only">
                제품 정보
              </h2>
              {product.summary ? (
                <p className="mb-20 text-body-m whitespace-pre-line text-text-2">
                  {product.summary}
                </p>
              ) : null}
              <div className="mx-auto aspect-[856/1200] w-full max-w-[856px] overflow-hidden rounded-12 bg-surface">
                <ProductImage
                  src={galleryImages[0]?.url ?? null}
                  alt={galleryImages[0]?.alt ?? product.name + ' 상세 이미지'}
                />
              </div>
            </section>

            {product.specifications.length > 0 ? (
              <section aria-labelledby="product-spec-heading" className="flex flex-col gap-16">
                <h2 id="product-spec-heading" className="text-h3">
                  제품 사양
                </h2>
                <dl className="border-t-2 border-text-1">
                  {product.specifications.map((specification) => (
                    <div
                      key={specification.label}
                      className="grid grid-cols-[120px_minmax(0,1fr)] border-b border-line text-body-s lg:grid-cols-[196px_minmax(0,1fr)]"
                    >
                      <dt className="flex min-h-52 items-center bg-surface px-16 text-body-s-medium text-text-2">
                        {specification.label}
                      </dt>
                      <dd className="flex items-center px-16 py-12">{specification.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            <section
              id="product-tab-shipping"
              aria-labelledby="shipping-heading"
              className="flex scroll-mt-120 flex-col gap-16 lg:scroll-mt-136"
            >
              <h2 id="shipping-heading" className="text-h3">
                배송/교환/반품 안내
              </h2>
              <p className="text-body-m whitespace-pre-line text-text-2">
                {product.shipping.policy || product.shipping.estimate}
              </p>
              <Link
                href="/shipping-policy"
                className="w-fit rounded-4 text-label-s underline focus-ring"
              >
                배송·교환·반품 정책 자세히 보기
              </Link>
            </section>

            <ProductReviewsSection
              productId={product.id}
              reviewCount={product.reviewCount}
              sectionId="product-tab-reviews"
              brand={product.brand}
            />

            <section
              id="product-tab-questions"
              aria-labelledby="questions-heading"
              className="scroll-mt-120 lg:scroll-mt-136"
            >
              <div className="flex flex-wrap items-center justify-between gap-12">
                <h2 id="questions-heading" className="text-h3">
                  상품 문의
                </h2>
                <Link
                  href={
                    '/login?redirect=' +
                    encodeURIComponent('/products/' + encodeURIComponent(product.id))
                  }
                  className="rounded-4 text-label-s underline focus-ring"
                >
                  문의하기
                </Link>
              </div>
              <EmptyState
                icon={PackageOpen}
                title="등록된 상품 문의가 없습니다"
                headingLevel="h3"
                className="pt-48"
              />
            </section>
          </div>
        </div>

        <ProductCarouselSection
          headingId="related-products-heading"
          title="함께 구매하면 좋은 제품"
          itemLabel="함께 구매하면 좋은 제품"
          products={relatedProducts}
          viewAllHref={category ? '/category/' + encodeURIComponent(category.slug) : '/search'}
          className="mt-80 lg:mt-120"
        />
      </PageContainer>

      {/* W-03m 하단 구매 바. 본문 끝에서는 푸터 위에 멈추도록 sticky로 둡니다. */}
      <div className="sticky bottom-0 z-30 bg-bg lg:hidden">
        {/* 모바일 알림: 하단 바 바로 위에 띄워 버튼을 누른 결과가 화면 안에 보이게 합니다. */}
        <p
          role="status"
          className={cx(noticeClassName, notice && 'border-t border-line px-20 py-10')}
        >
          {notice?.message}
        </p>
        {!priceDisplay.isPriceVisible ? (
          <NoticeInline isFullBleed>{PRICE_HIDDEN_NOTICE}</NoticeInline>
        ) : null}
        <div className="grid grid-cols-[56px_minmax(0,1fr)_minmax(0,1fr)] gap-8 border-t border-line px-20 py-12 pb-[max(env(safe-area-inset-bottom),12px)] max-mweb:gap-6 max-mweb:px-16">
          <WishButton
            isWishlisted={isWishlisted}
            label={wishButtonLabel}
            onToggle={() => toggleWishlist(product.id)}
            className="size-56"
            iconSize={24}
          />
          {/* 360px 같은 좁은 폭에서도 글자가 버튼 밖으로 나가지 않게 좌우 여백을 줄이고 줄임표로 자릅니다. */}
          <Button
            variant="primary"
            size="l"
            isFullWidth
            disabled={!isAddable}
            onClick={handleAddToCart}
            className="px-8"
          >
            <span className="min-w-0 truncate">장바구니 담기</span>
          </Button>
          <Button
            variant="secondary"
            size="l"
            isFullWidth
            disabled={isBuyNowDisabled}
            onClick={() => void handleBuyNow()}
            className="px-8"
          >
            <span className="min-w-0 truncate">바로 구매</span>
          </Button>
        </div>
      </div>
    </>
  );
}

/** 라벨 + 값 한 줄(구매 영역 정보 표) */
function InfoRow({
  label,
  value,
  labelClassName,
}: {
  label: string;
  value: string;
  labelClassName: string;
}) {
  return (
    <div className="flex items-start">
      <dt className={cx('shrink-0 text-text-3', labelClassName)}>{label}</dt>
      <dd className="min-w-0 text-text-1">{value}</dd>
    </div>
  );
}

/** 찜 토글 버튼(테두리 정사각형) */
function WishButton({
  isWishlisted,
  label,
  onToggle,
  className,
  iconSize = 24,
}: {
  isWishlisted: boolean;
  label: string;
  onToggle: () => void;
  className: string;
  iconSize?: IconSize;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={isWishlisted}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-8 border border-line-strong bg-bg focus-ring hover:bg-surface',
        className,
      )}
    >
      <Icon icon={Heart} size={iconSize} fill={isWishlisted ? 'currentColor' : 'none'} />
    </button>
  );
}

/**
 * 상품 갤러리.
 * - 데스크톱: 큰 이미지 + 썸네일 5개(선택한 썸네일은 2px 테두리, aria-pressed).
 * - 모바일(W-03m): 화면 폭 정사각형을 가로로 스와이프(scroll-snap)하고 "현재 / 전체"를 보여 줍니다.
 */
function ProductGallery({ images, productName }: { images: GalleryImage[]; productName: string }) {
  const [activeImageId, setActiveImageId] = useState<string | null>(images[0]?.id ?? null);
  const [mobileImageIndex, setMobileImageIndex] = useState(0);
  const activeImage = images.find((image) => image.id === activeImageId) ?? images[0];
  const placeholderAlt = productName + ' 상품 이미지';

  // 스와이프 위치로 현재 이미지 번호를 계산합니다.
  const handleMobileScroll = (scrollEvent: UIEvent<HTMLDivElement>) => {
    const scrollElement = scrollEvent.currentTarget;
    if (scrollElement.clientWidth === 0) return;
    setMobileImageIndex(Math.round(scrollElement.scrollLeft / scrollElement.clientWidth));
  };

  return (
    <div className="min-w-0">
      <div className="relative -mx-20 lg:hidden">
        <div
          onScroll={handleMobileScroll}
          className="flex aspect-square snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto bg-surface"
        >
          {images.length > 0 ? (
            images.map((image) => (
              <div key={image.id} className="aspect-square w-full shrink-0 snap-start">
                <ProductImage src={image.url} alt={image.alt} />
              </div>
            ))
          ) : (
            <div className="aspect-square w-full shrink-0">
              <ProductImage src={null} alt={placeholderAlt} />
            </div>
          )}
        </div>
        <span className="absolute right-16 bottom-16 inline-flex h-24 items-center rounded-12 bg-dim px-10 text-caption text-inverse">
          <span className="sr-only">이미지 </span>
          {Math.min(mobileImageIndex + 1, Math.max(images.length, 1))} /{' '}
          {Math.max(images.length, 1)}
        </span>
      </div>

      <div className="hidden lg:block">
        <div className="aspect-square overflow-hidden rounded-12 bg-surface">
          <ProductImage src={activeImage?.url ?? null} alt={activeImage?.alt ?? placeholderAlt} />
        </div>
        {images.length > 1 ? (
          <ul
            aria-label="상품 이미지 선택"
            className="mt-16 grid grid-cols-[repeat(5,minmax(0,96px))] gap-12"
          >
            {images.map((image, imageIndex) => {
              const isSelected = image.id === activeImage?.id;
              return (
                <li key={image.id}>
                  <button
                    type="button"
                    aria-label={`${imageIndex + 1}번째 이미지 보기`}
                    aria-pressed={isSelected}
                    onClick={() => setActiveImageId(image.id)}
                    className={cx(
                      'block aspect-square w-full overflow-hidden rounded-8 focus-ring',
                      isSelected
                        ? 'border-2 border-text-1'
                        : 'border border-line hover:border-line-strong',
                    )}
                  >
                    <ProductImage src={image.url} alt="" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/** 옵션 선택(HF/TextField Select). 고르면 선택 줄로 추가되고 다시 비워집니다. */
function OptionSelect({
  option,
  value,
  isPriceVisible,
  errorMessage,
  onChange,
}: {
  option: ProductOption;
  value: string;
  isPriceVisible: boolean;
  errorMessage?: string;
  onChange: (value: string) => void;
}) {
  return (
    <SelectField
      label={option.label}
      errorMessage={errorMessage}
      value={value}
      onChange={(changeEvent) => {
        if (changeEvent.target.value) onChange(changeEvent.target.value);
      }}
      placeholder={option.required ? option.label + '을(를) 선택해 주세요' : '선택 사항'}
      options={option.choices.map((choice) => ({
        value: choice.id,
        label:
          isPriceVisible && choice.priceDelta !== 0
            ? choice.label +
              ' (' +
              (choice.priceDelta > 0 ? '+' : '') +
              formatKrw(choice.priceDelta) +
              ')'
            : choice.label,
      }))}
    />
  );
}
