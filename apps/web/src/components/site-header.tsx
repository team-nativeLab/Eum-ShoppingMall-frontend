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
  CircleX,
  Heart,
  Menu,
  Search,
  Share2,
  UserRound,
  X,
} from 'lucide-react';
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
  type CSSProperties,
} from 'react';
import { CartLink } from './cart-link';
import { PageContainer } from './page-container';
import { useCategoriesQuery } from '@/features/products/use-categories-query';
import { useProductSuggestionsQuery } from '@/features/products/use-product-suggestions-query';
import { useBrandsQuery } from '@/features/brands/use-brands-query';
import {
  buildBrandHref,
  getPrimaryNavigationItems,
  isPrimaryNavigationItemActive,
} from '@/features/products/product-navigation';

const ALL_MENU_ID = 'site-header-all-menu';
const MENU_EXIT_DURATION_MS = 160;

/** 데스크톱 GNB 주요 메뉴. 활성 메뉴는 경로만으로 정하므로 쿼리(useSearchParams)·Suspense가 필요 없습니다. */
function PrimaryNavigation({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  return (
    <nav
      aria-label="주요 메뉴"
      className="flex h-full shrink-0 items-center gap-24 min-[1440px]:gap-40 xl:gap-32"
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

/** 카테고리 상세 경로에서는 메뉴에 표시되는 가장 가까운 최상위 카테고리를 현재 링크로 돌립니다. */
function getCurrentMenuHref(categories: readonly Category[], pathname: string): string {
  const categorySlug = pathname.match(/^\/category\/([^/]+)\/?$/)?.[1];
  if (!categorySlug) return pathname;

  let decodedCategorySlug = categorySlug;
  try {
    decodedCategorySlug = decodeURIComponent(categorySlug);
  } catch {
    // 잘못된 인코딩이면 원래 문자열로 조회해 다른 메뉴의 활성 상태를 바꾸지 않습니다.
  }

  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  let activeCategory = categories.find((category) => category.slug === decodedCategorySlug);
  if (!activeCategory) return pathname;

  const visitedIds = new Set([activeCategory.id]);
  while (activeCategory.parentId) {
    const parentCategory = categoriesById.get(activeCategory.parentId);
    if (!parentCategory || visitedIds.has(parentCategory.id)) break;
    visitedIds.add(parentCategory.id);
    activeCategory = parentCategory;
  }

  return '/category/' + encodeURIComponent(activeCategory.slug);
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
  const [isScrolled, setIsScrolled] = useState(false);
  const isMenuOpenRef = useRef(false);
  const menuUnmountTimerRef = useRef<number | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const shouldRestoreMenuFocusRef = useRef(false);
  const desktopMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const categoryList = categoriesQuery.data ?? [];
  const isMenuVisible = isMenuOpen;
  const closeMenu = useCallback((restoreFocus = false) => {
    if (!isMenuOpenRef.current) return;

    isMenuOpenRef.current = false;
    setIsMenuOpen(false);
    setIsMobileSearchOpen(false);
    if (menuUnmountTimerRef.current !== null) {
      window.clearTimeout(menuUnmountTimerRef.current);
    }
    menuUnmountTimerRef.current = window.setTimeout(() => {
      setIsMenuMounted(false);
      menuUnmountTimerRef.current = null;
    }, MENU_EXIT_DURATION_MS);
    shouldRestoreMenuFocusRef.current = restoreFocus;
    if (!restoreFocus) menuTriggerRef.current = null;
  }, []);
  const toggleMenu = (trigger: HTMLButtonElement) => {
    if (isMenuOpenRef.current) {
      closeMenu();
      return;
    }

    if (menuUnmountTimerRef.current !== null) {
      window.clearTimeout(menuUnmountTimerRef.current);
      menuUnmountTimerRef.current = null;
    }
    shouldRestoreMenuFocusRef.current = false;
    menuTriggerRef.current = trigger;
    isMenuOpenRef.current = true;
    setIsMenuOpen(true);
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

  // 닫힌 상태의 inert/aria-hidden DOM이 반영된 뒤 trigger로 포커스를 돌립니다.
  useLayoutEffect(() => {
    if (isMenuVisible || !shouldRestoreMenuFocusRef.current) return;

    shouldRestoreMenuFocusRef.current = false;
    const menuTrigger = menuTriggerRef.current;
    menuTriggerRef.current = null;
    menuTrigger?.focus();
  }, [isMenuVisible]);

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
            className="self-start rounded-4 text-h3 whitespace-nowrap focus-ring sm:self-auto"
          >
            이음산업건설
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
          'sticky top-0 z-30 border-line bg-bg transition-[box-shadow] duration-200 ease-[cubic-bezier(.2,0,0,1)] motion-reduce:transition-none lg:border-b',
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
          {/* 로고·메뉴·아이콘은 줄지 않고, 남는 폭은 검색바가 받습니다(1024~1440 어느 폭에서도 겹치지 않음). */}
          <div className="flex w-160 shrink-0 items-center min-[1440px]:w-220">
            <Link href="/" className="rounded-4 text-h3 whitespace-nowrap focus-ring">
              이음산업건설
            </Link>
          </div>
          <PrimaryNavigation pathname={pathname} onNavigate={() => closeMenu()} />
          <div className="flex min-w-0 flex-1 justify-end pl-24">
            <UrlKeywordHeaderSearch
              onSearchKeyword={searchKeyword}
              onSelectProduct={openProduct}
              onOpenPanel={() => closeMenu()}
              className="w-full max-w-320"
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
            <button
              ref={desktopMenuButtonRef}
              type="button"
              onClick={(clickEvent) => toggleMenu(clickEvent.currentTarget)}
              aria-label={isMenuVisible ? '전체 메뉴 닫기' : '전체 메뉴 열기'}
              aria-controls={ALL_MENU_ID}
              aria-expanded={isMenuVisible}
              className="inline-flex size-44 items-center justify-center rounded-8 focus-ring hover:bg-surface"
            >
              <Icon icon={Menu} size={24} />
            </button>
          </div>
        </PageContainer>

        {isProductDetail ? (
          <ProductDetailMobileBar />
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
                  <Icon icon={Menu} size={24} />
                </button>
                <Link href="/" className="rounded-4 text-h3 whitespace-nowrap focus-ring">
                  이음산업건설
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
          aria-hidden={!isMenuVisible}
          inert={!isMenuVisible}
          hidden={!isMenuMounted}
          data-state={isMenuVisible ? 'open' : 'closed'}
          style={{ '--menu-header-height': isScrolled ? '64px' : '72px' } as CSSProperties}
          className={cx(
            'absolute top-full left-0 z-50 max-h-[calc(100dvh-56px)] w-full overflow-y-auto border-y border-line-strong bg-bg shadow-2 transition-[opacity,transform] duration-[160ms] ease-out motion-reduce:translate-y-0 motion-reduce:transition-none lg:max-h-[calc(100dvh-var(--menu-header-height))]',
            isMenuMounted ? 'visible' : 'invisible',
            isMenuVisible
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none translate-y-8 opacity-0',
          )}
        >
          {isMenuMounted ? (
            <AllMenuDropdown
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
function ProductDetailMobileBar() {
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

/** W-16 전체 메뉴 dropdown. 브랜드 목록 조회는 popup이 열려 있을 때만 실행합니다. */
function AllMenuDropdown({
  categories,
  pathname,
  onClose,
  onNavigate,
}: {
  categories: readonly Category[];
  pathname: string;
  onClose: () => void;
  onNavigate: () => void;
}) {
  // 이 컴포넌트는 popup이 열리거나 닫힘 애니메이션 중일 때만 마운트됩니다.
  // 로딩·실패 중에는 브랜드 항목 없이 「전체 브랜드」만 보여 줘서 브랜드 화면으로 갈 길을 남겨 둡니다.
  const brandsQuery = useBrandsQuery();
  const brandList = brandsQuery.data ?? [];

  const menuSections: { title: string; items: { label: string; href: string }[] }[] = [
    {
      title: '제품',
      items: [
        ...categories
          .filter((category) => category.parentId === null)
          .map((category) => ({
            label: category.name,
            href: '/category/' + encodeURIComponent(category.slug),
          })),
        { label: '전체 제품', href: '/search' },
      ],
    },
    {
      title: '브랜드',
      items: [
        ...brandList.map((brandSummary) => ({
          label: brandSummary.name,
          href: buildBrandHref(brandSummary.id),
        })),
        { label: '전체 브랜드', href: buildBrandHref() },
      ],
    },
    {
      title: '안전 솔루션',
      items: [
        { label: '맞춤 제작/납품', href: '/solutions' },
        { label: '견적 문의', href: '/solutions' },
        { label: '도입 사례', href: '/solutions' },
      ],
    },
    {
      title: '고객지원',
      items: [
        { label: '공지사항', href: '/support/notices' },
        { label: 'FAQ', href: '/support/faq' },
        { label: '1:1 문의', href: '/support/inquiry' },
      ],
    },
    {
      title: '회사소개',
      items: [
        { label: '개요', href: '/about' },
        { label: '사업분야', href: '/about' },
        { label: '연혁', href: '/about' },
        { label: '인증', href: '/about' },
        { label: '파트너', href: '/about' },
        { label: '오시는 길', href: '/about' },
      ],
    },
  ];
  const currentMenuHref = getCurrentMenuHref(categories, pathname);
  // 여러 메뉴 항목이 같은 주소를 가리켜도 현재 경로는 첫 번째 링크 한 곳에만 표시합니다.
  const currentMenuItem = menuSections
    .flatMap((menuSection) => menuSection.items)
    .find((menuItem) => menuItem.href === currentMenuHref);

  return (
    <nav aria-label="전체 메뉴">
      <div className="border-b border-line">
        <PageContainer className="flex h-56 items-center justify-between lg:h-64">
          <h2
            id="all-menu-heading"
            className="inline-flex items-center rounded-8 bg-success-tint px-12 py-8 text-label-m text-success"
          >
            전체 메뉴
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="전체 메뉴 닫기"
            className="inline-flex size-44 shrink-0 items-center justify-center rounded-8 focus-ring hover:bg-surface"
          >
            <Icon icon={X} size={20} />
          </button>
        </PageContainer>
      </div>
      <PageContainer className="grid grid-cols-1 content-start gap-x-16 gap-y-8 py-12 lg:grid-cols-5 lg:gap-x-24 lg:gap-y-0 lg:py-24">
        {menuSections.map((menuSection) => (
          <MenuColumn
            key={menuSection.title}
            title={menuSection.title}
            items={menuSection.items}
            currentItem={currentMenuItem}
            onNavigate={onNavigate}
          />
        ))}
      </PageContainer>
      <div className="border-t border-line">
        <PageContainer className="flex min-h-52 items-center gap-12 text-body-s text-text-2">
          <span>고객센터</span>
          <Link
            href="/support/faq"
            onClick={onNavigate}
            className="text-label-m text-text-1 focus-ring"
          >
            이용 안내
          </Link>
        </PageContainer>
      </div>
    </nav>
  );
}

function MenuColumn({
  title,
  items,
  currentItem,
  onNavigate,
}: {
  title: string;
  items: { label: string; href: string }[];
  currentItem: { label: string; href: string } | undefined;
  onNavigate: () => void;
}) {
  const isCurrentSection = currentItem ? items.includes(currentItem) : false;
  const [isExpanded, setIsExpanded] = useState(false);
  const desktopViewportRef = useRef<boolean | null>(null);

  // SSR와 hydration 모두 닫힌 details로 시작하고, popup mount 시 layout 전에 viewport 기본값을 맞춥니다.
  useLayoutEffect(() => {
    const syncViewport = () => {
      const isDesktopViewport = window.innerWidth >= 1024;
      if (desktopViewportRef.current === isDesktopViewport) return;
      desktopViewportRef.current = isDesktopViewport;
      setIsExpanded(isDesktopViewport);
    };

    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  return (
    <section aria-label={title}>
      <details
        open={isExpanded}
        onToggle={(toggleEvent) => setIsExpanded(toggleEvent.currentTarget.open)}
        className="group"
      >
        <summary
          className={cx(
            'flex min-h-44 cursor-pointer list-none items-center justify-between border-b pr-4 text-label-l focus-ring [&::-webkit-details-marker]:hidden',
            isCurrentSection ? 'border-success text-success' : 'border-line text-text-1',
          )}
        >
          <h3>{title}</h3>
          <Icon
            icon={ChevronDown}
            size={16}
            className="transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <ul className="mt-8 space-y-4">
          {items.map((menuItem) => (
            <li key={menuItem.href + '-' + menuItem.label}>
              <Link
                href={menuItem.href}
                onClick={onNavigate}
                aria-current={menuItem === currentItem ? 'page' : undefined}
                className={cx(
                  'inline-flex min-h-44 w-full items-center rounded-8 px-8 text-body-s focus-ring transition-colors',
                  menuItem === currentItem
                    ? 'bg-success-tint text-label-m text-success underline decoration-success underline-offset-4 hover:bg-success-tint hover:text-success active:bg-success-tint'
                    : 'text-text-2 hover:bg-surface hover:text-text-1 active:bg-surface-2',
                )}
              >
                {menuItem.label}
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
