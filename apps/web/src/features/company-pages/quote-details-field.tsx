'use client';

import { useId, useState } from 'react';

/** 견적 문의 상세 내용을 임시 UI 상태로 보여 주고 입력 글자 수를 계산합니다. */
export function QuoteDetailsField() {
  const fieldId = useId();
  const countId = `${fieldId}-count`;
  const [details, setDetails] = useState('');

  return (
    <div className="flex flex-col gap-8">
      <label htmlFor={fieldId} className="text-label-m">
        상세 내용
      </label>
      <div className="flex h-200 flex-col justify-between rounded-8 border border-line-control bg-bg p-14 focus-within:border-text-1 focus-within:ring-[0.5px] focus-within:ring-text-1 focus-within:ring-inset">
        <textarea
          id={fieldId}
          name="details"
          maxLength={1000}
          aria-describedby={countId}
          placeholder="제작 사양, 로고 인쇄 여부 등 상세 내용을 입력해 주세요."
          value={details}
          onChange={(event) => setDetails(event.currentTarget.value)}
          className="min-h-0 flex-1 resize-none bg-transparent text-body-m text-text-1 outline-none placeholder:text-text-3"
        />
        <p id={countId} className="self-end text-caption text-text-3" aria-live="polite">
          {details.length.toLocaleString('ko-KR')} / 1,000
        </p>
      </div>
    </div>
  );
}
