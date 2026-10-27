import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@eum/ui/components/Button';
import { Checkbox } from '@eum/ui/components/Checkbox';
import { Modal } from '@eum/ui/components/Modal';
import { AdminTabs } from '@/components/AdminUI';
import { AdminEmpty, AdminError, AdminLoading, AdminPageHeader } from '@/components/AdminUI';
import { getBrowserLocalDateKey } from '@/lib/admin-preview-validation';
import { getAdminApiConfig } from '@/lib/api-config';
import { getShopApi } from '@/lib/shop-api';
import type { AdminFaq, AdminNotice } from '@eum/api/types';
import type { AdminFaqInput, AdminNoticeInput } from '@eum/api/shop-api';

function isAdminNotice(item: AdminNotice | AdminFaq): item is AdminNotice {
  return 'body' in item;
}

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
function createEmptyDraft(): ContentDraft {
  return {
    title: '',
    body: '',
    category: '',
    isPinned: false,
    isVisible: true,
    sortOrder: '0',
    publishedAt: getBrowserLocalDateKey(),
  };
}

function getNoticeDateKey(publishedAt: string): string | null {
  const publishedDate = new Date(publishedAt);
  return Number.isNaN(publishedDate.getTime()) ? null : getBrowserLocalDateKey(publishedDate);
}

function getNoticePublishedAtTimestamp(publishedAt: string): number | null {
  const publishedDate = new Date(publishedAt);
  return Number.isNaN(publishedDate.getTime()) ? null : publishedDate.getTime();
}

function isNoticeScheduledInFuture(publishedAt: string, now: Date): boolean {
  const publishedTimestamp = getNoticePublishedAtTimestamp(publishedAt);
  const publishedDateKey = getNoticeDateKey(publishedAt);

  return (
    (publishedTimestamp !== null &&
      publishedDateKey !== null &&
      publishedDateKey > getBrowserLocalDateKey(now)) ||
    (publishedTimestamp !== null && publishedTimestamp > now.getTime())
  );
}

export function AdminNoticesPage() {
  return <AdminSupportContentPage mode="notice" />;
}
export function AdminFaqsPage() {
  return <AdminSupportContentPage mode="faq" />;
}

