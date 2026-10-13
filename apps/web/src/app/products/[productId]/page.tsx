import { ProductDetailView } from '@/features/products/product-detail-view';

/** 상품 상세는 요청마다 가격과 재고를 확인합니다. */
export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const routeParams = await params;
  return <ProductDetailView productId={routeParams.productId} />;
}
