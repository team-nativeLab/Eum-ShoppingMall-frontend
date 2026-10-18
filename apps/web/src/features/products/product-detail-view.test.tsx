import type { Product, ProductOption } from '@eum/api/types';
import { render as renderWithoutProviders, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutProvider } from '@/features/checkout/checkout-context';
import { CHECKOUT_SELECTION_STORAGE_KEY } from '@/features/checkout/checkout-selection-storage';
import { ProductDetailView } from './product-detail-view';

const detailMocks = vi.hoisted(() => ({
  productQuery: vi.fn(),
  categoriesQuery: vi.fn(),
  relatedQuery: vi.fn(),
  addToCart: vi.fn(),
  isOrderPending: false,
  getCurrentUser: vi.fn(),
  isDesktop: true,
  toggleWishlist: vi.fn(),
  recordRecent: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: detailMocks.routerPush }) }));
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...linkProps
  }: {
    href: string;
    children: ReactNode;
    [propName: string]: unknown;
  }) => (
    <a href={href} {...linkProps}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/cart/cart-context', () => ({
  useCart: () => ({
    addToCart: detailMocks.addToCart,
    isOrderPending: detailMocks.isOrderPending,
  }),
}));
vi.mock('@/lib/member-auth', () => ({
  getMemberAuth: async () => ({ getCurrentUser: detailMocks.getCurrentUser }),
}));
vi.mock('@/lib/use-media-query', () => ({
  DESKTOP_QUERY: '(min-width: 64rem)',
  getScrollBehavior: () => 'auto',
  useMediaQuery: () => detailMocks.isDesktop,
  usePrefersReducedMotion: () => true,
}));
vi.mock('./local-collections-context', () => ({
  useLocalCollections: () => ({
    wishlistIds: [],
    toggleWishlist: detailMocks.toggleWishlist,
    recordRecent: detailMocks.recordRecent,
  }),
}));
vi.mock('./product-carousel', () => ({ ProductCarouselSection: () => null }));
vi.mock('./product-reviews-section', () => ({ ProductReviewsSection: () => <section /> }));
vi.mock('./use-categories-query', () => ({ useCategoriesQuery: detailMocks.categoriesQuery }));
vi.mock('./use-product-query', () => ({ useProductQuery: detailMocks.productQuery }));
vi.mock('./use-related-products-query', () => ({
  useRelatedProductsQuery: detailMocks.relatedQuery,
}));
vi.mock('./use-product-questions-query', () => ({
  useProductQuestionsQuery: () => ({ data: [], isPending: false, isError: false }),
}));

const testProduct: Product = {
  id: 'product-test',
  name: '테스트 안전화',
  brand: '테스트 브랜드',
  categoryId: 'category-test',
  price: 10560,
  listPrice: 20900,
  priceVisible: true,
  stockStatus: 'inStock',
  thumbnailUrl: null,
  summary: '강철 선심, 미끄럼 방지 밑창',
  modelName: 'TEST-01',
  images: [{ id: 'image-test', url: '/test-product.jpg', alt: '테스트 안전화 상세 이미지' }],
  options: [],
  specifications: [{ label: '재질', value: '합성가죽' }],
  certifications: ['KCs 안전인증'],
  shipping: {
    method: '택배',
    estimate: '3일 이내 출고',
    fee: 0,
    countryOfOrigin: '대한민국',
    policy: '배송 안내입니다.',
  },
  purchaseNotices: [],
  rating: 4.7,
  reviewCount: 6,
  createdAt: '2026-10-15T00:00:00.000Z',
  isFeatured: false,
};

const sizeOption: ProductOption = {
  id: 'size',
  label: '사이즈',
  required: true,
  choices: [
    { id: 'medium', label: 'M', priceDelta: 0 },
    { id: 'large', label: 'L', priceDelta: 1000 },
  ],
};
const colorOption: ProductOption = {
  id: 'color',
  label: '색상',
  required: true,
  choices: [{ id: 'black', label: '검정', priceDelta: 0 }],
};
const optionalOption: ProductOption = {
  id: 'accessory',
  label: '액세서리',
  required: false,
  choices: [{ id: 'cover', label: '커버', priceDelta: 3000 }],
};

class TestIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly scrollMargin = '';
  readonly thresholds: number[] = [];

  disconnect() {}
  observe() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  unobserve() {}
}

function getButtonAt(buttons: HTMLElement[], index: number): HTMLElement {
  const button = buttons[index];
  if (!button) throw new Error('구매 버튼을 찾을 수 없습니다.');
  return button;
}

const originalIntersectionObserver = globalThis.IntersectionObserver;

function render(ui: ReactNode) {
  return renderWithoutProviders(<CheckoutProvider>{ui}</CheckoutProvider>);
}

