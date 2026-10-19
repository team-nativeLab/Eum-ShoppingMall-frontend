import { Badge } from '@eum/ui/components/Badge';
import { Icon } from '@eum/ui/components/Icon';
import { cx } from '@eum/ui/lib/cx';
import {
  Building2,
  CalendarDays,
  CircleDollarSign,
  CircleHelp,
  FolderTree,
  LayoutDashboard,
  MessageCircleQuestion,
  MessagesSquare,
  MessageSquareText,
  Newspaper,
  Package,
  PanelsTopLeft,
  Receipt,
  RotateCcw,
  Star,
  Tags,
  TicketPercent,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router';

interface AdminMenuItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

interface AdminMenuGroup {
  id: string;
  label: string;
  items: AdminMenuItem[];
}

const DASHBOARD_MENU_ITEM: AdminMenuItem = {
  label: '대시보드',
  to: '/',
  icon: LayoutDashboard,
};

// Figma HF/Admin/Sidebar 메뉴 순서와 기능 분류
const ADMIN_MENU_GROUPS: AdminMenuGroup[] = [
  {
    id: 'products',
    label: '상품 관리',
    items: [
      { label: '상품 관리', to: '/products', icon: Package },
      { label: '카테고리 관리', to: '/categories', icon: FolderTree },
      { label: '브랜드 관리', to: '/brands', icon: Tags },
    ],
  },
  {
    id: 'operating-content',
    label: '운영 콘텐츠',
    items: [
      { label: '홈 편성', to: '/home-content', icon: PanelsTopLeft },
      { label: '이벤트 관리', to: '/events', icon: CalendarDays },
      { label: '공지 관리', to: '/content/notices', icon: Newspaper },
      { label: 'FAQ 관리', to: '/content/faqs', icon: CircleHelp },
    ],
  },
  {
    id: 'orders-quotes',
    label: '주문·견적',
    items: [
      { label: '주문 관리', to: '/orders', icon: Receipt },
      { label: '취소·반품·교환', to: '/claims', icon: RotateCcw },
      { label: '견적 문의', to: '/quotes', icon: MessageSquareText },
    ],
  },
  {
    id: 'inquiries-support',
    label: '문의·고객지원',
    items: [
      { label: '1:1 문의', to: '/content/inquiries', icon: MessagesSquare },
      { label: '상품 문의', to: '/content/product-questions', icon: MessageCircleQuestion },
      { label: '상품 리뷰', to: '/content/reviews', icon: Star },
    ],
  },
  {
    id: 'members-operations',
    label: '회원·운영 설정',
    items: [
      { label: '회원 관리', to: '/members', icon: Users },
      { label: '적립금 관리', to: '/points', icon: CircleDollarSign },
      { label: '배송·할인 설정', to: '/settings/shipping-discount', icon: Truck },
      { label: '회사·정책 정보', to: '/settings/company-policies', icon: Building2 },
      { label: '쿠폰 관리', to: '/coupons', icon: TicketPercent },
    ],
  },
];

function AdminMenuLink({ menuItem }: { menuItem: AdminMenuItem }) {
  const location = useLocation();
  const isProductSection = location.pathname.startsWith('/products');
  const isBrandSection = location.pathname.startsWith('/brands');
  const hasSubmenu = menuItem.to === '/products' || menuItem.to === '/brands';
  const isCurrentSection =
    (menuItem.to === '/products' && isProductSection) ||
    (menuItem.to === '/brands' && isBrandSection);

  return (
    <li>
      <NavLink
        to={menuItem.to}
        end={menuItem.to === '/'}
        className={({ isActive }) =>
          cx(
            'flex min-h-44 items-center gap-12 rounded-8 px-12 py-8 focus-ring transition-colors',
            isActive
              ? 'bg-text-1 text-label-l text-inverse'
              : 'text-body-m text-text-2 hover:bg-surface',
          )
        }
      >
        <Icon icon={menuItem.icon} size={20} className="shrink-0" />
        <span className="min-w-0 flex-1 break-words">{menuItem.label}</span>
      </NavLink>
      {hasSubmenu && isCurrentSection ? (
        <ul className="mt-4 ml-44 grid gap-2 border-l border-line pl-12">
          {menuItem.to === '/products' ? (
            <>
              <li>
                <NavLink
                  to="/products"
                  end
                  className={({ isActive }) =>
                    cx(
                      'flex min-h-36 items-center rounded-6 px-8 py-6 text-body-s focus-ring',
                      isActive ? 'font-medium text-text-1' : 'text-text-3 hover:text-text-1',
                    )
                  }
                >
                  상품 목록
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/products/new"
                  className={({ isActive }) =>
                    cx(
                      'flex min-h-36 items-center rounded-6 px-8 py-6 text-body-s focus-ring',
                      isActive ? 'font-medium text-text-1' : 'text-text-3 hover:text-text-1',
                    )
                  }
                >
                  상품 등록
                </NavLink>
              </li>
            </>
          ) : (
            <>
              <li>
                <NavLink
                  to="/brands"
                  end
                  className={({ isActive }) =>
                    cx(
                      'flex min-h-36 items-center rounded-6 px-8 py-6 text-body-s focus-ring',
                      isActive ? 'font-medium text-text-1' : 'text-text-3 hover:text-text-1',
                    )
                  }
                >
                  브랜드 목록
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/brands/new"
                  className={({ isActive }) =>
                    cx(
                      'flex min-h-36 items-center rounded-6 px-8 py-6 text-body-s focus-ring',
                      isActive ? 'font-medium text-text-1' : 'text-text-3 hover:text-text-1',
                    )
                  }
                >
                  브랜드 등록
                </NavLink>
              </li>
            </>
          )}
        </ul>
      ) : null}
    </li>
  );
}

/** 관리자 사이드바(Figma HF/Admin/Sidebar, w240). 활성 메뉴는 검정 채움입니다. */
export function AdminSidebar() {
  return (
    <aside className="sticky top-0 flex h-dvh w-240 shrink-0 flex-col overflow-y-auto border-r border-line bg-bg">
      <div className="flex h-64 shrink-0 items-center gap-8 px-20">
        <span className="text-title">이음산업건설</span>
        <Badge tone="outline">관리자</Badge>
      </div>
      <nav aria-label="관리자 메뉴" className="px-12 pt-8 pb-16">
        <section aria-labelledby="admin-menu-dashboard" className="mb-16">
          <h2 id="admin-menu-dashboard" className="sr-only">
            대시보드
          </h2>
          <ul className="flex flex-col gap-4">
            <AdminMenuLink menuItem={DASHBOARD_MENU_ITEM} />
          </ul>
        </section>
        <div className="flex flex-col gap-20">
          {ADMIN_MENU_GROUPS.map((group) => (
            <section key={group.id} aria-labelledby={`admin-menu-${group.id}`}>
              <h2
                id={`admin-menu-${group.id}`}
                className="mb-4 px-12 text-label-s text-text-3"
              >
                {group.label}
              </h2>
              <ul className="flex flex-col gap-4">
                {group.items.map((menuItem) => (
                  <AdminMenuLink key={menuItem.to} menuItem={menuItem} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </nav>
    </aside>
  );
}
