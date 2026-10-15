'use client';

import type { Category, ProductSuggestion } from '@eum/api/types';
import { Button } from '@eum/ui/components/Button';
import { Icon } from '@eum/ui/components/Icon';
import { Toast } from '@eum/ui/components/Toast';
import { cx } from '@eum/ui/lib/cx';
import {
  Check,
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
  useRef,
  useState,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { CartLink } from './cart-link';
import { PageContainer } from './page-container';
import { useCategoriesQuery } from '@/features/products/use-categories-query';
import { useBrandsQuery } from '@/features/brands/use-brands-query';
import { useProductSuggestionsQuery } from '@/features/products/use-product-suggestions-query';
import {
  buildBrandHref,
  getPrimaryNavigationItems,
  isPrimaryNavigationItemActive,
} from '@/features/products/product-navigation';

/** 주요 GNB 항목은 URL 경로만으로 현재 상태를 정합니다. */
function PrimaryNavigation({ pathname }: { pathname: string }) {
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

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 전체 화면 메뉴 다이얼로그의 모달 동작을 맡는 훅(다이얼로그가 마운트된 동안 동작).
 * 열리면 배경을 inert로 막고 스크롤을 잠그며 닫기 버튼에 포커스를 줍니다.
 * Tab은 다이얼로그 안에서만 돌고, Escape로 닫히며, 닫히면 연 버튼으로 포커스를 돌려줍니다.
 */
function useMenuDialog(
  onClose: () => void,
  dialogRef: RefObject<HTMLDivElement | null>,
  initialFocusRef: RefObject<HTMLButtonElement | null>,
) {
  useEffect(() => {
    const dialogElement = dialogRef.current;
    if (!dialogElement) return;

    const triggerElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // 다이얼로그는 body 바로 아래에 portal로 그리므로, 나머지 body 자식을 모두 배경으로 봅니다.
    const backgroundElements = [...document.body.children].filter(
      (bodyChild): bodyChild is HTMLElement =>
        bodyChild instanceof HTMLElement && !bodyChild.contains(dialogElement) && !bodyChild.inert,
    );
    for (const backgroundElement of backgroundElements) backgroundElement.inert = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    initialFocusRef.current?.focus();

    const handleKeyDown = (keyEvent: globalThis.KeyboardEvent) => {
      if (keyEvent.key === 'Escape') {
        onClose();
        return;
      }
      if (keyEvent.key !== 'Tab') return;
      const focusableElements = [
        ...dialogElement.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ];
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (!firstElement || !lastElement) return;
      const activeElement = document.activeElement;
      if (
        keyEvent.shiftKey &&
        (activeElement === firstElement || !dialogElement.contains(activeElement))
      ) {
        keyEvent.preventDefault();
        lastElement.focus();
      } else if (
        !keyEvent.shiftKey &&
        (activeElement === lastElement || !dialogElement.contains(activeElement))
      ) {
        keyEvent.preventDefault();
        firstElement.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      for (const backgroundElement of backgroundElements) backgroundElement.inert = false;
      document.body.style.overflow = previousOverflow;
      if (triggerElement?.isConnected) triggerElement.focus();
    };
  }, [dialogRef, initialFocusRef, onClose]);
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
  const [isScrolled, setIsScrolled] = useState(false);
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  const categoryList = categoriesQuery.data ?? [];
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
    router.push('/search?q=' + encodeURIComponent(keyword));
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

  const openProduct = (productId: string) => {
    setIsMobileSearchOpen(false);
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
          <PrimaryNavigation pathname={pathname} />
          <div className="flex min-w-0 flex-1 justify-end pl-24">
            <UrlKeywordHeaderSearch
              onSearchKeyword={searchKeyword}
              onSelectProduct={openProduct}
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
              type="button"
              onClick={() => setIsMenuOpen(true)}
              aria-label="전체 메뉴 열기"
              aria-haspopup="dialog"
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
                  type="button"
                  onClick={() => setIsMenuOpen(true)}
                  aria-label="전체 메뉴 열기"
                  aria-haspopup="dialog"
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
                  onClick={() => setIsMobileSearchOpen((isOpen) => !isOpen)}
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
                  onEscape={() => setIsMobileSearchOpen(false)}
                />
              </PageContainer>
            ) : null}
          </>
        )}
      </header>
      {isMenuOpen
        ? createPortal(
            <AllMenuDialog categories={categoryList} onClose={closeMenu} />,
            document.body,
          )
        : null}
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
  onEscape,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSearchKeyword: (keyword: string) => void;
  onSelectProduct: (productId: string) => void;
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
    setIsPanelOpen(true);
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
            setIsPanelOpen(true);
          }}
          onFocus={() => setIsPanelOpen(true)}
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

