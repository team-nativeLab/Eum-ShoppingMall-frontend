'use client';

import { getApiFailureKind } from '@eum/api/errors';
import type { Category, HomeContent, Product } from '@eum/api/types';
import { buttonClassName } from '@eum/ui/components/Button';
import { capsuleButtonClassName } from '@eum/ui/components/ButtonCapsule';
import { Chip } from '@eum/ui/components/Chip';
import { Icon } from '@eum/ui/components/Icon';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { cx } from '@eum/ui/lib/cx';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Pause,
  Play,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type FocusEvent } from 'react';
import { PageContainer } from '@/components/page-container';
import { CategoryBar, MobileCategoryGrid } from './category-bar';
import { ProductCard } from './product-card';
import { useCategoriesQuery } from './use-categories-query';
import { useHomeQuery } from './use-home-query';

const HOME_ERROR_COPY: Record<string, string> = {
  config: '서비스 설정 문제로 홈 콘텐츠를 불러올 수 없습니다.',
  notImplemented: '홈 콘텐츠 조회 기능을 준비하고 있습니다.',
  notFound: '홈 콘텐츠를 찾을 수 없습니다.',
  temporary: '홈 콘텐츠를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
};

/** 데스크톱 베스트 셀러 한 화면에 보이는 카드 수(Figma 5열) */
const BEST_SELLER_PAGE_SIZE = 5;
/** 모바일 베스트 셀러에 보여 줄 카드 수(Figma W-01m 2×2) */
const MOBILE_BEST_SELLER_COUNT = 4;

/** 슬라이드 번호를 Figma 인디케이터처럼 두 자리(01, 02…)로 바꿉니다. */
function formatSlideNumber(slideIndex: number): string {
  return String(slideIndex + 1).padStart(2, '0');
}

/** W-01 메인 화면. 프로모션·베스트 상품·카테고리는 홈/API 응답에 맞춰 구성합니다. */
export function HomeView() {
  const homeQuery = useHomeQuery();
  const categoriesQuery = useCategoriesQuery();

  if (homeQuery.isPending || categoriesQuery.isPending) {
    return (
      <div aria-busy="true" className="space-y-24">
        <div className="h-340 animate-pulse bg-surface lg:h-480" />
        <PageContainer>
          <div className="h-128 animate-pulse rounded-12 bg-surface" />
          <div className="mt-48 h-240 animate-pulse rounded-12 bg-surface" />
        </PageContainer>
      </div>
    );
  }

  if (homeQuery.isError || categoriesQuery.isError) {
    const error = homeQuery.error ?? categoriesQuery.error;
    return (
      <PageContainer className="py-64">
        <NoticeInline tone="danger" role="alert">
          {HOME_ERROR_COPY[getApiFailureKind(error)]}
        </NoticeInline>
      </PageContainer>
    );
  }

  return <HomeContentView content={homeQuery.data} categories={categoriesQuery.data} />;
}

function HomeContentView({
  content,
  categories,
}: {
  content: HomeContent;
  categories: Category[];
}) {
  return (
    // 푸터 기본 위 여백(64)과 합쳐 Figma 간격(모바일 48, 데스크톱 120)을 맞춥니다.
    <div className="-mb-16 lg:mb-56">
      <HomeHero slides={content.heroSlides} />
      <PageContainer>
        <CategoryBar categories={categories} />
      </PageContainer>
      <MobileCategoryGrid categories={categories} />

      <PageContainer className="hidden lg:block">
        <ServiceBenefits benefits={content.serviceBenefits} />
      </PageContainer>

      <PromoBannerSection banners={content.promoBanners} />

      <BestSellerSection products={content.featuredProducts} categories={categories} />

      <PageContainer className="hidden lg:block">
        <QuoteBanner />
      </PageContainer>
    </div>
  );
}

