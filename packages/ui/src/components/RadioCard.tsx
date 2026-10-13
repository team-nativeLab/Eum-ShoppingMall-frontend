import type { InputHTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface RadioCardProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  children: ReactNode;
}

/** 카드형 라디오(Figma HF/RadioCard, h56 · r8). 결제 수단 선택 등에 씁니다. */
export function RadioCard({ children, className, disabled, ...inputProps }: RadioCardProps) {
  return (
    <label
      className={cx(
        'relative flex min-w-0',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        className,
      )}
    >
      <input type="radio" disabled={disabled} className="peer sr-only" {...inputProps} />
      <span
        className={cx(
          'flex h-56 w-full items-center justify-center rounded-8 border border-line-strong bg-bg px-16 text-body-s-medium text-text-2 transition-colors',
          'peer-[:checked:enabled]:border-text-1 peer-[:checked:enabled]:text-text-1 peer-[:checked:enabled]:ring-[0.5px] peer-[:checked:enabled]:ring-text-1 peer-[:checked:enabled]:ring-inset',
          // 비활성+선택은 선택 링 없이 회색으로만 보여 줍니다(Checkbox·Radio와 같은 :checked:enabled 패턴).
          'peer-disabled:border-line peer-disabled:text-text-disabled',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-text-1',
        )}
      >
        {children}
      </span>
    </label>
  );
}
