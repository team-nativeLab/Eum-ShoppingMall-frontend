'use client';

import { Icon } from '@eum/ui/components/Icon';
import { CalendarDays } from 'lucide-react';
import { useId, useRef, useState, type ChangeEvent } from 'react';

/** 네이티브 날짜 값을 폼에 보존하면서 버튼으로 날짜 선택기를 엽니다. */
export function QuoteDateField() {
  const fieldId = useId();
  const fieldLabelId = `${fieldId}-label`;
  const fieldValueId = `${fieldId}-value`;
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState('');

  const handleDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDate(event.currentTarget.value);
  };

  function handleOpenDatePicker() {
    const dateInput = dateInputRef.current;
    if (!dateInput) return;

    if (typeof dateInput.showPicker === 'function') {
      try {
        dateInput.showPicker();
        return;
      } catch {
        // Some browsers expose showPicker but cannot open this input's picker.
      }
    }

    dateInput.click();
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <span id={fieldLabelId} className="text-label-m text-text-1">
        희망 납기
      </span>
      <div className="relative">
        <input
          ref={dateInputRef}
          id={fieldId}
          name="deliveryDate"
          type="date"
          value={date}
          onChange={handleDateChange}
          aria-hidden="true"
          tabIndex={-1}
          className="pointer-events-none absolute inset-0 h-48 w-full opacity-0"
        />
        <button
          type="button"
          aria-labelledby={`${fieldLabelId} ${fieldValueId}`}
          onClick={handleOpenDatePicker}
          className="flex h-48 w-full min-w-0 items-center justify-between gap-8 rounded-8 border border-line-strong bg-bg px-14 text-body-s focus-ring"
        >
          <span
            id={fieldValueId}
            className={
              date
                ? 'min-w-0 truncate text-left text-text-1'
                : 'min-w-0 truncate text-left text-text-3'
            }
          >
            {date || '날짜를 선택해 주세요'}
          </span>
          <Icon icon={CalendarDays} size={20} className="shrink-0 text-text-2" />
        </button>
      </div>
    </div>
  );
}