/** W-16 전체 메뉴 오버레이. 브랜드 목록은 ShopApi를 통해 메뉴가 열릴 때 조회합니다. */
function AllMenuDialog({
  categories,
  onClose,
}: {
  categories: readonly Category[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // 이 컴포넌트는 메뉴가 열렸을 때만 마운트되므로 조회도 그때만 실행됩니다.
  const brandsQuery = useBrandsQuery();
  const brandList = brandsQuery.data ?? [];

  useMenuDialog(onClose, dialogRef, closeButtonRef);

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex flex-col bg-bg"
      role="dialog"
      aria-modal="true"
      aria-labelledby="all-menu-heading"
    >
      <div className="border-b border-line">
        <PageContainer className="flex h-72 items-center justify-between">
          <Link href="/" onClick={onClose} className="text-title focus-ring">
            이음산업건설
          </Link>
          <h2 id="all-menu-heading" className="sr-only">
            전체 메뉴
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="전체 메뉴 닫기"
            className="inline-flex size-40 items-center justify-center rounded-8 focus-ring hover:bg-surface"
          >
            <Icon icon={X} size={20} />
          </button>
        </PageContainer>
      </div>
      <PageContainer className="grid flex-1 grid-cols-1 gap-24 overflow-y-auto py-32 sm:grid-cols-2 lg:grid-cols-5 lg:gap-24 lg:py-56">
        <MenuColumn
          title="제품"
          items={[
            ...categories
              .filter((category) => category.parentId === null)
              .map((category) => ({
                label: category.name,
                href: '/category/' + encodeURIComponent(category.slug),
              })),
            { label: '전체 제품', href: '/search' },
          ]}
          onNavigate={onClose}
        />
        <MenuColumn
          title="브랜드"
          items={[
            ...brandList.map((brandSummary) => ({
              label: brandSummary.name,
              href: buildBrandHref(brandSummary.id),
            })),
            { label: '전체 브랜드', href: buildBrandHref() },
          ]}
          onNavigate={onClose}
        />
        <MenuColumn
          title="안전 솔루션"
          items={[
            { label: '맞춤 제작/납품', href: '/solutions' },
            { label: '견적 문의', href: '/solutions' },
            { label: '도입 사례', href: '/solutions' },
          ]}
          onNavigate={onClose}
        />
        <MenuColumn
          title="고객지원"
          items={[
            { label: '공지사항', href: '/support/notices' },
            { label: 'FAQ', href: '/support/faq' },
            { label: '1:1 문의', href: '/support/inquiry' },
          ]}
          onNavigate={onClose}
        />
        <MenuColumn
          title="회사소개"
          items={[
            { label: '개요', href: '/about' },
            { label: '사업분야', href: '/about' },
            { label: '연혁', href: '/about' },
            { label: '인증', href: '/about' },
            { label: '파트너', href: '/about' },
            { label: '오시는 길', href: '/about' },
          ]}
          onNavigate={onClose}
        />
      </PageContainer>
      <div className="border-t border-line">
        <PageContainer className="flex h-64 items-center gap-12 text-body-s text-text-2">
          <span>고객센터</span>
          <Link
            href="/support/faq"
            onClick={onClose}
            className="text-label-m text-text-1 focus-ring"
          >
            이용 안내
          </Link>
        </PageContainer>
      </div>
    </div>
  );
}

function MenuColumn({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: { label: string; href: string }[];
  onNavigate: () => void;
}) {
  return (
    <nav aria-label={title}>
      <h3 className="border-b border-text-1 pb-12 text-label-l">{title}</h3>
      <ul className="mt-8 space-y-4">
        {items.map((menuItem) => (
          <li key={menuItem.href + '-' + menuItem.label}>
            <Link
              href={menuItem.href}
              onClick={onNavigate}
              className="inline-flex min-h-36 items-center text-body-s text-text-2 focus-ring hover:text-text-1"
            >
              {menuItem.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
