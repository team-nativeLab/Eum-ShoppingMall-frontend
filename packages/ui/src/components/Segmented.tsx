'use client';

import { useId } from 'react';
import { cx } from '../lib/cx';

export interface SegmentedOption<TValue extends string> {
  value: TValue;
  label: string;
}

export interface SegmentedProps<TValue extends string> {
  options: ReadonlyArray<SegmentedOption<TValue>>;
  value: TValue;
  onValueChange: (nextValue: TValue) => void;
  /** 그룹 이름(스크린리더) */
  label: string;
  className?: string;
}

/**
 * 세그먼트 선택(Figma HF/Segmented, p4 · gap4 · r8, 선택 항목 r6 · sh-1).
 * 네이티브 라디오 그룹이라 화살표 키로 이동합니다.
 */
export function Segmented<TValue extends string>({
  options,
  value,
  onValueChange,
  label,
  className,
}: SegmentedProps<TValue>) {
  const groupName = useId();
  return (
    <fieldset className={cx('m-0 flex min-w-0 gap-4 rounded-8 border-0 bg-surface p-4', className)}>
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label key={option.value} className="relative flex min-w-0 flex-1 cursor-pointer">
          <input
            type="radio"
            name={groupName}
            value={option.value}
            checked={option.value === value}
            onChange={() => onValueChange(option.value)}
            className="peer sr-only"
          />
          <span
            className={cx(
              'flex h-36 w-full items-center justify-center rounded-6 text-label-m text-text-2 transition-colors',
              'peer-checked:bg-bg peer-checked:text-text-1 peer-checked:shadow-1',
              'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-text-1',
            )}
          >
            {option.label}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
