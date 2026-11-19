'use client';

import type { Category, ProductSuggestion } from '@eum/api/types';
import { Button } from '@eum/ui/components/Button';
import { Icon } from '@eum/ui/components/Icon';
import { Toast } from '@eum/ui/components/Toast';
import { cx } from '@eum/ui/lib/cx';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleX,
  Heart,
  LayoutGrid,
  Search,
  Share2,
  UserRound,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
  type TransitionEvent as ReactTransitionEvent,
} from 'react';
import { CartLink } from './cart-link';
import { PageContainer } from './page-container';
import {
  getCategoryHref,
  getCurrentMenuHref,
  isCustomOrderCategory,
} from '@/features/products/category-href';
import { useCategoriesQuery } from '@/features/products/use-categories-query';
import { useProductSuggestionsQuery } from '@/features/products/use-product-suggestions-query';
import {
  buildBrandHref,
  getPrimaryNavigationItems,
  isPrimaryNavigationItemActive,
} from '@/features/products/product-navigation';

const ALL_MENU_ID = 'site-header-all-menu';
const MENU_TRANSITION_DURATION_MS = 160;
/** 메가메뉴 섹션 링크 목록을 2열로 나누는 최소 항목 수(「전체 보기」 포함). */
const MENU_TWO_COLUMN_MIN_ITEMS = 5;
const SAFETY_MATJIP_LOGO_SRC = '/assets/web/safety-matjip-logo.png';

