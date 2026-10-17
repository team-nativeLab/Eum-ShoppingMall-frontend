import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@eum/api/errors';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductReviewsSection } from './product-reviews-section';

const reviewMocks = vi.hoisted(() => ({ useQuery: vi.fn() }));

vi.mock('./use-product-reviews-query', () => ({
  useProductReviewsQuery: reviewMocks.useQuery,
}));

vi.mock('@/lib/use-media-query', () => ({
  getScrollBehavior: () => 'auto',
  usePrefersReducedMotion: () => true,
}));

const firstReview = {
  id: 'review-1',
  productId: 'product-test',
  authorName: '김*리',
  rating: 5,
  content: '발이 편하고 미끄럼 방지 기능이 좋아요.',
  optionLabel: '사이즈: 260mm',
  createdAt: '2026-10-01T00:00:00.000Z',
};
const secondReview = {
  ...firstReview,
  id: 'review-2',
  authorName: '박*수',
  rating: 4,
  content: '배송이 빨랐습니다.',
  optionLabel: null,
  createdAt: '2026-09-30T00:00:00.000Z',
};

const originalScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'scrollIntoView',
);

beforeEach(() => {
  reviewMocks.useQuery.mockReturnValue({
    data: { items: [firstReview, secondReview], page: 1, pageSize: 5, totalCount: 2 },
    isPending: false,
    isError: false,
    isPlaceholderData: false,
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  if (originalScrollIntoViewDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      'scrollIntoView',
      originalScrollIntoViewDescriptor,
    );
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  }
});

describe('ProductReviewsSection', () => {
  it('shows masked author, rating, date, content and an optional option label without inventing media or votes', () => {
    const { container } = render(
      <ProductReviewsSection
        productId="product-test"
        reviewCount={2}
        sectionId="product-tab-reviews"
        brand="테스트 브랜드"
      />,
    );

    expect(screen.getByRole('heading', { name: '리뷰 (2)' })).toBeInTheDocument();
    expect(screen.getByText('브랜드: 테스트 브랜드')).toBeInTheDocument();
    expect(screen.getByText('김*리')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '평점 5점' })).toBeInTheDocument();
    expect(screen.getByText('2026. 10. 01.')).toBeInTheDocument();
    expect(screen.getByText('발이 편하고 미끄럼 방지 기능이 좋아요.')).toBeInTheDocument();
    expect(screen.getByText('옵션 · 사이즈: 260mm')).toBeInTheDocument();
    expect(screen.queryByText('옵션 ·')).not.toBeInTheDocument();
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /도움/ })).not.toBeInTheDocument();
    const reportButtons = screen.getAllByRole('button', { name: /리뷰 신고하기/ });
    expect(reportButtons).toHaveLength(2);
    for (const reportButton of reportButtons) {
      expect(reportButton).toBeDisabled();
      expect(reportButton).toHaveAttribute('type', 'button');
      expect(reportButton).toHaveAccessibleDescription('신고 접수 기능은 준비 중입니다');
    }
    expect(
      screen.getByRole('button', { name: '김*리 2026. 10. 01. 리뷰 신고하기' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('keeps loading, error, and empty states available', () => {
    reviewMocks.useQuery.mockReturnValueOnce({
      data: undefined,
      isPending: true,
      isError: false,
      isPlaceholderData: false,
    });
    const loadingView = render(
      <ProductReviewsSection
        productId="product-test"
        reviewCount={0}
        sectionId="reviews"
        brand="테스트 브랜드"
      />,
    );
    expect(screen.getByRole('region', { name: '리뷰 (0)' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('button', { name: /리뷰 신고하기/ })).not.toBeInTheDocument();
    loadingView.unmount();

    reviewMocks.useQuery.mockReturnValueOnce({
      data: undefined,
      error: new ApiError('NOT_IMPLEMENTED', '리뷰 조회 스텁'),
      isPending: false,
      isError: true,
      isPlaceholderData: false,
    });
    const errorView = render(
      <ProductReviewsSection
        productId="product-test"
        reviewCount={0}
        sectionId="reviews"
        brand="테스트 브랜드"
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('리뷰 조회 기능을 준비하고 있습니다.');
    expect(screen.queryByRole('button', { name: /리뷰 신고하기/ })).not.toBeInTheDocument();
    errorView.unmount();

    reviewMocks.useQuery.mockReturnValueOnce({
      data: { items: [], page: 1, pageSize: 5, totalCount: 0 },
      isPending: false,
      isError: false,
      isPlaceholderData: false,
    });
    render(
      <ProductReviewsSection
        productId="product-test"
        reviewCount={0}
        sectionId="reviews"
        brand="테스트 브랜드"
      />,
    );
    expect(
      screen.getByRole('heading', { name: '아직 작성된 리뷰가 없습니다' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /리뷰 신고하기/ })).not.toBeInTheDocument();
  });

  it('requests the latest review page and preserves focus/scroll behavior on page changes', async () => {
    const user = userEvent.setup();
    reviewMocks.useQuery.mockImplementation((_productId: string, params: { page: number }) => {
      const page = params.page ?? 1;
      return {
        data: {
          items: [page === 1 ? firstReview : secondReview],
          page,
          pageSize: 5,
          totalCount: 6,
        },
        isPending: false,
        isError: false,
        isPlaceholderData: false,
      };
    });

    render(
      <ProductReviewsSection
        productId="product-test"
        reviewCount={6}
        sectionId="reviews"
        brand="테스트 브랜드"
      />,
    );

    expect(reviewMocks.useQuery).toHaveBeenCalledWith('product-test', { page: 1, pageSize: 5 });
    await user.click(screen.getByRole('button', { name: '2페이지' }));

    expect(await screen.findByText('배송이 빨랐습니다.')).toBeInTheDocument();
    expect(screen.queryByText('발이 편하고 미끄럼 방지 기능이 좋아요.')).not.toBeInTheDocument();
    expect(reviewMocks.useQuery).toHaveBeenCalledWith('product-test', { page: 2, pageSize: 5 });
    expect(screen.getByRole('heading', { name: '리뷰 (6)' })).toHaveFocus();
    await waitFor(() => expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled());
  });

  it('guards invalid review dates instead of passing them to Intl.DateTimeFormat', () => {
    reviewMocks.useQuery.mockReturnValueOnce({
      data: {
        items: [{ ...firstReview, createdAt: 'not-a-date' }],
        page: 1,
        pageSize: 5,
        totalCount: 1,
      },
      isPending: false,
      isError: false,
      isPlaceholderData: false,
    });

    render(
      <ProductReviewsSection
        productId="product-test"
        reviewCount={1}
        sectionId="reviews"
        brand="테스트 브랜드"
      />,
    );

    expect(screen.getByText('날짜 미제공')).toBeInTheDocument();
  });
});
