import { cx } from '../lib/cx';

export interface SelectableTabOption<TValue extends string> {
  value: TValue;
  label: string;
  count?: number;
}

export interface SelectableTabsProps<TValue extends string> {
  options: readonly SelectableTabOption<TValue>[];
  value: TValue;
  onValueChange: (nextValue: TValue) => void;
  label: string;
  isScrollable?: boolean;
  horizontalPadding?: '12' | '16';
  countPresentation?: 'inline' | 'muted';
  selectedFontWeight?: 'normal' | 'medium';
}

/** 외부 상태로 제어하는 단일 선택 탭 버튼 그룹입니다. */
export function SelectableTabs<TValue extends string>({
  options,
  value,
  onValueChange,
  label,
  isScrollable = false,
  horizontalPadding = '12',
  countPresentation = 'inline',
  selectedFontWeight = 'normal',
}: SelectableTabsProps<TValue>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cx(
        'flex border-b border-line',
        isScrollable && 'min-w-0 [scrollbar-width:none] overflow-x-auto',
      )}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        const hasMutedCount = countPresentation === 'muted' && option.count !== undefined;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onValueChange(option.value)}
            className={cx(
              'min-h-44 border-b-2 text-body-s focus-ring',
              isScrollable && 'shrink-0',
              horizontalPadding === '16' ? 'px-16' : 'px-12',
              !isScrollable && '-mb-px flex h-44 items-center',
              hasMutedCount && 'gap-6',
              isSelected
                ? cx('border-text-1 text-text-1', selectedFontWeight === 'medium' && 'font-medium')
                : 'border-transparent text-text-2 hover:text-text-1',
            )}
          >
            <span>{option.label}</span>
            {option.count !== undefined ? (
              countPresentation === 'muted' ? (
                <span className="text-caption text-text-3">{option.count}</span>
              ) : (
                <span> {option.count}</span>
              )
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
