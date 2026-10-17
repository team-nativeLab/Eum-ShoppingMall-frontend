import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@eum/api/types';
import { ProductCard } from './product-card';

const cardMocks = vi.hoisted(() => ({
  addToCart: vi.fn(),
  isOrderPending: false,
  toggleWishlist: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: cardMocks.routerPush }) }));
vi.mock('@/features/cart/cart-context', () => ({
  useCart: () => ({
    addToCart: cardMocks.addToCart,
    isOrderPending: cardMocks.isOrderPending,
  }),
}));
vi.mock('./local-collections-context', () => ({
  useLocalCollections: () => ({ wishlistIds: [], toggleWishlist: cardMocks.toggleWishlist }),
}));

function createProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prd-card-test',
    name: '테스트 안전화',
    brand: '테스트 브랜드',
    categoryId: 'cat-test',
    price: 10560,
    listPrice: 20900,
    priceVisible: true,
    stockStatus: 'inStock',
    thumbnailUrl: null,
    summary: '',
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
    rating: 4.7,
    reviewCount: 6,
    createdAt: '2026-01-01T00:00:00.000Z',
    isFeatured: false,
    ...overrides,
  };
}

describe('ProductCard', () => {
  beforeEach(() => {
    cardMocks.addToCart.mockReset();
    cardMocks.addToCart.mockReturnValue(true);
    cardMocks.isOrderPending = false;
  });

  it('disables cart add while checkout is pending and restores it after the request settles', async () => {
    cardMocks.isOrderPending = true;
    const user = userEvent.setup();
    const { rerender } = render(<ProductCard product={createProduct()} />);

    const addButton = screen.getByRole('button', { name: '테스트 안전화 장바구니 담기' });
    expect(addButton).toBeDisabled();
    await user.click(addButton);
    expect(cardMocks.addToCart).not.toHaveBeenCalled();

    cardMocks.isOrderPending = false;
    rerender(<ProductCard product={createProduct()} />);
    await user.click(screen.getByRole('button', { name: '테스트 안전화 장바구니 담기' }));
    expect(cardMocks.addToCart).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent(
      '테스트 안전화을(를) 장바구니에 담았습니다.',
    );
  });

  it('allows the home desktop card to grow while keeping long names, reviews and prices', () => {
    const longProductName = '산업 현장용 고시인성 장시간 착용 안전화 상품명 길이 확인용';
    render(
      <ProductCard
        product={createProduct({ name: longProductName, reviewCount: 12345 })}
        mobileVariant="compact"
        cardVariant="home-carousel"
      />,
    );

    const card = screen.getByRole('article');
    expect(card).toHaveClass('aspect-[181/284]', 'lg:h-auto', 'lg:min-h-max');
    expect(card).not.toHaveClass(
      'lg:min-h-0',
      'lg:min-h-[var(--home-carousel-card-height)]',
      'lg:h-[var(--home-carousel-card-height)]',
    );
    expect(within(card).getByRole('link', { name: longProductName })).toBeInTheDocument();
    expect(within(card).getByLabelText('리뷰 12,345개')).toHaveTextContent('(12,345)');
    expect(within(card).getByText('49%')).toBeInTheDocument();
    expect(within(card).getByText('₩20,900')).toBeInTheDocument();
    expect(within(card).getByText('₩10,560')).toBeInTheDocument();
    expect(
      within(card).getByRole('button', { name: `${longProductName} 장바구니 담기` }),
    ).toBeInTheDocument();
  });

  it('shows average stars, review count, integer discount, list price and highlighted sale price', () => {
    render(<ProductCard product={createProduct()} />);

    expect(screen.getByRole('img', { name: '평점 4.7점' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '평점 4.7점' }).querySelector('svg')).toHaveClass(
      'text-rating-star-stroke',
    );
    expect(screen.getByText('4.7')).toBeInTheDocument();
    expect(screen.getByLabelText('리뷰 6개')).toHaveTextContent('(6)');
    expect(screen.getByText('49%')).toBeInTheDocument();
    expect(screen.getByText('₩20,900')).toHaveClass('line-through');
    expect(screen.getByText('₩10,560')).toHaveClass('text-danger');
  });

  it('labels unrated products clearly and omits discount when the product has no discount', () => {
    render(
      <ProductCard
        product={createProduct({ rating: null, reviewCount: 0, price: 12000, listPrice: null })}
      />,
    );

    expect(screen.getByRole('img', { name: '평점 없음' })).toBeInTheDocument();
    expect(screen.getByText('평점 없음')).toBeInTheDocument();
    expect(screen.getByLabelText('리뷰 0개')).toHaveTextContent('(0)');
    expect(screen.getByRole('img', { name: '평점 없음' }).parentElement).not.toHaveClass(
      'max-lg:flex-col',
    );
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
    expect(screen.getByText('₩12,000')).not.toHaveClass('text-danger');
  });

  it('shows a positive sub-one-percent discount as <1%', () => {
    render(<ProductCard product={createProduct({ price: 9999, listPrice: 10000 })} />);

    expect(screen.getByText('<1%')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('gives home cards responsive image sizing, mobile height, and separate badge and favorite slots', () => {
    const longProductName = '테스트 현장용 고시인성 장시간 착용 안전화 상품명 길이 확인';
    render(
      <ProductCard
        product={createProduct({
          name: longProductName,
          stockStatus: 'soldOut',
          priceVisible: false,
          thumbnailUrl: '/test-placeholder.png',
        })}
        mobileVariant="compact"
        cardVariant="home-carousel"
      />,
    );

    const card = screen.getByRole('article');
    expect(card).toHaveClass('relative', 'pb-24', 'lg:pb-8', 'min-h-[384px]');
    expect(card).toHaveClass('aspect-[181/284]', 'lg:h-auto', 'lg:min-h-max');
    expect(card).not.toHaveClass(
      'lg:min-h-0',
      'lg:min-h-[var(--home-carousel-card-height)]',
      'lg:h-[var(--home-carousel-card-height)]',
    );
    const imageFrame = card.firstElementChild;
    if (!(imageFrame instanceof HTMLElement)) throw new Error('Expected a product image frame.');

    expect(imageFrame).toHaveClass(
      'mx-auto',
      'w-[calc(100%_-_24px)]',
      'max-w-[116px]',
      'aspect-[2/3]',
      'lg:mx-0',
      'lg:aspect-[23/20]',
      'lg:w-full',
      'lg:max-w-none',
      'overflow-hidden',
    );
    expect(imageFrame).not.toHaveClass('lg:aspect-[181/284]', 'lg:min-h-0');
    expect(imageFrame.querySelector('img')).toHaveClass('object-cover');

    const favoriteButton = within(card).getByRole('button', {
      name: `${longProductName} 찜하기`,
    });
    expect(favoriteButton).toHaveClass('top-8', 'right-4', 'size-44', 'z-20');
    expect(favoriteButton.parentElement).toBe(card);

    const homeBadgeStack = within(card).getByText('금액 미표시').parentElement;
    expect(homeBadgeStack).toHaveClass(
      'absolute',
      'top-8',
      'left-12',
      'right-48',
      'pr-4',
      'z-10',
      'flex-col',
      'items-start',
      'gap-4',
    );
    expect(homeBadgeStack?.parentElement).toBe(card);
    expect(homeBadgeStack?.children).toHaveLength(2);
    expect(within(card).getByText('품절')).toBeInTheDocument();

    const productLink = within(card).getByRole('link', { name: longProductName });
    expect(productLink).toHaveClass('truncate');
    expect(productLink.parentElement).toHaveClass('px-4');
    const priceRow = card.querySelector('div.mt-auto');
    expect(priceRow).toHaveClass('mt-auto', 'items-end', 'justify-between');
    expect(priceRow?.parentElement).toHaveClass('px-4');
    expect(
      within(card).getByRole('button', {
        name: `${longProductName} 장바구니 담기`,
      }),
    ).toHaveClass('size-36', 'hidden', 'lg:inline-flex');
  });

  it('stacks home mobile unrated stars above a single-line rating summary', () => {
    render(
      <ProductCard
        product={createProduct({ rating: null, reviewCount: 0 })}
        mobileVariant="compact"
        cardVariant="home-carousel"
      />,
    );

    const ratingRow = screen.getByRole('img', { name: '평점 없음' }).parentElement;
    expect(ratingRow).toHaveClass('max-lg:flex-col', 'max-lg:items-start', 'max-lg:gap-2');

    const ratingSummary = screen.getByText('평점 없음').parentElement;
    if (!(ratingSummary instanceof HTMLElement)) {
      throw new Error('Expected an unrated home card summary.');
    }
    expect(ratingSummary).toHaveClass('max-lg:whitespace-nowrap');
    expect(ratingSummary.textContent).toContain('(0)');
    expect(within(ratingSummary).getByLabelText('리뷰 0개')).toHaveTextContent('(0)');
  });

  it('keeps default and shared compact card image sizing and spacing unchanged', () => {
    const soldOutProduct = createProduct({ stockStatus: 'soldOut' });
    const { rerender } = render(<ProductCard product={soldOutProduct} />);

    let card = screen.getByRole('article');
    let imageFrame = card.firstElementChild;
    if (!(imageFrame instanceof HTMLElement)) throw new Error('Expected a product image frame.');
    expect(card).toHaveClass('aspect-[181/284]', 'min-h-max');
    expect(card).not.toHaveClass('@container');
    expect(imageFrame).toHaveClass('aspect-[23/20]');
    expect(imageFrame).not.toHaveClass('w-[calc(100%_-_16px)]', 'mx-auto');
    expect(card).not.toHaveClass('pb-24');
    expect(card).not.toHaveClass('min-h-[384px]');
    expect(within(imageFrame).getByText('품절').parentElement).toHaveClass('left-8');
    expect(within(imageFrame).getByText('품절').parentElement).not.toHaveClass('left-4');
    expect(within(imageFrame).getByRole('button', { name: '테스트 안전화 찜하기' })).toHaveClass(
      'top-4',
      'right-4',
      'size-40',
    );

    rerender(<ProductCard product={soldOutProduct} mobileVariant="compact" />);

    card = screen.getByRole('article');
    imageFrame = card.firstElementChild;
    if (!(imageFrame instanceof HTMLElement)) throw new Error('Expected a product image frame.');
    expect(card).not.toHaveClass('@container');
    expect(card).not.toHaveClass('min-h-[384px]');
    expect(card).toHaveClass('pb-10', 'lg:pb-8');
    expect(card).toHaveClass('aspect-[181/284]', 'min-h-max');
    expect(imageFrame).toHaveClass('aspect-[23/20]');
    expect(imageFrame).not.toHaveClass('w-[calc(100%_-_16px)]', 'mx-auto');
    expect(within(imageFrame).getByText('품절').parentElement).toHaveClass('left-8');
    expect(within(imageFrame).getByText('품절').parentElement).not.toHaveClass('left-4');
  });

  it('keeps the list image square without applying the grid card ratio', () => {
    render(<ProductCard product={createProduct()} layout="list" />);

    const card = screen.getByRole('article');
    const imageFrame = card.firstElementChild;
    if (!(imageFrame instanceof HTMLElement)) throw new Error('Expected a product image frame.');

    expect(card).toHaveClass('flex-row');
    expect(card).not.toHaveClass('aspect-[181/284]');
    expect(imageFrame).toHaveClass('aspect-square', 'w-144');
  });
});
