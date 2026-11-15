import type { Metadata } from 'next';
import { ProductListingView } from '@/features/products/product-listing-view';

export const metadata: Metadata = { title: '베스트' };

export default function BestProductsPage() {
  return <ProductListingView collection="featured" />;
}
