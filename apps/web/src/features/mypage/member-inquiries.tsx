'use client';

import { queryKeys } from '@eum/api/query-keys';
import type { Inquiry } from '@eum/api/types';
import { Badge } from '@eum/ui/components/Badge';
import { Button } from '@eum/ui/components/Button';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemberSession } from '@/features/auth/member-session';
import { MyPageShell } from './mypage-shell';
import { getShopApi } from '@/lib/shop-api';

function formatInquiryDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '날짜 미제공'
    : new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
}

function useMemberInquiries() {
  const { member, status } = useMemberSession();
  const inquiriesQuery = useQuery({
    queryKey: member ? queryKeys.inquiries.byMember(member.id) : queryKeys.inquiries.byMember(''),
    enabled: status === 'ready' && member !== null,
    queryFn: async ({ signal }) => {
      if (!member) throw new Error('문의 내역을 확인할 회원이 없습니다.');
      const inquiries = await (await getShopApi()).inquiries.listByMember(member.id, { signal });
      return inquiries.filter((inquiry) => inquiry.memberId === member.id);
    },
  });

  return { member, status, inquiriesQuery };
}

/** W-31 회원 문의 목록은 현재 로그인 세션으로 조회하며 본문은 URL에 포함하지 않습니다. */
export function MemberInquiriesPage() {
  const { member, status, inquiriesQuery } = useMemberInquiries();
  const inquiries = [...(inquiriesQuery.data ?? [])].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );

  return (
    <MyPageShell activeSection="inquiries" title="1:1 문의 내역">
      {status === 'loading' ? (
        <p role="status" className="py-40 text-center text-body-s text-text-3">
          회원 정보를 확인하는 중입니다.
        </p>
      ) : null}
      {status === 'error' ? (
        <p role="alert" className="py-40 text-center text-body-s text-text-2">
          회원 정보를 확인하지 못했습니다. 다시 로그인해 주세요.
        </p>
      ) : null}
      {status === 'ready' && !member ? (
        <div className="py-40 text-center">
          <p role="status" className="text-body-s text-text-2">
            로그인 후 문의 내역을 확인할 수 있습니다.
          </p>
          <Link
            href="/login?redirect=%2Fmypage%2Finquiries"
            className="mt-16 inline-flex min-h-40 items-center justify-center rounded-8 bg-text-1 px-16 text-label-s text-inverse focus-ring"
          >
            로그인
          </Link>
        </div>
      ) : null}
      {member && inquiriesQuery.isPending ? (
        <p role="status" className="py-40 text-center text-body-s text-text-3">
          문의 내역을 불러오는 중입니다.
        </p>
      ) : null}
      {member && inquiriesQuery.isError ? (
        <div role="alert" className="py-40 text-center">
          <p className="text-body-s text-text-2">문의 내역을 불러오지 못했습니다.</p>
          <Button
            type="button"
            variant="secondary"
            size="s"
            onClick={() => void inquiriesQuery.refetch()}
            className="mt-12"
          >
            다시 시도
          </Button>
        </div>
      ) : null}
      {member && inquiriesQuery.isSuccess ? (
        inquiries.length === 0 ? (
          <div className="py-40 text-center">
            <p className="text-body-s text-text-3">등록된 문의가 없습니다.</p>
            <Link
              href="/support/inquiry"
              className="mt-16 inline-flex min-h-40 items-center justify-center rounded-8 bg-text-1 px-16 text-label-s text-inverse focus-ring"
            >
              문의 작성
            </Link>
          </div>
        ) : (
          <div>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-480 table-fixed border-t border-text-1">
                <thead className="border-b border-line bg-surface text-caption text-text-2">
                  <tr>
                    <th scope="col" className="w-104 px-12 py-12 text-center">
                      상태
                    </th>
                    <th scope="col" className="px-16 py-12 text-left">
                      제목
                    </th>
                    <th scope="col" className="w-144 px-12 py-12 text-center">
                      문의일
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {inquiries.map((inquiry) => (
                    <InquiryListRow key={inquiry.id} inquiry={inquiry} />
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line border-t border-text-1 lg:hidden">
              {inquiries.map((inquiry) => (
                <li key={inquiry.id} className="py-16">
                  <div className="flex items-center justify-between gap-8">
                    <InquiryStatusBadge status={inquiry.status} />
                    <time className="text-caption text-text-3">
                      {formatInquiryDate(inquiry.createdAt)}
                    </time>
                  </div>
                  <Link
                    href={`/mypage/inquiries/${encodeURIComponent(inquiry.id)}`}
                    className="mt-8 block rounded-4 text-body-s break-words focus-ring hover:underline"
                  >
                    {inquiry.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )
      ) : null}
    </MyPageShell>
  );
}

function InquiryListRow({ inquiry }: { inquiry: Inquiry }) {
  return (
    <tr className="border-b border-line">
      <td className="px-12 py-16 text-center">
        <InquiryStatusBadge status={inquiry.status} />
      </td>
      <td className="min-w-0 px-16 py-16">
        <Link
          href={`/mypage/inquiries/${encodeURIComponent(inquiry.id)}`}
          className="block truncate rounded-4 text-body-s focus-ring hover:underline"
        >
          {inquiry.title}
        </Link>
      </td>
      <td className="px-12 py-16 text-center text-body-s text-text-3">
        {formatInquiryDate(inquiry.createdAt)}
      </td>
    </tr>
  );
}

/** W-31 상세는 세션 회원의 mock 조회 결과에서만 찾고 본문을 텍스트 노드로 렌더링합니다. */
export function MemberInquiryDetailPage({ inquiryId }: { inquiryId: string }) {
  const { member, status, inquiriesQuery } = useMemberInquiries();
  const inquiry = inquiriesQuery.data?.find((item) => item.id === inquiryId);

  return (
    <MyPageShell activeSection="inquiry-detail" title="문의 상세">
      {status === 'loading' || (member && inquiriesQuery.isPending) ? (
        <p role="status" className="py-40 text-center text-body-s text-text-3">
          문의 내용을 불러오는 중입니다.
        </p>
      ) : null}
      {status === 'error' || (member && inquiriesQuery.isError) ? (
        <div role="alert" className="py-40 text-center">
          <p className="text-body-s text-text-2">문의 내용을 불러오지 못했습니다.</p>
          {member && inquiriesQuery.isError ? (
            <Button
              type="button"
              variant="secondary"
              size="s"
              onClick={() => void inquiriesQuery.refetch()}
              className="mt-12"
            >
              다시 시도
            </Button>
          ) : null}
        </div>
      ) : null}
      {status === 'ready' && !member ? (
        <p role="status" className="py-40 text-center text-body-s text-text-2">
          로그인 후 문의 내용을 확인할 수 있습니다.
        </p>
      ) : null}
      {member && inquiriesQuery.isSuccess && !inquiry ? (
        <p role="status" className="py-40 text-center text-body-s text-text-2">
          문의 내용을 찾을 수 없습니다.
        </p>
      ) : null}
      {member && inquiry ? (
        <article className="rounded-12 border border-line p-16 sm:p-24">
          <header className="border-b border-line pb-16">
            <div className="flex flex-wrap items-center justify-between gap-8">
              <InquiryStatusBadge status={inquiry.status} />
              <time className="text-caption text-text-3">
                {formatInquiryDate(inquiry.createdAt)}
              </time>
            </div>
            <h2 className="mt-12 text-h3 break-words">{inquiry.title}</h2>
          </header>
          <section aria-labelledby="inquiry-body-heading" className="py-20">
            <h3 id="inquiry-body-heading" className="text-label-m">
              문의 내용
            </h3>
            <p className="mt-8 text-body-s break-words whitespace-pre-line text-text-2">
              {inquiry.body}
            </p>
          </section>
          {inquiry.answer ? (
            <section
              aria-labelledby="inquiry-answer-heading"
              className="border-t border-line pt-20"
            >
              <h3 id="inquiry-answer-heading" className="text-label-m">
                답변
              </h3>
              <p className="mt-8 text-body-s break-words whitespace-pre-line text-text-2">
                {inquiry.answer}
              </p>
            </section>
          ) : null}
        </article>
      ) : null}
      <div className="mt-20">
        <Link href="/mypage/inquiries" className="text-label-m underline focus-ring">
          목록으로
        </Link>
      </div>
    </MyPageShell>
  );
}

function InquiryStatusBadge({ status }: { status: Inquiry['status'] }) {
  return status === 'answered' ? (
    <Badge tone="success">답변완료</Badge>
  ) : (
    <span className="rounded-capsule border border-line-strong px-10 py-4 text-caption text-text-2">
      답변대기
    </span>
  );
}