beforeEach(() => {
  detailMocks.productQuery.mockReturnValue({
    data: testProduct,
    isPending: false,
    isError: false,
  });
  detailMocks.categoriesQuery.mockReturnValue({ data: [], isPending: false });
  detailMocks.relatedQuery.mockReturnValue({ data: [] });
  detailMocks.addToCart.mockReset();
  detailMocks.addToCart.mockReturnValue(true);
  detailMocks.isOrderPending = false;
  detailMocks.getCurrentUser.mockResolvedValue(null);
  detailMocks.isDesktop = true;
  detailMocks.toggleWishlist.mockReset();
  detailMocks.recordRecent.mockReset();
  detailMocks.routerPush.mockReset();
  vi.stubGlobal('IntersectionObserver', TestIntersectionObserver);
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  if (originalIntersectionObserver) {
    vi.stubGlobal('IntersectionObserver', originalIntersectionObserver);
  } else {
    vi.unstubAllGlobals();
  }
});

describe('ProductDetailView content layout', () => {
  it('disables cart additions while checkout is pending', () => {
    detailMocks.isOrderPending = true;
    render(<ProductDetailView productId="product-test" />);

    expect(screen.getAllByRole('button', { name: '장바구니 담기' })).toHaveLength(2);
    for (const addButton of screen.getAllByRole('button', { name: '장바구니 담기' })) {
      expect(addButton).toBeDisabled();
    }
  });

  it('removes the duplicate purchase aside and lets the detail tabs use the full content column', () => {
    render(<ProductDetailView productId="product-test" />);

    const detailTabs = screen.getByRole('navigation', { name: '상품 상세 탭' });
    const detailLayout = detailTabs.parentElement;
    if (!detailLayout) throw new Error('상품 상세 영역을 찾을 수 없습니다.');

    expect(screen.queryByRole('complementary', { name: '구매 요약' })).not.toBeInTheDocument();
    expect(detailLayout).toHaveClass('mt-40', 'min-w-0', 'lg:mt-96');
    expect(detailLayout).not.toHaveClass('grid', 'lg:grid-cols-[minmax(0,856fr)_minmax(0,416fr)]');
    expect(screen.getByRole('heading', { level: 2, name: '제품 사양' })).toBeInTheDocument();
    expect(screen.getByText('재질').parentElement).toHaveClass(
      'lg:grid-cols-[196px_minmax(0,1fr)]',
    );

    const image = screen
      .getAllByRole('img', { name: '테스트 안전화 상세 이미지' })
      .find((candidate) => candidate.parentElement?.classList.contains('max-w-[856px]'));
    if (!image) throw new Error('상세 설명 이미지를 찾을 수 없습니다.');
    expect(image.parentElement).toHaveClass(
      'mx-auto',
      'w-full',
      'max-w-[856px]',
      'aspect-[856/1200]',
    );
  });

  it('keeps top purchase controls, mobile purchase bar, discount display, and quote link affordances', () => {
    render(<ProductDetailView productId="product-test" />);

    expect(screen.getAllByRole('button', { name: '장바구니 담기' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: '바로 구매' })).toHaveLength(2);
    expect(screen.getByText('총 금액 (1개)')).toBeInTheDocument();
    expect(screen.getByText('49%')).toHaveClass('text-danger');
    expect(screen.getByText('₩20,900').closest('p')).toHaveClass('line-through');

    const quoteLink = screen.getByRole('link', { name: '대량 구매는 견적 문의 →' });
    expect(quoteLink).toHaveAttribute('href', '/solutions?productId=product-test');
    expect(quoteLink).not.toHaveClass('underline');
    expect(quoteLink).toHaveClass(
      'focus-ring',
      'hover:underline',
      'hover:underline-offset-2',
      'focus-visible:underline',
      'focus-visible:underline-offset-2',
    );
  });

  it('passes each selected option and quantity to the quote inquiry link', async () => {
    const user = userEvent.setup();
    detailMocks.productQuery.mockReturnValue({
      data: { ...testProduct, options: [sizeOption] },
      isPending: false,
      isError: false,
    });
    render(<ProductDetailView productId="product-test" />);

    const sizeSelect = screen.getByLabelText('사이즈');
    await user.selectOptions(sizeSelect, 'medium');
    await user.selectOptions(sizeSelect, 'large');

    const mediumQuantity = screen.getByRole('group', { name: '사이즈: M 수량' });
    const largeQuantity = screen.getByRole('group', { name: '사이즈: L 수량' });
    await user.click(within(mediumQuantity).getByRole('button', { name: '수량 늘리기' }));
    await user.click(within(mediumQuantity).getByRole('button', { name: '수량 늘리기' }));
    await user.click(within(largeQuantity).getByRole('button', { name: '수량 늘리기' }));

    const quoteLink = screen.getByRole('link', { name: '대량 구매는 견적 문의 →' });
    const query = new URLSearchParams(quoteLink.getAttribute('href')?.split('?')[1] ?? '');
    expect(query.getAll('productId')).toEqual(['product-test', 'product-test']);
    expect(query.getAll('optionId')).toEqual(['size:medium', 'size:large']);
    expect(query.getAll('quantity')).toEqual(['3', '2']);
  });

  it('shows the selected SKU image in the product gallery', async () => {
    const user = userEvent.setup();
    detailMocks.productQuery.mockReturnValue({
      data: {
        ...testProduct,
        options: [sizeOption],
        skus: [
          {
            id: 'sku-large',
            optionLabels: ['사이즈: L'],
            priceDelta: 1000,
            isAvailable: true,
            imageUrl: '/sku-large.jpg',
          },
        ],
      },
      isPending: false,
      isError: false,
    });
    render(<ProductDetailView productId="product-test" />);

    await user.selectOptions(screen.getByLabelText('사이즈'), 'large');

    expect(
      screen.getAllByRole('img', { name: '테스트 안전화 선택 옵션 이미지' })[0],
    ).toHaveAttribute('src', '/sku-large.jpg');
  });

  it('does not show a false zero discount in the purchase summary', () => {
    detailMocks.productQuery.mockReturnValue({
      data: { ...testProduct, price: 9999, listPrice: 10000 },
      isPending: false,
      isError: false,
    });
    render(<ProductDetailView productId="product-test" />);

    expect(screen.getAllByText('<1%')).toHaveLength(1);
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });
});

