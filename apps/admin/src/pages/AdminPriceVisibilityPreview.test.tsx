import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminProduct, Product } from '@eum/api/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
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
  const router = createMemoryRouter(
    [
      { path: '/products', element: <AdminProductsPage /> },
      { path: '/products/:productId', element: <AdminProductFormPage /> },
    ],
    { initialEntries: [initialEntry] },
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <AdminPriceVisibilityPreviewProvider>
        <AdminProductExposurePreviewProvider>
          <RouterProvider router={router} />
        </AdminProductExposurePreviewProvider>
      </AdminPriceVisibilityPreviewProvider>
    </QueryClientProvider>,
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
      brands: {
        adminList: vi.fn(async () => [{ id: 'brand-test', name: '테스트 브랜드' }]),
      },
    });
  });

  it('filters the list by the product price and exposure fields', async () => {
    const user = userEvent.setup();
    const adminProducts: AdminProduct[] = productFixtures.map((product) => ({
      ...structuredClone(product),
      skus: [],
      price: product.price ?? 0,
      stockCount: 0,
      salesStatus: 'active',
      isVisible: product.id !== 'product-b',
    }));
    apiMocks.adminListProducts.mockResolvedValueOnce(adminProducts);
    renderAdminApp();

    await screen.findByRole('row', { name: /상품 A/ });
    await user.selectOptions(screen.getByLabelText('금액 표시 필터'), 'hidden');
    expect(await screen.findByRole('row', { name: /상품 B/ })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /상품 A/ })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('금액 표시 필터'), 'all');
    await user.selectOptions(screen.getByLabelText('노출 필터'), 'hidden');
    expect(await screen.findByRole('row', { name: /상품 B/ })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /상품 A/ })).not.toBeInTheDocument();
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

  it('shows option inputs without exposing the Figma-excluded SKU editing table', async () => {
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

    expect(await screen.findByRole('heading', { name: '옵션' })).toBeInTheDocument();
    expect(screen.getByLabelText('옵션명')).toHaveValue('색상');
    expect(screen.queryByText(/SKU 조합별 판매 설정/)).not.toBeInTheDocument();
  });

  it('counts products by sales status independently of stock and exposure', async () => {
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
    expect(await tabs.findByRole('button', { name: /판매중/ })).toHaveTextContent('1');
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
    expect(tabs.getByRole('button', { name: /판매중/ })).toHaveTextContent('2');
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
    await user.click(screen.getByRole('link', { name: '취소' }));
    const returnedRow = await screen.findByRole('row', { name: /상품 B/ });
    await waitFor(() =>
      expect(within(returnedRow).getByRole('switch', { name: '상품 B 금액 표시' })).toHaveAttribute(
        'aria-checked',
        'false',
      ),
    );
  });

  it('cancels bulk hiding without changes, confirms and saves hiding, then saves showing', async () => {
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
    expect(dialog).toHaveAccessibleName('선택한 상품 2개의 금액을 숨길까요?');
    expect(
      within(dialog).getByText(/사용자 화면에 가격 대신 '구매 불가'로 표시됩니다/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/이 설정은 목 API에 저장됩니다/)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/이미 장바구니에 담긴 상품은 '주문할 수 없는 상품'/),
    ).toBeInTheDocument();
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
    await user.click(within(dialog).getByRole('button', { name: '금액 숨기기' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const hideAnnouncement = screen.getByRole('status');
    expect(hideAnnouncement).toHaveAttribute('aria-live', 'polite');
    await waitFor(() =>
      expect(hideAnnouncement).toHaveTextContent(
        '목 API에 금액 표시 2개 상품을 저장했습니다. 목록과 관련 화면을 새로고침했습니다.',
      ),
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
    expect(await screen.findByRole('status')).toHaveTextContent(
      '목 API에 금액 표시 2개 상품을 저장했습니다. 목록과 관련 화면을 새로고침했습니다.',
    );
  });

  it('locks pending product actions by ID while leaving other product rows available', async () => {
    const user = userEvent.setup();
    let finishPendingSave: () => void = () => {};
    const pendingSave = new Promise<void>((resolve) => {
      finishPendingSave = resolve;
    });
    apiMocks.saveAdmin.mockImplementationOnce(async (input: AdminProduct) => {
      await pendingSave;
      return structuredClone(input);
    });
    renderAdminApp();

    const productARow = await screen.findByRole('row', { name: /상품 A/ });
    const productBRow = screen.getByRole('row', { name: /상품 B/ });
    await user.click(within(productARow).getByRole('checkbox', { name: '상품 A 선택' }));
    await user.click(within(productARow).getByText('작업'));
    const productAPriceSwitch = within(productARow).getByRole('switch', {
      name: '상품 A 금액 표시',
    });
    await user.click(productAPriceSwitch);

    await waitFor(() => expect(apiMocks.saveAdmin).toHaveBeenCalledTimes(1));
    expect(productAPriceSwitch).toHaveAttribute('aria-busy', 'true');
    expect(within(productARow).getByRole('switch', { name: '상품 A 상품 노출' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(within(productARow).getByRole('checkbox', { name: '상품 A 선택' })).toBeDisabled();
    expect(within(productARow).getByText('작업').closest('summary')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(within(productARow).getByRole('button', { name: '재고 있음으로 설정' })).toBeDisabled();
    expect(
      within(screen.getByRole('region', { name: '선택 상품 작업' })).getByRole('button', {
        name: '금액 표시',
      }),
    ).toBeDisabled();

    await user.click(productAPriceSwitch);
    expect(apiMocks.saveAdmin).toHaveBeenCalledTimes(1);

    const productBPriceSwitch = within(productBRow).getByRole('switch', {
      name: '상품 B 금액 표시',
    });
    expect(productBPriceSwitch).not.toHaveAttribute('aria-busy', 'true');
    await user.click(productBPriceSwitch);
    await waitFor(() => expect(apiMocks.saveAdmin).toHaveBeenCalledTimes(2));

    finishPendingSave();
    await waitFor(() => expect(productAPriceSwitch).not.toHaveAttribute('aria-busy', 'true'));
    expect(within(productARow).getByRole('checkbox', { name: '상품 A 선택' })).toBeEnabled();
  });

  it('continues after one bulk save fails, refreshes the list, and announces partial success', async () => {
    const user = userEvent.setup();
    apiMocks.saveAdmin.mockRejectedValueOnce(new Error('첫 상품 저장 실패'));
    renderAdminApp();

    await screen.findByRole('row', { name: /상품 A/ });
    await user.click(screen.getByRole('checkbox', { name: '상품 A 선택' }));
    await user.click(screen.getByRole('checkbox', { name: '상품 B 선택' }));
    const initialListCallCount = apiMocks.adminListProducts.mock.calls.length;
    await user.click(screen.getByRole('button', { name: /^금액 표시$/ }));

    await waitFor(() => expect(apiMocks.saveAdmin).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('status')).toHaveTextContent(
      '목 API에 금액 표시 1개 저장, 1개 실패했습니다. 목록과 관련 화면을 새로고침했습니다.',
    );
    await waitFor(() =>
      expect(apiMocks.adminListProducts.mock.calls.length).toBeGreaterThan(initialListCallCount),
    );
  });

  it('announces total failure after refreshing the list', async () => {
    const user = userEvent.setup();
    apiMocks.saveAdmin.mockRejectedValue(new Error('저장 실패'));
    renderAdminApp();

    await screen.findByRole('row', { name: /상품 A/ });
    await user.click(screen.getByRole('checkbox', { name: '상품 A 선택' }));
    await user.click(screen.getByRole('checkbox', { name: '상품 B 선택' }));
    const initialListCallCount = apiMocks.adminListProducts.mock.calls.length;
    await user.click(screen.getByRole('button', { name: /^금액 표시$/ }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      '목 API에 금액 표시 2개 상품 저장이 실패했습니다. 목록과 관련 화면을 새로고침했습니다.',
    );
    await waitFor(() =>
      expect(apiMocks.adminListProducts.mock.calls.length).toBeGreaterThan(initialListCallCount),
    );
  });

  it('keeps the last list visible and distinguishes save success from a failed refresh', async () => {
    const user = userEvent.setup();
    const initialProducts: AdminProduct[] = productFixtures.map((product) => ({
      ...structuredClone(product),
      skus: [],
      price: product.price ?? 0,
      stockCount: 0,
      salesStatus: 'active',
      isVisible: true,
    }));
    apiMocks.adminListProducts
      .mockResolvedValueOnce(initialProducts)
      .mockRejectedValueOnce(new Error('refresh failed'));
    renderAdminApp();

    const productARow = await screen.findByRole('row', { name: /상품 A/ });
    await user.click(within(productARow).getByRole('checkbox', { name: '상품 A 선택' }));
    await user.click(screen.getByRole('button', { name: /^금액 표시$/ }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      '목 API에 금액 표시 1개 저장, 0개 실패했습니다. 저장은 처리했지만 관련 화면을 갱신하지 못했습니다. 다시 조회해 주세요.',
    );
    expect(screen.getByRole('row', { name: /상품 A/ })).toBeInTheDocument();
  });

  it('clears selection when search, category, sales filter, or tab changes', async () => {
    const user = userEvent.setup();
    renderAdminApp();

    await screen.findByRole('row', { name: /상품 A/ });
    await user.click(screen.getByRole('checkbox', { name: '상품 A 선택' }));
    expect(screen.getByRole('button', { name: '선택 해제' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('판매 상태 필터'), 'paused');
    await waitFor(() => expect(screen.queryByRole('button', { name: '선택 해제' })).toBeNull());

    await user.selectOptions(screen.getByLabelText('판매 상태 필터'), 'all');
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
        persistenceTargetLabel="목 API"
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('explains that confirmation changes mock data instead of server data', () => {
    render(
      <PriceVisibilityConfirmDialog
        isOpen
        selectedProducts={[{ id: 'product-a', name: '상품 A', thumbnailUrl: null }]}
        persistenceTargetLabel="목 API"
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );

    expect(screen.getByText(/이 설정은 목 API에 저장됩니다/)).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: '금액 숨기기' }));
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
