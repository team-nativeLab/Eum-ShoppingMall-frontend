import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMockUnifiedAuth } from '@eum/api/unified-auth';
import { getBrowserStore } from '@eum/api/auth';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AdminLayout } from './AdminLayout';
import { getAdminAuth } from '@/lib/admin-auth';

vi.mock('@/lib/api-config', () => ({
  getAdminApiConfig: () => ({
    mode: 'mock',
    baseUrl: '',
    mockLatencyMs: 0,
    mockScenario: 'normal',
    isProduction: false,
    isMockAllowedInProduction: false,
  }),
}));

describe('통합 로그인 후 관리자 세션', () => {
  it('로그인한 관리자 세션을 AdminLayout의 현재 사용자 조회가 읽고 관리 화면을 연다', async () => {
    const unifiedAuth = await createMockUnifiedAuth(
      {
        mode: 'mock',
        baseUrl: '',
        mockLatencyMs: 0,
        mockScenario: 'normal',
        isProduction: false,
        isMockAllowedInProduction: false,
      },
      getBrowserStore(),
    );
    await unifiedAuth.login({ email: 'admin@example.com', password: 'password' });
    const adminAuth = await getAdminAuth();
    const getCurrentUser = vi.spyOn(adminAuth, 'getCurrentUser');
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const router = createMemoryRouter([
      {
        path: '/',
        element: <AdminLayout />,
        children: [{ index: true, element: <p>관리자 화면 준비 완료</p> }],
      },
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(getCurrentUser).toHaveBeenCalled());
    expect(await screen.findByText('관리자 화면 준비 완료')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '관리자 메뉴' })).toBeInTheDocument();
  });
});
