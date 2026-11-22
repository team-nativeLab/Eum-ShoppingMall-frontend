import type { Metadata } from 'next';
import { PagedProductCollectionView } from '@/features/products/product-collection-view';

export const metadata: Metadata = { title: '베스트' };

export default function BestProductsPage() {
  return (
    <PagedProductCollectionView
      title="베스트"
      collection="featured"
      emptyTitle="등록된 베스트 상품이 없습니다"
    />
  );
}
