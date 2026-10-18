'use client';

import { canAddToCart, getPriceDisplay } from '@eum/api/price';
import type { Product } from '@eum/api/types';
import { Badge } from '@eum/ui/components/Badge';
import { Icon } from '@eum/ui/components/Icon';
import { cx } from '@eum/ui/lib/cx';
import { Heart, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useCart } from '@/features/cart/cart-context';
import { useLocalCollections } from './local-collections-context';
import { ProductImage } from './product-image';
import { ProductRatingStars } from './product-rating-stars';

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
  cardVariant = 'default',
}: {
  product: Product;
  className?: string;
  layout?: 'grid' | 'list';
  mobileVariant?: 'full' | 'compact';
  /** 홈 베스트 셀러: 중앙 정렬한 좁은 2:3 프레임과 전용 카드 여백·데스크톱 규격을 제어합니다. */
  cardVariant?: 'default' | 'home-carousel';
}) {
  const router = useRouter();
  const { addToCart, isOrderPending } = useCart();
  const { wishlistIds, toggleWishlist } = useLocalCollections();
  const priceDisplay = getPriceDisplay(product);
  const isWishlisted = wishlistIds.includes(product.id);
  const isSoldOut = product.stockStatus === 'soldOut';
  const isCompactOnMobile = mobileVariant === 'compact';
  const isHomeCarouselCard = cardVariant === 'home-carousel';
  const isHomeCarouselCompactCard = isCompactOnMobile && isHomeCarouselCard;
  const hasRequiredOptions = product.options.some((productOption) => productOption.required);
  const productHref = `/products/${encodeURIComponent(product.id)}`;
  const [cartAnnouncement, setCartAnnouncement] = useState('');

  const productBadges = (
    <>
      {!priceDisplay.isPriceVisible ? (
        <Badge tone="outline" className="bg-bg">
          금액 미표시
        </Badge>
      ) : null}
      {isSoldOut ? <Badge tone="soldout">품절</Badge> : null}
    </>
  );

  const favoriteButton = (
    <button
      type="button"
      aria-label={isWishlisted ? `${product.name} 찜 취소` : `${product.name} 찜하기`}
      aria-pressed={isWishlisted}
      onClick={() => toggleWishlist(product.id)}
      className={cx(
        'absolute inline-flex items-center justify-center rounded-capsule focus-ring',
        isWishlisted ? 'text-danger' : 'text-text-1',
        isHomeCarouselCard
          ? 'top-8 right-4 z-20 size-44'
          : isCompactOnMobile
            ? 'top-0 right-0 size-44 lg:top-4 lg:right-4 lg:size-40'
            : 'top-4 right-4 size-40',
      )}
    >
      <Icon icon={Heart} size={16} fill={isWishlisted ? 'currentColor' : 'none'} />
    </button>
  );

  const handleCartAction = () => {
    if (isOrderPending) return;
    if (hasRequiredOptions) {
      router.push(productHref);
      return;
    }
    if (addToCart(product)) {
      setCartAnnouncement(`${product.name}을(를) 장바구니에 담았습니다.`);
    }
  };

  return (
    <article
      className={cx(
        'group flex min-w-0 rounded-8 border border-line bg-bg p-8 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-1',
        layout === 'list'
          ? 'flex-row gap-16'
          : isHomeCarouselCard
            ? 'aspect-[181/284] flex-col lg:aspect-auto'
            : 'aspect-[181/284] min-h-max flex-col',
        isCompactOnMobile && (isHomeCarouselCard ? 'pb-24 lg:pb-8' : 'pb-10 lg:pb-8'),
        // Keep compact home cards tall on mobile and use the desktop carousel minimum height.
        isHomeCarouselCompactCard && 'min-h-[384px]',
        isCompactOnMobile && (layout === 'list' ? 'gap-10 lg:gap-0' : 'gap-16 lg:gap-0'),
        isHomeCarouselCard &&
          'relative lg:min-h-[var(--home-carousel-card-min-height)] lg:border-0 lg:before:pointer-events-none lg:before:absolute lg:before:inset-0 lg:before:rounded-8 lg:before:border lg:before:border-line lg:hover:before:border-line-strong',
        className,
      )}
    >
      <div
        className={cx(
          'relative shrink-0 overflow-hidden rounded-6 bg-surface',
          layout === 'list'
            ? 'aspect-square w-144'
            : isHomeCarouselCompactCard
              ? 'mx-auto aspect-[2/3] w-[calc(100%_-_24px)] max-w-[116px] lg:mx-0 lg:aspect-[4/3] lg:w-full lg:max-w-none'
              : 'aspect-[23/20]',
        )}
      >
        {/* 이름 링크와 같은 곳으로 가는 중복 링크라 탭 순서·보조기기에서 뺍니다. */}
        <Link
          href={productHref}
          tabIndex={-1}
          aria-hidden="true"
          className={cx(
            'block size-full transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none',
            isSoldOut && 'opacity-48',
          )}
        >
          <ProductImage src={product.thumbnailUrl} alt={product.name} />
        </Link>
        {isHomeCarouselCompactCard ? (
          <button
            type="button"
            aria-label={
              hasRequiredOptions ? `${product.name} 옵션 선택` : `${product.name} 장바구니 담기`
            }
            onClick={handleCartAction}
            disabled={isOrderPending || !canAddToCart(product)}
            className="absolute right-8 bottom-8 z-10 hidden size-36 shrink-0 items-center justify-center rounded-8 border border-line-strong bg-bg text-text-1 shadow-1 focus-ring enabled:hover:bg-surface disabled:cursor-not-allowed disabled:border-line disabled:text-text-disabled lg:inline-flex"
          >
            <Icon icon={ShoppingCart} size={20} />
          </button>
        ) : null}
        {!isHomeCarouselCard ? (
          <div className="pointer-events-none absolute top-8 left-8 flex flex-wrap gap-4">
            {productBadges}
          </div>
        ) : null}
        {!isHomeCarouselCard ? favoriteButton : null}
      </div>
      {isHomeCarouselCard ? (
        <div className="pointer-events-none absolute top-8 right-48 left-12 z-10 flex flex-col items-start gap-4 pr-4">
          {productBadges}
        </div>
      ) : null}
      {isHomeCarouselCard ? favoriteButton : null}
      <div
        className={cx(
          'flex min-w-0 flex-1 flex-col px-4',
          isCompactOnMobile ? 'gap-4' : layout === 'list' ? 'pt-12' : 'pt-16',
          isCompactOnMobile && (layout === 'list' ? 'lg:gap-0 lg:pt-12' : 'lg:gap-0 lg:pt-16'),
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
            'mt-6 flex items-center gap-4 text-caption text-text-2',
            isHomeCarouselCompactCard &&
              product.rating === null &&
              'max-lg:flex-col max-lg:items-start max-lg:gap-2',
          )}
        >
          <ProductRatingStars rating={product.rating} />
          {product.rating === null ? (
            <span
              className={cx(
                'flex items-center gap-4',
                isHomeCarouselCompactCard && 'max-lg:whitespace-nowrap',
              )}
            >
              <span>평점 없음</span>
              <span role="img" aria-label={`리뷰 ${product.reviewCount.toLocaleString('ko-KR')}개`}>
                ({product.reviewCount.toLocaleString('ko-KR')})
              </span>
            </span>
          ) : (
            <span className="text-caption-medium text-text-1">{product.rating.toFixed(1)}</span>
          )}
          {product.rating !== null ? (
            <span role="img" aria-label={`리뷰 ${product.reviewCount.toLocaleString('ko-KR')}개`}>
              ({product.reviewCount.toLocaleString('ko-KR')})
            </span>
          ) : null}
        </div>
        <div
          className={cx(
            'mt-auto flex items-end justify-between gap-8',
            isCompactOnMobile ? 'lg:pt-8' : 'pt-8',
          )}
        >
          <div className={cx('min-w-0', isHomeCarouselCompactCard && 'lg:w-full')}>
            {priceDisplay.listPriceText ? (
              <p
                className={
                  isHomeCarouselCompactCard
                    ? 'text-caption text-text-3 line-through lg:break-all'
                    : 'truncate text-caption text-text-3 line-through'
                }
              >
                <span className="sr-only">정가 </span>
                {priceDisplay.listPriceText}
              </p>
            ) : null}
            <p
              className={cx(
                isHomeCarouselCompactCard ? 'text-price-m lg:break-all' : 'truncate text-price-m',
                isSoldOut
                  ? 'text-text-3'
                  : priceDisplay.discountRateLabel !== null
                    ? 'text-danger'
                    : !priceDisplay.isPriceVisible && 'text-text-2',
              )}
            >
              {priceDisplay.discountRateLabel !== null ? (
                <span className="mr-4 text-label-m text-danger">
                  {priceDisplay.discountRateLabel}
                </span>
              ) : null}
              {priceDisplay.listPriceText ? <span className="sr-only">판매가 </span> : null}
              {priceDisplay.text}
            </p>
          </div>
          {!isHomeCarouselCompactCard ? (
            <button
              type="button"
              aria-label={
                hasRequiredOptions ? `${product.name} 옵션 선택` : `${product.name} 장바구니 담기`
              }
              onClick={handleCartAction}
              disabled={isOrderPending || !canAddToCart(product)}
              className={cx(
                'size-36 shrink-0 items-center justify-center rounded-8 border border-line-strong bg-bg text-text-1 focus-ring enabled:hover:bg-surface disabled:cursor-not-allowed disabled:border-line disabled:text-text-disabled',
                isCompactOnMobile ? 'hidden lg:inline-flex' : 'inline-flex',
              )}
            >
              <Icon icon={ShoppingCart} size={20} />
            </button>
          ) : null}
        </div>
        <p role="status" className="sr-only">
          {cartAnnouncement}
        </p>
      </div>
    </article>
  );
}
