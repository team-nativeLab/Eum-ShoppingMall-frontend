import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@eum/ui/components/Button';
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  formatAdminDateTime,
} from '@/components/AdminUI';
import { getShopApi } from '@/lib/shop-api';

/** 상품 리뷰 공개 여부와 공개 답변·내부 메모를 관리합니다. */
export function AdminReviewsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [memo, setMemo] = useState<string | null>(null);
  const [visible, setVisible] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const reviewsQuery = useQuery({
    queryKey: ['admin', 'reviews'],
    queryFn: async ({ signal }) => (await getShopApi()).products.adminListReviews({ signal }),
  });
  const productsQuery = useQuery({
    queryKey: ['admin', 'products', 'review-labels'],
    queryFn: async ({ signal }) => (await getShopApi()).products.adminList({ signal }),
  });
  if (reviewsQuery.isPending || productsQuery.isPending)
    return <AdminLoading label="상품 리뷰를 불러오고 있습니다." />;
  if (reviewsQuery.isError || productsQuery.isError)
    return (
      <AdminError
        onRetry={() => {
          void reviewsQuery.refetch();
          void productsQuery.refetch();
        }}
      />
    );
  const reviews = reviewsQuery.data;
  const active = reviews.find((review) => review.id === selectedId) ?? reviews[0];
  const activeReply = reply ?? active?.adminReply ?? '';
  const activeMemo = memo ?? active?.adminMemo ?? '';
  const activeVisibility = visible ?? active?.isVisible ?? true;
  const productName = (productId: string) =>
    productsQuery.data.find((product) => product.id === productId)?.name ?? productId;
  const save = async () => {
    if (!active) return;
    setMessage('');
    try {
      await (
        await getShopApi()
      ).products.updateReviewAdmin(active.id, {
        adminReply: activeReply.trim(),
        adminMemo: activeMemo,
        isVisible: activeVisibility,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['product-reviews'] }),
      ]);
      setReply(null);
      setMemo(null);
      setVisible(null);
      setMessage(
        '리뷰 노출과 답변을 목 API에 저장했습니다. 공개 답변은 Web 리뷰 목록에 반영됩니다.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '리뷰 변경을 저장하지 못했습니다.');
    }
  };
  return (
    <section aria-label="상품 리뷰 관리">
      <AdminPageHeader
        title="상품 리뷰"
        description={`전체 ${reviews.length.toLocaleString('ko-KR')}건`}
      />
      <AdminNotice tone="warning" className="mb-16">
        숨김 처리된 리뷰는 Web 상세와 리뷰 목록에서 제외됩니다. 공개 답변과 내부 메모는 별도로
        저장됩니다.
      </AdminNotice>
      <div className="grid items-start gap-16 xl:grid-cols-[minmax(360px,1fr)_minmax(420px,1.2fr)]">
        <section aria-label="리뷰 목록" className="rounded-12 border border-line bg-bg">
          {reviews.length ? (
            <ul className="divide-y divide-line">
              {reviews.map((review) => (
                <li key={review.id}>
                  <button
                    type="button"
                    aria-pressed={active?.id === review.id}
                    onClick={() => {
                      setSelectedId(review.id);
                      setReply(null);
                      setMemo(null);
                      setVisible(null);
                      setMessage('');
                    }}
                    className="w-full p-16 text-left focus-ring hover:bg-surface"
                  >
                    <span className="flex items-center justify-between gap-8">
                      <span className="font-medium">
                        {productName(review.productId)} · {'★'.repeat(review.rating)}
                      </span>
                      <span className="text-caption text-text-3">
                        {review.isVisible ? '노출' : '숨김'}
                      </span>
                    </span>
                    <span className="mt-4 block truncate text-body-s text-text-2">
                      {review.content}
                    </span>
                    <span className="mt-4 block text-caption text-text-3">
                      {review.authorName} · {formatAdminDateTime(review.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <AdminEmpty title="등록된 리뷰가 없습니다" />
          )}
        </section>
        {active ? (
          <section aria-label="리뷰 상세" className="rounded-12 border border-line bg-bg p-24">
            <h2 className="text-h3">{productName(active.productId)}</h2>
            <p className="mt-8 text-caption text-text-3">
              {active.authorName} · {formatAdminDateTime(active.createdAt)} · 평점 {active.rating}점
            </p>
            {active.optionLabel ? (
              <p className="mt-8 text-caption text-text-3">옵션 {active.optionLabel}</p>
            ) : null}
            <p className="mt-20 text-body-s whitespace-pre-wrap">{active.content}</p>
            <label className="mt-20 flex items-center gap-8 text-body-s">
              <input
                type="checkbox"
                checked={activeVisibility}
                onChange={(event) => setVisible(event.target.checked)}
              />
              Web에 공개
            </label>
            <label className="mt-16 grid gap-8 text-label-m">
              고객 공개 답변
              <textarea
                value={activeReply}
                onChange={(event) => setReply(event.target.value)}
                maxLength={2000}
                className="min-h-96 rounded-8 border border-line-control p-12 text-body-s"
              />
            </label>
            <label className="mt-16 grid gap-8 text-label-m">
              내부 메모
              <textarea
                value={activeMemo}
                onChange={(event) => setMemo(event.target.value)}
                maxLength={2000}
                className="min-h-80 rounded-8 border border-line-control p-12 text-body-s"
              />
            </label>
            <div className="mt-16 flex items-center justify-between gap-8">
              <span role="status" className="text-caption text-info">
                {message}
              </span>
              <Button onClick={() => void save()}>변경 저장</Button>
            </div>
          </section>
        ) : (
          <AdminEmpty title="리뷰를 선택해 주세요" />
        )}
      </div>
    </section>
  );
}
