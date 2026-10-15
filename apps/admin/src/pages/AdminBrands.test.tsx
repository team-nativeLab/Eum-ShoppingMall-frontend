import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, MemoryRouter, Route, Routes, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminBrandPreviewProvider } from '@/lib/admin-brand-preview';
import { adminRoutes } from '@/routes';
import { AdminBrandsPage } from './AdminBrandsPage';
import { AdminBrandFormPage } from './AdminBrandFormPage';

const adminAuthMocks = vi.hoisted(() => ({ getAdminAuth: vi.fn() }));

vi.mock('@/lib/admin-auth', () => ({
  currentAdminQueryKey: ['admin', 'current-user'],
  getAdminAuth: adminAuthMocks.getAdminAuth,
}));

vi.mock('@/lib/api-config', () => ({
  getAdminApiConfig: () => ({ mode: 'mock' }),
}));

function renderBrandApp(initialEntry = '/brands', empty = false) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AdminBrandPreviewProvider
        initialBrands={empty ? [] : undefined}
        initialMonthlyBrandId={empty ? null : undefined}
      >
        <Routes>
          <Route path="/brands" element={<AdminBrandsPage />} />
          <Route path="/brands/new" element={<AdminBrandFormPage />} />
          <Route path="/brands/:brandId" element={<AdminBrandFormPage />} />
        </Routes>
      </AdminBrandPreviewProvider>
    </MemoryRouter>,
  );
}

