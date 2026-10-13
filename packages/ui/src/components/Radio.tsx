import type { InputHTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  children?: ReactNode;
}

/** 라디오 버튼(Figma HF/Radio, 20px). 같은 name끼리 화살표 키로 이동합니다. */
export function Radio({ children, className, disabled, ...inputProps }: RadioProps) {
  return (
    <label
      className={cx(
        'inline-flex items-center gap-8 text-body-s text-text-1',
        disabled ? 'cursor-not-allowed text-text-disabled' : 'cursor-pointer',
        className,
      )}
    >
      <input type="radio" disabled={disabled} className="peer sr-only" {...inputProps} />
      <span
        aria-hidden="true"
        className={cx(
          'relative inline-flex size-20 shrink-0 items-center justify-center rounded-capsule border-[1.5px] border-line-control bg-bg',
          'peer-[:checked:enabled]:border-text-1 peer-checked:[&>span]:block',
          'peer-disabled:border-surface-2 peer-disabled:bg-surface-2 peer-disabled:[&>span]:bg-text-disabled',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-text-1',
        )}
      >
        <span className="hidden size-10 rounded-capsule bg-text-1" />
      </span>
      {children}
    </label>
  );
}
