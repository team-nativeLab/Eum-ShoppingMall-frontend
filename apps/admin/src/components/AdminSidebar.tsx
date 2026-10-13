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
  type LucideIcon,
} from 'lucide-react';
import { NavLink } from 'react-router';

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
];

/** 관리자 사이드바(Figma HF/Admin/Sidebar, w240). 활성 메뉴는 검정 채움입니다. */
export function AdminSidebar() {
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
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
