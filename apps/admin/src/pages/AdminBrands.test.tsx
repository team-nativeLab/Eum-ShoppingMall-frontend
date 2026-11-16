import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminBrand } from '@eum/api/types';
import { AdminBrandsPage } from './AdminBrandsPage';
import { AdminBrandFormPage } from './AdminBrandFormPage';

const shopMocks = vi.hoisted(() => ({ getShopApi: vi.fn() }));
vi.mock('@/lib/shop-api', () => ({ getShopApi: shopMocks.getShopApi }));

const fixtureBrand: AdminBrand = {
  id: 'brand-one',
  name: '한결안전',
  englishName: 'HANGYEOL',
  logoUrl: 'https://example.test/logo.png',
  tagline: '현장의 안전 브랜드',
  productCount: 1,
  coverImageUrl: null,
  mainField: '안전용품',
  originCountry: '대한민국',
  certification: 'KC',
  story: { title: '안전을 만드는 기술', body: '브랜드 이야기입니다.' },
  isVisible: true,
  isFeatured: false,
  sortOrder: 10,
};

function renderBrandApp(path = '/brands') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/brands" element={<AdminBrandsPage />} />
          <Route path="/brands/new" element={<AdminBrandFormPage />} />
          <Route path="/brands/:brandId" element={<AdminBrandFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ShopApi 기반 브랜드 관리', () => {
  let brands: AdminBrand[];
  let saveAdmin: ReturnType<typeof vi.fn>;
  let deleteAdmin: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    brands = [structuredClone(fixtureBrand)];
    saveAdmin = vi.fn(async (input: Omit<AdminBrand, 'id' | 'productCount'> & { id?: string }) => {
      const saved = { ...input, id: input.id ?? 'brand-created', productCount: 0 } as AdminBrand;
      const index = brands.findIndex((brand) => brand.id === saved.id);
      if (index < 0) brands.unshift(saved);
      else brands[index] = saved;
      return saved;
    });
    deleteAdmin = vi.fn(async (id: string) => {
      brands = brands.filter((brand) => brand.id !== id);
    });
    shopMocks.getShopApi.mockResolvedValue({
      brands: {
        adminList: vi.fn(async () => structuredClone(brands)),
        saveAdmin,
        deleteAdmin,
      },
    });
  });

  it('목 API에서 브랜드를 읽고 검색한다', async () => {
    const user = userEvent.setup();
    renderBrandApp();
    expect(await screen.findByRole('row', { name: /한결안전/ })).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: '브랜드 검색' }), '없는 브랜드');
    expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument();
  });

  it('대표로 지정한 노출 브랜드를 이달의 브랜드 영역에 표시한다', async () => {
    brands = [{ ...structuredClone(fixtureBrand), isFeatured: true }];
    renderBrandApp();

    expect(await screen.findByRole('heading', { name: '이달의 브랜드' })).toBeInTheDocument();
    expect(
      await within(screen.getByRole('region', { name: '이달의 브랜드' })).findByText('한결안전'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: '이달의 브랜드' })).getByRole('link', {
        name: '수정',
      }),
    ).toHaveAttribute('href', '/brands/brand-one');
  });

  it('노출 상태 변경을 ShopApi에 저장한다', async () => {
    const user = userEvent.setup();
    renderBrandApp();
    const row = await screen.findByRole('row', { name: /한결안전/ });
    await user.click(within(row).getByRole('switch', { name: '한결안전 노출' }));
    await waitFor(() =>
      expect(saveAdmin).toHaveBeenCalledWith(expect.objectContaining({ isVisible: false })),
    );
  });

  it('브랜드 필드와 이미지 파일을 목 API에 저장한다', async () => {
    const user = userEvent.setup();
    renderBrandApp('/brands/new');
    await user.type(await screen.findByRole('textbox', { name: /브랜드명/ }), '새 브랜드');
    await user.type(screen.getByRole('textbox', { name: /한 줄 소개/ }), '새 브랜드 소개');
    const file = new File(['logo'], 'logo.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(/로고 파일 선택/), { target: { files: [file] } });
    expect(await screen.findByRole('img', { name: '브랜드 로고 미리보기' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() =>
      expect(saveAdmin).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '새 브랜드',
          tagline: '새 브랜드 소개',
          logoUrl: expect.stringMatching(/^data:image\/png;base64,/),
        }),
      ),
    );
  });
});
