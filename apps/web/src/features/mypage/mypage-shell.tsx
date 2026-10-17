'use client';

import { buttonClassName } from '@eum/ui/components/Button';
import { cx } from '@eum/ui/lib/cx';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemberSession } from '@/features/auth/member-session';
import { PageContainer } from '@/components/page-container';
import { useEffect, useRef, type ReactNode } from 'react';

interface MyPageNavLink {
  key: string;
  label: string;
  href: string;
}

interface MyPageNavGroup {
  label: string;
  links: MyPageNavLink[];
}

export const MYPAGE_NAV_GROUPS: MyPageNavGroup[] = [
  {
    label: '쇼핑',
    links: [
      { key: 'orders', label: '주문/배송 조회', href: '/mypage/orders' },
      { key: 'claims', label: '취소/반품 내역', href: '/mypage/claims' },
      { key: 'claim-new', label: '취소/반품/교환 신청', href: '/mypage/claims/new' },
      { key: 'wishlist', label: '찜한 상품', href: '/mypage/wishlist' },
      { key: 'recent', label: '최근 본 상품', href: '/mypage/recent' },
    ],
  },
  {
    label: '혜택',
    links: [
      { key: 'coupons', label: '쿠폰', href: '/mypage/coupons' },
      { key: 'points', label: '적립금', href: '/mypage/points' },
    ],
  },
  {
    label: '내 정보',
    links: [
      { key: 'profile', label: '내 정보 관리', href: '/mypage/profile' },
      { key: 'addresses', label: '배송지 관리', href: '/mypage/addresses' },
      { key: 'quotes', label: '견적 문의 내역', href: '/mypage/quotes' },
      { key: 'inquiries', label: '1:1 문의 내역', href: '/mypage/inquiries' },
      { key: 'logout', label: '로그아웃', href: '/login' },
    ],
  },
];

export type MyPageSection =
  | 'dashboard'
  | 'orders'
  | 'order-detail'
  | 'claims'
  | 'claim-new'
  | 'wishlist'
  | 'recent'
  | 'coupons'
  | 'points'
  | 'profile'
  | 'profile-edit'
  | 'addresses'
  | 'quotes'
  | 'quote-detail';

type MyPageShellSection = MyPageSection | 'inquiries' | 'inquiry-detail';

interface MyPageBreadcrumb {
  label: string;
  href?: string;
}

const SECTION_NAV_KEY: Record<MyPageShellSection, string> = {
  dashboard: 'dashboard',
  orders: 'orders',
  'order-detail': 'orders',
  claims: 'claims',
  'claim-new': 'claim-new',
  wishlist: 'wishlist',
  recent: 'recent',
  coupons: 'coupons',
  points: 'points',
  profile: 'profile',
  'profile-edit': 'profile',
  addresses: 'addresses',
  quotes: 'quotes',
  'quote-detail': 'quotes',
  inquiries: 'inquiries',
  'inquiry-detail': 'inquiries',
};

