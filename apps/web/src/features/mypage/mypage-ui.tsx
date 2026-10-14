import { Badge } from '@eum/ui/components/Badge';
import { Button } from '@eum/ui/components/Button';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { cx } from '@eum/ui/lib/cx';
import { CalendarDays, CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

export type LocalNotice = { tone: 'info' | 'warning'; message: string } | null;

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: 'dark' | 'warning' | 'outline' | 'success' | 'neutral' | 'danger';
}) {
  return <Badge tone={tone}>{label}</Badge>;
}

export function DividerTitle({ children }: { children: ReactNode }) {
  return <h2 className="border-b border-line-strong pb-12 text-h3">{children}</h2>;
}

export function TabBar<T extends string>({
  options,
  value,
  onChange,
  label,
  counts,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  label: string;
  counts?: Partial<Record<T, number>>;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex min-w-0 [scrollbar-width:none] overflow-x-auto border-b border-line"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cx(
            'min-h-44 shrink-0 border-b-2 px-16 text-body-s focus-ring',
            option.value === value
              ? 'border-text-1 font-medium text-text-1'
              : 'border-transparent text-text-2 hover:text-text-1',
          )}
        >
          {option.label}
          {counts ? ` ${counts[option.value] ?? 0}` : ''}
        </button>
      ))}
    </div>
  );
}

export function DateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onPreset,
  selectedPreset,
  onApply,
}: {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onPreset: (months: number) => void;
  selectedPreset?: number | null;
  onApply?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-8 rounded-12 border border-line px-12 py-12 lg:min-h-72 lg:gap-12 lg:px-20 lg:py-14">
      <span className="mr-4 text-label-s text-text-2">조회 기간</span>
      {[1, 3, 6, 12].map((months) => (
        <Button
          key={months}
          size="s"
          variant={selectedPreset === months ? 'primary' : 'secondary'}
          onClick={() => onPreset(months)}
        >
          {months === 12 ? '1년' : `${months}개월`}
        </Button>
      ))}
      <label className="flex h-40 min-w-[142px] flex-1 items-center gap-8 rounded-8 border border-line-strong px-10 focus-within:border-text-1 focus-within:ring-1 focus-within:ring-text-1">
        <span className="sr-only">시작일</span>
        <CalendarDays size={16} aria-hidden="true" className="text-text-3" />
        <input
          aria-label="시작일"
          lang="ko-KR"
          type="date"
          value={startDate}
          onChange={(event) => onStartDateChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-body-s [font-variant-numeric:tabular-nums] [color-scheme:light] outline-none"
        />
      </label>
      <span aria-hidden="true" className="text-text-3">
        ~
      </span>
      <label className="flex h-40 min-w-[142px] flex-1 items-center gap-8 rounded-8 border border-line-strong px-10 focus-within:border-text-1 focus-within:ring-1 focus-within:ring-text-1">
        <span className="sr-only">종료일</span>
        <CalendarDays size={16} aria-hidden="true" className="text-text-3" />
        <input
          aria-label="종료일"
          lang="ko-KR"
          type="date"
          value={endDate}
          onChange={(event) => onEndDateChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-body-s [font-variant-numeric:tabular-nums] [color-scheme:light] outline-none"
        />
      </label>
      {onApply ? (
        <Button size="s" variant="primary" onClick={onApply} className="shrink-0">
          조회
        </Button>
      ) : null}
    </div>
  );
}

export function NoticeResult({ notice }: { notice: LocalNotice }) {
  return notice ? (
    <NoticeInline tone={notice.tone} role="status" className="mt-16" aria-live="polite">
      {notice.message}
    </NoticeInline>
  ) : null;
}

export function PageLoadingState() {
  return (
    <div role="status" className="space-y-16" aria-label="마이페이지 정보를 불러오는 중">
      <div className="h-96 animate-pulse rounded-12 bg-surface" />
      <div className="h-180 animate-pulse rounded-12 bg-surface" />
      <span className="sr-only">마이페이지 정보를 불러오는 중입니다.</span>
    </div>
  );
}

export function PageErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-12 border border-line p-24 text-center">
      <CircleAlert size={28} aria-hidden="true" className="mx-auto text-danger" />
      <p className="mt-12 text-h3">정보를 불러오지 못했습니다.</p>
      <p className="mt-8 text-body-s text-text-2">잠시 후 다시 시도해 주세요.</p>
      <Button className="mt-20" onClick={onRetry}>
        다시 불러오기
      </Button>
    </div>
  );
}
