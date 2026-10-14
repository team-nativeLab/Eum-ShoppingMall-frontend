'use client';

import { useState, type ChangeEvent } from 'react';
import { TextField } from '@eum/ui/components/TextField';

/** 네이티브 날짜 선택기를 유지하면서 Figma의 한국어 빈 상태 문구를 보여 줍니다. */
export function QuoteDateField() {
  const [date, setDate] = useState('');

  const handleDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDate(event.currentTarget.value);
  };

  return (
    <div className="relative">
      <TextField
        label="희망 납기"
        name="deliveryDate"
        type="date"
        value={date}
        onChange={handleDateChange}
        aria-description="날짜를 선택해 주세요"
      />
      {!date ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-28 left-14 z-10 flex h-48 items-center bg-bg text-body-m text-text-3"
        >
          날짜를 선택해 주세요
        </span>
      ) : null}
    </div>
  );
}
