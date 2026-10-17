'use client';

import { queryKeys } from '@eum/api/query-keys';
import { getApiFailureKind } from '@eum/api/errors';
import type { Notice } from '@eum/api/types';
import { Button } from '@eum/ui/components/Button';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { Download, Paperclip } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ProductImage } from '@/features/products/product-image';
import { getShopApi } from '@/lib/shop-api';
import { SupportShell } from './support-shell';

function formatNoticeDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '날짜 미제공';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
  }).format(parsed);
}

function getValidNoticeDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    dateTime: value,
    label: new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Seoul',
    }).format(parsed),
  };
}

function formatAttachmentSize(sizeBytes: number) {
  return `${(Math.max(0, sizeBytes) / (1024 * 1024)).toFixed(1)}MB`;
}

function getSafeDownloadUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value, 'https://eum.invalid');
    return url.protocol === 'http:' || url.protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

function NoticeDetailContent({
  notice,
  previous,
  next,
}: {
  notice: Notice;
  previous?: Notice;
  next?: Notice;
}) {
  const previousDate = previous ? getValidNoticeDate(previous.publishedAt) : null;
  const nextDate = next ? getValidNoticeDate(next.publishedAt) : null;
  return (
    <article>
      <header className="border-y border-line py-20">
        <div className="flex flex-wrap items-center gap-8">
          {notice.isPinned ? (
            <span className="rounded-4 bg-text-1 px-8 py-4 text-caption text-inverse">공지</span>
          ) : null}
          <h1 className="min-w-0 flex-1 text-h3">{notice.title}</h1>
        </div>
        <dl className="mt-12 flex flex-wrap gap-x-16 gap-y-4 text-caption text-text-3">
          <div className="flex gap-4">
            <dt>등록일</dt>
            <dd>{formatNoticeDate(notice.publishedAt)}</dd>
          </div>
          <div className="flex gap-4">
            <dt>조회</dt>
            <dd>{notice.viewCount ?? '—'}</dd>
          </div>
        </dl>
      </header>
      <div className="min-h-240 border-b border-line py-24 lg:min-h-320 lg:py-40">
        <div className="space-y-24">
          <p className="text-body-m whitespace-pre-line text-text-2">{notice.body}</p>
          {notice.bodyImage ? (
            <figure className="aspect-video w-full max-w-[466px] overflow-hidden rounded-4">
              <ProductImage
                src={notice.bodyImage.src}
                alt={notice.bodyImage.alt}
                className="rounded-4"
              />
            </figure>
          ) : null}
          {notice.attachments?.length ? (
            <section
              aria-labelledby="notice-attachments-heading"
              className="w-full max-w-[526px] rounded-8 bg-bg-subtle p-16"
            >
              <h2 id="notice-attachments-heading" className="text-label-m text-text-1">
                첨부파일 {notice.attachments.length}
              </h2>
              <ul className="mt-12 space-y-8">
                {notice.attachments.map((attachment) => {
                  const downloadUrl = getSafeDownloadUrl(attachment.downloadUrl);
                  return (
                    <li
                      key={attachment.id}
                      className="flex min-h-40 items-center gap-12 text-body-s"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-8">
                        <Paperclip aria-hidden="true" size={16} className="shrink-0 text-text-3" />
                        <span className="truncate text-text-1">{attachment.fileName}</span>
                      </span>
                      <span className="shrink-0 text-caption text-text-3">
                        {formatAttachmentSize(attachment.sizeBytes)}
                      </span>
                      {downloadUrl ? (
                        <a
                          href={downloadUrl}
                          download
                          aria-label={`${attachment.fileName} 다운로드`}
                          className="inline-flex size-32 shrink-0 items-center justify-center rounded-4 text-text-2 focus-ring hover:bg-surface"
                        >
                          <Download aria-hidden="true" size={16} />
                        </a>
                      ) : (
                        <span
                          aria-hidden="true"
                          className="inline-flex size-32 shrink-0 items-center justify-center text-text-2"
                        >
                          <Download size={16} />
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
      <nav aria-label="이전·다음 공지" className="border-b border-line text-body-s">
        <div className="grid min-h-56 grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-12 border-b border-line px-8">
          <span className="text-text-3">이전글</span>
          {previous ? (
            <Link
              href={`/support/notices/${encodeURIComponent(previous.id)}`}
              className="truncate rounded-4 focus-ring"
            >
              {previous.title}
            </Link>
          ) : (
            <span className="text-text-3">이전글이 없습니다.</span>
          )}
          {previousDate ? (
            <time dateTime={previousDate.dateTime} className="text-caption text-text-3">
              {previousDate.label}
            </time>
          ) : null}
        </div>
        <div className="grid min-h-56 grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-12 px-8">
          <span className="text-text-3">다음글</span>
          {next ? (
            <Link
              href={`/support/notices/${encodeURIComponent(next.id)}`}
              className="truncate rounded-4 focus-ring"
            >
              {next.title}
            </Link>
          ) : (
            <span className="text-text-3">다음글이 없습니다.</span>
          )}
          {nextDate ? (
            <time dateTime={nextDate.dateTime} className="text-caption text-text-3">
              {nextDate.label}
            </time>
          ) : null}
        </div>
      </nav>
      <div className="mt-24 flex justify-center">
        <Link
          href="/support/notices"
          className="inline-flex min-h-48 items-center rounded-8 border border-line-strong px-20 text-label-m focus-ring"
        >
          목록으로
        </Link>
      </div>
    </article>
  );
}

export function NoticeDetailPage({ noticeId }: { noticeId: string }) {
  const noticesQuery = useQuery({
    queryKey: queryKeys.notices.all,
    queryFn: async ({ signal }) => (await getShopApi()).notices.list({ signal }),
    enabled: noticeId.length > 0,
  });
  const notices = [...(noticesQuery.data ?? [])].sort((left, right) =>
    right.publishedAt.localeCompare(left.publishedAt),
  );
  const index = notices.findIndex((notice) => notice.id === noticeId);
  const notice = index < 0 ? undefined : notices[index];

  return (
    <SupportShell activePath="/support/notices">
      {noticesQuery.isPending ? (
        <p role="status" className="py-56 text-center text-body-s text-text-3">
          공지사항을 불러오는 중입니다.
        </p>
      ) : null}
      {noticesQuery.isError ? (
        <NoticeInline tone="danger" role="alert">
          <div className="flex flex-wrap items-center justify-between gap-12">
            <span>
              {getApiFailureKind(noticesQuery.error) === 'notImplemented'
                ? '공지사항 기능을 준비하고 있습니다.'
                : '공지사항을 불러오지 못했습니다.'}
            </span>
            {getApiFailureKind(noticesQuery.error) === 'temporary' ? (
              <Button size="s" variant="secondary" onClick={() => void noticesQuery.refetch()}>
                다시 시도
              </Button>
            ) : null}
          </div>
        </NoticeInline>
      ) : null}
      {noticesQuery.isSuccess && !notice ? (
        <section className="py-56 text-center" aria-labelledby="notice-missing-heading">
          <h1 id="notice-missing-heading" className="text-h3">
            요청하신 공지사항을 찾을 수 없습니다.
          </h1>
          <p className="mt-8 text-body-s text-text-2">
            삭제되었거나 주소가 올바르지 않을 수 있습니다.
          </p>
          <Link
            href="/support/notices"
            className="mt-24 inline-flex min-h-48 items-center rounded-8 border border-line-strong px-20 text-label-m focus-ring"
          >
            목록으로
          </Link>
        </section>
      ) : null}
      {notice ? (
        <NoticeDetailContent
          notice={notice}
          previous={notices[index + 1]}
          next={notices[index - 1]}
        />
      ) : null}
    </SupportShell>
  );
}
