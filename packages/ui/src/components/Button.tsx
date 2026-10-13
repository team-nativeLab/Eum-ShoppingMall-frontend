import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'l' | 'm' | 's';

const SIZE_CLASS: Record<ButtonSize, string> = {
  l: 'h-56 px-20 text-label-l',
  m: 'h-48 px-16 text-label-m',
  s: 'h-36 px-12 text-label-m',
};

// Figma HF/Button: Hover는 Pressed와 같은 시각, Focus는 2px 외곽선.
// hover·active는 비활성이 아닐 때만 적용합니다(not-disabled·not-aria-disabled).
// <a>에는 :disabled가 없으므로 링크도 hover가 동작합니다.
// aria-disabled="true"는 시각 표시(회색·포인터 차단)만 바꿉니다. 키보드 이동·Enter 동작까지 막지는 않으므로
// 실제 차단은 호출부 책임입니다(onClick에서 preventDefault, 또는 링크 대신 비활성 <button>/<span>으로 렌더).
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: cx(
    'bg-text-1 text-inverse focus-ring',
    'hover:not-disabled:not-aria-disabled:bg-pressed-dark active:not-disabled:not-aria-disabled:bg-pressed-dark',
    'disabled:bg-surface-2 disabled:text-text-disabled aria-disabled:bg-surface-2 aria-disabled:text-text-disabled',
  ),
  secondary: cx(
    'border border-line-strong bg-bg text-text-1 focus-ring',
    'hover:not-disabled:not-aria-disabled:bg-surface active:not-disabled:not-aria-disabled:bg-surface',
    'disabled:border-line disabled:text-text-disabled aria-disabled:border-line aria-disabled:text-text-disabled',
  ),
  ghost: cx(
    'bg-transparent text-text-1 focus-ring',
    'hover:not-disabled:not-aria-disabled:bg-surface active:not-disabled:not-aria-disabled:bg-surface',
    'disabled:text-text-disabled aria-disabled:text-text-disabled',
  ),
  danger: cx(
    'bg-danger text-inverse focus-ring-danger',
    'hover:not-disabled:not-aria-disabled:bg-danger-pressed active:not-disabled:not-aria-disabled:bg-danger-pressed',
    'disabled:bg-surface-2 disabled:text-text-disabled aria-disabled:bg-surface-2 aria-disabled:text-text-disabled',
  ),
};

/** 버튼 모양 옵션 */
export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isFullWidth?: boolean;
}

/**
 * 버튼 모양 className을 만드는 함수.
 * 링크(Next Link, react-router Link)를 버튼처럼 보이게 할 때 이 함수를 씁니다.
 */
export function buttonClassName({
  variant = 'primary',
  size = 'm',
  isFullWidth = false,
}: ButtonStyleOptions = {}): string {
  return cx(
    'inline-flex shrink-0 items-center justify-center gap-6 rounded-8 whitespace-nowrap transition-colors disabled:cursor-not-allowed aria-disabled:pointer-events-none',
    SIZE_CLASS[size],
    VARIANT_CLASS[variant],
    isFullWidth && 'w-full',
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleOptions {
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

/** 공통 버튼(Figma HF/Button). 기본 type은 "button"이라 폼 안에서 의도치 않게 제출되지 않습니다. */
export function Button({
  variant,
  size,
  isFullWidth,
  leadingIcon,
  trailingIcon,
  className,
  type = 'button',
  children,
  ...buttonProps
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(buttonClassName({ variant, size, isFullWidth }), className)}
      {...buttonProps}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}
