import { render, screen } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { adminRoutes } from './routes';

vi.mock('./layouts/AdminLayout', () => ({
  AdminLayout: () => (
    <div>
      <nav aria-label="관리자 메뉴">관리자 메뉴</nav>
      <Outlet />
    </div>
  ),
}));

vi.mock('./pages/AdminDashboardPage', () => {
  return {
    AdminDashboardPage: () => <div>대시보드</div>,
  };
});

vi.mock('./pages/AdminProductsPage', () => {
  throw new Error('페이지 모듈을 불러올 수 없습니다');
});

describe('관리자 페이지 로딩 실패', () => {
  it('관리자 메뉴를 유지하며 새로고침 복구 방법을 보여줍니다', async () => {
    const router = createMemoryRouter(adminRoutes, { initialEntries: ['/products'] });
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '화면을 불러오지 못했습니다. 페이지를 새로고침해 다시 시도해 주세요.',
    );
    expect(screen.getByRole('navigation', { name: '관리자 메뉴' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '새로고침' })).toBeInTheDocument();
  });
});