/**
 * HF/Web/HeroSlider. 6초마다 다음 배너로 넘어가고, 마우스를 올리거나 포커스가 들어오면 멈춥니다.
 * 진행 막대 애니메이션이 끝날 때 다음 배너로 넘기므로, 감속 모드(prefers-reduced-motion)에서는 자동 재생하지 않습니다.
 */
function HomeHero({ slides }: { slides: HomeContent['heroSlides'] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPausedByUser, setIsPausedByUser] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const activeSlide = slides[activeIndex];

  if (!activeSlide) {
    return (
      <div className="flex h-340 items-center justify-center bg-surface px-20 text-center text-body-s text-text-3 lg:h-480">
        홈 배너가 등록되면 이곳에 표시됩니다.
      </div>
    );
  }

  const hasMultipleSlides = slides.length > 1;
  const isAutoplayPaused = isPausedByUser || isInteracting;
  const [firstDescriptionLine, ...restDescriptionLines] = activeSlide.description.split('\n');

  const changeSlide = (direction: -1 | 1) => {
    setActiveIndex((currentIndex) => (currentIndex + direction + slides.length) % slides.length);
  };

  // 포커스가 히어로 밖으로 나갈 때만 자동 재생을 다시 시작합니다.
  const handleBlur = (blurEvent: FocusEvent<HTMLElement>) => {
    if (!blurEvent.currentTarget.contains(blurEvent.relatedTarget)) setIsInteracting(false);
  };

  return (
    <section
      aria-label="주요 프로모션"
      aria-roledescription="carousel"
      onMouseEnter={() => setIsInteracting(true)}
      onMouseLeave={() => setIsInteracting(false)}
      onFocus={() => setIsInteracting(true)}
      onBlur={handleBlur}
      className="relative isolate overflow-hidden bg-surface lg:h-480"
    >
      {activeSlide.imageUrl ? (
        // CMS가 제공한 배너 이미지는 Next 이미지 도메인 설정 없이 표시합니다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={activeSlide.imageUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-10 size-full object-cover object-center"
        />
      ) : null}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#ffffffeb_0%,#ffffff4d_100%)] lg:bg-[linear-gradient(90deg,#12121200_72%,#12121261_100%),linear-gradient(90deg,#ffffffd1_0%,#ffffff00_50%)]" />

      <PageContainer className="relative pt-48 pb-32 lg:h-full lg:pt-64 lg:pb-0">
        <div
          aria-roledescription="slide"
          aria-label={`${slides.length}개 중 ${activeIndex + 1}번째 배너`}
          aria-live={isAutoplayPaused ? 'polite' : 'off'}
          className="max-w-560"
        >
          <p className="text-overline text-text-2">{activeSlide.eyebrow}</p>
          <h1 className="mt-12 text-display lg:text-web-display-l">
            {activeSlide.title.map((titleLine, lineIndex) => (
              <span
                key={titleLine + lineIndex}
                className={cx('block', lineIndex > 0 && 'text-text-2')}
              >
                {titleLine}
              </span>
            ))}
          </h1>
          <p className="mt-12 text-body-m text-text-2 lg:mt-16 lg:text-web-body-xl">
            <span className="block">{firstDescriptionLine}</span>
            {restDescriptionLines.map((descriptionLine, lineIndex) => (
              <span key={descriptionLine + lineIndex} className="hidden lg:block">
                {descriptionLine}
              </span>
            ))}
          </p>
          <div className="mt-24 flex items-center gap-24">
            <Link href={activeSlide.destination} className={capsuleButtonClassName}>
              제품 둘러보기
              <Icon icon={ArrowRight} size={16} />
            </Link>
            <Link
              href="/about"
              className="hidden items-center gap-6 rounded-4 text-label-l focus-ring hover:text-text-2 lg:inline-flex"
            >
              회사소개 보기
              <Icon icon={CirclePlus} size={20} />
            </Link>
          </div>
        </div>

        <div
          role="group"
          aria-label="배너 선택"
          className="mt-32 flex h-32 items-center gap-12 lg:mt-24"
        >
          {slides.map((slide, slideIndex) => {
            const isActive = slideIndex === activeIndex;
            return (
              <div key={slide.id} className="flex items-center gap-12">
                <button
                  type="button"
                  aria-label={`${slideIndex + 1}번째 배너 보기`}
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => setActiveIndex(slideIndex)}
                  className={cx(
                    'rounded-4 text-label-s focus-ring',
                    isActive ? 'text-text-1' : 'text-text-3 hover:text-text-1',
                  )}
                >
                  {formatSlideNumber(slideIndex)}
                </button>
                {isActive && hasMultipleSlides ? (
                  <span
                    aria-hidden="true"
                    className="relative h-1 w-32 overflow-hidden bg-line-strong lg:w-40"
                  >
                    <span
                      key={activeIndex}
                      onAnimationEnd={() => changeSlide(1)}
                      style={{ animationPlayState: isAutoplayPaused ? 'paused' : 'running' }}
                      className="animate-hero-progress absolute inset-y-0 left-0 w-1/2 bg-text-1 motion-reduce:animate-none"
                    />
                  </span>
                ) : null}
              </div>
            );
          })}
          {hasMultipleSlides ? (
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
              onClick={() => changeSlide(-1)}
              aria-label="이전 배너"
              className="inline-flex size-44 items-center justify-center rounded-capsule bg-bg shadow-2 focus-ring hover:bg-surface"
            >
              <Icon icon={ArrowLeft} size={20} />
            </button>
            <button
              type="button"
              onClick={() => changeSlide(1)}
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
    <ul className="mt-48 flex items-center rounded-12 border border-line px-8 py-20">
      {benefits.map((benefit, benefitIndex) => (
        <li key={benefit.id} className="flex min-w-0 flex-1 items-center">
          {benefitIndex > 0 ? <span aria-hidden="true" className="h-32 w-1 bg-line" /> : null}
          <div className="flex min-w-0 flex-1 flex-col gap-4 px-24">
            <h3 className="truncate text-label-m">{benefit.title}</h3>
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
      <PageContainer className="flex snap-x snap-mandatory [scrollbar-width:none] gap-12 overflow-x-auto lg:grid lg:grid-cols-3 lg:gap-24 lg:overflow-visible">
        {banners.map((banner) => {
          const isLight = banner.tone === 'light';
          return (
            <Link
              key={banner.id}
              href={banner.destination}
              className="group relative isolate flex h-216 w-300 shrink-0 snap-start flex-col overflow-hidden rounded-12 bg-surface px-32 py-24 focus-ring lg:w-auto"
            >
              {banner.imageUrl ? (
                // CMS가 제공한 배너 이미지 URL을 직접 사용합니다.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={banner.imageUrl}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 size-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
                />
              ) : null}
              <div
                className={cx(
                  'absolute inset-0 -z-10',
                  isLight
                    ? 'bg-[linear-gradient(90deg,#ffffffd9_0%,#ffffff0d_75%)]'
                    : 'bg-[linear-gradient(90deg,#121212b8_0%,#12121226_90%)]',
                )}
              />
              <h2 className={cx('text-h2', isLight ? 'text-text-1' : 'text-inverse')}>
                {banner.title.map((titleLine, lineIndex) => (
                  <span key={titleLine + lineIndex} className="block">
                    {titleLine}
                  </span>
                ))}
              </h2>
              <p
                className={cx(
                  'mt-8 text-body-s whitespace-pre-line',
                  isLight ? 'text-text-2' : 'text-inverse-2',
                )}
              >
                {banner.description}
              </p>
              <span
                aria-hidden="true"
                className={cx(
                  'mt-auto inline-flex size-36 items-center justify-center rounded-capsule border',
                  isLight ? 'border-line-control text-text-1' : 'border-inverse text-inverse',
                )}
              >
                <Icon icon={ArrowRight} size={16} />
              </span>
            </Link>
          );
        })}
      </PageContainer>
    </section>
  );
}

/**
 * 베스트 셀러. 데스크톱은 카테고리 탭 + 5열 페이지(이전/다음 버튼),
 * 모바일은 칩 + 2×2 카드 + 하단 "전체 보기" 버튼입니다(W-01m).
 */
function BestSellerSection({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const topLevelCategories = useMemo(
    () => categories.filter((category) => category.parentId === null),
    [categories],
  );
  const filteredProducts = useMemo(
    () =>
      activeCategoryId === null
        ? products
        : products.filter((product) => product.categoryId === activeCategoryId),
    [activeCategoryId, products],
  );
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / BEST_SELLER_PAGE_SIZE));
  const visibleProducts = filteredProducts.slice(
    pageIndex * BEST_SELLER_PAGE_SIZE,
    (pageIndex + 1) * BEST_SELLER_PAGE_SIZE,
  );
  const categoryOptions = [
    { id: null, name: '전체' },
    ...topLevelCategories.map((category) => ({ id: category.id, name: category.name })),
  ];

  // 카테고리를 바꾸면 첫 페이지부터 다시 보여 줍니다.
  const selectCategory = (categoryId: string | null) => {
    setActiveCategoryId(categoryId);
    setPageIndex(0);
  };

  return (
    <PageContainer className="mt-48 lg:mt-96">
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

        {visibleProducts.length > 0 ? (
          <div className="relative mt-16 lg:mt-48">
            <ul className="grid grid-cols-2 gap-x-12 gap-y-16 lg:grid-cols-5 lg:gap-24">
              {visibleProducts.map((product, productIndex) => (
                <li
                  key={product.id}
                  className={cx(
                    'min-w-0',
                    productIndex >= MOBILE_BEST_SELLER_COUNT && 'hidden lg:block',
                  )}
                >
                  <ProductCard product={product} mobileVariant="compact" className="h-full" />
                </li>
              ))}
            </ul>
            {pageIndex > 0 ? (
              <button
                type="button"
                onClick={() => setPageIndex((currentPage) => currentPage - 1)}
                aria-label="이전 베스트 상품"
                className="absolute top-1/2 -left-20 hidden size-44 -translate-y-1/2 items-center justify-center rounded-capsule bg-bg shadow-2 focus-ring hover:bg-surface lg:inline-flex"
              >
                <Icon icon={ChevronLeft} size={20} />
              </button>
            ) : null}
            {pageIndex < pageCount - 1 ? (
              <button
                type="button"
                onClick={() => setPageIndex((currentPage) => currentPage + 1)}
                aria-label="다음 베스트 상품"
                className="absolute top-1/2 -right-20 hidden size-44 -translate-y-1/2 items-center justify-center rounded-capsule bg-bg shadow-2 focus-ring hover:bg-surface lg:inline-flex"
              >
                <Icon icon={ChevronRight} size={20} />
              </button>
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

/** HF/Web/CTABand. 맞춤 견적 문의로 이동합니다(데스크톱 전용, W-01m에는 없음). */
function QuoteBanner() {
  return (
    <section
      aria-labelledby="quote-banner-heading"
      className="mt-96 flex items-center justify-between gap-24 rounded-12 bg-text-1 px-48 py-40"
    >
      <div className="min-w-0">
        <p className="text-overline text-inverse-2">CUSTOM ORDER</p>
        <h2 id="quote-banner-heading" className="mt-4 text-h2 text-inverse">
          현장에 꼭 맞는 안전 솔루션, 지금 상담받아 보세요.
        </h2>
      </div>
      <Link
        href="/solutions"
        className="inline-flex h-56 shrink-0 items-center gap-8 rounded-8 border border-inverse px-24 text-label-l text-inverse transition-colors hover:bg-pressed-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inverse"
      >
        견적 문의하기
        <Icon icon={ArrowRight} size={20} />
      </Link>
    </section>
  );
}
