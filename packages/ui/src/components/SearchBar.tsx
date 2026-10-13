'use client';

import { CircleX, Search } from 'lucide-react';
import { useId, type FormEvent } from 'react';
import { cx } from '../lib/cx';
import { Icon } from './Icon';

export interface SearchBarProps {
  value: string;
  onValueChange: (nextValue: string) => void;
  onSearch: (keyword: string) => void;
  placeholder: string;
  /** 스크린리더용 입력 이름 */
  label?: string;
  /** 돋보기 위치(Figma Icon=Left/Right) */
  iconPosition?: 'left' | 'right';
  className?: string;
}

/**
 * 검색바(Figma HF/SearchBar, h44 · capsule).
 * form role="search"로 감싸 Enter로 검색하고, 값이 있으면 지우기 버튼을 보여 줍니다.
 */
export function SearchBar({
  value,
  onValueChange,
  onSearch,
  placeholder,
  label = '검색어',
  iconPosition = 'left',
  className,
}: SearchBarProps) {
  const inputId = useId();
  const hasValue = value.length > 0;

  // Enter 제출 시 페이지 이동 없이 검색 콜백만 부르는 함수
  const handleSubmit = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    onSearch(value.trim());
  };

  const searchIcon = <Icon icon={Search} size={20} className="shrink-0 text-text-2" />;

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={cx(
        'flex h-44 w-full items-center gap-8 rounded-capsule bg-surface transition-colors',
        'focus-within:bg-bg focus-within:ring-[1.5px] focus-within:ring-text-1 focus-within:ring-inset',
        iconPosition === 'left' ? 'pl-16' : 'pl-20',
        hasValue ? 'pr-4' : 'pr-16',
        className,
      )}
    >
      {iconPosition === 'left' ? searchIcon : null}
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(changeEvent) => onValueChange(changeEvent.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-body-m text-text-1 outline-none placeholder:text-text-3 [&::-webkit-search-cancel-button]:hidden"
      />
      {iconPosition === 'right' ? searchIcon : null}
      {hasValue ? (
        <button
          type="button"
          onClick={() => onValueChange('')}
          aria-label="검색어 지우기"
          className="inline-flex size-36 shrink-0 items-center justify-center rounded-capsule text-text-2 focus-ring hover:bg-surface"
        >
          <Icon icon={CircleX} size={20} />
        </button>
      ) : null}
    </form>
  );
}
