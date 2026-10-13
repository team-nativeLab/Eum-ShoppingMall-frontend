import { ArrowRight } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../lib/cx';
import { Icon } from './Icon';

/** 캡슐 버튼 className(히어로 CTA). 링크에 같은 모양을 줄 때 씁니다. */
export const capsuleButtonClassName =
  'inline-flex h-40 shrink-0 items-center gap-6 whitespace-nowrap rounded-capsule bg-text-1 px-20 text-label-m text-inverse transition-colors focus-ring hover:bg-pressed-dark';

export interface ButtonCapsuleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 오른쪽 화살표 표시 여부(Figma 기본은 표시) */
  hasArrow?: boolean;
}

/** 캡슐형 CTA 버튼(Figma HF/Button Capsule) */
export function ButtonCapsule({
  hasArrow = true,
  className,
  type = 'button',
  children,
  ...buttonProps
}: ButtonCapsuleProps) {
  return (
    <button type={type} className={cx(capsuleButtonClassName, className)} {...buttonProps}>
      {children}
      {hasArrow ? <Icon icon={ArrowRight} size={16} /> : null}
    </button>
  );
}
