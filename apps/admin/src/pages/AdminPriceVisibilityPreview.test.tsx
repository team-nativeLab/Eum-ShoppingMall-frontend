import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminProduct, Product } from '@eum/api/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { PriceVisibilityConfirmDialog } from '@/components/PriceVisibilityConfirmDialog';
import {
  AdminPriceVisibilityPreviewProvider,
  useAdminPriceVisibilityPreview,
} from '@/lib/admin-price-visibility-preview';
import { AdminProductFormPage } from './AdminProductFormPage';
import { AdminProductsPage } from './AdminProductsPage';
import { AdminProductExposurePreviewProvider } from '@/lib/admin-product-exposure-preview';

const apiMocks = vi.hoisted(() => ({
  getShopApi: vi.fn(),
  listProducts: vi.fn(),
  adminListProducts: vi.fn(),
  getProductById: vi.fn(),
  listCategories: vi.fn(),
  saveAdmin: vi.fn(),
}));

vi.mock('@/lib/shop-api', () => ({
  getShopApi: apiMocks.getShopApi,
}));

const productFixtures: Product[] = [
  {
    id: 'product-a',
    name: '상품 A',
    brand: '테스트 브랜드',
    categoryId: 'category-a',
    price: 12000,
    listPrice: 15000,
    priceVisible: true,
    stockStatus: 'inStock',
    thumbnailUrl: null,
    summary: '테스트 상품 설명',
    modelName: null,
    images: [],
    options: [],
    specifications: [],
    certifications: [],
    shipping: {
      method: '일반 배송',
      estimate: '2~3일 이내 출고',
      fee: 0,
      countryOfOrigin: '대한민국',
      policy: '',
    },
    purchaseNotices: [],
    rating: null,
    reviewCount: 0,
    createdAt: '2026-01-02T00:00:00.000Z',
    isFeatured: false,
  },
  {
    id: 'product-b',
    name: '상품 B',
    brand: '테스트 브랜드',
    categoryId: 'category-b',
    price: null,
    listPrice: null,
    priceVisible: false,
    stockStatus: 'inStock',
    thumbnailUrl: null,
    summary: '실제 금액이 응답되지 않은 테스트 상품',
    modelName: null,
    images: [],
    options: [],
    specifications: [],
    certifications: [],
    shipping: {
      method: '일반 배송',
      estimate: '2~3일 이내 출고',
      fee: 0,
      countryOfOrigin: '대한민국',
      policy: '',
    },
    purchaseNotices: [],
    rating: null,
    reviewCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    isFeatured: false,
  },
];

const categoryFixtures = [
  {
    id: 'category-a',
    slug: 'category-a',
    name: '분류 A',
    parentId: null,
    description: null,
    iconKey: null,
  },
  {
    id: 'category-b',
    slug: 'category-b',
    name: '분류 B',
    parentId: null,
    description: null,
    iconKey: null,
  },
];

function renderAdminApp(initialEntry = '/products') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={queryClient}>
        <AdminPriceVisibilityPreviewProvider>
          <AdminProductExposurePreviewProvider>
            <Routes>
              <Route path="/products" element={<AdminProductsPage />} />
              <Route path="/products/:productId" element={<AdminProductFormPage />} />
            </Routes>
          </AdminProductExposurePreviewProvider>
        </AdminPriceVisibilityPreviewProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function SpecialPricePreviewProbe() {
  const specialIdProducts = [
    { id: 'toString', priceVisible: false },
    { id: '__proto__', priceVisible: false },
  ];
  const { getPreviewValue, setPreviewValue } = useAdminPriceVisibilityPreview();

  return (
    <div>
      {specialIdProducts.map((product) => (
        <div key={product.id}>
          <output data-testid={`preview-${product.id}`}>
            {getPreviewValue(product) ? '표시' : '미표시'}
          </output>
          <button type="button" onClick={() => setPreviewValue([product], true)}>
            {product.id} 표시
          </button>
          <button type="button" onClick={() => setPreviewValue([product], false)}>
            {product.id} 미표시
          </button>
        </div>
      ))}
    </div>
  );
}

