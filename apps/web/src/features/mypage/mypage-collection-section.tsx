'use client';
import type { Product } from '@eum/api/types';
import { Button } from '@eum/ui/components/Button';
import { Checkbox } from '@eum/ui/components/Checkbox';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { Clock3, Heart, Package, X } from 'lucide-react';
import { useState } from 'react';
import { ProductCard } from '@/features/products/product-card';
import { useLocalCollections } from '@/features/products/local-collections-context';
import { MyPageActionLink } from './mypage-shell';
import { formatMyPageDate } from './mypage-data';

export function ProductCollectionView({
  mode,
  products,
  unavailableProductIds,
}: {
  mode: 'wishlist' | 'recent';
  products: Product[];
  unavailableProductIds: string[];
}) {
  const { wishlistIds, recentIds, recentViewedAt, toggleWishlist, removeRecent, clearRecent } =
    useLocalCollections();
  const productIds = mode === 'wishlist' ? wishlistIds : recentIds;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const productById = new Map(products.map((product) => [product.id, product]));
  const unavailableIdSet = new Set(unavailableProductIds);
  const orderedProducts = productIds
    .map((id) => productById.get(id))
    .filter((product): product is Product => product !== undefined);
  const isWishlist = mode === 'wishlist';
  const recentGroupsByDate = new Map<
    string,
    { products: Product[]; unavailableProductIds: string[] }
  >();
  for (const productId of productIds) {
    const product = productById.get(productId);
    if (!product && !unavailableIdSet.has(productId)) continue;
    const viewedAt = recentViewedAt[productId];
    const groupLabel = viewedAt ? formatMyPageDate(viewedAt) : '날짜 정보 미제공';
    const group = recentGroupsByDate.get(groupLabel) ?? {
      products: [],
      unavailableProductIds: [],
    };
    if (product) group.products.push(product);
    else group.unavailableProductIds.push(productId);
    recentGroupsByDate.set(groupLabel, group);
  }
  const productGroups: {
    label: string;
    products: Product[];
    unavailableProductIds: string[];
  }[] = isWishlist
    ? [
        {
          label: '',
          products: orderedProducts,
          unavailableProductIds: productIds.filter((productId) => unavailableIdSet.has(productId)),
        },
      ]
    : [...recentGroupsByDate.entries()].map(([label, group]) => ({ label, ...group }));
  const allSelected =
    orderedProducts.length > 0 &&
    orderedProducts.every((product) => selectedIds.includes(product.id));
  const removeProduct = (productId: string) => {
    if (isWishlist) {
      toggleWishlist(productId);
      setSelectedIds((previous) => previous.filter((id) => id !== productId));
    } else removeRecent(productId);
  };
  const removeSelected = () => {
    orderedProducts
      .filter((product) => selectedIds.includes(product.id))
      .forEach((product) => removeProduct(product.id));
    setSelectedIds([]);
  };
  return (
    <div>
      <div className="mb-16 flex flex-wrap items-center justify-between gap-12">
        <p className="text-body-s text-text-2">
          {isWishlist
            ? `찜한 상품 ${orderedProducts.length + unavailableProductIds.length}개`
            : `${orderedProducts.length + unavailableProductIds.length}개 상품`}
        </p>
        {isWishlist ? (
          <div className="flex items-center gap-12">
            <Checkbox
              aria-label="상품 전체 선택"
              checked={allSelected}
              isIndeterminate={selectedIds.length > 0 && !allSelected}
              onChange={(event) =>
                setSelectedIds(
                  event.target.checked ? orderedProducts.map((product) => product.id) : [],
                )
              }
            >
              전체 선택
            </Checkbox>
            <Button
              size="s"
              variant="secondary"
              disabled={!selectedIds.length}
              onClick={removeSelected}
            >
              선택 삭제
            </Button>
          </div>
        ) : (
          <Button size="s" variant="ghost" onClick={clearRecent}>
            전체 삭제
          </Button>
        )}
      </div>
      {!isWishlist ? (
        <NoticeInline className="mb-16">
          최근 본 상품은 최대 20개까지 브라우저에 보관됩니다. 삭제 내용은 이 브라우저에 저장됩니다.
        </NoticeInline>
      ) : null}
      {!orderedProducts.length && !unavailableProductIds.length ? (
        <EmptyState
          icon={isWishlist ? Heart : Clock3}
          title={isWishlist ? '찜한 상품이 없습니다.' : '최근 본 상품이 없습니다.'}
          description={
            isWishlist
              ? '마음에 드는 상품을 찜해 두면 여기에서 확인할 수 있습니다.'
              : '상품을 확인하면 최근 본 상품에 표시됩니다.'
          }
          action={
            <MyPageActionLink href="/" variant="primary">
              상품 보러 가기
            </MyPageActionLink>
          }
        />
      ) : (
        productGroups.map((group) => (
          <section key={group.label || 'wishlist'} className="mb-24 last:mb-0">
            {!isWishlist ? (
              <div className="mb-12 flex flex-wrap items-center justify-between gap-8 border-b border-line pb-10">
                <h2 className="text-label-m">{group.label}</h2>
                {group.label === '날짜 정보 미제공' ? (
                  <span className="text-caption text-text-3">
                    이전 방문일은 저장되지 않았습니다.
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-12 sm:grid-cols-3 lg:grid-cols-4 lg:gap-16">
              {group.products.map((product) => (
                <div key={product.id} className="relative min-w-0">
                  {isWishlist ? (
                    <div className="absolute top-8 left-8 z-10 flex size-32 items-center justify-center rounded-4 bg-bg/90">
                      <Checkbox
                        aria-label={`${product.name} 선택`}
                        checked={selectedIds.includes(product.id)}
                        onChange={(event) =>
                          setSelectedIds((previous) =>
                            event.target.checked
                              ? [...previous, product.id]
                              : previous.filter((id) => id !== product.id),
                          )
                        }
                      />
                    </div>
                  ) : (
                    <Button
                      aria-label={`${product.name} 최근 본 상품에서 삭제`}
                      size="s"
                      variant="secondary"
                      className="absolute top-8 right-8 z-10 size-32 !p-0"
                      onClick={() => removeProduct(product.id)}
                    >
                      <X size={16} aria-hidden="true" />
                    </Button>
                  )}
                  <ProductCard
                    product={product}
                    className={
                      isWishlist
                        ? 'pt-8 [&>div:first-child>div:first-of-type]:top-[44px] lg:[&>div:first-child>div:first-of-type]:top-8 lg:[&>div:first-child>div:first-of-type]:left-[44px]'
                        : '[&>div:first-child>button]:hidden'
                    }
                  />
                </div>
              ))}
              {group.unavailableProductIds.map((productId, index) => (
                <div
                  key={`unavailable-${productId}`}
                  role="group"
                  aria-label="상품 정보를 불러올 수 없는 항목"
                  className="flex min-h-260 flex-col items-center justify-center rounded-12 border border-line bg-surface p-16 text-center"
                >
                  <Package size={28} aria-hidden="true" className="text-text-3" />
                  <p className="mt-12 text-label-m">상품 정보를 불러오지 못했습니다.</p>
                  <p className="mt-4 text-caption text-text-3">
                    다시 시도하거나 목록에서 삭제할 수 있습니다.
                  </p>
                  <Button
                    className="mt-16"
                    size="s"
                    variant="secondary"
                    aria-label={`${isWishlist ? '찜' : '최근 본'} 불러올 수 없는 상품 ${index + 1} 삭제`}
                    onClick={() => removeProduct(productId)}
                  >
                    목록에서 삭제
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
