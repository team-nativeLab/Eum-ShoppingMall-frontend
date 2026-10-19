'use client';

import { getApiFailureKind } from '@eum/api/errors';
import type { Category, HomeContent, HomeCtaBand, Product } from '@eum/api/types';
import { buttonClassName } from '@eum/ui/components/Button';
import { capsuleButtonClassName } from '@eum/ui/components/ButtonCapsule';
import { Chip } from '@eum/ui/components/Chip';
import { Icon } from '@eum/ui/components/Icon';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { cx } from '@eum/ui/lib/cx';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type FocusEvent, type PointerEvent } from 'react';
import { PageContainer } from '@/components/page-container';
import { usePrefersReducedMotion } from '@/lib/use-media-query';
import { filterProductsByCategoryTree } from './best-seller-filter';
import { CategoryBar, MobileCategoryGrid } from './category-bar';
import { ProductCarouselTrack, useCarouselPaging, useHomeCarouselLayout } from './product-carousel';
import { useCategoriesQuery } from './use-categories-query';
import { heroSlideStyle, useHeroSlides } from './use-hero-slides';
import { useHomeQuery } from './use-home-query';

const HOME_ERROR_COPY: Record<string, string> = {
  config: '서비스 설정 문제로 홈 콘텐츠를 불러올 수 없습니다.',
  notImplemented: '홈 콘텐츠 조회 기능을 준비하고 있습니다.',
  notFound: '홈 콘텐츠를 찾을 수 없습니다.',
  temporary: '홈 콘텐츠를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
};

/** 슬라이드 번호를 Figma 인디케이터처럼 두 자리(01, 02…)로 바꿉니다. */
function formatSlideNumber(slideIndex: number): string {
  return String(slideIndex + 1).padStart(2, '0');
}

/**
 * W-01 메인 화면. 프로모션·베스트 상품은 홈 API, 카테고리는 카테고리 API 응답으로 구성합니다.
 * 카테고리 조회가 실패해도 다른 섹션은 그대로 보여 주도록 섹션 단위로 상태를 처리합니다.
 */
export function HomeView() {
  const homeQuery = useHomeQuery();

  return (
    <>
      {/* 히어로 제목은 배너마다 바뀌므로 페이지 제목(h1)은 고정해 둡니다. */}
      <h1 className="sr-only">이음산업건설 쇼핑몰 홈</h1>
      {homeQuery.isPending ? (
        <div aria-busy="true" className="space-y-24">
          <div className="h-340 animate-pulse bg-surface lg:h-480" />
          <PageContainer>
            <div className="h-128 animate-pulse rounded-12 bg-surface" />
            <div className="mt-48 h-240 animate-pulse rounded-12 bg-surface" />
          </PageContainer>
        </div>
      ) : homeQuery.isError ? (
        <PageContainer className="py-64">
          <NoticeInline tone="danger" role="alert">
            {HOME_ERROR_COPY[getApiFailureKind(homeQuery.error)]}
          </NoticeInline>
        </PageContainer>
      ) : (
        <HomeContentView content={homeQuery.data} />
      )}
    </>
  );
}

function HomeContentView({ content }: { content: HomeContent }) {
  const categoriesQuery = useCategoriesQuery();
  const categories = categoriesQuery.data ?? [];

  return (
    // 푸터 기본 위 여백(64)과 합쳐 Figma 간격(모바일 48, 데스크톱 120)을 맞춥니다.
    <div className="-mb-16 lg:mb-56">
      <HomeHero slides={content.heroSlides} />
      {categoriesQuery.isPending ? (
        <PageContainer>
          <div
            aria-busy="true"
            className="mt-24 h-96 animate-pulse rounded-12 bg-surface lg:relative lg:z-10 lg:-mt-64 lg:h-132"
          />
        </PageContainer>
      ) : categoriesQuery.isError ? (
        <PageContainer className="pt-24 lg:pt-32">
          <NoticeInline tone="danger" role="alert">
            상품 카테고리를 불러오지 못했습니다.{' '}
            <button
              type="button"
              onClick={() => void categoriesQuery.refetch()}
              className="rounded-4 underline focus-ring"
            >
              다시 시도
            </button>
          </NoticeInline>
        </PageContainer>
      ) : (
        <>
          <PageContainer>
            <CategoryBar categories={categories} />
          </PageContainer>
          <MobileCategoryGrid categories={categories} />
        </>
      )}

      <PromoBannerSection banners={content.promoBanners} />

      <BestSellerSection products={content.featuredProducts} categories={categories} />

      {content.ctaBand ? (
        <PageContainer className="hidden lg:block">
          <QuoteBanner ctaBand={content.ctaBand} />
        </PageContainer>
      ) : null}

      <PageContainer className="hidden lg:block">
        <ServiceBenefits benefits={content.serviceBenefits} />
      </PageContainer>
    </div>
  );
}

