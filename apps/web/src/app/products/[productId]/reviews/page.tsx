import type { Metadata } from 'next';
import { ProductReviewsPage } from '@/features/products/product-reviews-page';

export const metadata: Metadata = { title: '상품 리뷰' };

export default async function ProductReviewsRoute({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const routeParams = await params;
  return <ProductReviewsPage productId={routeParams.productId} />;
}
