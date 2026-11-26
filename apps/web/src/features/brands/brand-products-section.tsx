'use client';

import { type ApiFailureKind, getApiFailureKind } from '@eum/api/errors';
import type { BrandSummary, Product } from '@eum/api/types';
import { Button } from '@eum/ui/components/Button';
import { Icon } from '@eum/ui/components/Icon';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { cx } from '@eum/ui/lib/cx';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useEffect, useRef } from 'react';
import { PageContainer } from '@/components/page-container';
import { ProductCard } from '@/features/products/product-card';
import { buildBrandProductsHref } from '@/features/products/product-navigation';
import { useProductsQuery } from '@/features/products/use-products-query';
import { getScrollBehavior, REDUCED_MOTION_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { BRAND_SCROLL_MARGIN_CLASS } from './brand-scroll';

/** 「제품 보기」 해시 이동이 가리키는 섹션 id입니다. */
export const BRAND_PRODUCTS_SECTION_ID = 'brand-products';
/** 「제품 보기」 링크의 같은 페이지 앵커입니다. 뒤로 가기 기록을 남기려고 해시 이동을 씁니다. */
export const BRAND_PRODUCTS_SECTION_HREF = `#${BRAND_PRODUCTS_SECTION_ID}`;
const BRAND_PRODUCTS_HEADING_ID = 'brand-products-heading';
/** 선택 브랜드 상품 수. 데스크톱 5열×2행을 채우는 분량입니다(최대 두 줄). */
const BRAND_PRODUCTS_PAGE_SIZE = 10;

/**
 * 상품 그리드 배치입니다. 홈 추천과 같은 두 줄 구성을 씁니다.
 * - 데스크톱(lg): 5열, 행은 두 줄로 고정합니다(10개 = 5열×2행).
 * - 모바일: 2행을 가로로 밀어 보는 배치입니다. 2열로 세로 나열하면 10개가 다섯 줄이 되어 두 줄 구성과 맞지 않습니다.
 * 가로 스크롤은 바깥 래퍼가 맡습니다. 목록 자체에 overflow를 주면 모바일에서 문서 폭이 함께 늘어납니다.
 */
/**
 * 모바일 가로 스크롤 래퍼입니다.
 * - relative: 카드 안 sr-only(absolute) 요소가 스크롤 영역 밖으로 빠져 문서 폭을 늘리지 않게 합니다(홈 캐러셀 래퍼와 같은 이유).
 * - py-8·px-8: overflow-x는 세로 방향도 잘라서, 카드 그림자와 포커스 링이 잘리지 않도록 안쪽 여백을 줍니다.
 *   scroll-px-8: 스냅이 첫 카드를 스크롤 포트 가장자리에 맞추면 이 여백이 밀려나므로, 스냅 기준도 같은 여백으로 맞춥니다.
 *   바깥 여백(mt-8, -mb-8, -mx-8)으로 여백을 상쇄해 카드의 위치와 전체 세로 간격은 그대로 둡니다.
 * - lg에서는 overflow를 주지 않으므로 여백을 되돌립니다.
 */
const PRODUCT_SCROLLER_CLASS =
  'relative mt-8 -mb-8 -mx-8 snap-x snap-mandatory scroll-px-8 overflow-x-auto px-8 py-8 [scrollbar-width:none] lg:mx-0 lg:mt-24 lg:mb-0 lg:overflow-visible lg:px-0 lg:py-0';
const PRODUCT_GRID_CLASS =
  'grid auto-cols-[calc((100%-12px)/2)] grid-flow-col grid-rows-2 gap-x-12 gap-y-16 lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-5 lg:grid-rows-none lg:gap-x-24';

/**
 * 스켈레톤 카드의 최소 높이입니다(aspect-ratio와 함께 쓰면 max(비율 높이, 최소 높이)). 측정값에 맞춘 값입니다.
 * - lg(1024 이상): 로딩 후 카드의 최대 높이 330px에 맞췄습니다(1024~1280 측정 최대치).
 * - 기본(모바일): 바닥값 245px에 맞췄습니다(320px 측정 카드 높이). 넓은 모바일에서는 비율 높이가 더 크게 적용됩니다.
 * 측정(2026-11-26): 뷰포트 폭 1440·1280·1024·320(높이 900, 기기 에뮬레이션 없음), 홈 팝업은 sessionStorage로 숨김.
 *   스켈레톤은 삽입 직후(MutationObserver)에, 실제 카드는 목록 카드가 나타난 뒤 300ms에 article 높이를 잽니다.
 *   대기 조건: networkidle 후 목록 카드 또는 0개 안내가 보일 때까지. 차이 최대치는 1440 0, 1280 3, 1024 24, 320 18px입니다.
 *   600·768·900 측정(2026-11-26, 같은 방법): 스켈레톤 430·562·665px, 로딩 후 카드 최대 347·420·477px, 차이 최대 99·158·204px.
 *   이 구간은 스켈레톤이 비율 높이만 따라 모바일 카드 내용보다 커서 차이가 큽니다(후속 과제, 아직 조정하지 않음).
 * 프로젝트에 px 최소 높이 선례(product-card.tsx의 min-h-[384px])가 있어 새 토큰은 만들지 않았습니다.
 * 내용 구조를 복제하지 않는 이유: 실제 카드 레이아웃이 바뀔 때 스켈레톤을 함께 고쳐야 하는 중복을 피하기 위해서입니다.
 */
const SKELETON_CARD_MIN_HEIGHT_CLASS = 'min-h-[245px] lg:min-h-[330px]';

/**
 * 상품 카드를 이 섹션 안에서만 조정합니다(공용 ProductCard는 바꾸지 않습니다). 적용 대상은 아래와 같습니다.
 * - 카드 높이: li는 세로 flex이고 카드는 flex-1로 칸 높이를 채웁니다. 칸 높이는 내용이 정하며(lg는 줄 단위, 모바일은 두 행이 같은 높이로 두 행 모두 가장 큰 카드 기준),
 *   lg에서 최소 높이를 auto로 바꿔 고정 비율(181:284)이 내용을 자르지 않게 합니다. 내용이 길면 높이 증가를 허용합니다.
 * - 평점 줄: 좁은 폭에서 글자 단위로 접히지 않도록 줄바꿈을 허용하고, "평점 없음"은 한 덩어리로 둡니다.
 * - 가격 줄: 말줄임 대신 줄바꿈을 허용해 할인가·원가가 잘리지 않게 합니다.
 */
const BRAND_CARD_CLASS =
  'lg:[&_article]:min-h-[auto] [&_article_.text-price-m]:whitespace-normal [&_article_.mt-6]:flex-wrap [&_article_.mt-6_span_span]:whitespace-nowrap';

const PRODUCTS_LOAD_ERROR_COPY: Record<ApiFailureKind, { title: string; description: string }> = {
  config: {
    title: '서비스 설정 문제로 상품을 불러올 수 없습니다',
    description: '관리자에게 문의해 주세요.',
  },
  notImplemented: {
    title: '상품 조회 기능을 준비하고 있습니다',
    description: '조금만 기다려 주세요.',
  },
  notFound: {
    title: '상품을 찾을 수 없습니다',
    description: '잠시 후 다시 시도해 주세요.',
  },
  temporary: {
    title: '상품을 불러오지 못했습니다',
    description: '잠시 후 다시 시도해 주세요.',
  },
};

/**
 * 상품 섹션의 열림 요청입니다. brandId는 섹션이 속한 브랜드입니다.
 * - shouldFocus: 이 열기가 제목 포커스를 요청했는지입니다. 「제품 보기」 클릭에서만 true입니다.
 * - shouldScroll: 섹션 머리를 헤더 아래로 옮길지입니다. 「제품 보기」 클릭(다시 누른 경우 포함)과, 상품 섹션이 열린 주소로 새로고침한 경우에만 true입니다.
 *   뒤로·앞으로 가기로 열면 false입니다(F-4 범위: 기본은 옮기지 않음).
 * 클릭마다 새 객체를 만들어, 섹션이 이미 열린 상태에서 다시 눌러도 effect가 다시 돕니다.
 * 처리한 요청은 부모가 소비해 두 플래그를 false로 되돌립니다(나중에 다시 마운트되어도 움직이지 않게 합니다).
 */
export interface BrandProductsOpenRequest {
  brandId: string;
  shouldFocus: boolean;
  shouldScroll: boolean;
}

/**
 * 「제품 보기」 클릭 뒤 포커스를 섹션 제목으로 옮깁니다. 섹션이 마운트된 뒤에 호출합니다.
 * 위치 이동은 해시 이동이 맡으므로 preventScroll로 스크롤을 두 번 하지 않습니다.
 */
export function focusBrandProductsHeading() {
  document.getElementById(BRAND_PRODUCTS_HEADING_ID)?.focus({ preventScroll: true });
}

/**
 * 선택 브랜드의 상품을 두 줄 그리드로 보여 주는 섹션입니다(선택 밴드 아래, 브랜드 카드 그리드 위).
 * 「제품 보기」로 연 경우에만 마운트하므로(호출하는 쪽이 열림 상태를 정합니다), 선택만 한 브랜드는 상품 목록을 요청하지 않습니다.
 * 상품이 없는 브랜드도 마운트하지 않습니다(호출하는 쪽이 productCount를 확인합니다).
 * 제목과 「전체 보기」는 상태와 무관하게 같은 자리에 그려, 「제품 보기」 앵커 대상과 포커스 대상이 사라지지 않게 합니다.
 */
export function BrandProductsSection({
  brand,
  openRequest,
  onOpenRequestHandled,
}: {
  brand: BrandSummary;
  openRequest: BrandProductsOpenRequest;
  /** 스크롤·포커스 요청을 처리했음을 부모에 알려, 요청을 한 번만 쓰게 합니다. */
  onOpenRequestHandled: (brandId: string) => void;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  // 이 컴포넌트는 열린 뒤에만 마운트되므로(호출하는 쪽에서 확인), 조회는 항상 켜 둡니다.
  const productsQuery = useProductsQuery({
    brand: [brand.name],
    pageSize: BRAND_PRODUCTS_PAGE_SIZE,
  });
  const title = `${brand.name} 제품`;
  const products = productsQuery.data?.items ?? [];

  // 열림 요청을 마운트 직후(또는 새 요청이 생긴 직후) 한 번 처리합니다.
  // 스크롤: 루트의 scroll-margin(BRAND_SCROLL_MARGIN_CLASS)이 헤더 높이만큼 띄우므로, 루트를 block start로 옮기면 제목이 헤더 바로 아래에 옵니다.
  //   루트 위치는 섹션 안의 로딩 상태와 무관하므로(위에 있는 밴드는 고정 높이), 상품이 도착해도 위치가 밀리지 않습니다.
  // 포커스: 「제품 보기」 클릭일 때만 제목으로 옮기며, 스크롤과 별개로 처리합니다(focus는 preventScroll).
  // 요청은 한 번 처리하고 바로 소비합니다. 소비하지 않으면 상품 0개로 섹션이 내려갔다가 다시 마운트될 때 사용자 조작 없이 움직입니다.
  useEffect(() => {
    if (!openRequest.shouldScroll && !openRequest.shouldFocus) return;
    if (openRequest.shouldScroll) {
      sectionRef.current?.scrollIntoView({
        block: 'start',
        behavior: getScrollBehavior(prefersReducedMotion),
      });
    }
    if (openRequest.shouldFocus) focusBrandProductsHeading();
    onOpenRequestHandled(brand.id);
  }, [openRequest, onOpenRequestHandled, brand.id, prefersReducedMotion]);

  return (
    <div
      ref={sectionRef}
      id={BRAND_PRODUCTS_SECTION_ID}
      className={cx(BRAND_SCROLL_MARGIN_CLASS, 'pt-24 lg:pt-48')}
    >
      <PageContainer>
        <BrandProductsLayout title={title} viewAllHref={buildBrandProductsHref(brand.id)}>
          {productsQuery.isPending ? (
            <BrandProductsSkeleton />
          ) : productsQuery.isError ? (
            <BrandProductsError
              error={productsQuery.error}
              onRetry={() => void productsQuery.refetch()}
            />
          ) : products.length === 0 ? (
            <p className="mt-16 text-body-m text-text-2 lg:mt-24">현재 판매 중인 상품이 없습니다</p>
          ) : (
            <BrandProductsGrid products={products} label={title} />
          )}
        </BrandProductsLayout>
      </PageContainer>
    </div>
  );
}

/** 모든 상태가 공유하는 골격입니다. 제목과 「전체 보기」를 같은 자리에 둡니다. */
function BrandProductsLayout({
  title,
  viewAllHref,
  children,
}: {
  title: string;
  viewAllHref: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={BRAND_PRODUCTS_HEADING_ID}>
      <div className="flex min-h-40 items-center justify-between gap-16">
        <h2
          id={BRAND_PRODUCTS_HEADING_ID}
          tabIndex={-1}
          className="min-w-0 text-h3 break-words lg:text-h1"
        >
          {title}
        </h2>
        <Link
          href={viewAllHref}
          className="inline-flex shrink-0 items-center gap-4 rounded-4 text-label-m focus-ring hover:text-text-2"
        >
          전체 보기
          <Icon icon={ArrowRight} size={16} />
        </Link>
      </div>
      {children}
    </section>
  );
}

/** 로딩 중 자리표시자입니다. 실제 그리드와 같은 배치와 최소 높이를 씁니다. */
function BrandProductsSkeleton() {
  return (
    <div aria-busy="true" className={PRODUCT_SCROLLER_CLASS}>
      <div className={PRODUCT_GRID_CLASS}>
        {Array.from({ length: BRAND_PRODUCTS_PAGE_SIZE }, (_, skeletonIndex) => (
          <div
            key={skeletonIndex}
            className={cx(
              'aspect-[181/284] animate-pulse rounded-8 border border-line bg-surface',
              SKELETON_CARD_MIN_HEIGHT_CLASS,
            )}
          />
        ))}
      </div>
    </div>
  );
}

/** 상품 두 줄 그리드입니다. 목록 이름은 제목과 같게 둡니다. */
function BrandProductsGrid({ products, label }: { products: Product[]; label: string }) {
  return (
    <div className={PRODUCT_SCROLLER_CLASS}>
      <ul aria-label={label} className={cx(PRODUCT_GRID_CLASS, BRAND_CARD_CLASS)}>
        {products.map((product) => (
          <li key={product.id} className="flex min-w-0 snap-start flex-col">
            {/* 같은 줄 카드 높이를 맞추려고 카드가 칸 높이만큼 늘어납니다(BRAND_CARD_CLASS 참고). */}
            <ProductCard product={product} mobileVariant="compact" className="flex-1" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 상품 목록 조회 실패 안내입니다. 다시 시도는 일시 오류(temporary)에서만 보여 줍니다. */
function BrandProductsError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const failureKind = getApiFailureKind(error);
  const errorCopy = PRODUCTS_LOAD_ERROR_COPY[failureKind];
  return (
    <NoticeInline tone="danger" role="alert" className="mt-16 lg:mt-24">
      {errorCopy.title}. {errorCopy.description}
      {failureKind === 'temporary' ? (
        <Button variant="secondary" size="s" className="ml-8" onClick={onRetry}>
          다시 시도
        </Button>
      ) : null}
    </NoticeInline>
  );
}