describe('admin price visibility previews', () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
    const adminProducts: AdminProduct[] = productFixtures.map((product) => ({
      ...structuredClone(product),
      skus: [],
      price: product.price ?? 0,
      stockCount: 0,
      salesStatus: 'active',
      isVisible: true,
    }));
    apiMocks.saveAdmin.mockImplementation(async (input: AdminProduct) => {
      const index = adminProducts.findIndex((product) => product.id === input.id);
      if (index < 0) adminProducts.unshift(structuredClone(input));
      else adminProducts[index] = structuredClone(input);
      return structuredClone(input);
    });
    apiMocks.listProducts.mockImplementation(
      async (params?: { keyword?: string; categoryId?: string }) => {
        const matches = productFixtures.filter((product) => {
          const matchesKeyword =
            !params?.keyword || product.name.toLocaleLowerCase('ko-KR').includes(params.keyword);
          return (
            matchesKeyword && (!params?.categoryId || product.categoryId === params.categoryId)
          );
        });
        return { items: matches, totalCount: matches.length };
      },
    );
    apiMocks.getProductById.mockImplementation(async (productId: string) =>
      productFixtures.find((product) => product.id === productId),
    );
    apiMocks.listCategories.mockResolvedValue(categoryFixtures);
    apiMocks.adminListProducts.mockImplementation(async () => structuredClone(adminProducts));
    apiMocks.getShopApi.mockResolvedValue({
      products: {
        adminList: apiMocks.adminListProducts,
        saveAdmin: apiMocks.saveAdmin,
        list: apiMocks.listProducts,
        getById: apiMocks.getProductById,
      },
      categories: {
        list: apiMocks.listCategories,
        adminList: apiMocks.listCategories,
      },
    });
  });

  it('shows the stored Admin amount even while the buyer price is hidden', async () => {
    renderAdminApp();

    const productRow = await screen.findByRole('row', { name: /상품 B/ });
    const productsRegion = screen.getByRole('region', { name: '상품 목록 가로 스크롤 표' });
    expect(screen.getByText(/표가 넓으면 가로로 이동할 수 있습니다/)).toBeInTheDocument();
    expect(within(productsRegion).getByRole('columnheader', { name: '작업' })).toHaveClass(
      'sticky',
      'right-0',
    );
    expect(within(productRow).getByText('작업')).toBeVisible();
    expect(within(productRow).getByText('₩0')).toBeInTheDocument();
    expect(within(productRow).getByRole('switch', { name: '상품 B 금액 표시' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(productRow.querySelector('.size-40')).toBeInTheDocument();
  });

  it('keeps the full registration date visible beside the sticky action column', async () => {
    renderAdminApp();

    const productsRegion = await screen.findByRole('region', { name: '상품 목록 가로 스크롤 표' });
    const registrationDateHeader = within(productsRegion).getByRole('columnheader', {
      name: '등록일',
    });
    const productRow = within(productsRegion).getByRole('row', { name: /상품 A/ });

    expect(registrationDateHeader).toHaveClass('w-112');
    expect(within(productRow).getByText('2026.01.02')).toBeInTheDocument();
    expect(within(productRow).getByText('2026.01.02').closest('td')).toHaveClass(
      'whitespace-nowrap',
    );
  });

  it('explains that option combinations need explicit SKU rows and gives the next action', async () => {
    const productWithOptions: AdminProduct = {
      ...productFixtures[0]!,
      price: productFixtures[0]!.price ?? 0,
      stockCount: 0,
      salesStatus: 'active',
      isVisible: true,
      skus: [],
      options: [
        {
          id: 'color',
          label: '색상',
          required: true,
          choices: [{ id: 'white', label: '백색', priceDelta: 0 }],
        },
      ],
    };
    apiMocks.adminListProducts.mockResolvedValueOnce([productWithOptions]);
    apiMocks.getProductById.mockResolvedValueOnce(productWithOptions);
    renderAdminApp('/products/product-a');

    expect(await screen.findByText(/옵션 조합은 자동 생성되지 않습니다/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'SKU 행 추가' }));
    expect(screen.getByRole('heading', { name: 'SKU 조합별 판매 설정 (1개)' })).toBeInTheDocument();
    expect(screen.getByText(/등록된 SKU 행별로 옵션 조합/)).toBeInTheDocument();
  });

  it('counts paused products by stock independently of exposure and sales status', async () => {
    const adminProducts: AdminProduct[] = productFixtures.map((product) => ({
      ...structuredClone(product),
      skus: [],
      price: product.price ?? 0,
      stockCount: 0,
      salesStatus: product.id === 'product-a' ? 'paused' : 'active',
      isVisible: true,
    }));
    apiMocks.adminListProducts.mockResolvedValueOnce(adminProducts);
    renderAdminApp();

    const tabs = within(await screen.findByRole('group', { name: '상품 상태 필터' }));
    expect(await tabs.findByRole('button', { name: /재고 있음/ })).toHaveTextContent('2');
    const hiddenTab = tabs.getByRole('button', { name: /숨김/ });
    expect(hiddenTab).toHaveTextContent('0');
    const productRow = await screen.findByRole('row', { name: /상품 A/ });
    expect(within(productRow).getByRole('switch', { name: '상품 A 상품 노출' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await userEvent.setup().click(within(productRow).getByText('작업'));
    await userEvent.setup().click(within(productRow).getByRole('button', { name: '판매 재개' }));
    await waitFor(() =>
      expect(apiMocks.saveAdmin).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'product-a', salesStatus: 'active' }),
      ),
    );
    expect(tabs.getByRole('button', { name: /재고 있음/ })).toHaveTextContent('2');
    await userEvent.setup().click(hiddenTab);
    expect(await screen.findByText('검색 결과가 없습니다')).toBeInTheDocument();
  });

  it('keeps special product IDs safe and restores their false API baseline after toggling', async () => {
    const user = userEvent.setup();
    render(
      <AdminPriceVisibilityPreviewProvider>
        <SpecialPricePreviewProbe />
      </AdminPriceVisibilityPreviewProvider>,
    );

    expect(screen.getByTestId('preview-toString')).toHaveTextContent('미표시');
    expect(screen.getByTestId('preview-__proto__')).toHaveTextContent('미표시');

    await user.click(screen.getByRole('button', { name: 'toString 표시' }));
    await user.click(screen.getByRole('button', { name: '__proto__ 표시' }));
    expect(screen.getByTestId('preview-toString')).toHaveTextContent('표시');
    expect(screen.getByTestId('preview-__proto__')).toHaveTextContent('표시');

    await user.click(screen.getByRole('button', { name: 'toString 미표시' }));
    await user.click(screen.getByRole('button', { name: '__proto__ 미표시' }));
    expect(screen.getByTestId('preview-toString')).toHaveTextContent('미표시');
    expect(screen.getByTestId('preview-__proto__')).toHaveTextContent('미표시');
  });

  it('loads the saved row visibility into the edit form and saves the changed value', async () => {
    const user = userEvent.setup();
    renderAdminApp();

    const productRow = await screen.findByRole('row', { name: /상품 B/ });
    const rowSwitch = within(productRow).getByRole('switch', { name: '상품 B 금액 표시' });
    expect(rowSwitch).toHaveAttribute('aria-checked', 'false');
    await user.click(rowSwitch);
    await waitFor(() => expect(rowSwitch).toHaveAttribute('aria-checked', 'true'));

    await user.click(within(productRow).getByRole('link', { name: '상품 B' }));
    const formSwitch = await screen.findByRole('switch', { name: '금액 표시' });
    const priceGroup = screen.getByRole('group', { name: '판매가 및 금액 표시' });
    expect(within(priceGroup).getByRole('spinbutton', { name: '판매가' })).toBeInTheDocument();
    expect(within(priceGroup).getByRole('switch', { name: '금액 표시' })).toBe(formSwitch);
    expect(screen.getByRole('spinbutton', { name: '정가' })).toBeInTheDocument();
    expect(screen.getByText('정가', { selector: 'p' })).toHaveClass('text-caption', 'text-text-3');
    expect(screen.queryByRole('heading', { name: '데모 안내' })).not.toBeInTheDocument();
    expect(formSwitch).toHaveAttribute('aria-checked', 'true');
    expect(apiMocks.saveAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'product-b', priceVisible: true }),
    );
    expect(within(priceGroup).getByRole('spinbutton', { name: '판매가' })).toHaveValue(0);

    await user.click(formSwitch);
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() =>
      expect(apiMocks.saveAdmin).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'product-b', priceVisible: false }),
      ),
    );
    await user.click(screen.getByRole('link', { name: '목록' }));
    const returnedRow = await screen.findByRole('row', { name: /상품 B/ });
    await waitFor(() =>
      expect(within(returnedRow).getByRole('switch', { name: '상품 B 금액 표시' })).toHaveAttribute(
        'aria-checked',
        'false',
      ),
    );
  });

  it('cancels bulk hiding without changes, confirms hiding, and previews bulk showing directly', async () => {
    const user = userEvent.setup();
    renderAdminApp();

    await screen.findByRole('row', { name: /상품 A/ });
    await user.click(screen.getByRole('checkbox', { name: '상품 A 선택' }));
    await user.click(screen.getByRole('checkbox', { name: '상품 B 선택' }));
    const selectedActions = screen.getByRole('region', { name: '선택 상품 작업' });
    expect(within(selectedActions).getByText('2개 상품 선택')).toBeInTheDocument();
    expect(within(selectedActions).getByRole('button', { name: '금액 표시' })).toBeInTheDocument();
    expect(
      within(selectedActions).queryByRole('combobox', { name: '정렬 기준' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^금액 미표시$/ }));

    let dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('선택한 상품 2개의 금액을 미표시 상태로 미리 볼까요?');
    expect(within(dialog).getByText(/실제 설정에 저장하면 구매자 화면에/)).toBeInTheDocument();
    expect(within(dialog).getByText(/실제 설정에 저장하면 구매자 화면에/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '취소' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('switch', { name: '상품 A 금액 표시' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('switch', { name: '상품 B 금액 표시' })).toHaveAttribute(
      'aria-checked',
      'false',
    );

    await user.click(screen.getByRole('button', { name: /^금액 미표시$/ }));
    dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '금액 미표시 미리보기' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const hideAnnouncement = screen.getByRole('status');
    expect(hideAnnouncement).toHaveAttribute('aria-live', 'polite');
    await waitFor(() =>
      expect(hideAnnouncement).toHaveTextContent('금액 표시를 저장하고 있습니다.'),
    );
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: '상품 A 금액 표시' })).toHaveAttribute(
        'aria-checked',
        'false',
      ),
    );
    expect(screen.getByRole('switch', { name: '상품 B 금액 표시' })).toHaveAttribute(
      'aria-checked',
      'false',
    );

    await user.click(screen.getByRole('button', { name: /^금액 표시$/ }));
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: '상품 A 금액 표시' })).toHaveAttribute(
        'aria-checked',
        'true',
      ),
    );
    expect(screen.getByRole('switch', { name: '상품 B 금액 표시' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('persists bulk price visibility updates through ShopApi', async () => {
    const user = userEvent.setup();
    renderAdminApp();
    await screen.findByRole('row', { name: /상품 A/ });
    await user.click(screen.getByRole('checkbox', { name: '상품 A 선택' }));
    await user.click(screen.getByRole('checkbox', { name: '상품 B 선택' }));
    await user.click(screen.getByRole('button', { name: /^금액 표시$/ }));
    await waitFor(() => expect(apiMocks.saveAdmin).toHaveBeenCalledTimes(2));
    expect(apiMocks.saveAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'product-a', priceVisible: true }),
    );
    expect(apiMocks.saveAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'product-b', priceVisible: true }),
    );
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: '상품 A 금액 표시' })).toHaveAttribute(
        'aria-checked',
        'true',
      ),
    );
    expect(screen.getByRole('switch', { name: '상품 B 금액 표시' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('clears selection when search, category, stock filter, or tab changes', async () => {
    const user = userEvent.setup();
    renderAdminApp();

    await screen.findByRole('row', { name: /상품 A/ });
    await user.click(screen.getByRole('checkbox', { name: '상품 A 선택' }));
    expect(screen.getByRole('button', { name: '선택 해제' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('재고 상태 필터'), 'soldOut');
    await waitFor(() => expect(screen.queryByRole('button', { name: '선택 해제' })).toBeNull());

    await user.selectOptions(screen.getByLabelText('재고 상태 필터'), 'all');
    await screen.findByRole('row', { name: /상품 A/ });
    await user.click(screen.getByRole('checkbox', { name: '상품 A 선택' }));
    const statusTabs = within(screen.getByRole('group', { name: '상품 상태 필터' }));
    await user.click(statusTabs.getByRole('button', { name: /^금액 미표시/ }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '선택 해제' })).toBeNull());

    await user.click(statusTabs.getByRole('button', { name: /^전체/ }));
    await screen.findByRole('row', { name: /상품 A/ });
    await user.click(screen.getByRole('checkbox', { name: '상품 A 선택' }));
    await user.selectOptions(screen.getByLabelText('카테고리 필터'), 'category-b');
    await waitFor(() => expect(screen.queryByRole('button', { name: '선택 해제' })).toBeNull());

    await user.selectOptions(screen.getByLabelText('카테고리 필터'), '');
    await screen.findByRole('row', { name: /상품 A/ });
    await user.click(screen.getByRole('checkbox', { name: '상품 A 선택' }));
    await user.type(screen.getByRole('searchbox', { name: '상품명·브랜드 검색' }), '없는 상품');
    await user.click(screen.getByRole('button', { name: '검색' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '선택 해제' })).toBeNull());
  });

  it('retains a saved price visibility value after the page remounts', async () => {
    const user = userEvent.setup();
    const firstRender = renderAdminApp();
    const productRow = await screen.findByRole('row', { name: /상품 A/ });
    const rowSwitch = within(productRow).getByRole('switch', { name: '상품 A 금액 표시' });
    await user.click(rowSwitch);
    await waitFor(() => expect(rowSwitch).toHaveAttribute('aria-checked', 'false'));
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);

    firstRender.unmount();
    renderAdminApp();

    const refreshedRow = await screen.findByRole('row', { name: /상품 A/ });
    expect(within(refreshedRow).getByRole('switch', { name: '상품 A 금액 표시' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('does not open the confirmation dialog for an empty target list', () => {
    render(
      <PriceVisibilityConfirmDialog
        isOpen
        selectedProducts={[]}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('saves product exposure and price visibility as separate fields', async () => {
    const user = userEvent.setup();
    renderAdminApp();
    const productRow = await screen.findByRole('row', { name: /상품 A/ });
    const priceSwitch = within(productRow).getByRole('switch', { name: '상품 A 금액 표시' });
    const exposureSwitch = within(productRow).getByRole('switch', { name: '상품 A 상품 노출' });

    await user.click(exposureSwitch);
    await user.click(within(productRow).getByRole('checkbox', { name: '상품 A 선택' }));
    await user.click(screen.getByRole('button', { name: '금액 미표시' }));
    await user.click(screen.getByRole('button', { name: '금액 미표시 미리보기' }));
    await waitFor(() =>
      expect(apiMocks.saveAdmin).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'product-a', isVisible: false }),
      ),
    );
    await waitFor(() =>
      expect(apiMocks.saveAdmin).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'product-a', priceVisible: false }),
      ),
    );
    await waitFor(() => expect(exposureSwitch).toHaveAttribute('aria-checked', 'false'));
    expect(priceSwitch).toHaveAttribute('aria-checked', 'false');
  });
});
