import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@eum/api/types';
import { ProductCard } from './product-card';

const cardMocks = vi.hoisted(() => ({
  addToCart: vi.fn(),
  toggleWishlist: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: cardMocks.routerPush }) }));
vi.mock('@/features/cart/cart-context', () => ({
  useCart: () => ({ addToCart: cardMocks.addToCart }),
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
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
    expect(screen.getByText('₩12,000')).not.toHaveClass('text-danger');
  });

  it('shows a positive sub-one-percent discount as <1%', () => {
    render(<ProductCard product={createProduct({ price: 9999, listPrice: 10000 })} />);

    expect(screen.getByText('<1%')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });
});
