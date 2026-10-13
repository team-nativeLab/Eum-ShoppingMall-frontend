import { PageContainer } from '@/components/page-container';
import { ProductPreviewSection } from '@/features/products/product-preview-section';

/** 홈 자리표시. W-01 메인 화면은 2단계에서 구현합니다. */
export default function HomePage() {
  return (
    <PageContainer className="py-64">
      <h1 className="text-web-h2">이음산업건설 쇼핑몰</h1>
      <p className="mt-8 text-body-l text-text-2">메인 화면을 준비하고 있습니다.</p>
      <ProductPreviewSection />
    </PageContainer>
  );
}
