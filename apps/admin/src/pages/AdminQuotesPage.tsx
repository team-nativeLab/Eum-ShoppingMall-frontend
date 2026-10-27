import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { AdminQuote, QuoteStatus } from '@eum/api/types';
import { QUOTE_STATUS_META } from '@eum/api/quote-status';
import { Badge } from '@eum/ui/components/Badge';
import { Button } from '@eum/ui/components/Button';
import { Modal } from '@eum/ui/components/Modal';
import { Pagination } from '@eum/ui/components/Pagination';
import {
  AdminEmpty,
  AdminDateInput,
  AdminError,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  AdminTabs,
  formatAdminDate,
  formatAdminDateTime,
  isInvalidAdminDateInput,
  parseAdminDateInput,
} from '@/components/AdminUI';
import { getShopApi } from '@/lib/shop-api';
import type { AdminQuoteUpdate } from '@eum/api/shop-api';
import {
  getBrowserLocalDateKey,
  validateAdminQuoteDraft,
  type AdminQuoteDraft,
} from '@/lib/admin-preview-validation';

type QuoteStatusFilter = 'all' | QuoteStatus;

const QUOTE_TABS = [
  { value: 'all', label: '전체' },
  { value: 'received', label: '접수' },
  { value: 'consulting', label: '상담중' },
  { value: 'quoteSent', label: '견적 발송' },
  { value: 'completed', label: '완료' },
  { value: 'canceled', label: '취소' },
] as const satisfies readonly { value: QuoteStatusFilter; label: string }[];

const PAGE_SIZE = 8;
const EMPTY_QUOTES: AdminQuote[] = [];

/** 견적 문의의 읽기 목록을 API에서 가져옵니다. */
async function loadQuotes(signal: AbortSignal): Promise<AdminQuote[]> {
  const api = await getShopApi();
  return api.quotes.adminList({ signal });
}

/** 상태 코드에 프로젝트 공통 견적 색상 규칙을 적용합니다. */
function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const statusMeta = QUOTE_STATUS_META[status] ?? {
    label: String(status) || '알 수 없는 상태',
    tone: 'neutral' as const,
  };
  return <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>;
}

function formatQuoteElapsedDays(requestedAt: string, now: number): string {
  const requestedTime = Date.parse(requestedAt);
  if (!Number.isFinite(requestedTime)) return '경과 정보 없음';
  const requestDate = new Date(requestedTime);
  const currentDate = new Date(now);
  const requestDay = Date.UTC(
    requestDate.getFullYear(),
    requestDate.getMonth(),
    requestDate.getDate(),
  );
  const currentDay = Date.UTC(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
  );
  const elapsedDays = Math.max(0, Math.floor((currentDay - requestDay) / 86_400_000));
  return `${elapsedDays}일 경과`;
}

