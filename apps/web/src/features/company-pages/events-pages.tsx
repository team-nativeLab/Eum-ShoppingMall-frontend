'use client';

import { getApiFailureKind } from '@eum/api/errors';
import { queryKeys } from '@eum/api/query-keys';
import type { ShopEvent, ShopEventStatus } from '@eum/api/types';
import { Badge } from '@eum/ui/components/Badge';
import { Button } from '@eum/ui/components/Button';
import { EmptyState } from '@eum/ui/components/EmptyState';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { PageContainer } from '@/components/page-container';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { getShopApi } from '@/lib/shop-api';

const EVENT_FILTERS: { value: ShopEventStatus | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'ongoing', label: '진행중' },
  { value: 'upcoming', label: '진행예정' },
  { value: 'ended', label: '종료' },
];

const EVENT_STATUS: Record<
  ShopEventStatus,
  { label: string; tone: 'success' | 'warning' | 'neutral' }
> = {
  ongoing: { label: '진행중', tone: 'success' },
  upcoming: { label: '진행예정', tone: 'warning' },
  ended: { label: '종료', tone: 'neutral' },
};

function formatEventDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '일정 미제공';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
  }).format(date);
}

function EventBanner({ event, compact = false }: { event: ShopEvent; compact?: boolean }) {
  return (
    <div
      className={`relative isolate overflow-hidden rounded-12 bg-text-1 text-inverse ${compact ? 'min-h-192 p-20 lg:min-h-240 lg:p-32' : 'min-h-288 p-24 lg:min-h-400 lg:p-64'}`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-br from-text-1 via-pressed-dark to-text-1 opacity-90"
      />
      <p className="text-overline text-inverse-2 uppercase">{event.eyebrow}</p>
      <h2
        className={`mt-12 max-w-720 leading-tight font-bold whitespace-pre-line ${compact ? 'text-h2 lg:text-web-h2' : 'text-h1 lg:text-web-display-l'}`}
      >
        {event.heroTitle.join('\n')}
      </h2>
      <p className="mt-12 max-w-560 text-body-m text-inverse-2 lg:mt-20 lg:text-body-l">
        {event.heroDescription}
      </p>
    </div>
  );
}

function EventCard({ event }: { event: ShopEvent }) {
  const status = EVENT_STATUS[event.status];
  return (
    <article className="overflow-hidden rounded-12 border border-line bg-bg transition-shadow hover:shadow-2">
      <Link
        href={`/events/${encodeURIComponent(event.id)}`}
        className="group block rounded-12 focus-ring"
      >
        <EventBanner event={event} compact />
        <div className="p-20 lg:p-24">
          <div className="flex flex-wrap items-center justify-between gap-8">
            <Badge tone={status.tone}>{status.label}</Badge>
            <span className="text-caption text-text-3">
              {formatEventDate(event.startAt)} – {formatEventDate(event.endAt)}
            </span>
          </div>
          <h3 className="mt-12 text-h3 group-hover:underline">{event.title}</h3>
          <p className="mt-8 line-clamp-2 text-body-s text-text-2">{event.subtitle}</p>
        </div>
      </Link>
    </article>
  );
}

export function EventsPage() {
  const [filter, setFilter] = useState<ShopEventStatus | 'all'>('all');
  const eventsQuery = useQuery({
    queryKey: queryKeys.events.all,
    queryFn: async ({ signal }) => (await getShopApi()).events.list({ signal }),
  });
  const events = (eventsQuery.data ?? []).filter(
    (event) => filter === 'all' || event.status === filter,
  );

  return (
    <PageContainer className="px-16 pt-24 pb-64 sm:px-20 lg:pt-40 lg:pb-80">
      <header className="mb-24 flex flex-col gap-8 lg:mb-32">
        <p className="text-caption text-text-3">이음산업건설</p>
        <h1 className="text-h1 lg:text-web-h2">이벤트</h1>
        <p className="max-w-560 text-body-m text-text-2">현장에 필요한 상품과 소식을 만나보세요.</p>
      </header>
      <nav
        aria-label="이벤트 상태"
        className="mb-24 flex gap-8 overflow-x-auto border-b border-line pb-12"
      >
        {EVENT_FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
            className={`min-h-40 shrink-0 rounded-capsule border px-16 text-label-m focus-ring ${filter === item.value ? 'border-text-1 bg-text-1 text-inverse' : 'border-line text-text-2'}`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {eventsQuery.isPending ? (
        <div role="status" className="grid gap-16 sm:grid-cols-2 lg:grid-cols-3">
          <span className="sr-only">이벤트를 불러오는 중입니다.</span>
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-320 animate-pulse rounded-12 bg-surface" />
          ))}
        </div>
      ) : eventsQuery.isError ? (
        <NoticeInline tone="danger" role="alert">
          <div className="flex flex-wrap items-center justify-between gap-12">
            <span>
              {getApiFailureKind(eventsQuery.error) === 'notImplemented'
                ? '이벤트를 준비하고 있습니다.'
                : '이벤트를 불러오지 못했습니다.'}
            </span>
            {getApiFailureKind(eventsQuery.error) !== 'notImplemented' ? (
              <Button size="s" variant="secondary" onClick={() => void eventsQuery.refetch()}>
                다시 시도
              </Button>
            ) : null}
          </div>
        </NoticeInline>
      ) : events.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={filter === 'all' ? '등록된 이벤트가 없습니다' : '해당하는 이벤트가 없습니다'}
          description="다른 상태를 선택해 다시 확인해 주세요."
        />
      ) : (
        <ul className="grid gap-16 sm:grid-cols-2 lg:grid-cols-3 lg:gap-24">
          {events.map((event) => (
            <li key={event.id}>
              <EventCard event={event} />
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}

export function EventDetailPage({ eventId }: { eventId: string }) {
  const eventQuery = useQuery({
    queryKey: queryKeys.events.detail(eventId),
    queryFn: async ({ signal }) => (await getShopApi()).events.getById(eventId, { signal }),
    enabled: eventId.length > 0,
  });

  return (
    <PageContainer className="px-16 pt-24 pb-64 sm:px-20 lg:pt-40 lg:pb-80">
      <nav aria-label="현재 위치" className="mb-20 text-caption text-text-3">
        <Link href="/events" className="rounded-4 focus-ring">
          이벤트
        </Link>
        <span aria-hidden="true" className="px-8">
          /
        </span>
        <span aria-current="page">상세</span>
      </nav>
      {eventQuery.isPending ? (
        <div role="status" className="h-400 animate-pulse rounded-12 bg-surface">
          이벤트를 불러오는 중입니다.
        </div>
      ) : null}
      {eventQuery.isError ? (
        <NoticeInline
          tone={getApiFailureKind(eventQuery.error) === 'notFound' ? 'info' : 'danger'}
          role="alert"
        >
          <div className="flex flex-col items-start gap-12">
            <p>
              {getApiFailureKind(eventQuery.error) === 'notFound'
                ? '요청하신 이벤트를 찾을 수 없습니다.'
                : getApiFailureKind(eventQuery.error) === 'notImplemented'
                  ? '이벤트 상세를 준비하고 있습니다.'
                  : '이벤트를 불러오지 못했습니다.'}
            </p>
            {getApiFailureKind(eventQuery.error) === 'temporary' ? (
              <Button size="s" variant="secondary" onClick={() => void eventQuery.refetch()}>
                다시 시도
              </Button>
            ) : null}
            <Link href="/events" className="rounded-4 text-label-m underline focus-ring">
              이벤트 목록으로
            </Link>
          </div>
        </NoticeInline>
      ) : eventQuery.data ? (
        <EventContent event={eventQuery.data} />
      ) : null}
    </PageContainer>
  );
}

function EventContent({ event }: { event: ShopEvent }) {
  const status = EVENT_STATUS[event.status];
  return (
    <article>
      <EventBanner event={event} />
      <div className="mx-auto max-w-840">
        <div className="flex flex-wrap items-center justify-between gap-12 border-b border-line py-20">
          <div className="flex items-center gap-8">
            <Badge tone={status.tone}>{status.label}</Badge>
            <span className="text-body-s">{event.title}</span>
          </div>
          <span className="inline-flex items-center gap-6 text-caption text-text-3">
            <CalendarDays size={16} aria-hidden="true" />
            {formatEventDate(event.startAt)} – {formatEventDate(event.endAt)}
          </span>
        </div>
        <p className="py-24 text-body-l whitespace-pre-line text-text-2">{event.body}</p>
        <div className="divide-y divide-line border-y border-line">
          {event.sections.map((section, index) => (
            <section key={`${section.heading}-${index}`} className="py-24">
              <h2 className="text-h3">{section.heading}</h2>
              <p className="mt-8 text-body-m whitespace-pre-line text-text-2">{section.body}</p>
            </section>
          ))}
        </div>
        <div className="mt-32 flex flex-wrap justify-center gap-8">
          <Link
            href={`/search?q=${encodeURIComponent(event.searchKeyword)}`}
            className="inline-flex min-h-48 items-center rounded-8 bg-text-1 px-20 text-label-m text-inverse focus-ring"
          >
            관련 상품 보기
          </Link>
          <Link
            href="/events"
            className="inline-flex min-h-48 items-center rounded-8 border border-line-strong px-20 text-label-m focus-ring"
          >
            목록으로
          </Link>
        </div>
      </div>
    </article>
  );
}
