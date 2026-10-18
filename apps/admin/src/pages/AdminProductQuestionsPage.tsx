import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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

/** 상품 문의 처리 화면. 공개 답변과 내부 메모를 분리해 저장합니다. */
export function AdminProductQuestionsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [memo, setMemo] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const questionsQuery = useQuery({
    queryKey: ['admin', 'product-questions'],
    queryFn: async ({ signal }) => (await getShopApi()).products.adminListQuestions({ signal }),
  });
  const productsQuery = useQuery({
    queryKey: ['admin', 'products', 'question-labels'],
    queryFn: async ({ signal }) => (await getShopApi()).products.adminList({ signal }),
  });
  if (questionsQuery.isPending || productsQuery.isPending)
    return <AdminLoading label="상품 문의를 불러오고 있습니다." />;
  if (questionsQuery.isError || productsQuery.isError)
    return (
      <AdminError
        title="상품 문의를 불러오지 못했습니다"
        onRetry={() => {
          void questionsQuery.refetch();
          void productsQuery.refetch();
        }}
      />
    );

  const questions = questionsQuery.data;
  const active = questions.find((question) => question.id === selectedId) ?? questions[0];
  const activeAnswer = answer ?? active?.answer ?? '';
  const activeMemo = memo ?? active?.adminMemo ?? '';
  const productName = (productId: string) =>
    productsQuery.data.find((product) => product.id === productId)?.name ?? productId;
  const save = async () => {
    if (!active) return;
    setMessage('');
    try {
      await (
        await getShopApi()
      ).products.updateQuestionAdmin(active.id, {
        status: activeAnswer.trim() ? 'answered' : 'waiting',
        answer: activeAnswer.trim() || null,
        adminMemo: activeMemo,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'product-questions'] }),
        queryClient.invalidateQueries({ queryKey: ['product-questions', active.productId] }),
      ]);
      setAnswer(null);
      setMemo(null);
      setMessage(
        '상품 문의 답변을 목 API에 저장했습니다. 공개 답변은 같은 목 API 인스턴스의 Web 상품 상세에 반영됩니다.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '상품 문의 답변을 저장하지 못했습니다.');
    }
  };

  return (
    <section aria-label="상품 문의 관리">
      <AdminPageHeader
        title="상품 문의"
        description={`전체 ${questions.length.toLocaleString('ko-KR')}건`}
      />
      <AdminNotice tone="warning" className="mb-16">
        구매자 Web에는 아직 상품 문의 작성 화면이 연결되지 않았습니다. 이 화면은 기존 문의에
        답변하는 운영 도구입니다.
      </AdminNotice>
      <div className="grid items-start gap-16 xl:grid-cols-[minmax(360px,1fr)_minmax(420px,1.2fr)]">
        <section aria-label="상품 문의 목록" className="rounded-12 border border-line bg-bg">
          {questions.length ? (
            <ul className="divide-y divide-line">
              {questions.map((question) => (
                <li key={question.id}>
                  <button
                    type="button"
                    aria-pressed={active?.id === question.id}
                    onClick={() => {
                      setSelectedId(question.id);
                      setAnswer(null);
                      setMemo(null);
                      setMessage('');
                    }}
                    className="w-full p-16 text-left focus-ring hover:bg-surface"
                  >
                    <span className="flex items-center justify-between gap-8">
                      <span className="font-medium">
                        {productName(question.productId)} · {question.title}
                      </span>
                      <span className="text-caption text-text-3">
                        {question.status === 'answered' ? '답변 완료' : '대기'}
                      </span>
                    </span>
                    <span className="mt-4 block truncate text-body-s text-text-2">
                      {question.body}
                    </span>
                    <span className="mt-4 block text-caption text-text-3">
                      {question.authorName} · {question.isPrivate ? '비밀 문의' : '공개 문의'} ·{' '}
                      {formatAdminDateTime(question.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <AdminEmpty title="등록된 상품 문의가 없습니다" />
          )}
        </section>
        {active ? (
          <section aria-label="상품 문의 상세" className="rounded-12 border border-line bg-bg p-24">
            <h2 className="text-h3">{productName(active.productId)}</h2>
            <p className="mt-8 text-caption text-text-3">
              {active.authorName} · {formatAdminDateTime(active.createdAt)} ·{' '}
              {active.isPrivate ? '비밀 문의' : '공개 문의'}
            </p>
            <h3 className="mt-20 text-title">{active.title}</h3>
            <p className="mt-8 text-body-s whitespace-pre-wrap">{active.body}</p>
            <ol aria-label="처리 이력" className="mt-16 grid gap-6 text-caption text-text-3">
              {active.statusHistory.map((item, index) => (
                <li key={`${item.occurredAt}-${index}`}>
                  {formatAdminDateTime(item.occurredAt)} · {item.note}
                </li>
              ))}
            </ol>
            <label className="mt-20 grid gap-8 text-label-m">
              고객 공개 답변
              <textarea
                value={activeAnswer}
                onChange={(event) => setAnswer(event.target.value)}
                maxLength={5000}
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
              <Button onClick={() => void save()}>답변 저장</Button>
            </div>
          </section>
        ) : (
          <AdminEmpty title="문의 내용을 선택해 주세요" />
        )}
      </div>
    </section>
  );
}
