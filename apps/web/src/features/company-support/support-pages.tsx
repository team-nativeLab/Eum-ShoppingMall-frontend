'use client';

import { queryKeys } from '@eum/api/query-keys';
import type { Faq, Inquiry, Notice } from '@eum/api/types';
import { Button } from '@eum/ui/components/Button';
import { Checkbox } from '@eum/ui/components/Checkbox';
import { Chip } from '@eum/ui/components/Chip';
import { Icon } from '@eum/ui/components/Icon';
import { Pagination } from '@eum/ui/components/Pagination';
import { SelectField, TextField } from '@eum/ui/components/TextField';
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
    <tr className={notice.isPinned ? 'bg-surface' : ''}>
      <td className="px-12 py-22 text-center text-body-s text-text-3">
        {notice.isPinned ? '고정' : number}
      </td>
      <td className="min-w-0 px-16 py-22">
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
      <td className="px-12 py-22 text-center text-body-s text-text-3">
        {formatDate(notice.publishedAt)}
      </td>
      <td className="px-12 py-22 text-center text-body-s text-text-3">{notice.viewCount ?? '—'}</td>
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

function InquiryBadge({ status }: { status: Inquiry['status'] }) {
  const isAnswered = status === 'answered';
  return (
    <span
      className={
        isAnswered
          ? 'rounded-capsule bg-surface-2 px-10 py-4 text-caption text-text-2'
          : 'rounded-capsule border border-line-strong px-10 py-4 text-caption text-text-2'
      }
    >
      {isAnswered ? '답변완료' : '답변대기'}
    </span>
  );
}

function InquiryHistory({ inquiries }: { inquiries: Inquiry[] }) {
  const rows = [...inquiries].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return (
    <section aria-labelledby="inquiry-history-heading" className="mb-40">
      <div className="mb-16 flex items-center justify-between gap-8">
        <h2 id="inquiry-history-heading" className="text-h4">
          내 문의 내역
        </h2>
        <Link
          href="#inquiry-form-heading"
          className="inline-flex h-40 shrink-0 items-center rounded-4 bg-text-1 px-16 text-label-s text-inverse focus-ring"
        >
          문의 작성
        </Link>
      </div>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full table-fixed border-t border-text-1">
          <colgroup>
            <col className="w-120" />
            <col />
            <col className="w-144" />
          </colgroup>
          <thead className="sr-only">
            <tr className="border-b border-line bg-surface text-caption font-medium text-text-2">
              <th scope="col" className="px-12 py-12 text-center">
                상태
              </th>
              <th scope="col" className="px-16 py-12 text-left">
                제목
              </th>
              <th scope="col" className="px-12 py-12 text-center">
                문의일
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inquiry) => (
              <tr key={inquiry.id} className="border-b border-line">
                <td className="px-12 py-16 text-center">
                  <InquiryBadge status={inquiry.status} />
                </td>
                <td className="truncate px-16 py-16 text-body-s">{inquiry.title}</td>
                <td className="px-12 py-16 text-center text-body-s text-text-3">
                  {formatDate(inquiry.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="lg:hidden">
        {rows.map((inquiry) => (
          <article key={inquiry.id} className="border-b border-line py-16">
            <div className="flex items-center justify-between gap-8">
              <InquiryBadge status={inquiry.status} />
              <time className="text-caption text-text-3">{formatDate(inquiry.createdAt)}</time>
            </div>
            <h3 className="mt-10 text-body-s font-medium">{inquiry.title}</h3>
          </article>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="py-32 text-center text-body-s text-text-3">등록된 문의가 없습니다.</p>
      ) : null}
    </section>
  );
}

function InquiryForm() {
  return (
    <section aria-labelledby="inquiry-form-heading">
      <form
        aria-labelledby="inquiry-form-heading"
        className="space-y-20 rounded-12 border border-line p-16 sm:p-24"
        onSubmit={(submitEvent) => submitEvent.preventDefault()}
      >
        <div className="flex items-end justify-between gap-12">
          <h2 id="inquiry-form-heading" tabIndex={-1} className="text-h4 scroll-mt-96">
            문의 작성
          </h2>
          <span className="text-caption text-text-3">* 필수 입력 항목</span>
        </div>
        <div className="grid gap-16 sm:grid-cols-2">
          <SelectField
            label="문의 유형 *"
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
          <TextField label="관련 주문 (선택)" placeholder="주문번호를 입력해 주세요" />
        </div>
        <TextField
          label="제목 *"
          placeholder="문의 제목을 입력해 주세요"
          required
          aria-required="true"
        />
        <label className="flex flex-col gap-8 text-label-m">
          문의 내용 *
          <textarea
            required
            aria-required="true"
            className="min-h-160 w-full resize-y rounded-8 border border-line-strong bg-bg p-14 text-body-m outline-none placeholder:text-text-3 focus:border-text-1 focus:ring-[0.5px] focus:ring-text-1 focus:ring-inset"
            placeholder="문의 내용을 입력해 주세요"
          />
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
        <Checkbox>답변이 등록되면 알림 받기</Checkbox>
        <div className="flex flex-col gap-12 border-t border-line pt-16 sm:flex-row sm:items-center sm:justify-between">
          <p id="inquiry-form-note" className="text-caption text-text-3">
            문의 등록 기능은 아직 연결되지 않았습니다.
          </p>
          <div className="flex shrink-0 justify-end gap-8">
            <Button type="reset" variant="secondary" size="m">
              취소
            </Button>
            <Button type="submit" disabled size="m" aria-describedby="inquiry-form-note">
              등록
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}

/** API에서 문의용 회원을 찾은 다음 해당 회원의 문의만 읽고, 새 문의는 disabled 시안으로 둡니다. */
export function InquiryPage() {
  const { member, status: memberStatus, refreshMember } = useMemberSession();
  const inquiryQuery = useQuery({
    queryKey: ['support', 'inquiries', member?.id ?? null],
    enabled: memberStatus === 'ready' && member !== null,
    queryFn: async ({ signal }) => {
      if (!member) throw new Error('문의 내역을 확인할 회원 정보가 없습니다.');
      const api = await getShopApi();
      return api.inquiries.listByMember(member.id, { signal });
    },
  });

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
        <p role="status" className="mb-40 py-24 text-center text-body-s text-text-3">
          로그인 후 문의 내역을 확인할 수 있습니다.
        </p>
      ) : null}
      {member && inquiryQuery.isLoading ? (
        <LoadingState label="문의 내역을 불러오는 중입니다." />
      ) : null}
      {member && inquiryQuery.isError ? (
        <SupportQueryError
          message="문의 내역을 불러오지 못했습니다."
          onRetry={() => void inquiryQuery.refetch()}
        />
      ) : null}
      {member && inquiryQuery.isSuccess ? <InquiryHistory inquiries={inquiryQuery.data} /> : null}
      <InquiryForm />
    </SupportShell>
  );
}