function AdminSupportContentPage({ mode }: { mode: ContentMode }) {
  const persistenceTargetLabel = getAdminApiConfig().mode === 'mock' ? '목 API' : '서버 API';
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedFaqCategory, setSelectedFaqCategory] = useState<string | null>(null);
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const [noticeStatus, setNoticeStatus] = useState<'all' | 'published' | 'scheduled' | 'hidden'>(
    'all',
  );
  const [pinnedFilter, setPinnedFilter] = useState<'all' | 'pinned' | 'normal'>('all');
  const [draft, setDraft] = useState<ContentDraft>(() => createEmptyDraft());
  const [isOpen, setIsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminNotice | AdminFaq | null>(null);
  const [selectedNoticeIds, setSelectedNoticeIds] = useState<Set<string>>(() => new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<AdminNotice[] | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkDeleteRefreshPending, setIsBulkDeleteRefreshPending] = useState(false);
  const bulkDeleteInFlightRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
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
    if (mode === 'notice') {
      void noticesQuery.refetch().then((result) => {
        if (!result.isError) setIsBulkDeleteRefreshPending(false);
      });
    } else void faqsQuery.refetch();
  };
  const todayDateKey = getBrowserLocalDateKey(new Date(currentTime));
  const filtered = useMemo(
    () =>
      data.filter((item) => {
        const text = isAdminNotice(item)
          ? `${item.title} ${item.body}`
          : `${item.category} ${item.question} ${item.answer}`;
        const matchesSearch = text
          .toLocaleLowerCase('ko-KR')
          .includes(search.trim().toLocaleLowerCase('ko-KR'));
        if (!matchesSearch) return false;
        if (visibilityFilter !== 'all' && item.isVisible !== (visibilityFilter === 'visible')) {
          return false;
        }
        if (!isAdminNotice(item)) {
          return selectedFaqCategory === null || item.category === selectedFaqCategory;
        }
        if (pinnedFilter !== 'all' && item.isPinned !== (pinnedFilter === 'pinned')) return false;
        if (noticeStatus === 'hidden') return !item.isVisible;
        const noticeDateKey = getNoticeDateKey(item.publishedAt);
        if (noticeStatus === 'published') {
          return item.isVisible && noticeDateKey !== null && noticeDateKey <= todayDateKey;
        }
        if (noticeStatus === 'scheduled') {
          return item.isVisible && noticeDateKey !== null && noticeDateKey > todayDateKey;
        }
        return true;
      }),
    [data, noticeStatus, pinnedFilter, search, selectedFaqCategory, todayDateKey, visibilityFilter],
  );
  const faqCategories = useMemo(
    () =>
      [...new Set(data.flatMap((item) => ('category' in item ? [item.category] : [])))].toSorted(
        (left, right) => left.localeCompare(right, 'ko-KR'),
      ),
    [data],
  );
  const visibleNotices = useMemo(
    () => (mode === 'notice' ? filtered.filter(isAdminNotice) : []),
    [filtered, mode],
  );
  const selectedVisibleNoticeIds = visibleNotices
    .filter((notice) => selectedNoticeIds.has(notice.id))
    .map((notice) => notice.id);
  const selectedVisibleNotices = visibleNotices.filter((notice) =>
    selectedNoticeIds.has(notice.id),
  );
  const nextFuturePublicationTimestamp = selectedVisibleNotices.reduce<number | null>(
    (nearestTimestamp, notice) => {
      const publicationTimestamp = getNoticePublishedAtTimestamp(notice.publishedAt);
      if (publicationTimestamp === null || publicationTimestamp <= currentTime) {
        return nearestTimestamp;
      }
      return nearestTimestamp === null
        ? publicationTimestamp
        : Math.min(nearestTimestamp, publicationTimestamp);
    },
    null,
  );
  const hasFutureScheduledNotice = selectedVisibleNotices.some((notice) =>
    isNoticeScheduledInFuture(notice.publishedAt, new Date(currentTime)),
  );
  const areAllVisibleNoticesSelected =
    visibleNotices.length > 0 && selectedVisibleNoticeIds.length === visibleNotices.length;
  const areSomeVisibleNoticesSelected =
    selectedVisibleNoticeIds.length > 0 && !areAllVisibleNoticesSelected;
  useEffect(() => {
    if (nextFuturePublicationTimestamp === null) return;
    const timeoutDelay = Math.min(nextFuturePublicationTimestamp - currentTime, 2_147_483_647);
    const timeoutId = window.setTimeout(() => setCurrentTime(Date.now()), timeoutDelay);
    return () => window.clearTimeout(timeoutId);
  }, [currentTime, nextFuturePublicationTimestamp]);
  if (isPending)
    return (
      <AdminLoading
        label={mode === 'notice' ? '공지를 불러오고 있습니다.' : 'FAQ를 불러오고 있습니다.'}
      />
    );
  if (isError)
    return (
      <>
        <AdminError onRetry={refetch} />
        {message ? (
          <p role="status" className="mt-12 text-caption text-info">
            {message}
          </p>
        ) : null}
      </>
    );
  const close = () => {
    setIsOpen(false);
    setDraft(createEmptyDraft());
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
      setMessage(
        `${persistenceTargetLabel}에 ${mode === 'notice' ? '공지' : 'FAQ'}를 저장했습니다.`,
      );
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
  const confirmBulkDelete = async () => {
    const targets = bulkDeleteTargets;
    if (!targets?.length || bulkDeleteInFlightRef.current) return;

    bulkDeleteInFlightRef.current = true;
    setIsBulkDeleting(true);
    setMessage(`선택한 공지 ${targets.length}건 삭제 요청을 처리하고 있습니다.`);

    let succeededCount = 0;
    let failedCount = 0;
    let couldNotStart = false;
    const succeededNoticeIds = new Set<string>();
    try {
      const api = await getShopApi();
      for (const notice of targets) {
        try {
          await api.notices.deleteAdmin(notice.id);
          succeededCount += 1;
          succeededNoticeIds.add(notice.id);
        } catch {
          failedCount += 1;
        }
      }
    } catch {
      couldNotStart = true;
    }

    let refreshFailed: boolean;
    let remainingSelectedCount: number | null = null;
    try {
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'notices'],
        refetchType: 'none',
      });
      const refreshedNotices = await noticesQuery.refetch();
      refreshFailed = refreshedNotices.isError;
      if (!refreshFailed) {
        const refreshedNoticeIds = new Set(
          (refreshedNotices.data ?? []).map((notice) => notice.id),
        );
        remainingSelectedCount = targets.filter((notice) =>
          refreshedNoticeIds.has(notice.id),
        ).length;
        setSelectedNoticeIds((currentSelection) => {
          return new Set(
            [...currentSelection].filter((noticeId) => refreshedNoticeIds.has(noticeId)),
          );
        });
        setIsBulkDeleteRefreshPending(false);
      }
    } catch {
      refreshFailed = true;
    }

    if (refreshFailed && succeededNoticeIds.size > 0) {
      setSelectedNoticeIds((currentSelection) => {
        return new Set(
          [...currentSelection].filter((noticeId) => !succeededNoticeIds.has(noticeId)),
        );
      });
      setIsBulkDeleteRefreshPending(true);
    }

    try {
      await queryClient.invalidateQueries({ queryKey: ['notices'] });
    } catch {
      // Query invalidation is best effort; the admin list result remains the primary outcome.
    }

    const resultMessage = couldNotStart
      ? `선택한 공지 ${targets.length}건 삭제 요청을 시작하지 못했습니다.`
      : `삭제 요청 성공 응답 ${succeededCount}건, 실패 응답 ${failedCount}건.`;
    const refreshMessage = refreshFailed
      ? ' 관리자 공지 목록을 새로 불러오지 못했습니다.'
      : ` 관리자 공지 목록을 다시 불러왔습니다. 남아 있는 선택 공지 ${remainingSelectedCount ?? 0}건입니다.`;
    setMessage(`${resultMessage}${refreshMessage}`);
    setBulkDeleteTargets(null);
    setIsBulkDeleting(false);
    bulkDeleteInFlightRef.current = false;
  };
  const toggleNoticeSelection = (noticeId: string, isSelected: boolean) => {
    setSelectedNoticeIds((currentSelection) => {
      const nextSelection = new Set(currentSelection);
      if (isSelected) nextSelection.add(noticeId);
      else nextSelection.delete(noticeId);
      return nextSelection;
    });
  };
  const toggleAllVisibleNotices = (isSelected: boolean) => {
    setSelectedNoticeIds((currentSelection) => {
      const nextSelection = new Set(currentSelection);
      for (const notice of visibleNotices) {
        if (isSelected) nextSelection.add(notice.id);
        else nextSelection.delete(notice.id);
      }
      return nextSelection;
    });
  };
  const updateSelectedNoticeVisibility = async (isVisible: boolean) => {
    const selectedNotices = visibleNotices.filter((notice) => selectedNoticeIds.has(notice.id));
    if (selectedNotices.length === 0 || isBulkUpdating || isBulkDeleting) return;
    if (
      isVisible &&
      selectedNotices.some((notice) => isNoticeScheduledInFuture(notice.publishedAt, new Date()))
    ) {
      setMessage('예약 공지는 게시 시각 전까지 공개할 수 없습니다.');
      return;
    }

    setIsBulkUpdating(true);
    setMessage(
      `선택한 공지 ${selectedNotices.length}건을 ${isVisible ? '게시' : '숨김'} 처리하고 있습니다.`,
    );
    const failedNoticeIds = new Set<string>();
    let succeededCount = 0;

    try {
      const api = await getShopApi();
      for (const notice of selectedNotices) {
        try {
          const input: AdminNoticeInput = { ...notice, isVisible };
          await api.notices.saveAdmin(input);
          succeededCount += 1;
        } catch {
          failedNoticeIds.add(notice.id);
        }
      }

      let refreshFailed = false;
      if (succeededCount > 0 || failedNoticeIds.size > 0) {
        try {
          await queryClient.invalidateQueries({
            queryKey: ['admin', 'notices'],
            refetchType: 'none',
          });
          const refreshedNotices = await noticesQuery.refetch();
          refreshFailed = refreshedNotices.isError;
          await queryClient.invalidateQueries({ queryKey: ['notices'] });
        } catch {
          refreshFailed = true;
        }
      }

      const failedCount = selectedNotices.length - succeededCount;
      const actionLabel = isVisible ? '게시' : '숨김';
      const outcomeMessage =
        failedCount === 0
          ? `선택한 공지 ${succeededCount}건을 ${actionLabel}했습니다.`
          : succeededCount === 0
            ? `선택한 공지 ${selectedNotices.length}건을 ${actionLabel}하지 못했습니다.`
            : `선택한 공지 ${succeededCount}건을 ${actionLabel}했고 ${failedCount}건은 실패했습니다.`;
      setMessage(
        `${outcomeMessage}${refreshFailed ? ' 목록을 새로 불러오지 못했습니다.' : ` ${persistenceTargetLabel} 목록을 다시 확인했습니다.`}`,
      );
    } catch {
      setMessage(
        `선택한 공지 ${selectedNotices.length}건을 ${isVisible ? '게시' : '숨김'}하지 못했습니다.`,
      );
    } finally {
      setSelectedNoticeIds(new Set());
      setIsBulkUpdating(false);
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
              setDraft(createEmptyDraft());
              setIsOpen(true);
            }}
          >
            새로 등록
          </Button>
        }
      />
      {mode === 'notice' ? (
        <AdminTabs
          label="공지 게시 상태"
          value={noticeStatus}
          onChange={setNoticeStatus}
          options={[
            { value: 'all', label: '전체', count: data.length },
            {
              value: 'published',
              label: '게시 중',
              count: data.filter((notice) => {
                if (!isAdminNotice(notice)) return false;
                const noticeDateKey = getNoticeDateKey(notice.publishedAt);
                return notice.isVisible && noticeDateKey !== null && noticeDateKey <= todayDateKey;
              }).length,
            },
            {
              value: 'scheduled',
              label: '예약',
              count: data.filter((notice) => {
                if (!isAdminNotice(notice)) return false;
                const noticeDateKey = getNoticeDateKey(notice.publishedAt);
                return notice.isVisible && noticeDateKey !== null && noticeDateKey > todayDateKey;
              }).length,
            },
            {
              value: 'hidden',
              label: '숨김',
              count: data.filter((notice) => isAdminNotice(notice) && !notice.isVisible).length,
            },
          ]}
        />
      ) : null}
      {mode === 'notice' && selectedVisibleNoticeIds.length > 0 ? (
        <div className="flex min-h-48 items-center justify-between gap-12 rounded-t-12 bg-text-1 px-16 text-inverse">
          <div className="flex items-center gap-12 text-body-s">
            <span aria-live="polite">{selectedVisibleNoticeIds.length}개 선택</span>
            <button
              type="button"
              onClick={() => setSelectedNoticeIds(new Set())}
              disabled={isBulkUpdating || isBulkDeleting}
              className="rounded-4 text-caption text-inverse focus-ring hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              선택 해제
            </button>
          </div>
          <div className="flex items-center gap-8">
            {hasFutureScheduledNotice ? (
              <span
                id="future-scheduled-notice-message"
                role="status"
                className="text-caption text-inverse"
              >
                예약 공지는 게시 시각 전까지 공개할 수 없습니다.
              </span>
            ) : null}
            <Button
              size="s"
              variant="secondary"
              aria-describedby={
                hasFutureScheduledNotice ? 'future-scheduled-notice-message' : undefined
              }
              disabled={isBulkUpdating || isBulkDeleting || hasFutureScheduledNotice}
              onClick={() => void updateSelectedNoticeVisibility(true)}
            >
              게시
            </Button>
            <Button
              size="s"
              variant="secondary"
              disabled={isBulkUpdating || isBulkDeleting}
              onClick={() => void updateSelectedNoticeVisibility(false)}
            >
              숨김
            </Button>
            <Button
              size="s"
              variant="secondary"
              aria-label="선택한 공지 삭제"
              disabled={isBulkUpdating || isBulkDeleting || isBulkDeleteRefreshPending}
              onClick={() => {
                setMessage('');
                setBulkDeleteTargets([...selectedVisibleNotices]);
              }}
            >
              삭제
            </Button>
          </div>
        </div>
      ) : null}
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
                        : `${category}${data.filter((item) => 'category' in item && item.category === category).length}`
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
                            <Button
                              size="s"
                              variant="secondary"
                              disabled={isBulkUpdating || isBulkDeleting}
                              onClick={() => openEdit(item)}
                            >
                              수정
                            </Button>
                            <Button
                              size="s"
                              variant="ghost"
                              disabled={isBulkUpdating || isBulkDeleting}
                              onClick={() => setDeleteTarget(item)}
                            >
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
            <label className="grid gap-4 text-caption text-text-2">
              고정 여부
              <select
                value={pinnedFilter}
                onChange={(event) => setPinnedFilter(event.target.value as typeof pinnedFilter)}
                className="h-40 rounded-8 border border-line-control bg-bg px-8 text-body-s"
              >
                <option value="all">전체</option>
                <option value="pinned">상단 고정</option>
                <option value="normal">일반</option>
              </select>
            </label>
            <label className="grid gap-4 text-caption text-text-2">
              노출 상태
              <select
                value={visibilityFilter}
                onChange={(event) =>
                  setVisibilityFilter(event.target.value as typeof visibilityFilter)
                }
                className="h-40 rounded-8 border border-line-control bg-bg px-8 text-body-s"
              >
                <option value="all">전체</option>
                <option value="visible">노출</option>
                <option value="hidden">숨김</option>
              </select>
            </label>
            <span role="status" className="text-caption text-info">
              {message}
            </span>
          </div>
          {filtered.length === 0 ? (
            <AdminEmpty title="조건에 맞는 공지가 없습니다" />
          ) : (
            <div className="overflow-x-auto rounded-12 border border-line bg-bg">
              <table className="w-full min-w-720 border-collapse text-left text-body-s">
                <thead className="bg-surface text-label-s text-text-2">
                  <tr>
                    <th scope="col" className="w-48 px-12 py-12">
                      <Checkbox
                        aria-label="현재 목록 공지 전체 선택"
                        checked={areAllVisibleNoticesSelected}
                        isIndeterminate={areSomeVisibleNoticesSelected}
                        disabled={isBulkUpdating || isBulkDeleting || visibleNotices.length === 0}
                        onChange={(event) => toggleAllVisibleNotices(event.target.checked)}
                      />
                    </th>
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
                        <td className="w-48 px-12 py-12">
                          <Checkbox
                            aria-label={`${item.title} 선택`}
                            checked={selectedNoticeIds.has(item.id)}
                            disabled={isBulkUpdating || isBulkDeleting}
                            onChange={(event) =>
                              toggleNoticeSelection(item.id, event.target.checked)
                            }
                          />
                        </td>
                        <td className="px-16 py-12">{item.sortOrder}</td>
                        <td className="px-12 py-12">{item.isPinned ? '고정' : '—'}</td>
                        <td className="px-12 py-12">{item.title}</td>
                        <td className="px-12 py-12">{item.isVisible ? '노출' : '숨김'}</td>
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
      <Modal
        isOpen={bulkDeleteTargets !== null}
        onClose={() => {
          if (!isBulkDeleting) setBulkDeleteTargets(null);
        }}
        title="공지를 삭제하시겠습니까?"
        description={
          bulkDeleteTargets
            ? `선택한 공지 ${bulkDeleteTargets.length}건을 삭제하면 사용자 화면에서 바로 사라지고 되돌릴 수 없습니다.`
            : undefined
        }
        tone="danger"
        actions={
          <>
            <Button
              variant="secondary"
              disabled={isBulkDeleting}
              onClick={() => setBulkDeleteTargets(null)}
            >
              취소
            </Button>
            <Button
              variant="danger"
              disabled={isBulkDeleting}
              onClick={() => void confirmBulkDelete()}
            >
              {isBulkDeleting ? '삭제 중' : '삭제'}
            </Button>
          </>
        }
      >
        {isBulkDeleting ? (
          <p role="status" aria-live="polite" className="mt-12 text-body-m text-text-2">
            선택한 공지의 삭제 요청을 순서대로 처리하고 있습니다.
          </p>
        ) : null}
      </Modal>
    </section>
  );
}
