'use client';

import { queryKeys } from '@eum/api/query-keys';
import type { Faq, Inquiry, Notice, Order } from '@eum/api/types';
import { Button } from '@eum/ui/components/Button';
import { Checkbox } from '@eum/ui/components/Checkbox';
import { Chip } from '@eum/ui/components/Chip';
import { Icon } from '@eum/ui/components/Icon';
import { Pagination } from '@eum/ui/components/Pagination';
import { SelectField, TextField } from '@eum/ui/components/TextField';
import { cx } from '@eum/ui/lib/cx';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, FileText, Search } from 'lucide-react';
import { useId, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useMemberSession } from '@/features/auth/member-session';
import { getShopApi } from '@/lib/shop-api';
import { SupportQueryError, SupportShell } from './support-shell';

const PAGE_SIZE = 10;

function SupportSearchForm({
  value,
  onValueChange,
  onSearch,
  placeholder,
  label,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSearch: (keyword: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  const inputId = useId();

  function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    onSearch(value.trim());
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={`flex h-48 w-full items-center gap-8 rounded-8 border border-line-strong bg-bg p-4 ${className ?? ''}`}
    >
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(changeEvent) => onValueChange(changeEvent.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent px-12 text-body-m text-text-1 outline-none placeholder:text-text-3 [&::-webkit-search-cancel-button]:hidden"
      />
      <Button
        type="submit"
        size="s"
        className="h-36 rounded-4"
        leadingIcon={<Icon icon={Search} size={16} />}
      >
        검색
      </Button>
    </form>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '날짜 미제공'
    : new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
}

function LoadingState({ label }: { label: string }) {
  return (
    <p role="status" className="py-40 text-center text-body-s text-text-3">
      {label}
    </p>
  );
}

function NoticeTableRow({ notice, number }: { notice: Notice; number: number }) {
  return (
    <tr className={cx(notice.isPinned && 'h-48 bg-surface')}>
      <td
        className={cx(
          'px-12 text-center text-body-s text-text-3',
          notice.isPinned ? 'py-12' : 'py-22',
        )}
      >
        {notice.isPinned ? '고정' : number}
      </td>
      <td className={cx('min-w-0 px-16', notice.isPinned ? 'py-12' : 'py-22')}>
        <details>
          <summary className="flex cursor-pointer list-none items-center gap-8 rounded-4 text-body-s font-medium focus-ring">
            {notice.isPinned ? (
              <span className="shrink-0 rounded-4 bg-text-1 px-6 py-2 text-caption text-inverse">
                공지
              </span>
            ) : null}
            <span className="truncate">{notice.title}</span>
          </summary>
          <p className="mt-12 text-body-s whitespace-pre-line text-text-2">{notice.body}</p>
        </details>
      </td>
      <td
        className={cx(
          'px-12 text-center text-body-s text-text-3',
          notice.isPinned ? 'py-12' : 'py-22',
        )}
      >
        {formatDate(notice.publishedAt)}
      </td>
      <td
        className={cx(
          'px-12 text-center text-body-s text-text-3',
          notice.isPinned ? 'py-12' : 'py-22',
        )}
      >
        {notice.viewCount ?? '—'}
      </td>
    </tr>
  );
}

function NoticeMobileRow({ notice, number }: { notice: Notice; number: number }) {
  return (
    <details className="border-b border-line py-16">
      <summary className="flex cursor-pointer list-none items-start gap-10 rounded-4 focus-ring">
        <span className="w-36 shrink-0 pt-2 text-caption text-text-3">
          {notice.isPinned ? '고정' : number}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-8 text-body-s font-medium">
            {notice.isPinned ? (
              <span className="shrink-0 rounded-4 bg-text-1 px-6 py-2 text-caption text-inverse">
                공지
              </span>
            ) : null}
            {notice.title}
          </span>
          <span className="mt-8 block text-caption text-text-3">
            {formatDate(notice.publishedAt)}
          </span>
        </span>
      </summary>
      <p className="mt-12 ml-46 text-body-s whitespace-pre-line text-text-2">{notice.body}</p>
    </details>
  );
}

/** 공지 목록은 화면당 10행이며, 검색·페이지 이동은 현재 조회 결과에 적용됩니다. */
export function NoticesPage() {
  const [searchText, setSearchText] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const noticesQuery = useQuery({
    queryKey: queryKeys.notices.all,
    queryFn: async ({ signal }) => (await getShopApi()).notices.list({ signal }),
  });
  const rows = useMemo(() => {
    const normalized = keyword.toLocaleLowerCase('ko-KR');
    return [...(noticesQuery.data ?? [])]
      .filter(
        (notice) =>
          !normalized ||
          `${notice.title} ${notice.body}`.toLocaleLowerCase('ko-KR').includes(normalized),
      )
      .sort(
        (left, right) =>
          Number(right.isPinned) - Number(left.isPinned) ||
          right.publishedAt.localeCompare(left.publishedAt),
      );
  }, [keyword, noticesQuery.data]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visibleRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <SupportShell activePath="/support/notices">
      <div className="mb-16 flex justify-end">
        <SupportSearchForm
          value={searchText}
          onValueChange={setSearchText}
          onSearch={(value) => {
            setKeyword(value);
            setPage(1);
          }}
          placeholder="검색어를 입력해 주세요"
          label="공지사항 검색"
          className="sm:max-w-320"
        />
      </div>
      {noticesQuery.isLoading ? <LoadingState label="공지사항을 불러오는 중입니다." /> : null}
      {noticesQuery.isError ? (
        <SupportQueryError
          message="공지사항을 불러오지 못했습니다."
          onRetry={() => void noticesQuery.refetch()}
        />
      ) : null}
      {noticesQuery.isSuccess ? (
        rows.length === 0 ? (
          <p className="py-56 text-center text-body-s text-text-3">
            {noticesQuery.data.length === 0
              ? '등록된 공지사항이 없습니다.'
              : '검색 결과가 없습니다.'}
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full table-fixed border-t border-text-1">
                <colgroup>
                  <col className="w-80" />
                  <col />
                  <col className="w-144" />
                  <col className="w-96" />
                </colgroup>
                <thead>
                  <tr className="border-b border-line bg-surface text-caption font-medium text-text-2">
                    <th scope="col" className="px-12 py-12 text-center">
                      번호
                    </th>
                    <th scope="col" className="px-16 py-12 text-left">
                      제목
                    </th>
                    <th scope="col" className="px-12 py-12 text-center">
                      등록일
                    </th>
                    <th scope="col" className="px-12 py-12 text-center">
                      조회
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((notice, index) => (
                    <NoticeTableRow
                      key={notice.id}
                      notice={notice}
                      number={rows.length - ((currentPage - 1) * PAGE_SIZE + index)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="lg:hidden">
              {visibleRows.map((notice, index) => (
                <NoticeMobileRow
                  key={notice.id}
                  notice={notice}
                  number={rows.length - ((currentPage - 1) * PAGE_SIZE + index)}
                />
              ))}
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={pages}
              onPageChange={setPage}
              siblingCount={2}
              className="mt-32 hidden justify-center lg:flex"
            />
            <Pagination
              currentPage={currentPage}
              totalPages={pages}
              onPageChange={setPage}
              siblingCount={1}
              className="mt-32 flex justify-center lg:hidden"
            />
          </>
        )
      ) : null}
    </SupportShell>
  );
}

const FAQ_CATEGORIES = ['전체', '주문/결제', '배송', '교환/반품', '회원', '견적·대량구매'] as const;

function FaqItem({ faq, isOpen, onToggle }: { faq: Faq; isOpen: boolean; onToggle: () => void }) {
  return (
    <article className="border-b border-line">
      <h3>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={onToggle}
          className="flex min-h-72 w-full items-center gap-12 py-16 text-left focus-ring"
        >
          <span className="shrink-0 font-semibold">Q.</span>
          <span className="min-w-0 flex-1 text-body-s font-medium">{faq.question}</span>
          <Icon
            icon={isOpen ? ChevronUp : ChevronDown}
            size={20}
            className="shrink-0 text-text-3"
          />
        </button>
      </h3>
      {isOpen ? (
        <div className="flex gap-12 bg-surface px-16 py-20 text-body-s text-text-2">
          <span className="shrink-0 font-semibold text-text-1">A.</span>
          <p className="min-w-0 flex-1">{faq.answer}</p>
        </div>
      ) : null}
    </article>
  );
}

/** FAQ 목록은 6개 분류와 검색, 첫 질문이 열린 아코디언으로 제공됩니다. */
export function FaqPage() {
  const [category, setCategory] = useState<(typeof FAQ_CATEGORIES)[number]>('전체');
  const [searchText, setSearchText] = useState('');
  const [keyword, setKeyword] = useState('');
  const [openId, setOpenId] = useState<string | null | undefined>(undefined);
  const faqsQuery = useQuery({
    queryKey: queryKeys.faqs.all,
    queryFn: async ({ signal }) => (await getShopApi()).faqs.list({ signal }),
  });
  const filteredFaqs = useMemo(() => {
    const normalized = keyword.toLocaleLowerCase('ko-KR');
    return (faqsQuery.data ?? []).filter(
      (faq) =>
        (category === '전체' || faq.category === category) &&
        (!normalized ||
          `${faq.question} ${faq.answer}`.toLocaleLowerCase('ko-KR').includes(normalized)),
    );
  }, [category, faqsQuery.data, keyword]);
  const activeOpenId =
    openId === null
      ? null
      : filteredFaqs.some((faq) => faq.id === openId)
        ? openId
        : (filteredFaqs[0]?.id ?? null);

  return (
    <SupportShell activePath="/support/faq">
      <div className="mb-16 flex flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap gap-8" aria-label="FAQ 분류">
          {FAQ_CATEGORIES.map((item) => (
            <Chip key={item} isSelected={item === category} onClick={() => setCategory(item)}>
              {item}
            </Chip>
          ))}
        </div>
        <SupportSearchForm
          value={searchText}
          onValueChange={setSearchText}
          onSearch={setKeyword}
          placeholder="궁금한 내용을 검색해 주세요"
          label="자주 묻는 질문 검색"
          className="lg:max-w-320 lg:shrink-0"
        />
      </div>
      {faqsQuery.isLoading ? <LoadingState label="FAQ를 불러오는 중입니다." /> : null}
      {faqsQuery.isError ? (
        <SupportQueryError
          message="FAQ를 불러오지 못했습니다."
          onRetry={() => void faqsQuery.refetch()}
        />
      ) : null}
      {faqsQuery.isSuccess ? (
        (faqsQuery.data?.length ?? 0) === 0 ? (
          <p className="py-56 text-center text-body-s text-text-3">등록된 FAQ가 없습니다.</p>
        ) : (
          <>
            {filteredFaqs.length ? (
              filteredFaqs.map((faq) => (
                <FaqItem
                  key={faq.id}
                  faq={faq}
                  isOpen={activeOpenId === faq.id}
                  onToggle={() => setOpenId(activeOpenId === faq.id ? null : faq.id)}
                />
              ))
            ) : (
              <p className="py-56 text-center text-body-s text-text-3">
                검색 또는 선택한 분류 결과가 없습니다.
              </p>
            )}
          </>
        )
      ) : null}
    </SupportShell>
  );
}

function InquiryForm({ memberId }: { memberId: string | null }) {
  const [inquiryBody, setInquiryBody] = useState('');
  const [feedback, setFeedback] = useState('');
  const [hasCompletedPreview, setHasCompletedPreview] = useState(false);
  const ordersQuery = useQuery({
    queryKey: memberId ? queryKeys.orders.byMember(memberId) : ['orders', 'member', null],
    enabled: Boolean(memberId),
    queryFn: async ({ signal }): Promise<Order[]> => {
      if (!memberId) return [];
      return (await getShopApi()).orders.listByMember(memberId, { signal });
    },
  });

  function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    if (hasCompletedPreview) {
      setFeedback('이미 접수 미리보기를 완료했습니다. 입력값은 저장되지 않았습니다.');
      return;
    }
    submitEvent.currentTarget.reset();
    setInquiryBody('');
    setHasCompletedPreview(true);
    setFeedback('문의가 접수되었습니다. 데모 화면이며 입력값은 전송·저장되지 않았습니다.');
  }

  return (
    <section aria-labelledby="inquiry-form-heading">
      <form
        aria-labelledby="inquiry-form-heading"
        className="space-y-20 rounded-12 border border-line p-16 sm:p-24"
        onSubmit={handleSubmit}
        onReset={() => {
          setInquiryBody('');
          setFeedback('작성 내용을 초기화했습니다. 입력값은 저장되지 않았습니다.');
        }}
      >
        <div className="flex items-end justify-between gap-12">
          <h2 id="inquiry-form-heading" tabIndex={-1} className="text-h4 scroll-mt-96">
            문의 작성
          </h2>
          <span className="text-caption text-text-3">
            <span aria-hidden="true" className="mr-4 text-danger">
              *
            </span>
            필수 입력 항목
          </span>
        </div>
        <div className="grid gap-16 sm:grid-cols-2">
          <SelectField
            label="문의 유형"
            showRequiredIndicator
            defaultValue=""
            required
            aria-required="true"
            options={[
              { value: '', label: '문의 유형을 선택해 주세요' },
              { value: 'order', label: '주문/결제' },
              { value: 'delivery', label: '배송' },
              { value: 'product', label: '상품' },
              { value: 'etc', label: '기타' },
            ]}
          />
          <SelectField
            label="주문 선택 (선택)"
            defaultValue=""
            options={[
              { value: '', label: '관련 주문을 선택해 주세요 (선택)' },
              ...(ordersQuery.data ?? []).map((order) => ({
                value: order.id,
                label: `${order.orderNumber} · ${formatDate(order.orderedAt)}`,
              })),
            ]}
          />
        </div>
        {memberId && ordersQuery.isError ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-8 text-body-s text-danger"
          >
            <span>주문 목록을 불러오지 못했습니다.</span>
            <Button
              type="button"
              variant="secondary"
              size="s"
              onClick={() => void ordersQuery.refetch()}
            >
              다시 시도
            </Button>
          </div>
        ) : null}
        <TextField
          label="제목"
          showRequiredIndicator
          placeholder="문의 제목을 입력해 주세요"
          required
          aria-required="true"
        />
        <label className="flex flex-col gap-8 text-label-m">
          문의 내용
          <span aria-hidden="true" className="ml-4 text-danger">
            *
          </span>
          <textarea
            required
            aria-required="true"
            value={inquiryBody}
            onChange={(changeEvent) => setInquiryBody(changeEvent.currentTarget.value)}
            maxLength={1000}
            aria-describedby="inquiry-body-count"
            className="min-h-160 w-full resize-y rounded-8 border border-line-strong bg-bg p-14 text-body-m outline-none placeholder:text-text-3 focus:border-text-1 focus:ring-[0.5px] focus:ring-text-1 focus:ring-inset"
            placeholder="문의 내용을 입력해 주세요"
          />
          <span
            id="inquiry-body-count"
            aria-live="polite"
            className="text-right text-caption text-text-3"
          >
            {inquiryBody.length.toLocaleString('ko-KR')} / 1,000
          </span>
        </label>
        <div className="space-y-8">
          <span className="block text-label-m">파일 첨부</span>
          <label className="flex min-h-88 cursor-not-allowed flex-col items-center justify-center gap-6 rounded-8 border border-dashed border-line-strong bg-surface px-16 text-center text-body-s text-text-3">
            <Icon icon={FileText} size={20} />
            <span>파일 첨부 기능은 준비 중입니다.</span>
            <input type="file" className="sr-only" disabled aria-label="문의 파일 첨부" />
          </label>
          <p className="text-caption text-text-3">첨부 파일 업로드는 현재 지원하지 않습니다.</p>
        </div>
        <div className="space-y-8">
          <Checkbox aria-describedby="inquiry-notification-note">답변 등록 시 알림 받기</Checkbox>
          <p id="inquiry-notification-note" className="text-caption text-text-3">
            알림 선택은 화면 미리보기용입니다. 실제로 저장되지 않으며 답변 알림도 발송되지 않습니다.
          </p>
        </div>
        <div className="flex flex-col gap-12 border-t border-line pt-16 sm:flex-row sm:items-center sm:justify-between">
          <p id="inquiry-form-note" className="text-caption text-text-3">
            입력 내용은 이 화면에서만 유지되며 실제 문의로 전달되지 않습니다.
          </p>
          <div className="flex shrink-0 justify-end gap-8">
            <Button type="reset" variant="secondary" size="m">
              취소
            </Button>
            <Button type="submit" size="m" aria-describedby="inquiry-form-note">
              등록
            </Button>
          </div>
        </div>
        {feedback ? (
          <p role="status" className="rounded-8 bg-surface p-12 text-body-s text-text-2">
            {feedback}
          </p>
        ) : null}
        {hasCompletedPreview ? (
          <button
            type="button"
            onClick={() =>
              setFeedback(
                '이미 접수 미리보기를 완료했습니다. 실제 문의 기록은 생성되지 않았습니다.',
              )
            }
            className="rounded-4 text-caption text-text-3 underline focus-ring"
          >
            접수 상태 다시 보기
          </button>
        ) : null}
      </form>
    </section>
  );
}

function MemberInquiryHistory({ memberId }: { memberId: string }) {
  const inquiriesQuery = useQuery({
    queryKey: queryKeys.inquiries.byMember(memberId),
    queryFn: async ({ signal }): Promise<Inquiry[]> => {
      const inquiries = await (await getShopApi()).inquiries.listByMember(memberId, { signal });
      return inquiries
        .filter((inquiry) => inquiry.memberId === memberId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
  });

  return (
    <section aria-labelledby="member-inquiries-heading" className="mb-24">
      <div className="mb-12 flex flex-wrap items-center justify-between gap-12">
        <h2 id="member-inquiries-heading" className="text-h4">
          내 문의 내역
        </h2>
        <Link
          href="#inquiry-form-heading"
          className="inline-flex min-h-40 items-center justify-center rounded-8 bg-text-1 px-16 text-label-s text-inverse focus-ring"
        >
          문의 작성
        </Link>
      </div>
      {inquiriesQuery.isPending ? <LoadingState label="문의 내역을 불러오는 중입니다." /> : null}
      {inquiriesQuery.isError ? (
        <SupportQueryError
          message="문의 내역을 불러오지 못했습니다."
          onRetry={() => void inquiriesQuery.refetch()}
        />
      ) : null}
      {inquiriesQuery.isSuccess ? (
        inquiriesQuery.data.length === 0 ? (
          <p className="border-y border-line py-24 text-center text-body-s text-text-3">
            등록된 문의가 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {inquiriesQuery.data.map((inquiry) => (
              <li key={inquiry.id} className="py-16">
                <div className="mb-8 flex items-center justify-between gap-8">
                  <span className="rounded-capsule border border-line-strong px-10 py-4 text-caption text-text-2">
                    {inquiry.status === 'answered' ? '답변완료' : '답변대기'}
                  </span>
                  <time className="text-caption text-text-3" dateTime={inquiry.createdAt}>
                    {formatDate(inquiry.createdAt)}
                  </time>
                </div>
                <Link
                  href={`/mypage/inquiries/${encodeURIComponent(inquiry.id)}`}
                  className="block rounded-4 text-body-s break-words focus-ring hover:underline"
                >
                  {inquiry.title}
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}

/** 고객 문의 작성 폼과 회원 문의 내역을 렌더링합니다. */
export function InquiryPage() {
  const { member, status: memberStatus, refreshMember } = useMemberSession();
  return (
    <SupportShell activePath="/support/inquiry">
      {memberStatus === 'loading' ? <LoadingState label="회원 정보를 확인하는 중입니다." /> : null}
      {memberStatus === 'error' ? (
        <SupportQueryError
          message="회원 정보를 확인하지 못했습니다."
          onRetry={() => void refreshMember()}
        />
      ) : null}
      {memberStatus === 'ready' && !member ? (
        <p role="status" className="mb-16 text-body-s text-text-3">
          문의 내역은{' '}
          <Link href="/login?redirect=%2Fmypage%2Finquiries" className="underline focus-ring">
            로그인 후
          </Link>{' '}
          마이페이지에서 확인할 수 있습니다.
        </p>
      ) : null}
      {memberStatus === 'ready' && member ? <MemberInquiryHistory memberId={member.id} /> : null}
      <InquiryForm memberId={member?.id ?? null} />
    </SupportShell>
  );
}
