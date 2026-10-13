'use client';

import { canAddToCart, getPriceDisplay } from '@eum/api/price';
import type { Product } from '@eum/api/types';
import { Badge } from '@eum/ui/components/Badge';
import { Icon } from '@eum/ui/components/Icon';
import { cx } from '@eum/ui/lib/cx';
import { Heart, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/features/cart/cart-context';
import { useLocalCollections } from './local-collections-context';
import { ProductImage } from './product-image';

/**
 * 공통 상품 카드(Figma HF/Web/ProductCard 240·251, 모바일 HF/ProductCard 169).
 * 구매자 가격과 구매 가능 여부만 표시하며, 숨김 가격 데이터는 사용하지 않습니다.
 * mobileVariant="compact"이면 모바일(lg 미만)에서 브랜드·장바구니 버튼을 빼고 이름·가격만 보여 줍니다(W-01m).
 */
export function ProductCard({
  product,
  className,
  layout = 'grid',
  mobileVariant = 'full',
}: {
  product: Product;
  className?: string;
  layout?: 'grid' | 'list';
  mobileVariant?: 'full' | 'compact';
}) {
  const router = useRouter();
  const { addToCart } = useCart();
  const { wishlistIds, toggleWishlist } = useLocalCollections();
  const priceDisplay = getPriceDisplay(product);
  const isWishlisted = wishlistIds.includes(product.id);
  const isSoldOut = product.stockStatus === 'soldOut';
  const isCompactOnMobile = mobileVariant === 'compact';
  const hasRequiredOptions = product.options.some((productOption) => productOption.required);
  const productHref = `/products/${encodeURIComponent(product.id)}`;

  const handleCartAction = () => {
    if (hasRequiredOptions) {
      router.push(productHref);
      return;
    }
    addToCart(product);
  };

  return (
    <article
      className={cx(
        'group flex min-w-0 rounded-8 border border-line bg-bg p-8 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-1',
        layout === 'list' ? 'flex-row gap-16' : 'flex-col',
        isCompactOnMobile && 'gap-10 pb-10 lg:gap-0 lg:pb-8',
        className,
      )}
    >
      <div
        className={cx(
          'relative aspect-square overflow-hidden rounded-6 bg-surface',
          layout === 'list' && 'w-144 shrink-0',
        )}
      >
        <Link
          href={productHref}
          aria-label={`${product.name} 상세 보기`}
          className={cx(
            'block size-full transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none',
            isSoldOut && 'opacity-48',
          )}
        >
          <ProductImage src={product.thumbnailUrl} alt={product.name} />
        </Link>
        <div className="pointer-events-none absolute top-8 left-8 flex flex-wrap gap-4">
          {!priceDisplay.isPriceVisible ? (
            <Badge tone="outline" className="bg-bg">
              금액 미표시
            </Badge>
          ) : null}
          {isSoldOut ? <Badge tone="soldout">품절</Badge> : null}
        </div>
        <button
          type="button"
          aria-label={isWishlisted ? `${product.name} 찜 취소` : `${product.name} 찜하기`}
          aria-pressed={isWishlisted}
          onClick={() => toggleWishlist(product.id)}
          className={cx(
            'absolute inline-flex items-center justify-center rounded-capsule text-text-1 focus-ring',
            isCompactOnMobile
              ? 'top-0 right-0 size-44 lg:top-4 lg:right-4 lg:size-40'
              : 'top-4 right-4 size-40',
          )}
        >
          <Icon icon={Heart} size={20} fill={isWishlisted ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div
        className={cx(
          'flex min-w-0 flex-1 flex-col px-4',
          isCompactOnMobile ? 'gap-4 lg:gap-0 lg:pt-12' : 'pt-12',
        )}
      >
        <p
          className={cx(
            'truncate text-caption text-text-3',
            isCompactOnMobile && 'hidden lg:block',
          )}
        >
          {product.brand}
        </p>
        <Link
          href={productHref}
          className={cx(
            'rounded-4 focus-ring',
            isSoldOut ? 'text-text-3' : 'text-text-1',
            isCompactOnMobile
              ? 'truncate text-body-s lg:mt-4 lg:line-clamp-2 lg:min-h-48 lg:text-body-m lg:whitespace-normal'
              : 'mt-4 line-clamp-2 min-h-48 text-body-m',
          )}
        >
          {product.name}
        </Link>
        <div
          className={cx(
            'mt-auto flex items-center justify-between gap-8',
            isCompactOnMobile ? 'lg:pt-8' : 'pt-8',
          )}
        >
          <p
            className={cx(
              'min-w-0 truncate text-price-m',
              isSoldOut ? 'text-text-3' : !priceDisplay.isPriceVisible && 'text-text-2',
            )}
          >
            {priceDisplay.text}
          </p>
          <button
            type="button"
            aria-label={
              hasRequiredOptions ? `${product.name} 옵션 선택` : `${product.name} 장바구니 담기`
            }
            onClick={handleCartAction}
            disabled={!canAddToCart(product)}
            className={cx(
              'size-36 shrink-0 items-center justify-center rounded-8 border border-line-strong bg-bg text-text-1 focus-ring enabled:hover:bg-surface disabled:cursor-not-allowed disabled:border-line disabled:text-text-disabled',
              isCompactOnMobile ? 'hidden lg:inline-flex' : 'inline-flex',
            )}
          >
            <Icon icon={ShoppingCart} size={20} />
          </button>
        </div>
      </div>
    </article>
  );
}
