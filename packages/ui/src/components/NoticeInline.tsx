import { CircleAlert, Info, type LucideIcon } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { cx } from '../lib/cx';
import { Icon } from './Icon';

export type NoticeTone = 'neutral' | 'info' | 'warning' | 'danger';

const TONE_STYLE: Record<NoticeTone, { boxClass: string; icon: LucideIcon }> = {
  neutral: { boxClass: 'bg-surface text-text-2', icon: Info },
  info: { boxClass: 'bg-info-tint text-info', icon: Info },
  warning: { boxClass: 'bg-warning-tint text-warning', icon: CircleAlert },
  danger: { boxClass: 'bg-danger-tint text-danger', icon: CircleAlert },
};

export interface NoticeInlineProps extends HTMLAttributes<HTMLDivElement> {
  tone?: NoticeTone;
  /** 화면 폭 띠 형태(Figma Type=FullBleed: 모서리 없음, 세로 여백 축소) */
  isFullBleed?: boolean;
}

/**
 * 안내 박스(Figma HF/NoticeInline).
 * 정적 안내라 기본 role이 없습니다. 사용자의 동작 결과를 알릴 때만 role="status"/"alert"를 넘깁니다.
 */
export function NoticeInline({
  tone = 'neutral',
  isFullBleed = false,
  className,
  children,
  ...divProps
}: NoticeInlineProps) {
  const toneStyle = isFullBleed ? TONE_STYLE.neutral : TONE_STYLE[tone];
  return (
    <div
      className={cx(
        'flex gap-8 text-body-s',
        toneStyle.boxClass,
        isFullBleed ? 'items-center px-20 py-10' : 'items-start rounded-12 px-14 py-12',
        className,
      )}
      {...divProps}
    >
      <Icon icon={toneStyle.icon} size={16} className={cx('shrink-0', !isFullBleed && 'mt-2')} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
