import { CircleCheck } from 'lucide-react';
import { cx } from '../lib/cx';
import { Icon } from './Icon';

export interface ToastProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/**
 * 토스트 한 개의 모양(Figma HF/Toast, h48 · r12 · sh-2).
 * role="status"로 스크린리더에 알립니다. 띄우고 닫는 관리는 화면 단계에서 붙입니다.
 */
export function Toast({ message, actionLabel, onAction, className }: ToastProps) {
  return (
    <div
      role="status"
      className={cx(
        'flex min-h-48 w-full max-w-350 items-center gap-10 rounded-12 bg-toast px-16 py-12 text-inverse shadow-2',
        className,
      )}
    >
      <Icon icon={CircleCheck} size={20} className="shrink-0" />
      <p className="min-w-0 flex-1 text-body-s">{message}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 rounded-4 text-label-m text-inverse underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inverse"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