describe('ProductDetailView required option validation', () => {
  const renderWithOptions = (options: ProductOption[]) => {
    detailMocks.productQuery.mockReturnValue({
      data: { ...testProduct, options },
      isPending: false,
      isError: false,
    });
    return render(<ProductDetailView productId="product-test" />);
  };

  it.each<[string, number, string, boolean]>([
    ['desktop add to cart', 0, '장바구니 담기', true],
    ['mobile add to cart', 1, '장바구니 담기', false],
    ['mobile buy now', 1, '바로 구매', false],
  ])(
    '%s attaches the missing required option error to the first option',
    async (_, buttonIndex, label, isDesktop) => {
      const user = userEvent.setup();
      detailMocks.isDesktop = isDesktop;
      renderWithOptions([sizeOption, colorOption]);
      const actionButtons = screen.getAllByRole('button', { name: label });
      await user.click(getButtonAt(actionButtons, buttonIndex));

      const sizeSelect = screen.getByLabelText('사이즈');
      expect(sizeSelect).toHaveAttribute('aria-invalid', 'true');
      expect(sizeSelect).toHaveAccessibleDescription('필수 옵션을 선택해 주세요.');
      expect(screen.getAllByText('필수 옵션을 선택해 주세요.')).toHaveLength(1);
      expect(document.activeElement).toBe(sizeSelect);
      expect(sizeSelect.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'center' });
      for (const status of screen.getAllByRole('status')) {
        expect(status).not.toHaveTextContent('필수 옵션을 선택해 주세요.');
      }
    },
  );

  it('moves the error and focus to the next missing required option, then clears it when all are selected', async () => {
    const user = userEvent.setup();
    renderWithOptions([sizeOption, colorOption]);

    await user.click(getButtonAt(screen.getAllByRole('button', { name: '장바구니 담기' }), 0));
    await user.selectOptions(screen.getByLabelText('사이즈'), 'medium');

    const colorSelect = screen.getByLabelText('색상');
    expect(colorSelect).toHaveAttribute('aria-invalid', 'true');
    expect(document.activeElement).toBe(colorSelect);
    expect(screen.getAllByText('필수 옵션을 선택해 주세요.')).toHaveLength(1);

    await user.selectOptions(colorSelect, 'black');

    expect(screen.queryByText('필수 옵션을 선택해 주세요.')).not.toBeInTheDocument();
    expect(screen.getByText('총 금액 (1개)')).toBeInTheDocument();
    await user.click(getButtonAt(screen.getAllByRole('button', { name: '장바구니 담기' }), 0));
    expect(detailMocks.addToCart).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('장바구니에 담았습니다.').length).toBeGreaterThan(0);
  });

  it('does not show a required option error for a product with only optional options', async () => {
    const user = userEvent.setup();
    renderWithOptions([optionalOption]);

    await user.click(getButtonAt(screen.getAllByRole('button', { name: '장바구니 담기' }), 0));

    expect(screen.queryByText('필수 옵션을 선택해 주세요.')).not.toBeInTheDocument();
    expect(
      screen
        .getAllByRole('status')
        .some((status) => status.textContent === '옵션을 고른 뒤 추가 버튼을 눌러 주세요.'),
    ).toBe(true);
    expect(screen.getByLabelText('액세서리')).not.toHaveAttribute('aria-invalid');
  });

  it('starts direct checkout without adding the product to the cart', async () => {
    const user = userEvent.setup();
    window.sessionStorage.clear();
    render(<ProductDetailView productId="product-test" />);

    await user.click(getButtonAt(screen.getAllByRole('button', { name: '바로 구매' }), 0));

    await waitFor(() => {
      expect(detailMocks.routerPush).toHaveBeenCalledWith('/login?redirect=%2Fcheckout%2Fshipping');
    });
    expect(detailMocks.addToCart).not.toHaveBeenCalled();
    expect(
      JSON.parse(window.sessionStorage.getItem(CHECKOUT_SELECTION_STORAGE_KEY) ?? 'null'),
    ).toMatchObject({
      selectionSource: 'direct',
      directLines: [{ productId: 'product-test', optionId: null, quantity: 1 }],
      checkoutStarted: true,
    });
  });
});
