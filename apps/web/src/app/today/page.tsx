import type { Metadata } from 'next';
import { ProductListingView } from '@/features/products/product-listing-view';

export const metadata: Metadata = { title: '오늘의 상품' };

export default function TodayProductsPage() {
  return <ProductListingView collection="today" />;
}