/** 견적 문의를 상태·검색어·접수일로 탐색하고 읽기 전용 상세를 표시합니다. */
export function AdminQuotesPage() {
  const [elapsedDayClock, setElapsedDayClock] = useState(() => Date.now());
  const [statusFilter, setStatusFilter] = useState<QuoteStatusFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({ keyword: '', startDate: '', endDate: '' });
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  useEffect(() => {
    const currentTime = Date.now();
    const nextMidnight = new Date(currentTime);
    nextMidnight.setHours(24, 0, 0, 0);
    const timeoutId = window.setTimeout(
      () => setElapsedDayClock(Date.now()),
      nextMidnight.getTime() - currentTime + 50,
    );

    return () => window.clearTimeout(timeoutId);
  }, [elapsedDayClock]);
  const hasInvalidDateFilter =
    isInvalidAdminDateInput(startDateInput) || isInvalidAdminDateInput(endDateInput);
  const quotesQuery = useQuery({
    queryKey: ['admin', 'quotes', 'list'],
    queryFn: ({ signal }) => loadQuotes(signal),
  });

  const allQuotes = quotesQuery.data ?? EMPTY_QUOTES;
  const visibleQuotes = useMemo(() => {
    const normalizedKeyword = appliedFilters.keyword.toLocaleLowerCase('ko-KR');
    const startDate = appliedFilters.startDate
      ? new Date(`${appliedFilters.startDate}T00:00:00`).getTime()
      : Number.NEGATIVE_INFINITY;
    const endDate = appliedFilters.endDate
      ? new Date(`${appliedFilters.endDate}T23:59:59.999`).getTime()
      : Number.POSITIVE_INFINITY;

    return allQuotes
      .filter((quote) => statusFilter === 'all' || quote.status === statusFilter)
      .filter((quote) => {
        if (!normalizedKeyword) return true;
        const searchableValues = [quote.id, quote.title, quote.companyName, quote.contactName];
        return searchableValues.some((searchValue) =>
          searchValue.toLocaleLowerCase('ko-KR').includes(normalizedKeyword),
        );
      })
      .filter((quote) => {
        if (!appliedFilters.startDate && !appliedFilters.endDate) return true;
        const requestedAt = new Date(quote.requestedAt).getTime();
        return !Number.isNaN(requestedAt) && requestedAt >= startDate && requestedAt <= endDate;
      })
      .toSorted((left, right) => right.requestedAt.localeCompare(left.requestedAt));
  }, [allQuotes, appliedFilters, statusFilter]);

  if (quotesQuery.isPending) {
    return <AdminLoading label="견적 문의 목록을 불러오고 있습니다." />;
  }

  if (quotesQuery.isError) {
    return <AdminError onRetry={() => void quotesQuery.refetch()} />;
  }

  const totalPages = Math.max(1, Math.ceil(visibleQuotes.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageQuotes = visibleQuotes.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const activeQuote = pageQuotes.find((quote) => quote.id === selectedQuoteId) ?? pageQuotes[0];
  const tabOptions = QUOTE_TABS.map((option) => ({
    ...option,
    count:
      option.value === 'all'
        ? allQuotes.length
        : allQuotes.filter((quote) => quote.status === option.value).length,
  }));

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (hasInvalidDateFilter) return;
    setAppliedFilters({
      keyword: searchText.trim(),
      startDate: parseAdminDateInput(startDateInput),
      endDate: parseAdminDateInput(endDateInput),
    });
    setPage(1);
    setSelectedQuoteId(null);
  };

  const handleReset = () => {
    setSearchText('');
    setStartDateInput('');
    setEndDateInput('');
    setAppliedFilters({ keyword: '', startDate: '', endDate: '' });
    setStatusFilter('all');
    setPage(1);
    setSelectedQuoteId(null);
  };

  const handleStatusFilter = (nextStatus: QuoteStatusFilter) => {
    setStatusFilter(nextStatus);
    setPage(1);
    setSelectedQuoteId(null);
  };

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    setSelectedQuoteId(null);
  };

  return (
    <section aria-label="견적 문의 관리">
      <AdminPageHeader
        title="견적 문의"
        description={`총 ${allQuotes.length.toLocaleString('ko-KR')}건`}
        descriptionPlacement="inline"
      />

      <AdminTabs
        label="견적 문의 상태 필터"
        options={tabOptions}
        value={statusFilter}
        onChange={handleStatusFilter}
      />

      <form
        className="mt-16 flex flex-wrap items-center gap-8 rounded-12 border border-line bg-bg p-12"
        onSubmit={handleSearch}
      >
        <label className="flex h-40 min-w-240 flex-1 items-center rounded-8 border border-line-control px-12">
          <span className="sr-only">문의 번호·회사명·담당자 검색</span>
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="문의번호 · 회사명 · 담당자 검색"
            className="w-full min-w-0 border-0 bg-transparent text-body-s outline-none placeholder:text-text-3"
          />
        </label>
        <div className="flex h-40 items-center gap-8 rounded-8 border border-line-control px-12">
          <AdminDateInput
            label="접수 시작일"
            value={startDateInput}
            invalid={isInvalidAdminDateInput(startDateInput)}
            errorMessageId="quote-date-filter-error"
            onChange={setStartDateInput}
            className="w-132"
          />
          <span className="text-caption text-text-3" aria-hidden="true">
            ~
          </span>
          <AdminDateInput
            label="접수 종료일"
            value={endDateInput}
            invalid={isInvalidAdminDateInput(endDateInput)}
            errorMessageId="quote-date-filter-error"
            onChange={setEndDateInput}
            className="w-132"
          />
        </div>
        <label className="sr-only" htmlFor="quote-type-unavailable">
          견적 유형
        </label>
        <select
          id="quote-type-unavailable"
          disabled
          aria-describedby="quote-type-unavailable-help"
          className="h-40 w-160 rounded-8 border border-line-control bg-bg px-12 text-body-s text-text-3 disabled:cursor-not-allowed"
        >
          <option>유형 정보 없음</option>
        </select>
        <span id="quote-type-unavailable-help" className="sr-only">
          Quote API가 견적 유형을 제공하지 않습니다.
        </span>
        <div className="ml-auto flex items-center gap-8">
          <Button type="button" variant="ghost" size="s" onClick={handleReset}>
            초기화
          </Button>
          <Button type="submit" size="s">
            검색
          </Button>
        </div>
      </form>
      {hasInvalidDateFilter ? (
        <p id="quote-date-filter-error" role="alert" className="mt-8 text-caption text-danger">
          시작일과 종료일은 YYYY.MM.DD 형식의 유효한 날짜여야 합니다. 검색 조건을 수정하고 다시
          검색해 주세요. 이전 검색 결과는 유지됩니다.
        </p>
      ) : null}

      <div className="mt-24 grid items-start gap-16 xl:grid-cols-[minmax(0,1.414fr)_minmax(360px,1fr)]">
        <section aria-label="견적 문의 목록" className="min-w-0">
          <div className="overflow-hidden rounded-12 border border-line bg-bg">
            <div className="flex h-44 items-center border-b border-line px-20 text-body-s text-text-2">
              검색 결과 {visibleQuotes.length.toLocaleString('ko-KR')}건
            </div>
            {pageQuotes.length === 0 ? (
              <AdminEmpty
                title="견적 문의가 없습니다"
                description="상태나 검색 조건을 확인해 주세요."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-720 border-collapse text-left text-body-s">
                  <thead className="h-44 bg-surface text-label-s text-text-2">
                    <tr>
                      <th scope="col" className="px-16 font-medium">
                        접수일
                      </th>
                      <th scope="col" className="px-12 font-medium">
                        경과
                      </th>
                      <th scope="col" className="px-12 font-medium">
                        문의 내용
                      </th>
                      <th scope="col" className="px-12 font-medium">
                        요청 품목
                      </th>
                      <th scope="col" className="px-12 font-medium">
                        회사 / 담당자
                      </th>
                      <th scope="col" className="px-12 font-medium">
                        상태
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageQuotes.map((quote) => {
                      const isSelected = quote.id === activeQuote?.id;
                      return (
                        <tr
                          key={quote.id}
                          className={`h-56 border-t border-line ${isSelected ? 'bg-bg-subtle' : 'bg-bg hover:bg-bg-subtle'}`}
                        >
                          <td className="px-16 whitespace-nowrap text-text-2">
                            {formatAdminDate(quote.requestedAt)}
                          </td>
                          <td className="px-12 whitespace-nowrap text-text-2">
                            {formatQuoteElapsedDays(quote.requestedAt, elapsedDayClock)}
                          </td>
                          <td className="min-w-160 px-12">
                            <button
                              type="button"
                              aria-pressed={isSelected}
                              className="block max-w-full truncate text-left focus-ring"
                              onClick={() => setSelectedQuoteId(quote.id)}
                            >
                              {quote.title}
                            </button>
                            <span className="mt-2 block truncate text-caption text-text-3">
                              {quote.id}
                            </span>
                          </td>
                          <td className="px-12 whitespace-nowrap text-text-2">
                            {quote.requestedItems.length.toLocaleString('ko-KR')}개
                          </td>
                          <td className="min-w-132 px-12">
                            <span className="block truncate font-medium">{quote.companyName}</span>
                            <span className="mt-2 block truncate text-caption text-text-3">
                              담당자 {quote.contactName}
                            </span>
                          </td>
                          <td className="px-12 whitespace-nowrap">
                            <QuoteStatusBadge status={quote.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            className="mt-16 flex justify-center"
          />
        </section>

        {activeQuote ? (
          <QuoteDetailPanel key={activeQuote.id} quote={activeQuote} />
        ) : (
          <div className="min-h-320 rounded-12 border border-line bg-bg p-24">
            <AdminEmpty
              title="표시할 견적이 없습니다"
              description="견적 문의를 선택하면 상세 정보가 표시됩니다."
            />
          </div>
        )}
      </div>
    </section>
  );
}

/** 견적 답변, 내부 메모, PDF 첨부 정보를 목 API에 저장합니다. */
function QuoteDetailPanel({ quote }: { quote: AdminQuote }) {
  const queryClient = useQueryClient();
  const [draftStatus, setDraftStatus] = useState<QuoteStatus>(quote.status);
  const [adminMemo, setAdminMemo] = useState(quote.internalMemo);
  const [previewMessage, setPreviewMessage] = useState('');
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [quoteDraft, setQuoteDraft] = useState<AdminQuoteDraft>({
    amount: '',
    expiresAt: '',
    notice: '',
    attachments: [],
  });
  const [quoteErrors, setQuoteErrors] = useState<string[]>([]);
  const [quotePreview, setQuotePreview] = useState('');
  const quoteFileInputRef = useRef<HTMLInputElement>(null);
  const resetQuoteDraft = () => {
    if (quoteFileInputRef.current) quoteFileInputRef.current.value = '';
    setQuoteDraft({ amount: '', expiresAt: '', notice: '', attachments: [] });
    setQuoteErrors([]);
  };
  const closeQuoteModal = () => {
    setIsQuoteModalOpen(false);
    resetQuoteDraft();
  };
  const persistQuote = async (update: AdminQuoteUpdate) => {
    await (await getShopApi()).quotes.updateAdmin(quote.id, update);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'quotes', 'list'] }),
      queryClient.invalidateQueries({ queryKey: ['quotes'] }),
    ]);
  };
  const validateAndPreviewQuote = async () => {
    const validationErrors = validateAdminQuoteDraft(quoteDraft, getBrowserLocalDateKey());
    setQuoteErrors(validationErrors);
    if (validationErrors.length) return;
    try {
      const attachments = quoteDraft.attachments.map((file) => ({
        id: `${quote.id}-${file.name}-${file.size}`,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      }));
      await persistQuote({
        status: 'quoteSent',
        quoteAmount: Number(quoteDraft.amount),
        expiresAt: quoteDraft.expiresAt,
        publicMessage: quoteDraft.notice.trim(),
        attachments,
      });
      setDraftStatus('quoteSent');
      setQuotePreview(
        '견적 정보와 PDF 파일 메타데이터를 목 API에 저장했습니다. PDF 파일 자체는 보관되지 않고 고객 이메일도 발송되지 않았습니다.',
      );
      closeQuoteModal();
    } catch (error) {
      setQuoteErrors([error instanceof Error ? error.message : '견적 정보를 저장하지 못했습니다.']);
    }
  };

  return (
    <aside className="min-w-0 rounded-12 border border-line bg-bg p-24" aria-label="견적 문의 상세">
      <div className="flex items-center justify-between gap-12">
        <h2 className="truncate text-h3">{quote.id}</h2>
        <QuoteStatusBadge status={quote.status} />
      </div>

      <dl className="mt-20 grid grid-cols-[88px_minmax(0,1fr)] gap-x-8 gap-y-8 text-body-s">
        <dt className="text-text-3">문의 내용</dt>
        <dd className="min-w-0 break-words text-text-1">{quote.title}</dd>
        <dt className="text-text-3">회사</dt>
        <dd className="min-w-0 break-words text-text-1">{quote.companyName}</dd>
        <dt className="text-text-3">담당자</dt>
        <dd className="min-w-0 break-words text-text-1">{quote.contactName}</dd>
        <dt className="text-text-3">접수일</dt>
        <dd className="min-w-0 break-words text-text-1">
          {formatAdminDateTime(quote.requestedAt)}
        </dd>
      </dl>

      <div className="mt-24 border-t border-line pt-20">
        <h3 className="text-label-m">문의 상세 정보</h3>
        <p className="mt-8 text-body-s text-text-3">{quote.inquiryBody || '문의 상세 내용 없음'}</p>
        {quote.requestedItems.length ? (
          <ul className="mt-12 grid gap-4 text-body-s">
            {quote.requestedItems.map((item, index) => (
              <li key={`${item.name}-${index}`}>
                {item.name} × {item.quantity}
                {item.option ? ` · ${item.option}` : ''}
              </li>
            ))}
          </ul>
        ) : null}
        {quote.attachments.length ? (
          <ul className="mt-12 grid gap-4 text-caption text-text-2">
            {quote.attachments.map((file) => (
              <li key={file.id}>
                {file.fileName} · {(file.sizeBytes / 1024 / 1024).toFixed(1)}MB
              </li>
            ))}
          </ul>
        ) : null}
        {quote.quoteAmount !== null ? (
          <p className="mt-12 text-body-s">
            견적 금액: {quote.quoteAmount.toLocaleString('ko-KR')}원
            {quote.expiresAt ? ` · 유효기간 ${quote.expiresAt}` : ''}
          </p>
        ) : null}
        {quote.publicMessage ? (
          <p className="mt-12 rounded-8 bg-surface p-12 text-body-s whitespace-pre-wrap">
            고객 공개 안내: {quote.publicMessage}
          </p>
        ) : null}
        <AdminNotice className="mt-16" tone="warning">
          견적 작성·저장에서 금액과 고객 안내를 입력하고 PDF를 선택할 수 있습니다. 저장 시
          파일명·형식·크기만 목 상태에 기록하며 PDF 파일 자체는 보관하거나 업로드하지 않고, 실제
          이메일도 발송하지 않습니다.
        </AdminNotice>
      </div>

      <div className="mt-20 flex flex-col gap-8">
        <label htmlFor="quote-status-preview" className="text-label-m">
          상태 변경
        </label>
        <select
          id="quote-status-preview"
          value={draftStatus}
          onChange={(event) => setDraftStatus(event.target.value as QuoteStatus)}
          className="h-48 w-full rounded-8 border border-line-control bg-bg px-14 text-body-s text-text-1"
        >
          {!QUOTE_STATUS_META[draftStatus] ? (
            <option value={draftStatus}>{String(draftStatus)} · 알 수 없는 상태</option>
          ) : null}
          {Object.entries(QUOTE_STATUS_META).map(([status, statusMeta]) => (
            <option key={status} value={status}>
              {statusMeta.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-16 flex flex-col gap-8">
        <label htmlFor="quote-admin-memo" className="text-label-m">
          관리자 메모
        </label>
        <textarea
          id="quote-admin-memo"
          value={adminMemo}
          onChange={(event) => setAdminMemo(event.target.value)}
          placeholder="내부 운영 메모를 입력해 주세요. 고객에게 공개되지 않습니다."
          className="min-h-96 resize-y rounded-8 border border-line-control bg-bg px-14 py-12 text-body-s text-text-2 placeholder:text-text-3 disabled:cursor-not-allowed"
        />
        <p className="text-caption text-text-3">
          견적 작성·저장에서 PDF 파일을 선택할 수 있습니다. 목 상태에는 파일명·형식·크기만 기록하고
          PDF 자체는 보관하거나 업로드하지 않습니다.
        </p>
      </div>
      {previewMessage ? (
        <p role="status" className="mt-12 text-caption text-warning">
          {previewMessage}
        </p>
      ) : null}
      <div className="mt-24 flex gap-8 border-t border-line pt-16">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={() => {
            resetQuoteDraft();
            setQuotePreview('');
            setIsQuoteModalOpen(true);
          }}
        >
          견적 작성·저장
        </Button>
        <Button
          type="button"
          className="flex-1"
          onClick={() =>
            void persistQuote({ status: draftStatus, internalMemo: adminMemo })
              .then(() => setPreviewMessage('상태와 내부 메모를 목 API에 저장했습니다.'))
              .catch((error: unknown) =>
                setPreviewMessage(
                  error instanceof Error ? error.message : '견적 변경을 저장하지 못했습니다.',
                ),
              )
          }
        >
          상태·메모 저장
        </Button>
      </div>
      {quotePreview ? (
        <p role="status" className="mt-12 text-caption text-warning">
          {quotePreview}
        </p>
      ) : null}
      <Modal
        isOpen={isQuoteModalOpen}
        onClose={closeQuoteModal}
        title="견적 정보 저장"
        actions={
          <>
            <Button variant="secondary" onClick={closeQuoteModal}>
              취소
            </Button>
            <Button onClick={() => void validateAndPreviewQuote()}>목 API에 저장</Button>
          </>
        }
      >
        <div className="mt-16 grid max-h-[65vh] gap-12 overflow-y-auto pr-4 text-body-s">
          <label className="grid gap-4">
            견적 금액
            <input
              type="number"
              min="1"
              max="1000000000"
              value={quoteDraft.amount}
              onChange={(event) =>
                setQuoteDraft((current) => ({ ...current, amount: event.target.value }))
              }
              className="h-40 rounded-8 border border-line-control px-12"
            />
          </label>
          <label className="grid gap-4">
            유효기간
            <input
              type="date"
              value={quoteDraft.expiresAt}
              onChange={(event) =>
                setQuoteDraft((current) => ({ ...current, expiresAt: event.target.value }))
              }
              className="h-40 rounded-8 border border-line-control px-12"
            />
          </label>
          <label className="grid gap-4">
            고객 안내
            <textarea
              maxLength={1000}
              value={quoteDraft.notice}
              onChange={(event) =>
                setQuoteDraft((current) => ({ ...current, notice: event.target.value }))
              }
              className="min-h-80 rounded-8 border border-line-control p-12"
            />
            <span className="text-caption text-text-3">{quoteDraft.notice.length}/1,000자</span>
          </label>
          <label className="grid gap-4">
            견적서 파일 (PDF 1개)
            <input
              ref={quoteFileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) =>
                setQuoteDraft((current) => ({
                  ...current,
                  attachments: Array.from(event.target.files ?? []),
                }))
              }
              className="text-body-s"
            />
          </label>
          {quoteDraft.attachments.map((file) => (
            <span key={`${file.name}-${file.size}`} className="text-caption text-text-3">
              {file.name} · {(file.size / 1024 / 1024).toFixed(1)}MB
            </span>
          ))}
          {quoteErrors.length ? (
            <ul role="alert" className="grid gap-4 text-danger">
              {quoteErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </Modal>
    </aside>
  );
}
