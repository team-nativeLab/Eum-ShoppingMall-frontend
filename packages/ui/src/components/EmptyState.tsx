import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import { Icon } from './Icon';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** 다음 행동 버튼·링크 */
  action?: ReactNode;
  /** 제목 태그 수준. 화면 구조에 맞춰 고릅니다. */
  headingLevel?: 'h2' | 'h3';
  className?: string;
}

/** 빈 상태 안내(Figma HF/EmptyState). 아이콘 타일 64 · 간격 20/8/24 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  headingLevel: HeadingTag = 'h2',
  className,
}: EmptyStateProps) {
  return (
    <div className={cx('flex flex-col items-center px-20 pt-64 pb-32 text-center', className)}>
      <div className="flex size-64 items-center justify-center rounded-capsule bg-surface text-text-2">
        <Icon icon={icon} size={28} />
      </div>
      <HeadingTag className="mt-20 text-h3 text-text-1">{title}</HeadingTag>
      {description ? <p className="mt-8 max-w-280 text-body-s text-text-2">{description}</p> : null}
      {action ? <div className="mt-24">{action}</div> : null}
    </div>
  );
}
