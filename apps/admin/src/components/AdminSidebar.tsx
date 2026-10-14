import { Badge } from '@eum/ui/components/Badge';
import { Icon } from '@eum/ui/components/Icon';
import { cx } from '@eum/ui/lib/cx';
import {
  FolderTree,
  LayoutDashboard,
  MessageSquareText,
  Package,
  Receipt,
  Users,
  Truck,
  TicketPercent,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router';

interface AdminMenuItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

// Figma HF/Admin/Sidebar 메뉴 순서
const ADMIN_MENU_ITEMS: AdminMenuItem[] = [
  { label: '대시보드', to: '/', icon: LayoutDashboard },
  { label: '상품 관리', to: '/products', icon: Package },
  { label: '카테고리 관리', to: '/categories', icon: FolderTree },
  { label: '주문 관리', to: '/orders', icon: Receipt },
  { label: '견적 문의', to: '/quotes', icon: MessageSquareText },
  { label: '회원 관리', to: '/members', icon: Users },
  { label: '배송·할인 설정', to: '/settings/shipping-discount', icon: Truck },
  { label: '쿠폰 관리', to: '/coupons', icon: TicketPercent },
];

/** 관리자 사이드바(Figma HF/Admin/Sidebar, w240). 활성 메뉴는 검정 채움입니다. */
export function AdminSidebar() {
  const location = useLocation();
  const isProductSection = location.pathname.startsWith('/products');

  return (
    <aside className="flex w-240 shrink-0 flex-col border-r border-line bg-bg">
      <div className="flex h-64 items-center gap-8 px-20">
        <span className="text-title">이음산업건설</span>
        <Badge tone="outline">관리자</Badge>
      </div>
      <nav aria-label="관리자 메뉴" className="px-12 pt-8">
        <ul className="flex flex-col gap-4">
          {ADMIN_MENU_ITEMS.map((menuItem) => (
            <li key={menuItem.to}>
              <NavLink
                to={menuItem.to}
                end={menuItem.to === '/'}
                className={({ isActive }) =>
                  cx(
                    'flex h-44 items-center gap-12 rounded-8 px-12 focus-ring transition-colors',
                    isActive
                      ? 'bg-text-1 text-label-l text-inverse'
                      : 'text-body-m text-text-2 hover:bg-surface',
                  )
                }
              >
                <Icon icon={menuItem.icon} size={20} />
                {menuItem.label}
              </NavLink>
              {menuItem.to === '/products' && isProductSection ? (
                <ul className="mt-4 ml-44 grid gap-2 border-l border-line pl-12">
                  <li>
                    <NavLink
                      to="/products"
                      end
                      className={({ isActive }) =>
                        cx(
                          'flex h-36 items-center rounded-6 px-8 text-body-s focus-ring',
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
                          'flex h-36 items-center rounded-6 px-8 text-body-s focus-ring',
                          isActive ? 'font-medium text-text-1' : 'text-text-3 hover:text-text-1',
                        )
                      }
                    >
                      상품 등록
                    </NavLink>
                  </li>
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