/** 데스크톱 GNB 주요 메뉴. 활성 메뉴는 경로만으로 정하므로 쿼리(useSearchParams)·Suspense가 필요 없습니다. */
function PrimaryNavigation({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  // 간격은 gap-16(xl 미만, 1024~1279 폭에서 검색 입력 폭 확보), gap-32(1280~1439), gap-40(1440 이상) 순서입니다.
  // xl은 Tailwind 기본 80rem(1280px)이며 packages/ui 토큰에서 재정의하지 않습니다.
  return (
    <nav
      aria-label="주요 메뉴"
      className="flex h-full shrink-0 items-center gap-16 min-[1440px]:gap-40 xl:gap-32"
    >
      {getPrimaryNavigationItems().map((navigationItem) => {
        const isActive = isPrimaryNavigationItemActive(navigationItem, pathname);
        return (
          <Link
            key={navigationItem.key}
            href={navigationItem.href}
            onClick={onNavigate}
            aria-current={isActive ? 'page' : undefined}
            className={cx(
              'relative inline-flex h-full items-center text-label-l whitespace-nowrap text-text-1 focus-ring',
              isActive
                ? 'after:absolute after:inset-x-0 after:bottom-0 after:h-2 after:bg-text-1'
                : 'hover:text-text-2',
            )}
          >
            {navigationItem.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** 헤더 검색창 공통 props(검색어 값은 주소에서 정합니다) */
type UrlKeywordSearchProps = Omit<Parameters<typeof HeaderSearch>[0], 'value' | 'onValueChange'>;

// Suspense 대기 중 빈 검색창이 입력을 받지 않도록 쓰는 빈 함수
function ignoreValueChange() {}

/**
 * 주소의 검색어(/search?q=)로 첫 렌더부터 채워지는 헤더 검색창.
 * useSearchParams는 정적 화면에서 Suspense가 필요해, 대기 중에는 같은 모양의 빈 검색창을 그립니다
 * (헤더 전체가 아니라 검색창만 다시 그려집니다). 요청마다 렌더링하는 /search는 서버 HTML부터 검색어가 들어 있어
 * 하이드레이션 값이 어긋나지 않습니다.
 */
function UrlKeywordHeaderSearch(searchProps: UrlKeywordSearchProps) {
  return (
    <Suspense
      fallback={<HeaderSearch {...searchProps} value="" onValueChange={ignoreValueChange} />}
    >
      <UrlKeywordHeaderSearchField {...searchProps} />
    </Suspense>
  );
}

/** 주소 검색어를 초기값으로 갖고, 주소 검색어가 바뀌면 그 값으로 맞추는 검색창 */
function UrlKeywordHeaderSearchField(searchProps: UrlKeywordSearchProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlKeyword = pathname === '/search' ? (searchParams.get('q') ?? '') : '';
  const [searchValue, setSearchValue] = useState(urlKeyword);
  // 다른 검색·다른 화면으로 이동하면 검색창을 주소 값으로 맞춥니다. 렌더 중 보정이라 effect가 필요 없습니다.
  const [syncedUrlKeyword, setSyncedUrlKeyword] = useState(urlKeyword);
  if (syncedUrlKeyword !== urlKeyword) {
    setSyncedUrlKeyword(urlKeyword);
    setSearchValue(urlKeyword);
  }
  return <HeaderSearch {...searchProps} value={searchValue} onValueChange={setSearchValue} />;
}

/** HF/Web/GNB: 데스크톱 탐색·검색·찜·장바구니·전체 메뉴와 모바일 헤더를 제공합니다. */
export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const categoriesQuery = useCategoriesQuery();
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMenuMounted, setIsMenuMounted] = useState(false);
  const [isMenuMotionOpen, setIsMenuMotionOpen] = useState(false);
  const [isMenuInteractive, setIsMenuInteractive] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const isMenuOpenRef = useRef(false);
  const menuUnmountTimerRef = useRef<number | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const shouldRestoreMenuFocusRef = useRef(false);
  // 메뉴를 연 직후 한 번만 패널 안의 닫기 버튼으로 포커스를 옮기기 위한 표시입니다.
  const shouldFocusMenuOnOpenRef = useRef(false);
  const desktopMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const productDetailBackButtonRef = useRef<HTMLButtonElement>(null);
  const checkoutLogoRef = useRef<HTMLAnchorElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const menuCloseButtonRef = useRef<HTMLButtonElement>(null);
  const categoryList = categoriesQuery.data ?? [];
  const isMenuVisible = isMenuOpen;
  const closeMenu = useCallback((restoreFocus = false) => {
    if (!isMenuOpenRef.current) return;

    isMenuOpenRef.current = false;
    setIsMenuOpen(false);
    setIsMenuMotionOpen(false);
    setIsMenuInteractive(false);
    setIsMobileSearchOpen(false);
    if (menuUnmountTimerRef.current !== null) {
      window.clearTimeout(menuUnmountTimerRef.current);
    }
    menuUnmountTimerRef.current = window.setTimeout(() => {
      setIsMenuMounted(false);
      menuUnmountTimerRef.current = null;
    }, MENU_TRANSITION_DURATION_MS);
    shouldRestoreMenuFocusRef.current = restoreFocus;
    shouldFocusMenuOnOpenRef.current = false;
    if (!restoreFocus) menuTriggerRef.current = null;
  }, []);
  const toggleMenu = (trigger: HTMLButtonElement) => {
    if (isMenuOpenRef.current) {
      closeMenu();
      return;
    }

    const prefersReducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    const isReopeningDuringExit = menuUnmountTimerRef.current !== null;
    if (menuUnmountTimerRef.current !== null) {
      window.clearTimeout(menuUnmountTimerRef.current);
      menuUnmountTimerRef.current = null;
    }
    shouldRestoreMenuFocusRef.current = false;
    menuTriggerRef.current = trigger;
    shouldFocusMenuOnOpenRef.current = true;
    isMenuOpenRef.current = true;
    setIsMenuOpen(true);
    setIsMenuMotionOpen(prefersReducedMotion || isReopeningDuringExit);
    setIsMenuInteractive(prefersReducedMotion);
    setIsMenuMounted(true);
    setIsMobileSearchOpen(false);
  };
  // 상품 상세는 모바일에서만 상세 전용 헤더(뒤로·공유·장바구니)를 씁니다. 데스크톱 GNB는 항상 그립니다.
  const isProductDetail = pathname.startsWith('/products/');
  const checkoutStep = pathname.startsWith('/checkout/')
    ? pathname === '/checkout/shipping'
      ? 1
      : pathname === '/checkout/payment'
        ? 2
        : pathname === '/checkout/complete'
          ? 3
          : 0
    : 0;
  const searchKeyword = (keyword: string) => {
    setIsMobileSearchOpen(false);
    closeMenu();
    router.push('/search?q=' + encodeURIComponent(keyword));
  };

  // 닫힌 상태를 반영한 뒤 현재 보이는 트리거를 씁니다.
  // 트리거가 없는 화면에서는 체크아웃 로고나 상세 모바일 뒤로 버튼으로 복귀합니다.
  useLayoutEffect(() => {
    if (isMenuVisible || !shouldRestoreMenuFocusRef.current) return;

    shouldRestoreMenuFocusRef.current = false;
    const openedMenuTrigger = menuTriggerRef.current;
    menuTriggerRef.current = null;
    const isDesktopViewport = window.innerWidth >= 1024;
    const currentMenuFocusTarget =
      checkoutStep > 0
        ? checkoutLogoRef.current
        : isDesktopViewport
          ? desktopMenuButtonRef.current
          : isProductDetail
            ? productDetailBackButtonRef.current
            : mobileMenuButtonRef.current;
    const openedTriggerIsVisible =
      checkoutStep === 0 &&
      (isDesktopViewport
        ? openedMenuTrigger === desktopMenuButtonRef.current
        : !isProductDetail && openedMenuTrigger === mobileMenuButtonRef.current);
    const focusTarget = openedTriggerIsVisible ? openedMenuTrigger : currentMenuFocusTarget;
    focusTarget?.focus();
  }, [checkoutStep, isMenuVisible, isProductDetail]);

  // 패널이 상호작용 가능해지면(inert 해제) 닫기 버튼으로 포커스를 옮깁니다. 그러면 Tab 한 번에 메뉴 항목으로 갑니다.
  useEffect(() => {
    if (!isMenuVisible || !isMenuInteractive || !shouldFocusMenuOnOpenRef.current) return;

    shouldFocusMenuOnOpenRef.current = false;
    // 열리는 사이 사용자가 다른 곳으로 포커스를 옮겼다면 빼앗지 않습니다.
    const activeElement = document.activeElement;
    const isFocusOnOpener =
      activeElement === document.body || activeElement === menuTriggerRef.current;
    if (!isFocusOnOpener) return;
    menuCloseButtonRef.current?.focus();
  }, [isMenuInteractive, isMenuVisible]);

  // Mount first in the closed visual state, then start the entrance on the next frame.
  useLayoutEffect(() => {
    if (!isMenuMounted || !isMenuVisible || isMenuMotionOpen) return;

    let entranceFrame: number | null = null;
    const initialFrame = window.requestAnimationFrame(() => {
      entranceFrame = window.requestAnimationFrame(() => setIsMenuMotionOpen(true));
    });
    return () => {
      window.cancelAnimationFrame(initialFrame);
      if (entranceFrame !== null) window.cancelAnimationFrame(entranceFrame);
    };
  }, [isMenuMounted, isMenuMotionOpen, isMenuVisible]);

  // Keep the entering menu out of the accessibility tree and inactive until its transition completes.
  useEffect(() => {
    if (!isMenuMounted || !isMenuVisible || !isMenuMotionOpen || isMenuInteractive) return;

    const duration = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 0
      : MENU_TRANSITION_DURATION_MS;
    const interactionTimer = window.setTimeout(() => setIsMenuInteractive(true), duration);
    return () => window.clearTimeout(interactionTimer);
  }, [isMenuInteractive, isMenuMounted, isMenuMotionOpen, isMenuVisible]);

  const handleMenuTransitionEnd = (transitionEvent: ReactTransitionEvent<HTMLDivElement>) => {
    if (
      !isMenuVisible ||
      !isMenuMotionOpen ||
      transitionEvent.target !== transitionEvent.currentTarget ||
      transitionEvent.propertyName !== 'opacity'
    ) {
      return;
    }
    setIsMenuInteractive(true);
  };

  // 데스크톱 GNB는 첫 8px 스크롤부터 Figma의 compact 높이로 전환합니다.
  // 높이 변경으로 브라우저가 scrollY를 8px 보정해도 임계점에서 반복 전환되지 않도록 복귀점은 4px로 둡니다.
  // 첫 렌더는 고정값이라 SSR/하이드레이션 결과가 같고, 감속 설정에서는 CSS transition을 끕니다.
  useEffect(() => {
    const updateHeaderState = () => {
      setIsScrolled(
        (wasScrolled) => window.innerWidth >= 1024 && window.scrollY >= (wasScrolled ? 4 : 8),
      );
    };
    updateHeaderState();
    window.addEventListener('scroll', updateHeaderState, { passive: true });
    window.addEventListener('resize', updateHeaderState);
    return () => {
      window.removeEventListener('scroll', updateHeaderState);
      window.removeEventListener('resize', updateHeaderState);
    };
  }, []);

  useEffect(() => {
    if (!isMenuVisible) return;

    const handleMenuKeyDown = (keyEvent: globalThis.KeyboardEvent) => {
      if (keyEvent.key !== 'Escape') return;
      keyEvent.preventDefault();
      closeMenu(true);
    };
    const handleOutsidePointerDown = (pointerEvent: globalThis.PointerEvent) => {
      if (!(pointerEvent.target instanceof Node)) return;
      const pointerTarget = pointerEvent.target;
      if (
        menuPanelRef.current?.contains(pointerTarget) ||
        desktopMenuButtonRef.current?.contains(pointerTarget) ||
        mobileMenuButtonRef.current?.contains(pointerTarget)
      ) {
        return;
      }
      closeMenu();
    };

    window.addEventListener('keydown', handleMenuKeyDown);
    window.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => {
      window.removeEventListener('keydown', handleMenuKeyDown);
      window.removeEventListener('pointerdown', handleOutsidePointerDown);
    };
  }, [closeMenu, isMenuVisible]);

  useEffect(
    () => () => {
      if (menuUnmountTimerRef.current !== null) {
        window.clearTimeout(menuUnmountTimerRef.current);
      }
    },
    [],
  );

  const openProduct = (productId: string) => {
    setIsMobileSearchOpen(false);
    closeMenu();
    router.push('/products/' + encodeURIComponent(productId));
  };

  // 로그인·회원가입 화면은 공용 헤더를 그리지 않습니다(demo-mode-banner.tsx와 같은 규칙). 모든 훅 호출 뒤에서 return합니다.
  if (pathname === '/login' || pathname === '/signup') return null;
  if (checkoutStep > 0) {
    const checkoutSteps = ['배송지', '결제', '완료'];
    return (
      <header className="border-b border-line bg-bg">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-16 focus:left-16 focus:z-50 focus:rounded-8 focus:bg-text-1 focus:px-16 focus:py-8 focus:text-label-m focus:text-inverse"
        >
          본문 바로가기
        </a>
        <PageContainer className="flex min-h-64 flex-col items-stretch gap-8 py-8 sm:flex-row sm:items-center sm:justify-between sm:gap-24 sm:py-0">
          <Link
            href="/"
            ref={checkoutLogoRef}
            className="self-start rounded-4 focus-ring sm:self-auto"
          >
            <Image
              src={SAFETY_MATJIP_LOGO_SRC}
              alt="안전맛집"
              width={2000}
              height={667}
              className="h-50 w-150 object-contain object-left"
            />
          </Link>
          <ol
            aria-label="주문 진행 단계"
            className="flex w-full items-center justify-between gap-4 sm:w-auto sm:gap-12"
          >
            {checkoutSteps.map((stepLabel, stepIndex) => {
              const stepNumber = stepIndex + 1;
              const isComplete = stepNumber < checkoutStep;
              const isCurrent = stepNumber === checkoutStep;
              return (
                <li key={stepLabel} className="flex items-center gap-4 sm:gap-12">
                  {stepIndex > 0 ? (
                    <span aria-hidden="true" className="h-1 w-12 bg-line-strong sm:w-32" />
                  ) : null}
                  <span
                    aria-current={isCurrent ? 'step' : undefined}
                    className={cx(
                      'inline-flex items-center gap-8 text-label-m whitespace-nowrap',
                      isCurrent || isComplete ? 'text-text-1' : 'text-text-3',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cx(
                        'inline-flex size-24 items-center justify-center rounded-capsule border text-caption',
                        isCurrent || isComplete
                          ? 'border-text-1 bg-text-1 text-inverse'
                          : 'border-line-strong bg-bg text-text-3',
                      )}
                    >
                      {isComplete ? <Check size={14} /> : stepNumber}
                    </span>
                    {stepLabel}
                  </span>
                </li>
              );
            })}
          </ol>
        </PageContainer>
      </header>
    );
  }

  return (
    <>
      <header
        className={cx(
          'sticky top-0 border-line bg-bg transition-[box-shadow] duration-200 ease-[cubic-bezier(.2,0,0,1)] motion-reduce:transition-none lg:border-b',
          isMenuMounted ? 'z-50' : 'z-30',
          isScrolled && 'shadow-1',
          isProductDetail && 'border-b',
        )}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-16 focus:left-16 focus:z-50 focus:rounded-8 focus:bg-text-1 focus:px-16 focus:py-8 focus:text-label-m focus:text-inverse"
        >
          본문 바로가기
        </a>
        <PageContainer
          className={cx(
            'hidden items-center transition-[height] duration-200 ease-[cubic-bezier(.2,0,0,1)] motion-reduce:transition-none lg:flex',
            isScrolled ? 'h-64' : 'h-72',
          )}
        >
          {/* 전체 메뉴 버튼은 로고 왼쪽에 둡니다. 블록 폭은 버튼 44 + 간격 8 + 로고 208 + 여백 24를 담아 모든 데스크톱 폭에서 같습니다. */}
          <div className="flex w-284 shrink-0 items-center gap-8">
            <button
              ref={desktopMenuButtonRef}
              type="button"
              onClick={(clickEvent) => toggleMenu(clickEvent.currentTarget)}
              aria-label={isMenuVisible ? '전체 메뉴 닫기' : '전체 메뉴 열기'}
              aria-controls={ALL_MENU_ID}
              aria-expanded={isMenuVisible}
              className="inline-flex size-44 shrink-0 items-center justify-center rounded-8 focus-ring hover:bg-surface"
            >
              <Icon icon={LayoutGrid} size={24} />
            </button>
            <Link href="/" className="rounded-4 focus-ring">
              <Image
                src={SAFETY_MATJIP_LOGO_SRC}
                alt="안전맛집"
                width={2000}
                height={667}
                className="h-69 w-208 object-contain object-left"
              />
            </Link>
          </div>
          <PrimaryNavigation pathname={pathname} onNavigate={() => closeMenu()} />
          <div className="flex min-w-0 flex-1 justify-end pl-24">
            <UrlKeywordHeaderSearch
              onSearchKeyword={searchKeyword}
              onSelectProduct={openProduct}
              onOpenPanel={() => closeMenu()}
              className="w-full max-w-335"
            />
          </div>
          <div className="ml-24 flex shrink-0 items-center gap-4">
            <Link
              href="/login"
              aria-label="로그인"
              className="inline-flex size-44 items-center justify-center rounded-8 focus-ring hover:bg-surface"
            >
              <Icon icon={UserRound} size={24} />
            </Link>
            <Link
              href="/mypage/wishlist"
              aria-label="찜한 상품"
              className="inline-flex size-44 items-center justify-center rounded-8 focus-ring hover:bg-surface"
            >
              <Icon icon={Heart} size={24} />
            </Link>
            <CartLink />
          </div>
        </PageContainer>

        {isProductDetail ? (
          <ProductDetailMobileBar backButtonRef={productDetailBackButtonRef} />
        ) : (
          <>
            <div className="flex h-56 items-center justify-between px-10 lg:hidden">
              <div className="flex items-center gap-2">
                <button
                  ref={mobileMenuButtonRef}
                  type="button"
                  onClick={(clickEvent) => toggleMenu(clickEvent.currentTarget)}
                  aria-label={isMenuVisible ? '전체 메뉴 닫기' : '전체 메뉴 열기'}
                  aria-controls={ALL_MENU_ID}
                  aria-expanded={isMenuVisible}
                  className="inline-flex size-44 items-center justify-center rounded-8 focus-ring hover:bg-surface"
                >
                  <Icon icon={LayoutGrid} size={24} />
                </button>
                <Link href="/" className="rounded-4 focus-ring">
                  <Image
                    src={SAFETY_MATJIP_LOGO_SRC}
                    alt="안전맛집"
                    width={2000}
                    height={667}
                    className="h-46 w-138 object-contain object-left"
                  />
                </Link>
              </div>
              <div className="flex items-center">
                <button
                  type="button"
                  aria-label={isMobileSearchOpen ? '검색 닫기' : '검색 열기'}
                  aria-expanded={isMobileSearchOpen}
                  onClick={() => {
                    if (!isMobileSearchOpen) closeMenu();
                    setIsMobileSearchOpen((isOpen) => !isOpen);
                  }}
                  className="inline-flex size-44 items-center justify-center rounded-8 focus-ring hover:bg-surface"
                >
                  <Icon icon={isMobileSearchOpen ? X : Search} size={24} />
                </button>
                <CartLink />
              </div>
            </div>
            {isMobileSearchOpen ? (
              <PageContainer className="pb-12 lg:hidden">
                <UrlKeywordHeaderSearch
                  onSearchKeyword={searchKeyword}
                  onSelectProduct={openProduct}
                  onOpenPanel={() => closeMenu()}
                  onEscape={() => setIsMobileSearchOpen(false)}
                />
              </PageContainer>
            ) : null}
          </>
        )}
        <div
          ref={menuPanelRef}
          id={ALL_MENU_ID}
          aria-hidden={!isMenuVisible || !isMenuInteractive}
          inert={!isMenuVisible || !isMenuInteractive}
          hidden={!isMenuMounted}
          data-state={isMenuVisible ? 'open' : 'closed'}
          data-menu-motion-state={isMenuMotionOpen ? 'open' : 'closed'}
          onTransitionEnd={handleMenuTransitionEnd}
          style={{
            translate: isMenuMotionOpen ? '-50% -50%' : '-50% calc(-50% - 8px)',
            transitionDuration: `${MENU_TRANSITION_DURATION_MS}ms`,
          }}
          className={cx(
            // 패널 높이 상한은 승인된 값(100dvh-210px)입니다. 헤더 하단(97px) 아래에 머물도록 하며, lg 이상은 내용이 적어도 같은 높이를 유지하도록 최소 높이를 줍니다(모바일 아코디언은 기존 동작 유지).
            'fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-210px)] w-[calc(100%_-_32px)] max-w-[1380px] overflow-x-hidden overflow-y-auto rounded-8 border border-line-strong bg-bg shadow-2 transition-[opacity,translate] ease-out motion-reduce:transition-none lg:min-h-[calc(100dvh-210px)] lg:w-[calc(100%_-_48px)]',
            (!isMenuVisible || !isMenuInteractive) && 'pointer-events-none',
            isMenuMotionOpen ? 'opacity-100' : 'opacity-0',
          )}
        >
          {isMenuMounted ? (
            <AllMenuDropdown
              closeButtonRef={menuCloseButtonRef}
              categories={categoryList}
              pathname={pathname}
              onClose={() => closeMenu(true)}
              onNavigate={() => closeMenu()}
            />
          ) : null}
        </div>
      </header>
    </>
  );
}

/**
 * W-03m 상품 상세 모바일 헤더(뒤로·공유·장바구니). 데스크톱에서는 숨깁니다.
 * 뒤로가기는 이전 기록이 없으면(새 탭으로 바로 연 경우) 홈으로 보냅니다.
 */
function ProductDetailMobileBar({
  backButtonRef,
}: {
  backButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  const router = useRouter();
  const [shareMessage, setShareMessage] = useState('');

  useEffect(() => {
    if (!shareMessage) return;
    const hideTimer = window.setTimeout(() => setShareMessage(''), 2500);
    return () => window.clearTimeout(hideTimer);
  }, [shareMessage]);

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  const handleShare = async () => {
    const currentUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ url: currentUrl });
        setShareMessage('상품을 공유했습니다.');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(currentUrl);
        setShareMessage('상품 링크를 복사했습니다.');
      } else {
        setShareMessage('이 브라우저에서는 공유를 지원하지 않습니다.');
      }
    } catch (shareError: unknown) {
      // 사용자가 공유 창을 닫은 경우(AbortError)는 아무 안내도 하지 않습니다.
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
      setShareMessage('공유하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  return (
    <>
      <PageContainer className="flex h-48 items-center justify-between lg:hidden">
        <button
          ref={backButtonRef}
          type="button"
          onClick={handleBack}
          aria-label="이전 화면"
          className="inline-flex size-40 items-center justify-start rounded-8 focus-ring"
        >
          <Icon icon={ChevronLeft} size={24} />
        </button>
        <div className="flex items-center gap-12">
          <button
            type="button"
            onClick={() => void handleShare()}
            aria-label="상품 공유"
            className="inline-flex size-40 items-center justify-center rounded-8 focus-ring hover:bg-surface"
          >
            <Icon icon={Share2} size={20} />
          </button>
          <CartLink />
        </div>
      </PageContainer>
      {shareMessage ? (
        <div className="fixed inset-x-16 bottom-96 z-50 flex justify-center lg:hidden">
          <Toast message={shareMessage} />
        </div>
      ) : null}
    </>
  );
}

/**
 * 헤더 검색(combobox + 자동완성 listbox). 데스크톱과 모바일이 각각 인스턴스를 가지므로
 * 패널 열림·바깥 클릭 판정이 서로 섞이지 않습니다.
 * 위/아래 화살표로 추천을 고르고 Enter로 열며, Escape나 Tab으로 검색 영역을 벗어나면 패널을 닫습니다.
 */
function HeaderSearch({
  value,
  onValueChange,
  onSearchKeyword,
  onSelectProduct,
  onOpenPanel,
  onEscape,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSearchKeyword: (keyword: string) => void;
  onSelectProduct: (productId: string) => void;
  onOpenPanel: () => void;
  onEscape?: () => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const listboxId = useId();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1);
  const suggestionsQuery = useProductSuggestionsQuery(value, isPanelOpen);
  const keyword = value.trim();
  const suggestions: ProductSuggestion[] = suggestionsQuery.data ?? [];
  const isLoadingSuggestions = suggestionsQuery.isPending && keyword.length > 0;
  const isSuggestionVisible = isPanelOpen && !isLoadingSuggestions && suggestions.length > 0;
  const safeActiveIndex =
    isSuggestionVisible && activeOptionIndex < suggestions.length ? activeOptionIndex : -1;
  const activeSuggestion = safeActiveIndex >= 0 ? suggestions[safeActiveIndex] : undefined;

  useEffect(() => {
    if (!isPanelOpen) return;
    const handleOutsidePointer = (pointerEvent: globalThis.PointerEvent) => {
      if (
        pointerEvent.target instanceof Node &&
        !containerRef.current?.contains(pointerEvent.target)
      ) {
        setIsPanelOpen(false);
      }
    };
    window.addEventListener('pointerdown', handleOutsidePointer);
    return () => window.removeEventListener('pointerdown', handleOutsidePointer);
  }, [isPanelOpen]);

  const closePanel = () => {
    setIsPanelOpen(false);
    setActiveOptionIndex(-1);
  };

  const openPanel = () => {
    onOpenPanel();
    setIsPanelOpen(true);
  };

  const selectSuggestion = (productId: string) => {
    closePanel();
    onSelectProduct(productId);
  };

  const submitSearch = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    if (activeSuggestion) {
      selectSuggestion(activeSuggestion.productId);
      return;
    }
    if (!keyword) return;
    closePanel();
    onSearchKeyword(keyword);
  };

  const handleKeyDown = (keyEvent: KeyboardEvent<HTMLInputElement>) => {
    if (keyEvent.key === 'Escape') {
      closePanel();
      onEscape?.();
      return;
    }
    if (keyEvent.key !== 'ArrowDown' && keyEvent.key !== 'ArrowUp') return;
    keyEvent.preventDefault();
    openPanel();
    if (suggestions.length === 0) return;
    const step = keyEvent.key === 'ArrowDown' ? 1 : -1;
    // -1(입력창)과 0~마지막 추천 사이를 순환합니다.
    setActiveOptionIndex((currentIndex) => {
      const startIndex = currentIndex >= suggestions.length ? -1 : currentIndex;
      const nextIndex = startIndex + step;
      if (nextIndex >= suggestions.length) return -1;
      if (nextIndex < -1) return suggestions.length - 1;
      return nextIndex;
    });
  };

  // 포커스가 검색 영역 밖으로 나가면(Tab 이동 포함) 패널을 닫습니다.
  const handleBlur = (blurEvent: FocusEvent<HTMLDivElement>) => {
    if (!blurEvent.currentTarget.contains(blurEvent.relatedTarget)) closePanel();
  };

  return (
    <div ref={containerRef} onBlur={handleBlur} className={cx('relative', className)}>
      <form
        role="search"
        onSubmit={submitSearch}
        className="flex h-44 items-center gap-8 rounded-capsule bg-surface pr-16 pl-20 focus-within:bg-bg focus-within:ring-1 focus-within:ring-text-1"
      >
        <label htmlFor={inputId} className="sr-only">
          상품 검색
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isSuggestionVisible}
          aria-controls={listboxId}
          aria-activedescendant={activeSuggestion ? `${listboxId}-${safeActiveIndex}` : undefined}
          autoComplete="off"
          value={value}
          onChange={(changeEvent) => {
            onValueChange(changeEvent.target.value);
            setActiveOptionIndex(-1);
            openPanel();
          }}
          onFocus={openPanel}
          onKeyDown={handleKeyDown}
          placeholder="어떤 제품을 찾고 계신가요?"
          className="min-w-0 flex-1 bg-transparent text-body-m outline-none placeholder:text-text-3 [&::-webkit-search-cancel-button]:hidden"
        />
        {value ? (
          <button
            type="button"
            aria-label="검색어 지우기"
            onClick={() => {
              onValueChange('');
              setActiveOptionIndex(-1);
              inputRef.current?.focus();
            }}
            className="inline-flex size-28 shrink-0 items-center justify-center rounded-capsule text-text-3 focus-ring hover:text-text-1"
          >
            <Icon icon={CircleX} size={20} />
          </button>
        ) : null}
        <button
          type="submit"
          aria-label="검색"
          className="inline-flex size-28 shrink-0 items-center justify-center rounded-capsule focus-ring"
        >
          <Icon icon={Search} size={20} />
        </button>
      </form>
      <div
        hidden={!isSuggestionVisible}
        className="absolute top-52 right-0 left-0 z-40 rounded-12 border border-line bg-bg p-8 shadow-2"
      >
        <ul id={listboxId} role="listbox" aria-label="검색 자동완성">
          {suggestions.map((suggestion, suggestionIndex) => (
            // 키보드 선택은 combobox(aria-activedescendant)가 맡고, 여기서는 포인터 선택만 받습니다.
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <li
              key={suggestion.productId}
              id={`${listboxId}-${suggestionIndex}`}
              role="option"
              aria-selected={suggestionIndex === safeActiveIndex}
              onPointerDown={(pointerEvent) => pointerEvent.preventDefault()}
              onClick={() => selectSuggestion(suggestion.productId)}
              className={cx(
                'flex w-full cursor-pointer items-center justify-between gap-16 rounded-8 px-12 py-10 text-left hover:bg-surface',
                suggestionIndex === safeActiveIndex && 'bg-surface',
              )}
            >
              <span className="truncate text-body-s">{suggestion.name}</span>
              <span className="shrink-0 text-caption text-text-3">{suggestion.brand}</span>
            </li>
          ))}
        </ul>
        <Button
          variant="ghost"
          size="s"
          isFullWidth
          onClick={() => {
            closePanel();
            if (keyword) onSearchKeyword(keyword);
          }}
          className="mt-4"
        >
          검색 결과 전체 보기
        </Button>
      </div>
    </div>
  );
}

/** W-16 전체 메뉴 dropdown. */
function AllMenuDropdown({
  categories,
  pathname,
  closeButtonRef,
  onClose,
  onNavigate,
}: {
  categories: readonly Category[];
  pathname: string;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onNavigate: () => void;
}) {
  // 대표 카테고리마다 열을 하나씩 두고, 하위 카테고리와 「전체 보기」를 넣습니다. 하위가 없으면 「전체 보기」 한 줄입니다.
  // 맞춤 제작/납품(custom-order)은 메뉴 열에서 뺍니다. 카테고리 바와 홈에는 그대로 남습니다.
  const representativeSections: MenuSection[] = categories
    .filter((category) => category.parentId === null && !isCustomOrderCategory(category))
    .map((category) => ({
      key: category.id,
      title: category.name,
      allowTwoColumnList: true,
      items: [
        ...categories
          .filter((subcategory) => subcategory.parentId === category.id)
          .map((subcategory) => ({
            label: subcategory.name,
            href: getCategoryHref(subcategory),
          })),
        {
          label: '전체 보기',
          href: getCategoryHref(category),
          ariaLabel: `${category.name} 전체 보기`,
        },
      ],
    }));
  // 열 수는 전체 제품 1 + 대표 카테고리 수(맞춤 제작/납품 제외)입니다. 대표 카테고리 수에 따라 열 수가 달라지며, lg에서는 4열 격자로 줄 바꿈됩니다.
  const menuSections: MenuSection[] = [
    {
      key: 'all-products',
      title: '전체 제품',
      items: [{ label: '전체 제품', href: '/search' }],
    },
    ...representativeSections,
  ];
  const brandHref = buildBrandHref();
  // GNB 「브랜드」와 같은 규칙으로 /brands/* 경로도 활성으로 봅니다.
  const isBrandLinkActive = isPrimaryNavigationItemActive(
    { key: 'brands', label: '브랜드', href: brandHref },
    pathname,
  );
  const currentMenuHref = getCurrentMenuHref(categories, pathname);
  // 여러 메뉴 항목이 같은 주소를 가리켜도 현재 경로는 첫 번째 링크 한 곳에만 표시합니다.
  const currentMenuItem = menuSections
    .flatMap((menuSection) => menuSection.items)
    .find((menuItem) => menuItem.href === currentMenuHref);

  return (
    <nav aria-label="전체 메뉴">
      <div className="border-b border-line">
        <div className="flex h-64 items-center justify-end px-18 lg:h-74 lg:px-28">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="전체 메뉴 닫기"
            className="inline-flex size-51 shrink-0 items-center justify-center rounded-8 focus-ring hover:bg-surface"
          >
            <Icon icon={X} size={24} />
          </button>
        </div>
      </div>
      {/* 모바일 전용 브랜드 진입점입니다. 카테고리 열 제목과 같은 글자·선으로 맞춥니다. 데스크톱에서는 GNB의 「브랜드」를 씁니다. */}
      <div className="px-18 lg:hidden">
        <Link
          href={brandHref}
          onClick={onNavigate}
          aria-current={isBrandLinkActive ? 'page' : undefined}
          className={cx(
            'flex min-h-51 w-full items-center justify-between border-b pr-5 text-left text-[18px] leading-[26px] font-medium focus-ring',
            isBrandLinkActive ? 'border-success text-success' : 'border-line text-text-1',
          )}
        >
          브랜드
          <Icon icon={ChevronRight} size={20} />
        </Link>
      </div>
      <div className="grid grid-cols-1 content-start gap-x-18 gap-y-9 px-18 py-14 lg:grid-cols-4 lg:gap-x-28 lg:gap-y-0 lg:px-28 lg:py-28">
        {menuSections.map((menuSection) => (
          <MenuColumn
            key={menuSection.key}
            title={menuSection.title}
            items={menuSection.items}
            allowTwoColumnList={menuSection.allowTwoColumnList === true}
            currentItem={currentMenuItem}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </nav>
  );
}

/** 전체 메뉴의 링크 항목. ariaLabel은 가시 텍스트가 같은 항목(예: 「전체 보기」)을 구별할 때만 씁니다. */
interface MenuItem {
  label: string;
  href: string;
  ariaLabel?: string;
}

/** 전체 메뉴의 열. key는 React 목록 키이고 title이 열 제목(접근 가능한 region 이름)입니다. */
interface MenuSection {
  key: string;
  title: string;
  items: MenuItem[];
  /** 대표 카테고리 섹션만 링크 목록을 2열로 나눌 수 있습니다(다른 섹션은 항상 1열). */
  allowTwoColumnList?: boolean;
}

function MenuColumn({
  title,
  items,
  allowTwoColumnList,
  currentItem,
  onNavigate,
}: {
  title: string;
  items: MenuItem[];
  /** true이면 항목이 많을 때 링크 목록을 2열로 나눕니다. */
  allowTwoColumnList: boolean;
  currentItem: MenuItem | undefined;
  onNavigate: () => void;
}) {
  const isCurrentSection = currentItem ? items.includes(currentItem) : false;
  const [isExpanded, setIsExpanded] = useState(false);
  const desktopViewportRef = useRef<boolean | null>(null);
  const isExpandedRef = useRef(false);
  const disclosureButtonRef = useRef<HTMLButtonElement>(null);
  const sectionContentRef = useRef<HTMLDivElement>(null);
  const sectionContentId = useId();

  // SSR와 hydration은 닫힌 상태로 시작하고 popup mount 시 viewport 기본값을 맞춥니다.
  useLayoutEffect(() => {
    const syncViewport = () => {
      const isDesktopViewport = window.innerWidth >= 1024;
      if (desktopViewportRef.current === isDesktopViewport) return;
      desktopViewportRef.current = isDesktopViewport;
      if (
        !isDesktopViewport &&
        isExpandedRef.current &&
        sectionContentRef.current?.contains(document.activeElement)
      ) {
        disclosureButtonRef.current?.focus();
      }
      isExpandedRef.current = isDesktopViewport;
      setIsExpanded(isDesktopViewport);
    };

    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  // Moving focus first keeps collapsed content from retaining keyboard focus.
  const toggleDisclosure = () => {
    const shouldExpand = !isExpanded;
    if (!shouldExpand && sectionContentRef.current?.contains(document.activeElement)) {
      disclosureButtonRef.current?.focus();
    }
    isExpandedRef.current = shouldExpand;
    setIsExpanded(shouldExpand);
  };

  return (
    <section aria-label={title}>
      <h2>
        <button
          ref={disclosureButtonRef}
          type="button"
          aria-expanded={isExpanded}
          aria-controls={sectionContentId}
          onClick={toggleDisclosure}
          className={cx(
            // 섹션 제목은 18px·500 굵기입니다. 18px 500 토큰이 없어 임의 값을 씁니다(label-l 16px의 약 1.15배).
            'flex min-h-51 w-full items-center justify-between border-b pr-5 text-left text-[18px] leading-[26px] font-medium focus-ring',
            isCurrentSection ? 'border-success text-success' : 'border-line text-text-1',
          )}
        >
          <span>{title}</span>
          <Icon
            icon={ChevronDown}
            size={20}
            className={cx(
              'transition-transform duration-[180ms] ease-out motion-reduce:transition-none',
              isExpanded && 'rotate-180',
            )}
          />
        </button>
      </h2>
      <div
        ref={sectionContentRef}
        id={sectionContentId}
        aria-hidden={!isExpanded}
        inert={!isExpanded}
        className="grid transition-[grid-template-rows] duration-[180ms] ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          {/* 항목이 많은 섹션(예: 개인보호장비)은 목록을 2열로 나눠 섹션 행 높이를 줄입니다. 열 전체는 늘리지 않습니다. */}
          <ul
            className={cx(
              'pt-9',
              allowTwoColumnList && items.length >= MENU_TWO_COLUMN_MIN_ITEMS
                ? 'grid grid-cols-2 gap-x-9 gap-y-5'
                : 'space-y-5',
            )}
          >
            {items.map((menuItem) => (
              <li key={menuItem.href + '-' + menuItem.label}>
                <Link
                  href={menuItem.href}
                  onClick={onNavigate}
                  aria-label={menuItem.ariaLabel}
                  aria-current={menuItem === currentItem ? 'page' : undefined}
                  className={cx(
                    'inline-flex min-h-51 w-full items-center rounded-8 px-9 text-body-l focus-ring transition-colors',
                    menuItem === currentItem
                      ? 'text-label-l text-success underline decoration-success underline-offset-4 hover:text-success active:text-success'
                      : 'text-text-2 hover:bg-surface hover:text-text-1 active:bg-surface-2',
                  )}
                >
                  {menuItem.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