describe('admin brand previews', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    adminAuthMocks.getAdminAuth.mockReset();
  });

  it('connects the list and registration screens through the real admin routes and sidebar', async () => {
    const user = userEvent.setup();
    adminAuthMocks.getAdminAuth.mockResolvedValue({
      getCurrentUser: async () => ({
        id: 'admin-test',
        loginId: 'admin-test',
        name: '테스트 관리자',
        role: 'owner',
      }),
    });
    const router = createMemoryRouter(adminRoutes, { initialEntries: ['/brands'] });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: '브랜드 관리' })).toBeInTheDocument();
    const sidebar = screen.getByRole('navigation', { name: '관리자 메뉴' });
    expect(within(sidebar).getByRole('link', { name: '브랜드 관리' })).toHaveAttribute(
      'href',
      '/brands',
    );
    const registerLink = within(sidebar).getByRole('link', { name: '브랜드 등록' });
    expect(registerLink).toHaveAttribute('href', '/brands/new');
    await user.click(registerLink);

    expect(await screen.findByRole('heading', { name: '브랜드 등록' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '브랜드 등록' })).toBeInTheDocument();

    await user.click(
      within(screen.getByRole('region', { name: '브랜드 등록' })).getByRole('link', {
        name: '브랜드 목록',
      }),
    );
    expect(await screen.findByRole('heading', { name: '브랜드 관리' })).toBeInTheDocument();
    const brandRow = screen.getByRole('row', { name: /한결안전/ });
    await user.click(within(brandRow).getByRole('link', { name: '한결안전' }));

    expect(await screen.findByRole('heading', { name: '브랜드 수정' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /브랜드명/ })).toHaveValue('한결안전');
  });

  it('shows the empty list state', () => {
    renderBrandApp('/brands', true);
    expect(screen.getByText('등록된 브랜드가 없습니다')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: '브랜드 목록' })).getByRole('link', {
        name: '브랜드 등록',
      }),
    ).toHaveAttribute('href', '/brands/new');
  });

  it('shows searchable no-results and can reset filters', async () => {
    const user = userEvent.setup();
    renderBrandApp();
    const searchInput = screen.getByRole('searchbox', { name: '브랜드명 검색' });
    expect(searchInput.closest('label')).toHaveClass('focus-within:ring-2');
    await user.type(searchInput, '없는 브랜드');
    await user.click(screen.getByRole('button', { name: '검색' }));
    expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '검색 조건 초기화' }));
    expect(screen.getByRole('row', { name: /한결안전/ })).toBeInTheDocument();
  });

  it('filters brands by complete and incomplete content', async () => {
    const user = userEvent.setup();
    renderBrandApp();
    const filter = screen.getByRole('combobox', { name: '콘텐츠 완성도 필터' });

    await user.selectOptions(filter, 'complete');
    expect(screen.getByRole('row', { name: /한결안전/ })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /워크메이트/ })).not.toBeInTheDocument();

    await user.selectOptions(filter, 'incomplete');
    expect(screen.getByRole('row', { name: /워크메이트/ })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /가드플러스/ })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /한결안전/ })).not.toBeInTheDocument();
  });

  it('blocks brand deletion while linked products or the monthly designation exist', async () => {
    const user = userEvent.setup();
    renderBrandApp();
    const linkedRow = screen.getByRole('row', { name: /한결안전/ });
    await user.click(within(linkedRow).getByRole('button', { name: '삭제' }));
    expect(screen.getByText(/12개 상품과 연결되어 있어 삭제할 수 없습니다/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '닫기' }));

    await user.click(screen.getByRole('button', { name: '브랜드 변경' }));
    await user.click(screen.getByRole('radio', { name: /워크메이트/ }));
    await user.click(screen.getByRole('button', { name: '지정하기' }));
    const unlinkedRow = screen.getByRole('row', { name: /워크메이트/ });
    await user.click(within(unlinkedRow).getByRole('button', { name: '삭제' }));
    expect(screen.getByRole('dialog', { name: '이달의 브랜드입니다' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이달의 브랜드 변경' })).toBeInTheDocument();
  });

  it('hides a brand in preview and restores its previous state with undo', async () => {
    const user = userEvent.setup();
    renderBrandApp();
    const row = screen.getByRole('row', { name: /워크메이트/ });
    const exposureSwitch = within(row).getByRole('switch', { name: '워크메이트 브랜드 노출' });
    await user.click(exposureSwitch);
    expect(exposureSwitch).toHaveAttribute('aria-checked', 'false');
    await user.click(screen.getByRole('button', { name: '되돌리기' }));
    expect(exposureSwitch).toHaveAttribute('aria-checked', 'true');
  });

  it('blocks hiding the monthly brand until another brand is designated', async () => {
    const user = userEvent.setup();
    renderBrandApp();
    const monthlyRow = screen.getByRole('row', { name: /한결안전/ });
    const exposureSwitch = within(monthlyRow).getByRole('switch', {
      name: '한결안전 브랜드 노출',
    });

    await user.click(exposureSwitch);
    expect(exposureSwitch).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('dialog', { name: '이달의 브랜드입니다' })).toHaveTextContent(
      '다른 브랜드를 먼저 지정해 주세요.',
    );
    await user.click(screen.getByRole('button', { name: '이달의 브랜드 변경' }));
    await user.click(screen.getByRole('radio', { name: /워크메이트/ }));
    await user.click(screen.getByRole('button', { name: '지정하기' }));

    await user.click(exposureSwitch);
    expect(exposureSwitch).toHaveAttribute('aria-checked', 'false');
  });

  it('undoes only exposure and keeps a later monthly-brand change', async () => {
    const user = userEvent.setup();
    renderBrandApp();
    const guardRow = screen.getByRole('row', { name: /가드플러스/ });
    await user.click(within(guardRow).getByRole('switch', { name: '가드플러스 브랜드 노출' }));

    const workmateRow = screen.getByRole('row', { name: /워크메이트/ });
    const workmateSwitch = within(workmateRow).getByRole('switch', {
      name: '워크메이트 브랜드 노출',
    });
    await user.click(workmateSwitch);
    expect(workmateSwitch).toHaveAttribute('aria-checked', 'false');

    await user.click(screen.getByRole('button', { name: '브랜드 변경' }));
    await user.click(screen.getByRole('radio', { name: /가드플러스/ }));
    await user.click(screen.getByRole('button', { name: '지정하기' }));
    await user.click(screen.getByRole('button', { name: '되돌리기' }));

    expect(workmateSwitch).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('가드플러스', { selector: 'p' })).toBeInTheDocument();
  });

  it('blocks hiding the monthly brand from its edit form too', async () => {
    const user = userEvent.setup();
    renderBrandApp('/brands/brand-demo-001');
    const exposureSwitch = screen.getByRole('switch', { name: '브랜드 노출' });

    await user.click(exposureSwitch);
    expect(exposureSwitch).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('dialog', { name: '이달의 브랜드입니다' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '이달의 브랜드 변경' }));
    await user.click(screen.getByRole('radio', { name: /워크메이트/ }));
    await user.click(screen.getByRole('button', { name: '지정하기' }));

    await user.click(exposureSwitch);
    expect(exposureSwitch).toHaveAttribute('aria-checked', 'false');
  });

  it('focuses the first story input and connects the paired-field error to both controls', async () => {
    const user = userEvent.setup();
    renderBrandApp('/brands/brand-demo-001');
    const storyTitleInput = screen.getByRole('textbox', { name: /스토리 제목/ });
    const storyBodyInput = screen.getByRole('textbox', { name: /스토리 내용/ });

    await user.clear(storyTitleInput);
    await user.click(screen.getByRole('button', { name: '수정 내용 미리보기' }));

    expect(storyTitleInput).toHaveFocus();
    expect(storyTitleInput).toHaveAttribute('aria-invalid', 'true');
    expect(storyTitleInput).toHaveAttribute('aria-describedby', 'story-error');
    expect(storyBodyInput).toHaveAttribute('aria-invalid', 'true');
    expect(storyBodyInput).toHaveAttribute('aria-describedby', 'story-error');
    expect(screen.getByRole('alert')).toHaveTextContent('스토리 제목과 내용을 함께 입력해 주세요.');
  });

  it('confirms deletion of an unlinked, non-monthly brand in preview state', async () => {
    const user = userEvent.setup();
    renderBrandApp();
    const row = screen.getByRole('row', { name: /가드플러스/ });
    await user.click(within(row).getByRole('button', { name: '삭제' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('브랜드를 삭제할까요?');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }));
    expect(screen.queryByRole('row', { name: /가드플러스/ })).not.toBeInTheDocument();
  });

  it('requires a logo and previews an uploaded file locally before in-memory registration', async () => {
    const user = userEvent.setup();
    let createdUrlCount = 0;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => `blob:brand-preview-${++createdUrlCount}`),
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    renderBrandApp('/brands/new');

    await user.click(screen.getByRole('button', { name: '브랜드 등록 미리보기' }));
    expect(screen.getByText('로고를 등록해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('브랜드명을 입력해 주세요.')).toBeInTheDocument();

    const nameInput = screen.getByRole('textbox', { name: /브랜드명/ });
    await user.type(nameInput, '한결안전');
    await user.type(screen.getByRole('textbox', { name: /브랜드 한 줄 소개/ }), '합성 예시입니다.');
    await user.upload(
      screen.getByLabelText('로고 파일 선택'),
      new File(['logo'], 'logo.png', { type: 'image/png' }),
    );
    await user.upload(
      screen.getByLabelText('커버 이미지 파일'),
      new File(['cover'], 'cover.jpg', { type: 'image/jpeg' }),
    );
    expect(screen.getByRole('img', { name: '선택한 브랜드 로고 미리보기' })).toHaveAttribute(
      'src',
      'blob:brand-preview-1',
    );
    expect(screen.getByRole('img', { name: '선택한 브랜드 커버 이미지 미리보기' })).toHaveAttribute(
      'src',
      'blob:brand-preview-2',
    );
    expect(screen.getByRole('img', { name: '한결안전 로고' })).toHaveAttribute(
      'src',
      'blob:brand-preview-1',
    );
    await user.click(screen.getByRole('button', { name: '브랜드 등록 미리보기' }));
    expect(screen.getByText('이미 등록된 브랜드입니다.')).toBeInTheDocument();
    await user.clear(nameInput);
    await user.type(nameInput, '테스트 브랜드');
    await user.click(screen.getByRole('button', { name: '브랜드 등록 미리보기' }));
    const brandRow = await screen.findByRole('row', { name: /테스트 브랜드/ });
    expect(within(brandRow).getByRole('img', { name: '테스트 브랜드 로고' })).toHaveAttribute(
      'src',
      'blob:brand-preview-3',
    );
    await user.click(within(brandRow).getByRole('link', { name: '테스트 브랜드' }));
    expect(await screen.findByRole('img', { name: '선택한 브랜드 로고 미리보기' })).toHaveAttribute(
      'src',
      'blob:brand-preview-3',
    );
    expect(screen.getByRole('img', { name: '선택한 브랜드 커버 이미지 미리보기' })).toHaveAttribute(
      'src',
      'blob:brand-preview-4',
    );
    await user.click(screen.getByRole('button', { name: '커버 제거' }));
    expect(
      screen.queryByRole('img', { name: '선택한 브랜드 커버 이미지 미리보기' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('커버 이미지 미리보기')).toBeInTheDocument();
  });
});
