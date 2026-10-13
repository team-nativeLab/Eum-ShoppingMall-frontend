import { ChevronRight } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import { Icon } from './Icon';

export interface BreadcrumbItem {
  label: string;
  /** 마지막(현재) 항목은 href 없이 둡니다 */
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  /**
   * 링크 렌더링 함수. Next Link·react-router Link를 쓰려면 넘깁니다.
   * 넘기지 않으면 일반 <a>를 씁니다.
   */
  renderLink?: (item: Required<BreadcrumbItem>, className: string) => ReactNode;
  className?: string;
}

const LINK_CLASS = 'rounded-4 text-text-3 hover:text-text-1 focus-ring';

/** 현재 위치 경로(Figma HF/Web/Breadcrumb, Caption · gap6 · chevron 12) */
export function Breadcrumb({ items, renderLink, className }: BreadcrumbProps) {
  return (
    <nav aria-label="현재 위치" className={className}>
      <ol className="flex flex-wrap items-center gap-6 text-caption">
        {items.map((breadcrumbItem, itemIndex) => {
          const isCurrent = itemIndex === items.length - 1;
          return (
            <Fragment key={`${breadcrumbItem.label}-${itemIndex}`}>
              <li className="flex items-center">
                {isCurrent || breadcrumbItem.href === undefined ? (
                  <span
                    aria-current={isCurrent ? 'page' : undefined}
                    className={isCurrent ? 'text-text-1' : 'text-text-3'}
                  >
                    {breadcrumbItem.label}
                  </span>
                ) : renderLink ? (
                  renderLink({ label: breadcrumbItem.label, href: breadcrumbItem.href }, LINK_CLASS)
                ) : (
                  <a href={breadcrumbItem.href} className={LINK_CLASS}>
                    {breadcrumbItem.label}
                  </a>
                )}
              </li>
              {isCurrent ? null : (
                <li aria-hidden="true" className={cx('flex items-center text-text-3')}>
                  <Icon icon={ChevronRight} size={12} />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
