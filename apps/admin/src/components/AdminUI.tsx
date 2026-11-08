import { AlertCircle, CalendarDays, LoaderCircle } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { Badge, type BadgeTone } from '@eum/ui/components/Badge';
import { Button } from '@eum/ui/components/Button';
import { Icon } from '@eum/ui/components/Icon';
import { Link } from 'react-router';
import { QUOTE_STATUS_META } from '@eum/api/quote-status';
import { cx } from '@eum/ui/lib/cx';

export const adminPanelClassName = 'rounded-12 border border-line bg-bg';

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  leading?: ReactNode;
  titleAdornment?: ReactNode;
  descriptionPlacement?: 'inline' | 'below';
}

/** 관리자 화면의 페이지 제목과 주 작업을 정렬합니다. */
export function AdminPageHeader({
  title,
  description,
  action,
  leading,
  titleAdornment,
  descriptionPlacement = 'below',
}: AdminPageHeaderProps) {
  return (
    <div className="mb-24 flex items-start justify-between gap-24">
      <div className="flex min-w-0 items-center gap-12">
        {leading}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-12">
            <h1 className="text-h1">{title}</h1>
            {titleAdornment}
            {description && descriptionPlacement === 'inline' ? (
              <p className="text-caption text-text-3">{description}</p>
            ) : null}
          </div>
          {description && descriptionPlacement === 'below' ? (
            <p className="mt-4 text-body-s text-text-3">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-8">{action}</div> : null}
    </div>
  );
}

interface AdminPanelProps {
  id?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** 제목과 본문 구성이 반복되는 관리자 패널입니다. */
export function AdminPanel({
  id,
  title,
  description,
  action,
  children,
  className = '',
  bodyClassName = '',
}: AdminPanelProps) {
  return (
    <section id={id} className={cx(adminPanelClassName, className)}>
      {title || description || action ? (
        <div className="flex items-start justify-between gap-16 px-24 pt-24">
          <div>
            {title ? <h2 className="text-h3">{title}</h2> : null}
            {description ? <p className="mt-4 text-caption text-text-3">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

interface AdminCountTileProps {
  label: string;
  value: string | number;
  href: string;
  emphasis?: boolean;
  hint?: string;
}

/** 대시보드 통계를 해당 목록으로 연결합니다. */
export function AdminCountTile({
  label,
  value,
  href,
  emphasis = false,
  hint,
}: AdminCountTileProps) {
  return (
    <Link
      to={href}
      className={`${adminPanelClassName} flex min-h-96 flex-col justify-between p-16 focus-ring transition-colors hover:bg-surface`}
    >
      <span className="text-body-s text-text-2">{label}</span>
      <span className="text-h2">{value}</span>
      <span className="flex items-center justify-between gap-8 text-caption text-text-3">
        <span>{hint ?? '목록 보기'}</span>
        {emphasis ? (
          <span aria-hidden="true" className="size-6 rounded-capsule bg-warning" />
        ) : null}
      </span>
    </Link>
  );
}

interface AdminNoticeProps {
  id?: string;
  children: ReactNode;
  tone?: 'info' | 'warning' | 'error';
  className?: string;
  action?: ReactNode;
}

/** API 미지원 등 다음 단계가 필요한 내용을 현재 화면의 상태로 안내합니다. */
export function AdminNotice({
  id,
  children,
  tone = 'info',
  className = '',
  action,
}: AdminNoticeProps) {
  const toneClassName =
    tone === 'warning'
      ? 'border-warning-tint bg-warning-tint text-warning'
      : tone === 'error'
        ? 'border-danger-tint bg-danger-tint text-danger'
        : 'border-info-tint bg-info-tint text-info';
  return (
    <div
      id={id}
      className={`flex items-start gap-8 rounded-8 border px-12 py-10 text-body-s ${toneClassName} ${className}`}
    >
      <Icon icon={AlertCircle} size={16} className="mt-2 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-8">
        <p>{children}</p>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

interface AdminLoadingProps {
  label?: string;
}

/** 요청이 끝나기 전 화면에 표시하는 읽기 전용 로딩 상태입니다. */
export function AdminLoading({ label = '화면을 불러오고 있습니다.' }: AdminLoadingProps) {
  return (
    <div
      role="status"
      className={`${adminPanelClassName} flex min-h-240 flex-col items-center justify-center gap-12 text-body-s text-text-2`}
    >
      <Icon icon={LoaderCircle} size={24} className="animate-spin" />
      <span>{label}</span>
    </div>
  );
}

interface AdminErrorProps {
  title?: string;
  description?: string;
  onRetry: () => void;
}

/** 조회에 실패하면 재시도 방법을 함께 보여 줍니다. */
export function AdminError({
  title = '정보를 불러오지 못했습니다',
  description = '잠시 후 다시 시도해 주세요.',
  onRetry,
}: AdminErrorProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`${adminPanelClassName} flex min-h-240 flex-col items-center justify-center px-24 py-32 text-center`}
    >
      <Icon icon={AlertCircle} size={24} className="text-danger" />
      <h2 className="mt-12 text-title">{title}</h2>
      <p className="mt-8 text-body-s text-text-3">{description}</p>
      <Button className="mt-20" variant="secondary" size="s" onClick={onRetry}>
        다시 불러오기
      </Button>
    </div>
  );
}

interface AdminEmptyProps {
  title: string;
  description?: string;
  className?: string;
}

/** 조회 결과가 없을 때 테이블 자리에 표시합니다. */
export function AdminEmpty({ title, description, className = '' }: AdminEmptyProps) {
  return (
    <div
      className={`flex min-h-160 flex-col items-center justify-center px-24 py-32 text-center ${className}`}
    >
      <p className="text-title">{title}</p>
      {description ? <p className="mt-8 text-body-s text-text-3">{description}</p> : null}
    </div>
  );
}

export interface AdminTabOption<TValue extends string> {
  value: TValue;
  label: string;
  count?: number;
}

interface AdminTabsProps<TValue extends string> {
  label: string;
  options: readonly AdminTabOption<TValue>[];
  value: TValue;
  onChange: (nextValue: TValue) => void;
}

/** 단일 선택 필터 버튼 묶음으로 현재 선택을 스크린리더에 전달합니다. */
export function AdminTabs<TValue extends string>({
  label,
  options,
  value,
  onChange,
}: AdminTabsProps<TValue>) {
  return (
    <div role="group" aria-label={label} className="flex border-b border-line">
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            className={`relative -mb-px flex h-44 items-center gap-6 border-b-2 px-12 text-body-s focus-ring ${
              isSelected
                ? 'border-text-1 text-text-1'
                : 'border-transparent text-text-2 hover:text-text-1'
            }`}
            onClick={() => onChange(option.value)}
          >
            <span>{option.label}</span>
            {option.count !== undefined ? (
              <span className="text-caption text-text-3">{option.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Date 필터용으로 ISO 시각을 브라우저의 현지 날짜로 변환합니다. */
export function getAdminLocalDateKey(dateValue: string): string {
  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) return '';
  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const day = String(parsedDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 입력 날짜를 브라우저 로케일과 무관하게 YYYY.MM.DD로 보이게 합니다. */
export function formatAdminDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4)}`;
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
}

/** YYYY.MM.DD 입력을 현지 달력 기준 비교용 YYYY-MM-DD 키로 변환합니다. */
export function parseAdminDateInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 8) return '';

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysByMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > (daysByMonth[month - 1] ?? 0)) return '';

  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/** 빈 값은 선택 사항으로 허용하고, 값이 있는 잘못된 날짜만 감지합니다. */
export function isInvalidAdminDateInput(value: string): boolean {
  return value.trim() !== '' && parseAdminDateInput(value) === '';
}

interface AdminDateInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  invalid?: boolean;
  errorMessageId?: string;
}

/** Dotted 날짜 입력과 키보드로 열 수 있는 브라우저 달력 버튼을 제공합니다. */
export function AdminDateInput({
  label,
  value,
  onChange,
  className = '',
  invalid = false,
  errorMessageId,
}: AdminDateInputProps) {
  const nativeDateInputRef = useRef<HTMLInputElement>(null);

  const openDatePicker = () => {
    const nativeDateInput = nativeDateInputRef.current;
    if (!nativeDateInput) return;

    if (typeof nativeDateInput.showPicker === 'function') {
      try {
        nativeDateInput.showPicker();
        return;
      } catch {
        // Some browsers reject showPicker for a visually hidden input; use the native click fallback.
      }
    }
    nativeDateInput.click();
  };

  return (
    <div className={`relative flex h-32 items-center ${className}`}>
      <input
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorMessageId : undefined}
        type="text"
        inputMode="numeric"
        maxLength={10}
        placeholder="0000.00.00"
        value={value}
        onChange={(event) => onChange(formatAdminDateInput(event.target.value))}
        className="h-full w-full min-w-0 bg-transparent pr-28 text-body-s text-text-1 placeholder:text-text-3"
      />
      <button
        type="button"
        aria-label={`${label} 달력 열기`}
        title={`${label} 달력 열기`}
        onClick={openDatePicker}
        className="absolute top-1/2 right-2 z-10 flex size-28 -translate-y-1/2 items-center justify-center rounded-4 text-text-3 focus-ring hover:bg-surface hover:text-text-1"
      >
        <Icon icon={CalendarDays} size={16} />
      </button>
      <input
        ref={nativeDateInputRef}
        aria-hidden="true"
        tabIndex={-1}
        type="date"
        value={parseAdminDateInput(value)}
        onChange={(event) => onChange(formatAdminDateInput(event.target.value))}
        className="pointer-events-none absolute top-1/2 right-2 size-28 -translate-y-1/2 opacity-0"
      />
    </div>
  );
}

const QUOTE_STATUS: Record<string, { label: string; tone: BadgeTone }> = QUOTE_STATUS_META;

const ORDER_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  paymentPending: { label: '결제대기', tone: 'warning' },
  paid: { label: '결제완료', tone: 'warning' },
  preparing: { label: '배송준비', tone: 'outline' },
  shipping: { label: '배송중', tone: 'outline' },
  delivered: { label: '배송완료', tone: 'success' },
  canceled: { label: '취소·반품', tone: 'neutral' },
};

const PRODUCT_STOCK_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  inStock: { label: '판매중', tone: 'success' },
  soldOut: { label: '품절', tone: 'danger' },
};

interface AdminStatusBadgeProps {
  status: string;
  kind: 'quote' | 'order' | 'product';
}

/** 도메인 상태를 기존 공통 Badge 톤으로 표시합니다. */
export function AdminStatusBadge({ status, kind }: AdminStatusBadgeProps) {
  const labels =
    kind === 'quote' ? QUOTE_STATUS : kind === 'order' ? ORDER_STATUS : PRODUCT_STOCK_STATUS;
  const statusPresentation = labels[status] ?? { label: status, tone: 'neutral' as const };
  return <Badge tone={statusPresentation.tone}>{statusPresentation.label}</Badge>;
}

/** ISO 날짜를 Admin 목록의 연·월·일 형식으로 보여 줍니다. */
export function formatAdminDate(dateValue: string): string {
  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) return '날짜 정보 없음';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(parsedDate)
    .replaceAll(' ', '')
    .replaceAll('.', '.')
    .replace(/\.$/, '');
}

/** ISO 날짜를 날짜와 시간으로 표시합니다. */
export function formatAdminDateTime(dateValue: string): string {
  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) return '날짜 정보 없음';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(parsedDate);
}

/** 원 단위 금액을 로캘에 맞춰 표시합니다. */
export function formatAdminCurrency(amount: number): string {
  return `₩${new Intl.NumberFormat('ko-KR').format(amount)}`;
}
