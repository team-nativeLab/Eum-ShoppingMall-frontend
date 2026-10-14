import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import type { Quote, QuoteStatus } from '@eum/api/types';
import { QUOTE_STATUS_META } from '@eum/api/quote-status';
import { Badge } from '@eum/ui/components/Badge';
import { Button } from '@eum/ui/components/Button';
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
const EMPTY_QUOTES: Quote[] = [];

/** 견적 문의의 읽기 목록을 API에서 가져옵니다. */
async function loadQuotes(signal: AbortSignal): Promise<Quote[]> {
  const api = await getShopApi();
  return api.quotes.list({ signal });
}

/** 상태 코드에 프로젝트 공통 견적 색상 규칙을 적용합니다. */
function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const statusMeta = QUOTE_STATUS_META[status] ?? {
    label: String(status) || '알 수 없는 상태',
    tone: 'neutral' as const,
  };
  return <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>;
}

/** 견적 문의를 상태·검색어·접수일로 탐색하고 읽기 전용 상세를 표시합니다. */
export function AdminQuotesPage() {
  const [statusFilter, setStatusFilter] = useState<QuoteStatusFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({ keyword: '', startDate: '', endDate: '' });
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [statusPreviews, setStatusPreviews] = useState<Partial<Record<string, QuoteStatus>>>({});
  const [page, setPage] = useState(1);
  const hasInvalidDateFilter =
    isInvalidAdminDateInput(startDateInput) || isInvalidAdminDateInput(endDateInput);
  const quotesQuery = useQuery({
    queryKey: ['admin', 'quotes', 'list'],
    queryFn: ({ signal }) => loadQuotes(signal),
  });

  const allQuotes = useMemo(
    () =>
      (quotesQuery.data ?? EMPTY_QUOTES).map((quote) => ({
        ...quote,
        status: statusPreviews[quote.id] ?? quote.status,
      })),
    [quotesQuery.data, statusPreviews],
  );
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
                <table className="w-full min-w-640 border-collapse text-left text-body-s">
                  <thead className="h-44 bg-surface text-label-s text-text-2">
                    <tr>
                      <th scope="col" className="px-16 font-medium">
                        접수일
                      </th>
                      <th scope="col" className="px-12 font-medium">
                        문의 내용
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
          <QuoteDetailPanel
            key={activeQuote.id}
            quote={activeQuote}
            onPreviewStatus={(status) =>
              setStatusPreviews((previous) => ({ ...previous, [activeQuote.id]: status }))
            }
          />
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

/** API가 제공하는 견적 데이터만 표시하고 미지원 필드 변경은 비활성화합니다. */
function QuoteDetailPanel({
  quote,
  onPreviewStatus,
}: {
  quote: Quote;
  onPreviewStatus: (status: QuoteStatus) => void;
}) {
  const [draftStatus, setDraftStatus] = useState<QuoteStatus>(quote.status);
  const [adminMemo, setAdminMemo] = useState('');
  const [previewMessage, setPreviewMessage] = useState('');

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
        <p className="mt-8 text-body-s text-text-3">
          품목·수량·연락처·첨부 파일 정보는 현재 견적 조회 API에서 제공하지 않습니다.
        </p>
        <AdminNotice className="mt-16" tone="warning">
          상태와 메모는 이 화면에서만 미리보기로 반영됩니다. 서버에는 저장되지 않으며 견적서도
          발송되지 않습니다.
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
          placeholder="메모를 입력해 주세요. 현재 화면에만 유지됩니다."
          className="min-h-96 resize-y rounded-8 border border-line-control bg-bg px-14 py-12 text-body-s text-text-2 placeholder:text-text-3 disabled:cursor-not-allowed"
        />
        <p className="text-caption text-text-3">이 화면을 닫으면 메모 미리보기는 사라집니다.</p>
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
          onClick={() =>
            setPreviewMessage('견적서 발송 API가 없어 실제 메일은 발송되지 않았습니다.')
          }
        >
          견적서 발송
        </Button>
        <Button
          type="button"
          className="flex-1"
          onClick={() => {
            onPreviewStatus(draftStatus);
            setPreviewMessage(
              '상태가 이 화면에만 임시 반영되었습니다. 서버에는 저장되지 않았습니다.',
            );
          }}
        >
          임시 반영
        </Button>
      </div>
    </aside>
  );
}
