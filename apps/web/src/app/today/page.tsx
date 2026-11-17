import type { Metadata } from 'next';
import { PagedProductCollectionView } from '@/features/products/product-collection-view';

export const metadata: Metadata = { title: '오늘의 상품' };

export default function TodayProductsPage() {
  return (
    <PagedProductCollectionView
      title="오늘의 상품"
      collection="today"
      emptyTitle="등록된 오늘의 상품이 없습니다"
    />
  );
}
