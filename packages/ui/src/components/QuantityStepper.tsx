import { Minus, Plus } from 'lucide-react';
import { cx } from '../lib/cx';
import { Icon } from './Icon';

export type QuantityStepperSize = 'm' | 's';

export interface QuantityStepperProps {
  value: number;
  onValueChange: (nextValue: number) => void;
  min?: number;
  max?: number;
  size?: QuantityStepperSize;
  isDisabled?: boolean;
  /** 그룹 이름. 예: "ABS 안전모 수량" */
  label: string;
  className?: string;
}

// 바깥 크기를 Figma 설명값(M 120×40, S 112×36)에 맞추려고 1px 테두리 두 줄을 빼고 안쪽 칸 크기를 정합니다.
// M: 39 + 40 + 39 + 2 = 120, 높이 38 + 2 = 40 / S: 35 + 40 + 35 + 2 = 112, 높이 34 + 2 = 36
const SIZE_CLASS: Record<QuantityStepperSize, { button: string; value: string }> = {
  m: { button: 'h-38 w-39', value: 'h-38 w-40' },
  s: { button: 'h-34 w-35', value: 'h-34 w-40' },
};

/**
 * 수량 스테퍼(Figma HF/QuantityStepper, M 120×40 · S 112×36 · r8).
 * 하한·상한에 닿으면 해당 버튼을 비활성화합니다. 바뀐 수량은 aria-live로 알립니다.
 */
export function QuantityStepper({
  value,
  onValueChange,
  min = 1,
  max = Number.MAX_SAFE_INTEGER,
  size = 'm',
  isDisabled = false,
  label,
  className,
}: QuantityStepperProps) {
  const isAtMin = value <= min;
  const isAtMax = value >= max;
  const sizeClass = SIZE_CLASS[size];
  const stepButtonClass = cx(
    'inline-flex items-center justify-center rounded-8 text-text-1 focus-ring enabled:hover:bg-surface disabled:cursor-not-allowed disabled:text-text-disabled',
    sizeClass.button,
  );

  return (
    <div
      role="group"
      aria-label={label}
      className={cx(
        'inline-flex items-center rounded-8 border bg-bg',
        isDisabled ? 'border-line' : 'border-line-strong',
        className,
      )}
    >
      <button
        type="button"
        className={stepButtonClass}
        onClick={() => onValueChange(Math.max(min, value - 1))}
        disabled={isDisabled || isAtMin}
        aria-label="수량 줄이기"
      >
        <Icon icon={Minus} size={16} />
      </button>
      <output
        aria-live="polite"
        className={cx(
          'inline-flex items-center justify-center text-label-m',
          isDisabled ? 'text-text-disabled' : 'text-text-1',
          sizeClass.value,
        )}
      >
        {value}
      </output>
      <button
        type="button"
        className={stepButtonClass}
        onClick={() => onValueChange(Math.min(max, value + 1))}
        disabled={isDisabled || isAtMax}
        aria-label="수량 늘리기"
      >
        <Icon icon={Plus} size={16} />
      </button>
    </div>
  );
}
