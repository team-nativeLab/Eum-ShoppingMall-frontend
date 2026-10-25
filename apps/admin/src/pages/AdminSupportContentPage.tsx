import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@eum/ui/components/Button';
import { Modal } from '@eum/ui/components/Modal';
import { AdminEmpty, AdminError, AdminLoading, AdminPageHeader } from '@/components/AdminUI';
import { getShopApi } from '@/lib/shop-api';
import type { AdminFaq, AdminNotice } from '@eum/api/types';
import type { AdminFaqInput, AdminNoticeInput } from '@eum/api/shop-api';

type ContentMode = 'notice' | 'faq';
interface ContentDraft {
  id?: string;
  title: string;
  body: string;
  category: string;
  isPinned: boolean;
  isVisible: boolean;
  sortOrder: string;
  publishedAt: string;
}
const EMPTY_DRAFT: ContentDraft = {
  title: '',
  body: '',
  category: '',
  isPinned: false,
  isVisible: true,
  sortOrder: '0',
  publishedAt: new Date().toISOString().slice(0, 10),
};

export function AdminNoticesPage() {
  return <AdminSupportContentPage mode="notice" />;
}
export function AdminFaqsPage() {
  return <AdminSupportContentPage mode="faq" />;
}

function AdminSupportContentPage({ mode }: { mode: ContentMode }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedFaqCategory, setSelectedFaqCategory] = useState<string | null>(null);
  const [draft, setDraft] = useState<ContentDraft>(EMPTY_DRAFT);
  const [isOpen, setIsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminNotice | AdminFaq | null>(null);
  const [message, setMessage] = useState('');
  const noticesQuery = useQuery({
    queryKey: ['admin', 'notices'],
    queryFn: async ({ signal }) => (await getShopApi()).notices.adminList({ signal }),
    enabled: mode === 'notice',
  });
  const faqsQuery = useQuery({
    queryKey: ['admin', 'faqs'],
    queryFn: async ({ signal }) => (await getShopApi()).faqs.adminList({ signal }),
    enabled: mode === 'faq',
  });
  const data = useMemo(
    () => (mode === 'notice' ? (noticesQuery.data ?? []) : (faqsQuery.data ?? [])),
    [faqsQuery.data, mode, noticesQuery.data],
  );
  const isPending = mode === 'notice' ? noticesQuery.isPending : faqsQuery.isPending;
  const isError = mode === 'notice' ? noticesQuery.isError : faqsQuery.isError;
  const refetch = () => {
    if (mode === 'notice') void noticesQuery.refetch();
    else void faqsQuery.refetch();
  };
  const filtered = useMemo(
    () =>
      data.filter((item) => {
        const text =
          mode === 'notice'
            ? `${(item as AdminNotice).title} ${(item as AdminNotice).body}`
            : `${(item as AdminFaq).category} ${(item as AdminFaq).question} ${(item as AdminFaq).answer}`;
        return (
          (selectedFaqCategory === null ||
            !('category' in item) ||
            item.category === selectedFaqCategory) &&
          text.toLocaleLowerCase('ko-KR').includes(search.trim().toLocaleLowerCase('ko-KR'))
        );
      }),
    [data, mode, search, selectedFaqCategory],
  );
  const faqCategories = useMemo(
    () =>
      [...new Set(data.flatMap((item) => ('category' in item ? [item.category] : [])))].toSorted(
        (left, right) => left.localeCompare(right, 'ko-KR'),
      ),
    [data],
  );
  if (isPending)
    return (
      <AdminLoading
        label={mode === 'notice' ? '공지를 불러오고 있습니다.' : 'FAQ를 불러오고 있습니다.'}
      />
    );
  if (isError) return <AdminError onRetry={refetch} />;
  const close = () => {
    setIsOpen(false);
    setDraft(EMPTY_DRAFT);
  };
  const openEdit = (item: AdminNotice | AdminFaq) => {
    setDraft(
      'body' in item
        ? {
            id: item.id,
            title: item.title,
            body: item.body,
            category: '',
            isPinned: item.isPinned,
            isVisible: item.isVisible,
            sortOrder: String(item.sortOrder),
            publishedAt: item.publishedAt.slice(0, 10),
          }
        : {
            id: item.id,
            title: item.question,
            body: item.answer,
            category: item.category,
            isPinned: false,
            isVisible: item.isVisible,
            sortOrder: String(item.sortOrder),
            publishedAt: '',
          },
    );
    setIsOpen(true);
  };
  const save = async () => {
    setMessage('');
    try {
      if (mode === 'notice') {
        const input: AdminNoticeInput = {
          id: draft.id,
          title: draft.title.trim(),
          body: draft.body.trim(),
          isPinned: draft.isPinned,
          isVisible: draft.isVisible,
          sortOrder: Number(draft.sortOrder),
          publishedAt: draft.publishedAt
            ? new Date(`${draft.publishedAt}T00:00:00`).toISOString()
            : new Date().toISOString(),
        };
        await (await getShopApi()).notices.saveAdmin(input);
        await queryClient.invalidateQueries({ queryKey: ['admin', 'notices'] });
        await queryClient.invalidateQueries({ queryKey: ['notices'] });
      } else {
        const input: AdminFaqInput = {
          id: draft.id,
          category: draft.category.trim(),
          question: draft.title.trim(),
          answer: draft.body.trim(),
          isVisible: draft.isVisible,
          sortOrder: Number(draft.sortOrder),
        };
        await (await getShopApi()).faqs.saveAdmin(input);
        await queryClient.invalidateQueries({ queryKey: ['admin', 'faqs'] });
        await queryClient.invalidateQueries({ queryKey: ['faqs'] });
      }
      setMessage(`${mode === 'notice' ? '공지' : 'FAQ'}를 목 API에 저장했습니다.`);
      close();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '콘텐츠를 저장하지 못했습니다.');
    }
  };
  const remove = async () => {
    if (!deleteTarget) return;
    try {
      if (mode === 'notice') await (await getShopApi()).notices.deleteAdmin(deleteTarget.id);
      else await (await getShopApi()).faqs.deleteAdmin(deleteTarget.id);
      await queryClient.invalidateQueries({
        queryKey: mode === 'notice' ? ['admin', 'notices'] : ['admin', 'faqs'],
      });
      await queryClient.invalidateQueries({ queryKey: mode === 'notice' ? ['notices'] : ['faqs'] });
      setMessage(`${mode === 'notice' ? '공지' : 'FAQ'}를 삭제했습니다.`);
      setDeleteTarget(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '콘텐츠를 삭제하지 못했습니다.');
    }
  };
  return (
    <section aria-label={mode === 'notice' ? '공지 관리' : 'FAQ 관리'}>
      <AdminPageHeader
        title={mode === 'notice' ? '공지 관리' : 'FAQ 관리'}
        description={`총 ${data.length.toLocaleString('ko-KR')}건`}
        descriptionPlacement="inline"
        action={
          <Button
            onClick={() => {
              setDraft(EMPTY_DRAFT);
              setIsOpen(true);
            }}
          >
            새로 등록
          </Button>
        }
      />
      {mode === 'faq' ? (
        <div className="grid grid-cols-[200px_minmax(0,1fr)] items-start gap-16">
          <aside className="rounded-12 border border-line bg-bg p-16" aria-label="FAQ 카테고리">
            <h2 className="mb-12 text-label-m">카테고리</h2>
            <ul className="grid gap-4">
              <li>
                <button
                  type="button"
                  aria-pressed={selectedFaqCategory === null}
                  onClick={() => setSelectedFaqCategory(null)}
                  className={`flex min-h-36 w-full items-center justify-between rounded-6 px-8 text-left text-body-s focus-ring ${selectedFaqCategory === null ? 'bg-surface text-text-1' : 'text-text-2 hover:bg-surface'}`}
                >
                  <span>전체</span>
                  <span className="text-caption text-text-3">{data.length}</span>
                </button>
              </li>
              {faqCategories.map((category) => (
                <li key={category}>
                  <button
                    type="button"
                    aria-label={
                      category.trim() === ''
                        ? category === ''
                          ? '빈 분류'
                          : '공백 분류'
                        : category
                    }
                    aria-pressed={selectedFaqCategory === category}
                    onClick={() => setSelectedFaqCategory(category)}
                    className={`flex min-h-36 w-full items-center justify-between rounded-6 px-8 text-left text-body-s focus-ring ${selectedFaqCategory === category ? 'bg-surface text-text-1' : 'text-text-2 hover:bg-surface'}`}
                  >
                    <span className="truncate">{category}</span>
                    <span className="text-caption text-text-3">
                      {
                        data.filter((item) => 'category' in item && item.category === category)
                          .length
                      }
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <div className="min-w-0">
            <div className="mb-16 flex items-center gap-12 rounded-12 border border-line bg-bg p-12">
              <label className="flex-1">
                <span className="sr-only">질문 검색</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="질문 검색"
                  className="h-40 w-full rounded-8 border border-line-control bg-bg px-12"
                />
              </label>
              <Button type="button" variant="ghost" size="s" onClick={() => setSearch('')}>
                초기화
              </Button>
              <span role="status" className="text-caption text-info">
                {message}
              </span>
            </div>
            {filtered.length === 0 ? (
              <AdminEmpty title="FAQ가 없습니다" className="rounded-12 border border-line bg-bg" />
            ) : (
              <div className="overflow-x-auto rounded-12 border border-line bg-bg">
                <table className="w-full min-w-640 border-collapse text-left text-body-s">
                  <thead className="bg-surface text-label-s text-text-2">
                    <tr>
                      <th scope="col" className="px-16 py-12">
                        순서
                      </th>
                      <th scope="col" className="px-12 py-12">
                        카테고리
                      </th>
                      <th scope="col" className="px-12 py-12">
                        질문
                      </th>
                      <th scope="col" className="px-12 py-12">
                        노출
                      </th>
                      <th scope="col" className="px-12 py-12">
                        작업
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr key={item.id} className="border-t border-line">
                        <td className="px-16 py-12">{item.sortOrder}</td>
                        <td className="px-12 py-12">{'category' in item ? item.category : ''}</td>
                        <td className="px-12 py-12">{'question' in item ? item.question : ''}</td>
                        <td className="px-12 py-12">{item.isVisible ? '노출' : '숨김'}</td>
                        <td className="px-12 py-12">
                          <div className="flex gap-8">
                            <Button size="s" variant="secondary" onClick={() => openEdit(item)}>
                              수정
                            </Button>
                            <Button size="s" variant="ghost" onClick={() => setDeleteTarget(item)}>
                              삭제
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-16 flex items-center gap-12">
            <label className="flex-1">
              <span className="sr-only">공지 검색</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="공지 제목·내용 검색"
                className="h-40 w-full rounded-8 border border-line-control bg-bg px-12"
              />
            </label>
            <span role="status" className="text-caption text-info">
              {message}
            </span>
          </div>
          {filtered.length === 0 ? (
            <AdminEmpty title="공지가 없습니다" />
          ) : (
            <div className="overflow-x-auto rounded-12 border border-line bg-bg">
              <table className="w-full min-w-720 border-collapse text-left text-body-s">
                <thead className="bg-surface text-label-s text-text-2">
                  <tr>
                    <th scope="col" className="px-16 py-12">
                      번호
                    </th>
                    <th scope="col" className="px-12 py-12">
                      고정
                    </th>
                    <th scope="col" className="px-12 py-12">
                      제목
                    </th>
                    <th scope="col" className="px-12 py-12">
                      상태
                    </th>
                    <th scope="col" className="px-12 py-12">
                      조회
                    </th>
                    <th scope="col" className="px-12 py-12">
                      등록일
                    </th>
                    <th scope="col" className="px-12 py-12">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    if (!('body' in item)) return null;
                    return (
                      <tr key={item.id} className="border-t border-line">
                        <td className="px-16 py-12">{item.sortOrder}</td>
                        <td className="px-12 py-12">{item.isPinned ? '고정' : '—'}</td>
                        <td className="px-12 py-12">{item.title}</td>
                        <td className="px-12 py-12">{item.isVisible ? '게시' : '숨김'}</td>
                        <td className="px-12 py-12">
                          {item.viewCount?.toLocaleString('ko-KR') ?? '미제공'}
                        </td>
                        <td className="px-12 py-12 whitespace-nowrap">
                          {item.publishedAt.slice(0, 10)}
                        </td>
                        <td className="px-12 py-12">
                          <div className="flex gap-8">
                            <Button size="s" variant="secondary" onClick={() => openEdit(item)}>
                              수정
                            </Button>
                            <Button size="s" variant="ghost" onClick={() => setDeleteTarget(item)}>
                              삭제
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <Modal
        isOpen={isOpen}
        onClose={close}
        title={`${mode === 'notice' ? '공지' : 'FAQ'} ${draft.id ? '수정' : '등록'}`}
        actions={
          <>
            <Button variant="secondary" onClick={close}>
              취소
            </Button>
            <Button onClick={() => void save()}>저장</Button>
          </>
        }
      >
        <div className="mt-16 grid gap-12">
          {mode === 'faq' ? (
            <label className="grid gap-4">
              분류
              <input
                value={draft.category}
                onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                className="h-40 rounded-8 border border-line-control px-12"
              />
            </label>
          ) : null}
          <label className="grid gap-4">
            {mode === 'notice' ? '제목' : '질문'}
            <input
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              maxLength={120}
              className="h-40 rounded-8 border border-line-control px-12"
            />
          </label>
          <label className="grid gap-4">
            {mode === 'notice' ? '본문' : '답변'}
            <textarea
              value={draft.body}
              onChange={(event) => setDraft({ ...draft, body: event.target.value })}
              maxLength={10000}
              className="min-h-160 rounded-8 border border-line-control p-12"
            />
          </label>
          {mode === 'notice' ? (
            <>
              <label className="grid gap-4">
                게시일
                <input
                  type="date"
                  value={draft.publishedAt}
                  onChange={(event) => setDraft({ ...draft, publishedAt: event.target.value })}
                  className="h-40 rounded-8 border border-line-control px-12"
                />
              </label>
              <label className="flex gap-8">
                <input
                  type="checkbox"
                  checked={draft.isPinned}
                  onChange={(event) => setDraft({ ...draft, isPinned: event.target.checked })}
                />
                상단 고정
              </label>
            </>
          ) : null}
          <label className="grid gap-4">
            정렬 순서
            <input
              type="number"
              min="0"
              value={draft.sortOrder}
              onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })}
              className="h-40 rounded-8 border border-line-control px-12"
            />
          </label>
          <label className="flex gap-8">
            <input
              type="checkbox"
              checked={draft.isVisible}
              onChange={(event) => setDraft({ ...draft, isVisible: event.target.checked })}
            />
            웹에 노출
          </label>
        </div>
      </Modal>
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="콘텐츠를 삭제할까요?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              취소
            </Button>
            <Button onClick={() => void remove()}>삭제</Button>
          </>
        }
      >
        <p className="mt-12">삭제한 콘텐츠는 목 API의 웹 목록에서도 사라집니다.</p>
      </Modal>
    </section>
  );
}
