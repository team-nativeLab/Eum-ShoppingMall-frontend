import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { PageContainer } from '@/components/page-container';
import { buttonClassName } from '@eum/ui/components/Button';
import { cx } from '@eum/ui/lib/cx';
import type { ReactNode } from 'react';

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
      { key: 'inquiries', label: '1:1 문의 내역', href: '/support/inquiry' },
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

const SECTION_NAV_KEY: Record<MyPageSection, string> = {
  dashboard: 'dashboard',
  orders: 'orders',
  'order-detail': 'orders',
  claims: 'claims',
  'claim-new': 'orders',
  wishlist: 'wishlist',
  recent: 'recent',
  coupons: 'coupons',
  points: 'points',
  profile: 'profile',
  'profile-edit': 'profile',
  addresses: 'addresses',
  quotes: 'quotes',
  'quote-detail': 'quotes',
};

export function MyPageShell({
  activeSection,
  title,
  titleAction,
  dashboardTop,
  children,
}: {
  activeSection: MyPageSection;
  title: string;
  titleAction?: ReactNode;
  dashboardTop?: ReactNode;
  children: ReactNode;
}) {
  const activeKey = SECTION_NAV_KEY[activeSection];
  const activeLink = MYPAGE_NAV_GROUPS.flatMap((group) => group.links).find(
    (link) => link.key === activeKey,
  );
  const mobileLinks = [
    { key: 'dashboard', label: '마이페이지', href: '/mypage' },
    ...MYPAGE_NAV_GROUPS.flatMap((group) => group.links).filter(
      (link) => link.key !== 'logout' && link.key !== 'inquiries',
    ),
  ];

  return (
    <div data-mypage-shell="">
      <PageContainer className="pt-20 pb-56 lg:pt-24 lg:pb-80">
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
            {activeSection !== 'dashboard' ? (
              <>
                <li aria-hidden="true">
                  <ChevronRight size={14} />
                </li>
                <li aria-current="page" className="text-text-1">
                  {title}
                </li>
              </>
            ) : null}
          </ol>
        </nav>

        <div className="-mx-20 mb-20 flex gap-8 overflow-x-auto px-20 pb-4 lg:hidden">
          {mobileLinks.map((link) => (
            <Link
              key={link.key}
              href={link.href}
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
          ))}
        </div>

        {dashboardTop}

        <div className="grid gap-24 lg:grid-cols-[192px_minmax(0,1fr)] lg:gap-24">
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
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>
          <div className="min-w-0">
            {activeLink ? <span className="sr-only">{activeLink.label}</span> : null}
            <div className="mb-20 flex items-start justify-between gap-12 lg:mb-24">
              <h1
                className={cx(
                  'min-w-0 text-h2 lg:text-web-h2',
                  activeSection === 'dashboard' && 'sr-only',
                )}
              >
                {title}
              </h1>
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
