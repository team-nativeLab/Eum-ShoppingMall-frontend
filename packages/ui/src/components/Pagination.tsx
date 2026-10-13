import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from '../lib/cx';
import { getPaginationItems } from '../lib/pagination';
import { Icon } from './Icon';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (nextPage: number) => void;
  /** 현재 페이지 양옆에 보여 줄 번호 수 */
  siblingCount?: number;
  className?: string;
}

const CELL_CLASS =
  'inline-flex size-40 items-center justify-center rounded-8 text-label-m focus-ring disabled:cursor-not-allowed';

/** 페이지 번호 이동(Figma HF/Web/Pagination, 40px 칸 · gap4). 1페이지뿐이면 그리지 않습니다. */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 2,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;
  const paginationItems = getPaginationItems(currentPage, totalPages, siblingCount);
  return (
    <nav aria-label="페이지 이동" className={className}>
      <ul className="flex items-center gap-4">
        <li>
          <button
            type="button"
            className={cx(
              CELL_CLASS,
              'border border-line-strong text-text-1 disabled:text-text-disabled',
            )}
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="이전 페이지"
          >
            <Icon icon={ChevronLeft} size={20} />
          </button>
        </li>
        {paginationItems.map((paginationItem) =>
          paginationItem.kind === 'ellipsis' ? (
            <li
              key={paginationItem.key}
              aria-hidden="true"
              className={cx(CELL_CLASS, 'text-text-disabled')}
            >
              …
            </li>
          ) : (
            <li key={paginationItem.key}>
              <button
                type="button"
                className={cx(
                  CELL_CLASS,
                  paginationItem.page === currentPage
                    ? 'bg-text-1 text-inverse'
                    : 'text-text-2 hover:bg-surface',
                )}
                onClick={() => onPageChange(paginationItem.page)}
                aria-current={paginationItem.page === currentPage ? 'page' : undefined}
                aria-label={`${paginationItem.page}페이지`}
              >
                {paginationItem.page}
              </button>
            </li>
          ),
        )}
        <li>
          <button
            type="button"
            className={cx(
              CELL_CLASS,
              'border border-line-strong text-text-1 disabled:text-text-disabled',
            )}
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="다음 페이지"
          >
            <Icon icon={ChevronRight} size={20} />
          </button>
        </li>
      </ul>
    </nav>
  );
}
