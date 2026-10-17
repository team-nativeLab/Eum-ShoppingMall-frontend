import { ApiError } from '@eum/api/errors';
import type { Product, ProductReview, ProductReviewSummary } from '@eum/api/types';
import { fireEvent, render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductReviewsPage } from './product-reviews-page';

const reviewMocks = vi.hoisted(() => ({
  useProductQuery: vi.fn(),
  useSummaryQuery: vi.fn(),
  useReviewsQuery: vi.fn(),
  refetchSummary: vi.fn(),
}));

vi.mock('./use-product-query', () => ({ useProductQuery: reviewMocks.useProductQuery }));
vi.mock('./use-product-review-summary-query', () => ({
  useProductReviewSummaryQuery: reviewMocks.useSummaryQuery,
}));
vi.mock('./use-product-reviews-query', () => ({
  useProductReviewsQuery: reviewMocks.useReviewsQuery,
}));
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...linkProps
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...linkProps}>
      {children}
    </a>
  ),
}));

const product: Product = {
  id: 'product-a',
  name: '안전화',
  brand: '안전브랜드',
  categoryId: 'category-a',
  price: 10000,
  listPrice: null,
  priceVisible: true,
  stockStatus: 'inStock',
  thumbnailUrl: null,
  summary: '',
  modelName: null,
  images: [],
  options: [],
  specifications: [],
  certifications: [],
  shipping: { method: '', estimate: '', fee: 0, countryOfOrigin: '', policy: '' },
  purchaseNotices: [],
  rating: 4.5,
  reviewCount: 2,
  createdAt: '2026-10-01T00:00:00+09:00',
  isFeatured: false,
};
const summary: ProductReviewSummary = {
  productId: product.id,
  averageRating: 4.5,
  totalCount: 2,
  ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
  photoReviewCount: 1,
};
const reviews: ProductReview[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  reviewMocks.useProductQuery.mockReturnValue({ data: product, isPending: false, isError: false });
  reviewMocks.useSummaryQuery.mockReturnValue({
    data: summary,
    isPending: false,
    isSuccess: true,
    isError: false,
    refetch: reviewMocks.refetchSummary,
  });
  reviewMocks.useReviewsQuery.mockReturnValue({
    data: { items: reviews, page: 1, pageSize: 5, totalCount: 2 },
    isPending: false,
    isSuccess: true,
    isError: false,
    isPlaceholderData: false,
  });
});

describe('전체 상품 리뷰 화면', () => {
  it('사진 미디어 계약이 없는 동안 포토 리뷰 필터를 비활성화하고 안내합니다', () => {
    render(<ProductReviewsPage productId={product.id} />);

    const photoFilter = screen.getByRole('button', { name: '포토 리뷰' });
    expect(photoFilter).toBeDisabled();
    expect(photoFilter).toHaveAttribute('aria-describedby', 'photo-review-unavailable-note');
    expect(screen.getByText(/사진 리뷰 데이터가 연결되기 전까지/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '리뷰 통계' })).toBeInTheDocument();
  });

  it('요약 일시 오류는 0점 통계로 대체하지 않고 재시도를 제공합니다', () => {
    reviewMocks.useSummaryQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isSuccess: false,
      isError: true,
      error: new ApiError('NETWORK', 'temporary failure'),
      refetch: reviewMocks.refetchSummary,
    });
    render(<ProductReviewsPage productId={product.id} />);

    expect(screen.getByRole('alert')).toHaveTextContent('리뷰 요약을 불러오지 못했습니다.');
    expect(screen.queryByRole('region', { name: '리뷰 통계' })).not.toBeInTheDocument();
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(reviewMocks.refetchSummary).toHaveBeenCalledOnce();
  });

  it('real mode의 요약 미구현 상태에서는 재시도 버튼을 보이지 않습니다', () => {
    reviewMocks.useSummaryQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isSuccess: false,
      isError: true,
      error: new ApiError('NOT_IMPLEMENTED', 'not connected'),
      refetch: reviewMocks.refetchSummary,
    });
    render(<ProductReviewsPage productId={product.id} />);

    expect(screen.getByRole('alert')).toHaveTextContent('전체 리뷰 요약은 준비 중입니다.');
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
  });
});
