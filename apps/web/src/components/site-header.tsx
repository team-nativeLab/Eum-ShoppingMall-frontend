'use client';

import { Button } from '@eum/ui/components/Button';
import { Icon } from '@eum/ui/components/Icon';
import { cx } from '@eum/ui/lib/cx';
import { Heart, Menu, Search, Share2, UserRound, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { CartLink } from './cart-link';
import { PageContainer } from './page-container';
import { useCategoriesQuery } from '@/features/products/use-categories-query';
import { useProductsQuery } from '@/features/products/use-products-query';
import { useProductSuggestionsQuery } from '@/features/products/use-product-suggestions-query';

const NAVIGATION_ITEMS = [
  { label: '제품', href: '/category/personal-protective-equipment', match: '/category' },
  { label: '브랜드', href: '/search', match: '/search' },
  { label: '안전 솔루션', href: '/solutions', match: '/solutions' },
  { label: '고객지원', href: '/support/notices', match: '/support' },
  { label: '회사소개', href: '/about', match: '/about' },
];

/** 전체 화면 메뉴가 열리면 배경 스크롤을 막고 Escape로 닫습니다. */
function useMenuDialog(
  isOpen: boolean,
  onClose: () => void,
  closeButtonRef: RefObject<HTMLButtonElement | null>,
) {
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = (keyEvent: globalThis.KeyboardEvent) => {
      if (keyEvent.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeButtonRef, isOpen, onClose]);
}

/** HF/Web/GNB: 데스크톱 탐색·검색·찜·장바구니·전체 메뉴와 모바일 헤더를 제공합니다. */
export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const categoriesQuery = useCategoriesQuery();
  const brandsQuery = useProductsQuery({ pageSize: 100 });
  const [searchValue, setSearchValue] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const closeMenuButtonRef = useRef<HTMLButtonElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  const suggestionsQuery = useProductSuggestionsQuery(searchValue, isSearchOpen);
  const categoryList = categoriesQuery.data ?? [];
  const brandList = [...new Set((brandsQuery.data?.items ?? []).map((product) => product.brand))];
  const isProductDetail = pathname.startsWith('/products/');

  useMenuDialog(isMenuOpen, closeMenu, closeMenuButtonRef);

  useEffect(() => {
    if (!isSearchOpen) return;
    const handleOutsidePointer = (pointerEvent: globalThis.PointerEvent) => {
      if (!searchContainerRef.current?.contains(pointerEvent.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('pointerdown', handleOutsidePointer);
    return () => window.removeEventListener('pointerdown', handleOutsidePointer);
  }, [isSearchOpen]);

  const submitSearch = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    const keyword = searchValue.trim();
    if (!keyword) return;
    setIsSearchOpen(false);
    setIsMobileSearchOpen(false);
    router.push('/search?q=' + encodeURIComponent(keyword));
  };

  const selectSuggestion = (productId: string) => {
    setIsSearchOpen(false);
    setIsMobileSearchOpen(false);
    router.push('/products/' + encodeURIComponent(productId));
  };

  const handleShare = async () => {
    const currentUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ url: currentUrl });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(currentUrl);
      }
    } catch {
      // 공유 취소는 사용자 입력으로 보고 아무 동작도 하지 않습니다.
    }
  };

  const handleSearchKeyDown = (keyEvent: KeyboardEvent<HTMLInputElement>) => {
    if (keyEvent.key === 'Escape') {
      setIsSearchOpen(false);
      setIsMobileSearchOpen(false);
    }
  };

  if (isProductDetail) {
    return (
      <header className="sticky top-0 z-30 border-b border-line bg-bg lg:hidden">
        <PageContainer className="flex h-48 items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="이전 화면"
            className="inline-flex size-40 items-center justify-start rounded-8 focus-ring"
          >
            <span aria-hidden="true" className="text-h2 leading-none">
              ‹
            </span>
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
      </header>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-line bg-bg lg:border-b">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-16 focus:left-16 focus:z-50 focus:rounded-8 focus:bg-text-1 focus:px-16 focus:py-8 focus:text-label-m focus:text-inverse"
        >
          본문 바로가기
        </a>
        <PageContainer className="hidden h-72 items-center lg:flex">
          <div className="flex w-220 shrink-0 items-center">
            <Link href="/" className="rounded-4 text-h3 whitespace-nowrap focus-ring">
              이음산업건설
            </Link>
          </div>
          <nav aria-label="주요 메뉴" className="flex min-w-0 items-center gap-40">
            {NAVIGATION_ITEMS.map((navigationItem) => {
              const isActive = pathname.startsWith(navigationItem.match);
              return (
                <Link
                  key={navigationItem.label}
                  href={navigationItem.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cx(
                    'relative inline-flex h-72 items-center text-label-l whitespace-nowrap text-text-1 focus-ring',
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
          <div ref={searchContainerRef} className="relative ml-auto w-320 shrink-0">
            <SearchForm
              value={searchValue}
              onValueChange={setSearchValue}
              onSubmit={submitSearch}
              onFocus={() => setIsSearchOpen(true)}
              onKeyDown={handleSearchKeyDown}
            />
            {isSearchOpen ? (
              <SuggestionPanel
                suggestions={suggestionsQuery.data ?? []}
                isLoading={suggestionsQuery.isPending && searchValue.trim().length > 0}
                onSelect={selectSuggestion}
                onSearchAll={() => {
                  const keyword = searchValue.trim();
                  if (keyword) router.push('/search?q=' + encodeURIComponent(keyword));
                  setIsSearchOpen(false);
                }}
              />
            ) : null}
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
              className="inline-flex size-44 items-center justify-center rounded-8 focus-ring hover:bg-surface"
            >
              <Icon icon={Menu} size={24} />
            </button>
          </div>
        </PageContainer>

        <div className="flex h-56 items-center justify-between px-10 lg:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              aria-label="전체 메뉴 열기"
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
            <div ref={searchContainerRef} className="relative">
              <SearchForm
                value={searchValue}
                onValueChange={setSearchValue}
                onSubmit={submitSearch}
                onFocus={() => setIsSearchOpen(true)}
                onKeyDown={handleSearchKeyDown}
              />
              {isSearchOpen ? (
                <SuggestionPanel
                  suggestions={suggestionsQuery.data ?? []}
                  isLoading={suggestionsQuery.isPending && searchValue.trim().length > 0}
                  onSelect={selectSuggestion}
                  onSearchAll={() => {
                    const keyword = searchValue.trim();
                    if (keyword) router.push('/search?q=' + encodeURIComponent(keyword));
                    setIsSearchOpen(false);
                    setIsMobileSearchOpen(false);
                  }}
                />
              ) : null}
            </div>
          </PageContainer>
        ) : null}
      </header>
      {isMenuOpen ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-bg"
          role="dialog"
          aria-modal="true"
          aria-labelledby="all-menu-heading"
        >
          <div className="border-b border-line">
            <PageContainer className="flex h-72 items-center justify-between">
              <Link href="/" onClick={closeMenu} className="text-title focus-ring">
                이음산업건설
              </Link>
              <h2 id="all-menu-heading" className="sr-only">
                전체 메뉴
              </h2>
              <button
                ref={closeMenuButtonRef}
                type="button"
                onClick={closeMenu}
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
                ...categoryList
                  .filter((category) => category.parentId === null)
                  .map((category) => ({
                    label: category.name,
                    href: '/category/' + encodeURIComponent(category.slug),
                  })),
                { label: '전체 제품', href: '/search' },
              ]}
              onNavigate={closeMenu}
            />
            <MenuColumn
              title="브랜드"
              items={[
                ...brandList.map((brand) => ({
                  label: brand,
                  href: '/search?q=' + encodeURIComponent(brand),
                })),
                { label: '전체 브랜드', href: '/search' },
              ]}
              onNavigate={closeMenu}
            />
            <MenuColumn
              title="안전 솔루션"
              items={[
                { label: '맞춤 제작/납품', href: '/solutions' },
                { label: '견적 문의', href: '/solutions' },
                { label: '도입 사례', href: '/solutions' },
              ]}
              onNavigate={closeMenu}
            />
            <MenuColumn
              title="고객지원"
              items={[
                { label: '공지사항', href: '/support/notices' },
                { label: 'FAQ', href: '/support/faq' },
                { label: '1:1 문의', href: '/support/inquiry' },
              ]}
              onNavigate={closeMenu}
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
              onNavigate={closeMenu}
            />
          </PageContainer>
          <div className="border-t border-line">
            <PageContainer className="flex h-64 items-center gap-12 text-body-s text-text-2">
              <span>고객센터</span>
              <Link
                href="/support/faq"
                onClick={closeMenu}
                className="text-label-m text-text-1 focus-ring"
              >
                이용 안내
              </Link>
            </PageContainer>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SearchForm({
  value,
  onValueChange,
  onSubmit,
  onFocus,
  onKeyDown,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  const inputId = useId();
  return (
    <form
      role="search"
      onSubmit={onSubmit}
      className="flex h-44 items-center gap-8 rounded-capsule bg-surface pr-16 pl-20 focus-within:bg-bg focus-within:ring-1 focus-within:ring-text-1"
    >
      <label htmlFor={inputId} className="sr-only">
        상품 검색
      </label>
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(changeEvent) => onValueChange(changeEvent.target.value)}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        placeholder="어떤 제품을 찾고 계신가요?"
        className="min-w-0 flex-1 bg-transparent text-body-m outline-none placeholder:text-text-3 [&::-webkit-search-cancel-button]:hidden"
      />
      <button
        type="submit"
        aria-label="검색"
        className="inline-flex size-28 items-center justify-center rounded-capsule focus-ring"
      >
        <Icon icon={Search} size={20} />
      </button>
    </form>
  );
}

function SuggestionPanel({
  suggestions,
  isLoading,
  onSelect,
  onSearchAll,
}: {
  suggestions: { productId: string; name: string; brand: string }[];
  isLoading: boolean;
  onSelect: (productId: string) => void;
  onSearchAll: () => void;
}) {
  if (isLoading || suggestions.length === 0) return null;
  return (
    <div className="absolute top-52 right-0 left-0 z-40 rounded-12 border border-line bg-bg p-8 shadow-2">
      <ul aria-label="검색 자동완성">
        {suggestions.map((suggestion) => (
          <li key={suggestion.productId}>
            <button
              type="button"
              onClick={() => onSelect(suggestion.productId)}
              className="flex w-full items-center justify-between gap-16 rounded-8 px-12 py-10 text-left focus-ring hover:bg-surface"
            >
              <span className="truncate text-body-s">{suggestion.name}</span>
              <span className="shrink-0 text-caption text-text-3">{suggestion.brand}</span>
            </button>
          </li>
        ))}
      </ul>
      <Button variant="ghost" size="s" isFullWidth onClick={onSearchAll} className="mt-4">
        검색 결과 전체 보기
      </Button>
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
