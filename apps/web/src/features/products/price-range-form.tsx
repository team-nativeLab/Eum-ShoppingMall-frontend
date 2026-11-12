'use client';

import { Button } from '@eum/ui/components/Button';
import { cx } from '@eum/ui/lib/cx';
import { useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  parsePriceInput,
  sanitizePriceDigits,
  type AppliedPrice,
  type PriceInputError,
} from './price-range';

const PRICE_INPUT_CLASS =
  'h-40 w-full min-w-0 rounded-8 border bg-bg pr-32 pl-8 text-body-s focus-ring';

interface SubmittedPriceError {
  error: PriceInputError;
  minText: string;
  maxText: string;
}

/**
 * 최소·최대 가격(만원)을 직접 입력하는 모바일·데스크톱 공용 폼입니다.
 * 입력값은 부모가 들고 있어 두 인스턴스가 같은 값을 보여 주고, 검증 오류는 제출한 쪽에만 보입니다.
 * 데스크톱·모바일 패널이 동시에 DOM에 있을 수 있어 `placement`를 접근성 이름에 붙입니다.
 */
export function PriceRangeForm({
  placement,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  onApply,
}: {
  placement: '데스크톱' | '모바일';
  minValue: string;
  maxValue: string;
  onMinChange: (nextValue: string) => void;
  onMaxChange: (nextValue: string) => void;
  onApply: (price: AppliedPrice) => void;
}) {
  const errorId = useId();
  const minInputRef = useRef<HTMLInputElement>(null);
  const maxInputRef = useRef<HTMLInputElement>(null);
  const [submittedError, setSubmittedError] = useState<SubmittedPriceError | undefined>();
  // 오류는 제출한 입력값에 대한 것이므로, 초기화·다른 인스턴스 수정으로 값이 달라지면 숨깁니다.
  const inputError =
    submittedError?.minText === minValue && submittedError.maxText === maxValue
      ? submittedError.error
      : undefined;

  const handleInputChange =
    (onChange: (nextValue: string) => void) => (changeEvent: ChangeEvent<HTMLInputElement>) => {
      onChange(sanitizePriceDigits(changeEvent.target.value));
      setSubmittedError(undefined);
    };

  const handleSubmit = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    const parsedPrice = parsePriceInput(minValue, maxValue);
    if (!parsedPrice.isValid) {
      setSubmittedError({ error: parsedPrice.error, minText: minValue, maxText: maxValue });
      (parsedPrice.error.field === 'max' ? maxInputRef : minInputRef).current?.focus();
      return;
    }
    setSubmittedError(undefined);
    onApply(parsedPrice.price);
  };

  const isMinInvalid = inputError?.field === 'min' || inputError?.field === 'range';
  const isMaxInvalid = inputError?.field === 'max' || inputError?.field === 'range';

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div role="group" aria-label={placement + ' 가격 범위'}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
          <div className="relative min-w-0">
            <input
              ref={minInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              placeholder="최소"
              aria-label={placement + ' 최소 가격(만원)'}
              aria-invalid={isMinInvalid ? true : undefined}
              aria-describedby={inputError ? errorId : undefined}
              value={minValue}
              onChange={handleInputChange(onMinChange)}
              className={cx(
                PRICE_INPUT_CLASS,
                isMinInvalid ? 'border-danger' : 'border-line-control',
              )}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-8 -translate-y-1/2 text-caption text-text-3"
            >
              만원
            </span>
          </div>
          <span aria-hidden="true" className="text-body-s text-text-3">
            -
          </span>
          <div className="relative min-w-0">
            <input
              ref={maxInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              placeholder="최대"
              aria-label={placement + ' 최대 가격(만원)'}
              aria-invalid={isMaxInvalid ? true : undefined}
              aria-describedby={inputError ? errorId : undefined}
              value={maxValue}
              onChange={handleInputChange(onMaxChange)}
              className={cx(
                PRICE_INPUT_CLASS,
                isMaxInvalid ? 'border-danger' : 'border-line-control',
              )}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-8 -translate-y-1/2 text-caption text-text-3"
            >
              만원
            </span>
          </div>
        </div>
        {inputError ? (
          <p id={errorId} role="alert" className="mt-8 text-caption text-danger">
            {inputError.message}
          </p>
        ) : null}
      </div>
      <Button
        type="submit"
        variant="secondary"
        size="s"
        isFullWidth
        aria-label={placement + ' 가격 적용'}
        className="mt-8"
      >
        적용
      </Button>
    </form>
  );
}
