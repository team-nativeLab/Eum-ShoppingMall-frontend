'use client';

import { Check } from 'lucide-react';
import { useEffect, useRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size'
> {
  /** 보이는 라벨. 없으면 aria-label을 꼭 넘깁니다(예: 표의 행 선택). */
  children?: ReactNode;
  /** 일부만 선택된 상태(전체 선택 체크박스). 네이티브 indeterminate로 알립니다. */
  isIndeterminate?: boolean;
  /** 상품 facet처럼 밀집된 목록에만 16px 상자를 사용합니다. 기본은 20px입니다. */
  size?: 'default' | 'small';
}

// 상태별 상자 모양. 비활성 규칙은 :checked/:indeterminate와 겹치지 않게 조건을 나눠
// CSS 생성 순서와 상관없이 비활성+체크에서도 체크 표시가 보이게 합니다.
const BOX_BASE_CLASS = cx(
  'relative inline-flex shrink-0 items-center justify-center rounded-4 border-[1.5px] border-line-control bg-bg text-inverse',
  'peer-[:checked:enabled]:border-text-1 peer-[:checked:enabled]:bg-text-1',
  'peer-[:indeterminate:enabled]:border-text-1 peer-[:indeterminate:enabled]:bg-text-1',
  // Figma Disabled(꺼짐): surface-2 채움. 비활성+체크·일부 선택은 같은 채움에 회색 표시
  'peer-disabled:border-surface-2 peer-disabled:bg-surface-2 peer-disabled:text-text-disabled',
  'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-text-1',
  'peer-checked:[&>.checkbox-check]:block',
  'peer-indeterminate:[&>.checkbox-check]:hidden peer-indeterminate:[&>.checkbox-dash]:block',
);

/**
 * 체크박스(Figma HF/Checkbox, 20px · radius 4).
 * 네이티브 input을 시각적으로만 숨기고 상태는 :checked/:indeterminate로 그립니다.
 */
export function Checkbox({
  children,
  isIndeterminate = false,
  size = 'default',
  className,
  disabled,
  ...inputProps
}: CheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // indeterminate는 HTML 속성이 없어 DOM 프로퍼티로만 지정할 수 있습니다.
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = isIndeterminate;
  }, [isIndeterminate]);

  return (
    <label
      className={cx(
        'inline-flex items-center gap-8 text-body-s text-text-1',
        disabled ? 'cursor-not-allowed text-text-disabled' : 'cursor-pointer',
        className,
      )}
    >
      <input
        ref={inputRef}
        type="checkbox"
        disabled={disabled}
        className="peer sr-only"
        {...inputProps}
      />
      <span
        aria-hidden="true"
        className={cx(BOX_BASE_CLASS, size === 'small' ? 'size-16' : 'size-20')}
      >
        <Check
          className="checkbox-check hidden"
          size={size === 'small' ? 12 : 14}
          strokeWidth={2}
        />
        <span className="checkbox-dash hidden h-2 w-10 rounded-[1px] bg-current" />
      </span>
      {children}
    </label>
  );
}
