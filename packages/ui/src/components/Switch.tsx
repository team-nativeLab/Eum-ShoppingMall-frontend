import { cx } from '../lib/cx';

export interface SwitchProps {
  isChecked: boolean;
  onCheckedChange: (nextChecked: boolean) => void;
  /** 접근 가능한 이름. 예: "금액 표시" */
  label: string;
  /** 켜짐 상태에서 옆에 보이는 문구(Figma: "표시") */
  onText?: string;
  /** 꺼짐 상태에서 옆에 보이는 문구(Figma: "미표시") */
  offText?: string;
  isDisabled?: boolean;
  /** 서버 반영 중(Figma State=Pending). 포커스는 유지하되 누름을 무시하고 aria-busy·aria-disabled로 알립니다. */
  isPending?: boolean;
  className?: string;
}

/**
 * 토글 스위치(Figma HF/Admin/Switch, 트랙 36×20 · 행 h32 · gap8).
 * 이름(label)은 고정하고 상태는 aria-checked로 알립니다. 옆 문구는 시각용입니다.
 */
export function Switch({
  isChecked,
  onCheckedChange,
  label,
  onText,
  offText,
  isDisabled = false,
  isPending = false,
  className,
}: SwitchProps) {
  const trackClass = isDisabled
    ? 'bg-surface-2'
    : isPending || !isChecked
      ? 'bg-line-control'
      : 'bg-text-1';
  const stateText = isChecked ? onText : offText;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked}
      aria-label={label}
      aria-busy={isPending || undefined}
      // 처리 중에는 네이티브 disabled 대신 aria-disabled를 써서 키보드 포커스가 사라지지 않게 합니다.
      aria-disabled={isPending || undefined}
      disabled={isDisabled}
      onClick={() => {
        if (isPending) return;
        onCheckedChange(!isChecked);
      }}
      className={cx(
        'inline-flex h-32 items-center gap-8 rounded-4 text-body-s focus-ring disabled:cursor-not-allowed aria-disabled:cursor-progress',
        isDisabled ? 'text-text-disabled' : 'text-text-2',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx('relative h-20 w-36 shrink-0 rounded-capsule transition-colors', trackClass)}
      >
        <span
          className={cx(
            'absolute top-2 left-2 size-16 rounded-capsule bg-bg shadow-1 transition-transform',
            isChecked ? 'translate-x-16' : 'translate-x-0',
          )}
        />
      </span>
      {stateText ? <span aria-hidden="true">{stateText}</span> : null}
    </button>
  );
}
