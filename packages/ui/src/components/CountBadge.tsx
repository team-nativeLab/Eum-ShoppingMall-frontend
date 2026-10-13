import { cx } from '../lib/cx';

export interface CountBadgeProps {
  count: number;
  /** 이 값을 넘으면 "99+"처럼 줄여 보여 줍니다 */
  max?: number;
  /** 스크린리더용 설명. 예: "장바구니 상품 3개". 없으면 숫자만 읽습니다. */
  label?: string;
  className?: string;
}

/** 숫자 배지(Figma HF/CountBadge). 0 이하이면 그리지 않습니다. */
export function CountBadge({ count, max = 99, label, className }: CountBadgeProps) {
  if (count <= 0) return null;
  const displayCount = count > max ? `${max}+` : String(count);
  return (
    <span
      className={cx(
        'inline-flex h-16 min-w-16 items-center justify-center rounded-capsule bg-text-1 px-4 text-label-xs text-inverse',
        className,
      )}
    >
      <span aria-hidden={label ? true : undefined}>{displayCount}</span>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
