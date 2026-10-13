import type { HTMLAttributes } from 'react';
import { cx } from '../lib/cx';

/** 배지 톤(Figma HF/Badge Type). 견적 상태 톤(dark/warning/outline/success/neutral)과 이름이 같습니다. */
export type BadgeTone =
  'neutral' | 'outline' | 'dark' | 'soldout' | 'warning' | 'success' | 'danger';

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-text-2',
  outline: 'border border-line-strong text-text-2',
  dark: 'bg-text-1 text-inverse',
  soldout: 'bg-text-2 text-inverse',
  warning: 'bg-warning-tint text-warning',
  success: 'bg-success-tint text-success',
  danger: 'bg-danger-tint text-danger',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

/** 상태 배지(radius 4) */
export function Badge({ tone = 'neutral', className, children, ...spanProps }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex h-20 shrink-0 items-center rounded-4 px-6 text-label-xs whitespace-nowrap',
        TONE_CLASS[tone],
        className,
      )}
      {...spanProps}
    >
      {children}
    </span>
  );
}