/** 히어로 슬라이드 레이어 상태: 보이는 중 / 들어오는 중 / 나가는 중 / 숨김 */
type SlideLayerState = 'active' | 'entering' | 'leaving' | 'hidden';

/**
 * HF/Web/HeroSlider. 6초마다 다음 배너로 넘어가고, 마우스를 올리거나 포커스가 들어오면 멈춥니다.
 * 다음(자동 넘김 포함)이면 현재 배너는 왼쪽으로 나가고 새 배너가 오른쪽에서 들어오며, 이전은 반대입니다.
 * 이미지는 함께 미끄러지고 문구는 짧게 페이드+슬라이드합니다. 전환 상태는 useHeroSlides가 관리합니다
 * (전환 중 클릭은 마지막 요청 하나만 큐에 넣었다가 실행).
 * 감속 모드(prefers-reduced-motion)에서는 즉시 바꾸고, 자동 재생·진행 막대·일시정지 버튼도 숨깁니다.
 */
function HomeHero({ slides }: { slides: HomeContent['heroSlides'] }) {
  const [isPausedByUser, setIsPausedByUser] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const {
    activeIndex: safeActiveIndex,
    leavingIndex,
    direction,
    showSlide,
    showAdjacentSlide,
  } = useHeroSlides(slides.length, prefersReducedMotion);
  const activeSlide = slides[safeActiveIndex];

  if (!activeSlide) {
    return (
      <div className="flex h-340 items-center justify-center bg-surface px-20 text-center text-body-s text-text-3 lg:h-480">
        홈 배너가 등록되면 이곳에 표시됩니다.
      </div>
    );
  }

  const hasMultipleSlides = slides.length > 1;
  const canAutoplay = hasMultipleSlides && !prefersReducedMotion;
  const isAutoplayPaused = isPausedByUser || isInteracting || !canAutoplay;

  // 레이어별 상태: 이동 중이면 새 배너는 entering, 이전 배너는 leaving입니다.
  const getLayerState = (slideIndex: number): SlideLayerState => {
    if (slideIndex === safeActiveIndex) return leavingIndex === null ? 'active' : 'entering';
    return slideIndex === leavingIndex ? 'leaving' : 'hidden';
  };

  // 포커스가 히어로 밖으로 나갈 때만 자동 재생을 다시 시작합니다.
  const handleBlur = (blurEvent: FocusEvent<HTMLElement>) => {
    if (!blurEvent.currentTarget.contains(blurEvent.relatedTarget)) setIsInteracting(false);
  };

  // 터치는 pointerenter 뒤 pointerleave가 오지 않을 수 있어, 마우스일 때만 hover 정지를 적용합니다.
  const handlePointerEnter = (pointerEvent: PointerEvent<HTMLElement>) => {
    if (pointerEvent.pointerType === 'mouse') setIsInteracting(true);
  };
  const handlePointerLeave = (pointerEvent: PointerEvent<HTMLElement>) => {
    if (pointerEvent.pointerType === 'mouse') setIsInteracting(false);
  };

  return (
    <section
      aria-label="주요 프로모션"
      aria-roledescription="carousel"
      data-testid="home-hero"
      data-direction={direction}
      style={heroSlideStyle}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onFocus={() => setIsInteracting(true)}
      onBlur={handleBlur}
      className="relative isolate overflow-hidden bg-surface lg:h-480"
    >
      {slides.map((slide, slideIndex) => {
        const layerState = getLayerState(slideIndex);
        return slide.imageUrl ? (
          <div
            key={slide.id}
            aria-hidden="true"
            data-slide-layer="image"
            data-state={layerState}
            data-direction={direction}
            className={cx('absolute inset-0 -z-20', layerState === 'hidden' && 'invisible')}
          >
            {/* CMS가 제공한 배너 이미지는 Next 이미지 도메인 설정 없이 표시합니다.
                첫 배너는 LCP 후보라 우선 내려받고, 나머지는 지연 로드합니다. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.imageUrl}
              alt=""
              fetchPriority={slideIndex === 0 ? 'high' : 'auto'}
              loading={slideIndex === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className="size-full object-cover object-center"
            />
          </div>
        ) : null;
      })}
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-bg/92 to-bg/30 lg:from-bg/82 lg:to-bg/0 lg:to-50%" />
      <div className="absolute inset-0 -z-10 hidden bg-linear-to-r from-text-1/0 from-72% to-text-1/38 lg:block" />

      <PageContainer className="relative pt-48 pb-32 lg:h-full lg:pt-64 lg:pb-0">
        {/* 화면낭독기용 현재 배너 안내. 자동 넘김 중에는 읽지 않고, 멈췄을 때(직접 넘길 때)만 알립니다. */}
        <p aria-live={isAutoplayPaused ? 'polite' : 'off'} aria-atomic="true" className="sr-only">
          {`${slides.length}개 중 ${safeActiveIndex + 1}번째: ${activeSlide.title.join(' ')}`}
        </p>
        {/* 모든 배너 문구를 같은 칸에 겹쳐 두어, 높이가 가장 긴 문구에 맞춰 고정되고 전환 중 레이아웃이 튀지 않습니다. */}
        <div className="grid max-w-560">
          {slides.map((slide, slideIndex) => {
            const layerState = getLayerState(slideIndex);
            const isCurrentSlide = slideIndex === safeActiveIndex;
            const [firstDescriptionLine, ...restDescriptionLines] = slide.description.split('\n');
            return (
              <div
                key={slide.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${slides.length}개 중 ${slideIndex + 1}번째 배너`}
                aria-hidden={!isCurrentSlide}
                inert={!isCurrentSlide}
                data-slide-layer="text"
                data-state={layerState}
                data-direction={direction}
                className={cx('col-start-1 row-start-1', layerState === 'hidden' && 'invisible')}
              >
                <p className="text-overline text-text-2">{slide.eyebrow}</p>
                <h2 className="mt-12 text-display lg:text-web-display-l">
                  {slide.title.map((titleLine, lineIndex) => (
                    <span
                      key={titleLine + lineIndex}
                      className={cx('block', lineIndex > 0 && 'text-text-2')}
                    >
                      {titleLine}
                    </span>
                  ))}
                </h2>
                <p className="mt-12 text-body-m text-text-2 lg:mt-16 lg:text-web-body-xl">
                  <span className="block">{firstDescriptionLine}</span>
                  {restDescriptionLines.map((descriptionLine, lineIndex) => (
                    <span key={descriptionLine + lineIndex} className="hidden lg:block">
                      {descriptionLine}
                    </span>
                  ))}
                </p>
                <div className="mt-24 flex items-center gap-24">
                  <Link href={slide.destination} className={capsuleButtonClassName}>
                    {slide.ctaLabel}
                    <Icon icon={ArrowRight} size={16} />
                  </Link>
                  {slide.secondaryCta ? (
                    <Link
                      href={slide.secondaryCta.destination}
                      className="hidden items-center gap-6 rounded-4 text-label-l focus-ring hover:text-text-2 hover:underline hover:underline-offset-4 lg:inline-flex"
                    >
                      {slide.secondaryCta.label}
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div
          role="group"
          aria-label="배너 선택"
          className="mt-32 flex h-32 items-center gap-12 lg:mt-24"
        >
          {slides.map((slide, slideIndex) => {
            const isActive = slideIndex === safeActiveIndex;
            return (
              <div key={slide.id} className="flex items-center gap-12">
                <button
                  type="button"
                  aria-label={`${slideIndex + 1}번째 배너 보기`}
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => showSlide(slideIndex)}
                  className={cx(
                    'rounded-4 text-label-s focus-ring',
                    isActive ? 'text-text-1' : 'text-text-3 hover:text-text-1',
                  )}
                >
                  {formatSlideNumber(slideIndex)}
                </button>
                {isActive && canAutoplay ? (
                  <span
                    aria-hidden="true"
                    className="relative h-1 w-32 overflow-hidden bg-line-strong lg:w-40"
                  >
                    <span
                      key={safeActiveIndex}
                      onAnimationEnd={() => showAdjacentSlide(1)}
                      style={{ animationPlayState: isAutoplayPaused ? 'paused' : 'running' }}
                      className="animate-hero-progress absolute inset-y-0 left-0 w-1/2 bg-text-1 motion-reduce:animate-none"
                    />
                  </span>
                ) : null}
              </div>
            );
          })}
          {canAutoplay ? (
            <button
              type="button"
              onClick={() => setIsPausedByUser((isPaused) => !isPaused)}
              aria-label={isPausedByUser ? '배너 자동 넘김 시작' : '배너 자동 넘김 일시정지'}
              aria-pressed={isPausedByUser}
              className="inline-flex size-32 items-center justify-center rounded-capsule focus-ring hover:bg-bg/60"
            >
              <Icon icon={isPausedByUser ? Play : Pause} size={16} />
            </button>
          ) : null}
        </div>

        {activeSlide.tagline.length > 0 ? (
          <div className="absolute top-72 right-20 hidden gap-12 lg:flex">
            <span aria-hidden="true" className="h-120 w-1 bg-inverse" />
            <p className="text-label-m text-inverse">
              {activeSlide.tagline.map((taglineLine, lineIndex) => (
                <span key={taglineLine + lineIndex} className="block">
                  {taglineLine}
                </span>
              ))}
            </p>
          </div>
        ) : null}

        {hasMultipleSlides ? (
          <div className="absolute right-20 bottom-80 hidden gap-8 lg:flex">
            <button
              type="button"
              onClick={() => showAdjacentSlide(-1)}
              aria-label="이전 배너"
              className="inline-flex size-44 items-center justify-center rounded-capsule bg-bg shadow-2 focus-ring hover:bg-surface"
            >
              <Icon icon={ArrowLeft} size={20} />
            </button>
            <button
              type="button"
              onClick={() => showAdjacentSlide(1)}
              aria-label="다음 배너"
              className="inline-flex size-44 items-center justify-center rounded-capsule bg-bg shadow-2 focus-ring hover:bg-surface"
            >
              <Icon icon={ArrowRight} size={20} />
            </button>
          </div>
        ) : null}
      </PageContainer>
    </section>
  );
}

/** 무료배송 등 서비스 안내 띠(trust strip). 항목 사이에 세로 구분선을 둡니다. */
function ServiceBenefits({ benefits }: { benefits: HomeContent['serviceBenefits'] }) {
  if (benefits.length === 0) return null;
  return (
    <ul
      aria-label="서비스 안내"
      className="mt-64 flex items-center rounded-12 border border-line px-8 py-20"
    >
      {benefits.map((benefit, benefitIndex) => (
        <li key={benefit.id} className="flex min-w-0 flex-1 items-center">
          {benefitIndex > 0 ? <span aria-hidden="true" className="h-32 w-1 bg-line" /> : null}
          <div className="flex min-w-0 flex-1 flex-col gap-4 px-24">
            <p className="truncate text-label-m">{benefit.title}</p>
            <p className="truncate text-caption text-text-3">{benefit.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** HF/Web/PromoBanner 3개. 데스크톱은 3열, 모바일은 가로 스크롤입니다. tone으로 밝은/어두운 스타일을 고릅니다. */
function PromoBannerSection({ banners }: { banners: HomeContent['promoBanners'] }) {
  if (banners.length === 0) return null;
  return (
    <section aria-label="안전 솔루션 프로모션" className="mt-48 lg:mt-24">
      <PageContainer className="flex snap-x snap-mandatory scroll-px-20 [scrollbar-width:none] gap-12 overflow-x-auto motion-safe:scroll-smooth lg:grid lg:grid-cols-3 lg:gap-16 lg:overflow-visible">
        {banners.map((banner) => {
          const isLight = banner.tone === 'light';
          return (
            <Link
              key={banner.id}
              href={banner.destination}
              className="group relative isolate flex h-216 w-300 shrink-0 snap-start flex-col overflow-hidden rounded-12 bg-surface px-32 py-24 focus-ring lg:h-auto lg:min-h-204 lg:w-auto"
            >
              {banner.imageUrl ? (
                // CMS가 제공한 배너 이미지 URL을 직접 사용합니다. 첫 화면 아래라 지연 로드합니다.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={banner.imageUrl}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 -z-10 size-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
                />
              ) : null}
              <div
                className={cx(
                  'absolute inset-0 -z-10 bg-linear-to-r',
                  isLight ? 'from-bg/85 to-bg/5 to-75%' : 'from-text-1/72 to-text-1/15 to-90%',
                )}
              />
              <h2 className={cx('text-h2', isLight ? 'text-text-1' : 'text-inverse')}>
                {banner.title.map((titleLine, lineIndex) => (
                  <span key={titleLine + lineIndex} className="block">
                    {titleLine}
                  </span>
                ))}
              </h2>
              <div className="mt-auto flex flex-col gap-4">
                <p
                  className={cx(
                    'text-body-s whitespace-pre-line',
                    isLight ? 'text-text-2' : 'text-inverse-2',
                  )}
                >
                  {banner.description}
                </p>
                <span
                  aria-hidden="true"
                  className={cx(
                    'inline-flex size-32 shrink-0 items-center justify-center rounded-capsule border transition-colors motion-reduce:transition-none',
                    isLight
                      ? 'border-line-control text-text-1 group-hover:bg-text-1 group-hover:text-inverse'
                      : 'border-inverse text-inverse group-hover:bg-bg group-hover:text-text-1',
                  )}
                >
                  <Icon icon={ArrowRight} size={16} />
                </span>
              </div>
            </Link>
          );
        })}
      </PageContainer>
    </section>
  );
}

/**
 * 베스트 셀러. 데스크톱은 카테고리 탭 + 홈 전용 카드 캐러셀(1024px대 5장, 1280px부터 7장 이동),
 * 모바일은 칩 + 2×2 카드 페이지를 스와이프로 넘기고 하단 "전체 보기" 버튼을 둡니다(W-01m).
 * 카테고리를 불러오지 못하면 "전체" 탭만 보여 줍니다.
 */
function BestSellerSection({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const desktopLayout = useHomeCarouselLayout();
  const topLevelCategories = useMemo(
    () => categories.filter((category) => category.parentId === null),
    [categories],
  );
  const filteredProducts = useMemo(
    () => filterProductsByCategoryTree(products, categories, activeCategoryId),
    [activeCategoryId, categories, products],
  );
  const carouselPaging = useCarouselPaging(
    Math.ceil(filteredProducts.length / desktopLayout.pageSize),
    desktopLayout.pageSize,
  );
  const categoryOptions = [
    { id: null, name: '전체' },
    ...topLevelCategories.map((category) => ({ id: category.id, name: category.name })),
  ];

  // 카테고리를 바꾸면 첫 페이지부터 다시 보여 줍니다.
  const selectCategory = (categoryId: string | null) => {
    setActiveCategoryId(categoryId);
    carouselPaging.resetPaging();
  };

  return (
    <PageContainer className="mt-48 lg:mt-64">
      <section aria-labelledby="best-sellers-heading">
        <div className="flex items-center gap-32">
          <h2 id="best-sellers-heading" className="shrink-0 text-h2 lg:text-h1">
            베스트 셀러
          </h2>
          <div
            role="group"
            aria-label="베스트 상품 카테고리"
            className="hidden min-w-0 [scrollbar-width:none] items-center gap-4 overflow-x-auto lg:flex"
          >
            {categoryOptions.map((categoryOption) => {
              const isSelected = activeCategoryId === categoryOption.id;
              return (
                <button
                  key={categoryOption.id ?? 'all'}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => selectCategory(categoryOption.id)}
                  className={cx(
                    'inline-flex h-28 shrink-0 items-center rounded-capsule px-12 whitespace-nowrap focus-ring',
                    isSelected
                      ? 'bg-text-1 text-label-s text-inverse'
                      : 'text-body-s text-text-3 hover:text-text-1',
                  )}
                >
                  {categoryOption.name}
                </button>
              );
            })}
          </div>
          <Link
            href="/search"
            className="ml-auto hidden shrink-0 items-center gap-4 rounded-4 text-label-m focus-ring hover:text-text-2 lg:inline-flex"
          >
            전체 보기
            <Icon icon={ArrowRight} size={16} />
          </Link>
        </div>

        <div
          role="group"
          aria-label="베스트 상품 카테고리"
          className="mt-16 flex [scrollbar-width:none] gap-8 overflow-x-auto lg:hidden"
        >
          {categoryOptions.map((categoryOption) => (
            <Chip
              key={categoryOption.id ?? 'all'}
              isSelected={activeCategoryId === categoryOption.id}
              onClick={() => selectCategory(categoryOption.id)}
            >
              {categoryOption.name}
            </Chip>
          ))}
        </div>

        {filteredProducts.length > 0 ? (
          <div className="relative mt-16 lg:mt-24">
            <ProductCarouselTrack
              key={activeCategoryId ?? 'all'}
              products={filteredProducts}
              pageIndex={carouselPaging.pageIndex}
              direction={carouselPaging.direction}
              mobileLayout="grid"
              desktopLayout={desktopLayout}
              label="베스트 상품"
            />
            {carouselPaging.pageCount > 1 ? (
              <>
                <button
                  type="button"
                  onClick={carouselPaging.goToPrevious}
                  disabled={!carouselPaging.canGoPrevious}
                  aria-label="이전 베스트 상품"
                  className="absolute top-1/2 -left-20 hidden size-44 -translate-y-1/2 items-center justify-center rounded-capsule bg-bg shadow-2 focus-ring enabled:hover:bg-surface disabled:cursor-not-allowed disabled:text-text-disabled lg:inline-flex"
                >
                  <Icon icon={ChevronLeft} size={20} />
                </button>
                <button
                  type="button"
                  onClick={carouselPaging.goToNext}
                  disabled={!carouselPaging.canGoNext}
                  aria-label="다음 베스트 상품"
                  className="absolute top-1/2 -right-20 hidden size-44 -translate-y-1/2 items-center justify-center rounded-capsule bg-bg shadow-2 focus-ring enabled:hover:bg-surface disabled:cursor-not-allowed disabled:text-text-disabled lg:inline-flex"
                >
                  <Icon icon={ChevronRight} size={20} />
                </button>
                <p aria-live="polite" className="sr-only">
                  {carouselPaging.direction === 'none'
                    ? ''
                    : `${carouselPaging.pageCount}페이지 중 ${carouselPaging.pageIndex + 1}페이지`}
                </p>
              </>
            ) : null}
          </div>
        ) : (
          <p className="mt-16 rounded-12 border border-line px-20 py-32 text-center text-body-s text-text-3 lg:mt-48">
            선택한 카테고리에 등록된 상품이 없습니다.
          </p>
        )}
        <Link
          href="/search"
          className={cx(
            buttonClassName({ variant: 'secondary', size: 'm', isFullWidth: true }),
            'mt-16 lg:hidden',
          )}
        >
          베스트 셀러 전체 보기
        </Link>
      </section>
    </PageContainer>
  );
}

/** HF/Web/CTABand. 문구·이동 경로는 홈 응답(ctaBand)으로 받습니다(데스크톱 전용, W-01m에는 없음). */
function QuoteBanner({ ctaBand }: { ctaBand: HomeCtaBand }) {
  return (
    <section
      aria-labelledby="quote-banner-heading"
      className="mt-64 flex items-center justify-between gap-24 rounded-12 bg-text-1 px-48 py-40"
    >
      <div className="min-w-0">
        <p className="text-overline text-inverse-2">{ctaBand.eyebrow}</p>
        <h2 id="quote-banner-heading" className="mt-4 text-h2 text-inverse">
          {ctaBand.title}
        </h2>
      </div>
      <Link
        href={ctaBand.cta.destination}
        className="inline-flex h-56 shrink-0 items-center gap-8 rounded-8 border border-inverse px-24 text-label-l text-inverse transition-colors hover:bg-pressed-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inverse"
      >
        {ctaBand.cta.label}
        <Icon icon={ArrowRight} size={20} />
      </Link>
    </section>
  );
}
