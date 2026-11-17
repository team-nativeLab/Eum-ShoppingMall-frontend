import type { Metadata } from 'next';
import { RecommendedProductCollectionView } from '@/features/products/product-collection-view';

export const metadata: Metadata = { title: '추천 상품' };

export default function RecommendedProductsPage() {
  return <RecommendedProductCollectionView title="추천 상품" emptyTitle="추천 상품이 없습니다" />;
}
