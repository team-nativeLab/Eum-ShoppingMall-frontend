import { X } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../lib/cx';
import { Icon } from './Icon';

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> {
  isSelected?: boolean;
}

/** 선택형 칩(Figma HF/Chip). 선택 상태를 aria-pressed로 알립니다. */
export function Chip({
  isSelected = false,
  className,
  type = 'button',
  children,
  ...buttonProps
}: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={isSelected}
      className={cx(
        'inline-flex h-36 shrink-0 items-center rounded-capsule px-14 text-label-m whitespace-nowrap focus-ring transition-colors disabled:cursor-not-allowed disabled:text-text-disabled',
        isSelected
          ? 'bg-text-1 text-inverse'
          : 'border border-line-strong bg-bg text-text-2 enabled:hover:bg-surface enabled:active:bg-surface',
        className,
      )}
      {...buttonProps}
    >
      {children}
    </button>
  );
}

export interface RemovableChipProps {
  label: string;
  onRemove: () => void;
  className?: string;
}

/** 지울 수 있는 칩(Figma HF/Chip State=Removable). 적용된 필터 표시에 씁니다. */
export function RemovableChip({ label, onRemove, className }: RemovableChipProps) {
  return (
    <span
      className={cx(
        'inline-flex h-36 shrink-0 items-center gap-4 rounded-capsule bg-surface pr-10 pl-14 text-label-m whitespace-nowrap text-text-1',
        className,
      )}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${label} 삭제`}
        className="inline-flex size-20 items-center justify-center rounded-capsule focus-ring hover:bg-surface-2"
      >
        <Icon icon={X} size={14} />
      </button>
    </span>
  );
}
