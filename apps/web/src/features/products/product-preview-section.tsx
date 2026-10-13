'use client';

import { getApiFailureKind, type ApiFailureKind } from '@eum/api/errors';
import { canAddToCart, getPriceDisplay } from '@eum/api/price';
import type { Product } from '@eum/api/types';
import { Badge } from '@eum/ui/components/Badge';
import { Button } from '@eum/ui/components/Button';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { PackageOpen } from 'lucide-react';
import { useCart } from '@/features/cart/cart-context';
import { useProductsQuery } from './use-products-query';

/** 목 API 연결 확인용 상품 미리보기(로딩·에러·빈·목록 상태). 2단계에서 HF/Web/ProductCard로 바꿉니다. */
export function ProductPreviewSection() {
  const productsQuery = useProductsQuery();

  return (
    <section aria-labelledby="product-preview-heading" className="mt-48">
      <h2 id="product-preview-heading" className="text-h2">
        상품 미리보기
      </h2>
      <div className="mt-24" aria-busy={productsQuery.isPending}>
        {productsQuery.isPending ? (
          <p className="text-body-s text-text-3">상품을 불러오고 있습니다.</p>
        ) : productsQuery.isError ? (
          <ProductLoadError
            failureKind={getApiFailureKind(productsQuery.error)}
            onRetry={() => productsQuery.refetch()}
          />
        ) : productsQuery.data.items.length === 0 ? (
          <EmptyState icon={PackageOpen} title="등록된 상품이 없습니다" headingLevel="h3" />
        ) : (
          <ul className="grid grid-cols-1 gap-24 sm:grid-cols-2 lg:grid-cols-4">
            {productsQuery.data.items.map((product) => (
              <li key={product.id}>
                <ProductPreviewCard product={product} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// 조회 실패 종류별 안내 문구
const LOAD_ERROR_MESSAGE: Record<ApiFailureKind, string> = {
  config: '서비스 설정 문제로 상품을 불러올 수 없습니다. 관리자에게 문의해 주십시오.',
  notImplemented: '상품 조회 기능을 준비하고 있습니다.',
  notFound: '상품 정보를 찾을 수 없습니다.',
  temporary: '상품을 불러오지 못했습니다. 잠시 후 다시 시도해 주십시오.',
};

// 조회 실패 안내. 다시 시도해도 해결되지 않는 오류에는 "다시 시도" 버튼을 보여 주지 않습니다.
function ProductLoadError({
  failureKind,
  onRetry,
}: {
  failureKind: ApiFailureKind;
  onRetry: () => void;
}) {
  return (
    <NoticeInline tone="danger" role="alert">
      {LOAD_ERROR_MESSAGE[failureKind]}
      {failureKind === 'temporary' ? (
        <Button variant="secondary" size="s" className="mt-8" onClick={onRetry}>
          다시 시도
        </Button>
      ) : null}
    </NoticeInline>
  );
}

// 상품 한 개 미리보기 카드
function ProductPreviewCard({ product }: { product: Product }) {
  const { addToCart } = useCart();
  const priceDisplay = getPriceDisplay(product);
  const isSoldOut = product.stockStatus === 'soldOut';
  return (
    <article className="flex h-full flex-col gap-8 rounded-8 border border-line p-16">
      {priceDisplay.isPriceVisible && !isSoldOut ? null : (
        <div className="flex flex-wrap gap-4">
          {priceDisplay.isPriceVisible ? null : <Badge tone="outline">금액 미표시</Badge>}
          {isSoldOut ? <Badge tone="soldout">품절</Badge> : null}
        </div>
      )}
      <p className="text-caption text-text-3">{product.brand}</p>
      <h3 className="text-body-s-medium">{product.name}</h3>
      <p className={priceDisplay.isPriceVisible ? 'text-price-m' : 'text-label-m text-text-3'}>
        {priceDisplay.text}
      </p>
      <Button
        variant="secondary"
        size="s"
        className="mt-auto"
        disabled={!canAddToCart(product)}
        onClick={() => addToCart(product)}
      >
        장바구니 담기
      </Button>
    </article>
  );
}