export function MyPageShell({
  activeSection,
  title,
  titleDescription,
  titleAction,
  dashboardTop,
  breadcrumbTrail,
  hideNavigation = false,
  children,
}: {
  activeSection: MyPageShellSection;
  title: string;
  titleDescription?: ReactNode;
  titleAction?: ReactNode;
  dashboardTop?: ReactNode;
  breadcrumbTrail?: MyPageBreadcrumb[];
  hideNavigation?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const { clearMember } = useMemberSession();
  const activeKey = SECTION_NAV_KEY[activeSection];
  const mobileNavRef = useRef<HTMLElement | null>(null);
  const activeMobileLinkRef = useRef<HTMLAnchorElement | null>(null);
  const activeLink = MYPAGE_NAV_GROUPS.flatMap((group) => group.links).find(
    (link) => link.key === activeKey,
  );
  const mobileLinks = [
    { key: 'dashboard', label: '마이페이지', href: '/mypage' },
    ...MYPAGE_NAV_GROUPS.flatMap((group) => group.links),
  ];
  const breadcrumbs = breadcrumbTrail ?? (activeSection === 'dashboard' ? [] : [{ label: title }]);

  useEffect(() => {
    if (hideNavigation) return;

    function revealActiveMobileLink() {
      const mobileNav = mobileNavRef.current;
      const activeMobileLink = activeMobileLinkRef.current;
      if (!mobileNav || !activeMobileLink) return;

      const navBounds = mobileNav.getBoundingClientRect();
      if (navBounds.width === 0) return;

      const linkBounds = activeMobileLink.getBoundingClientRect();
      if (linkBounds.left < navBounds.left) {
        mobileNav.scrollLeft = Math.max(0, mobileNav.scrollLeft + linkBounds.left - navBounds.left);
      } else if (linkBounds.right > navBounds.right) {
        mobileNav.scrollLeft += linkBounds.right - navBounds.right;
      }
    }

    revealActiveMobileLink();
    window.addEventListener('resize', revealActiveMobileLink);

    return () => window.removeEventListener('resize', revealActiveMobileLink);
  }, [activeKey, hideNavigation]);

  async function handleLogout() {
    try {
      await clearMember();
    } catch {
      // 로컬 세션·회원 캐시는 clearMember에서 정리하고, 로그인 화면으로 이동합니다.
    }
    router.push('/login');
  }

  return (
    <div data-mypage-shell="">
      <PageContainer
        maxWidth={hideNavigation ? 'web-detail' : 'web'}
        className="pt-20 pb-56 lg:pt-24 lg:pb-80"
      >
        <nav aria-label="현재 위치" className="mb-24 hidden lg:block">
          <ol className="flex items-center gap-8 text-caption text-text-3">
            <li>
              <Link href="/" className="rounded-4 focus-ring hover:text-text-1">
                홈
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight size={14} />
            </li>
            <li>
              <Link href="/mypage" className="rounded-4 focus-ring hover:text-text-1">
                마이페이지
              </Link>
            </li>
            {breadcrumbs.map((breadcrumb, index) => {
              const isCurrent = index === breadcrumbs.length - 1 && !breadcrumb.href;
              return [
                <li key={`breadcrumb-divider-${index}`} aria-hidden="true">
                  <ChevronRight size={14} />
                </li>,
                <li
                  key={`breadcrumb-${index}-${breadcrumb.href ?? 'current'}`}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={isCurrent ? 'text-text-1' : undefined}
                >
                  {breadcrumb.href ? (
                    <Link href={breadcrumb.href} className="rounded-4 focus-ring hover:text-text-1">
                      {breadcrumb.label}
                    </Link>
                  ) : (
                    breadcrumb.label
                  )}
                </li>,
              ];
            })}
          </ol>
        </nav>

        {!hideNavigation ? (
          <nav
            ref={mobileNavRef}
            aria-label="모바일 마이페이지 메뉴"
            className="-mx-20 mb-20 flex gap-8 overflow-x-auto px-20 pb-4 max-[600px]:-mx-16 max-[600px]:px-16 lg:hidden"
          >
            {mobileLinks.map((link) =>
              link.key === 'logout' ? (
                <button
                  key={link.key}
                  type="button"
                  onClick={() => void handleLogout()}
                  className="shrink-0 rounded-capsule border border-line px-14 py-8 text-label-s text-text-2 focus-ring"
                >
                  {link.label}
                </button>
              ) : (
                <Link
                  key={link.key}
                  href={link.href}
                  ref={link.key === activeKey ? activeMobileLinkRef : undefined}
                  aria-current={link.key === activeKey ? 'page' : undefined}
                  className={cx(
                    'shrink-0 rounded-capsule border px-14 py-8 text-label-s focus-ring',
                    link.key === activeKey
                      ? 'border-text-1 bg-text-1 text-inverse'
                      : 'border-line text-text-2',
                  )}
                >
                  {link.label}
                </Link>
              ),
            )}
          </nav>
        ) : null}

        <div
          className={cx(
            'grid gap-24',
            hideNavigation ? 'lg:grid-cols-1' : 'lg:grid-cols-[196px_minmax(0,1fr)] lg:gap-24',
          )}
        >
          {!hideNavigation ? (
            <aside aria-label="마이페이지 메뉴" className="hidden lg:block">
              <Link
                href="/mypage"
                aria-current={activeSection === 'dashboard' ? 'page' : undefined}
                className={cx(
                  'mb-20 flex h-40 items-center rounded-8 px-12 text-label-m focus-ring',
                  activeSection === 'dashboard' ? 'bg-surface text-text-1' : 'text-text-2',
                )}
              >
                마이페이지
              </Link>
              <nav className="flex flex-col gap-24">
                {MYPAGE_NAV_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="mb-8 px-4 text-caption text-text-3">{group.label}</p>
                    <ul className="flex flex-col gap-2">
                      {group.links.map((link) => (
                        <li key={link.key}>
                          {link.key === 'logout' ? (
                            <button
                              type="button"
                              onClick={() => void handleLogout()}
                              className="flex min-h-40 w-full items-center rounded-8 px-12 text-left text-body-s text-text-2 focus-ring hover:bg-surface"
                            >
                              {link.label}
                            </button>
                          ) : (
                            <Link
                              href={link.href}
                              aria-current={link.key === activeKey ? 'page' : undefined}
                              className={cx(
                                'flex min-h-40 items-center rounded-8 px-12 text-body-s focus-ring',
                                link.key === activeKey
                                  ? 'bg-surface text-label-m text-text-1'
                                  : 'text-text-2 hover:bg-surface',
                              )}
                            >
                              {link.label}
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
            </aside>
          ) : null}
          <div className="min-w-0">
            {dashboardTop}
            {activeLink ? <span className="sr-only">{activeLink.label}</span> : null}
            <div className="mb-20 flex items-start justify-between gap-12 lg:mb-24">
              <div className="min-w-0">
                <h1
                  className={cx(
                    'min-w-0 text-h2 lg:text-web-h2',
                    activeSection === 'dashboard' && 'sr-only',
                  )}
                >
                  {title}
                </h1>
                {titleDescription ? (
                  <p className="mt-8 text-body-s text-text-2">{titleDescription}</p>
                ) : null}
              </div>
              {titleAction}
            </div>
            {children}
          </div>
        </div>
      </PageContainer>
    </div>
  );
}

export function MyPageActionLink({
  href,
  children,
  variant = 'secondary',
  size = 's',
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'm' | 's';
  className?: string;
}) {
  return (
    <Link href={href} className={cx(buttonClassName({ variant, size }), className)}>
      {children}
    </Link>
  );
}
