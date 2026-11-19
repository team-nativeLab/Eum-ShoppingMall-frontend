import type { Metadata } from 'next';
import { PagedProductCollectionView } from '@/features/products/product-collection-view';

export const metadata: Metadata = { title: '할인 상품' };

export default function DiscountedProductsPage() {
  return (
    <PagedProductCollectionView
      title="할인 상품"
      collection="discounted"
      emptyTitle="등록된 할인 상품이 없습니다"
    />
  );
}
