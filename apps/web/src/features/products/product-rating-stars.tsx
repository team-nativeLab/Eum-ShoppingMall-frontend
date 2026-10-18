import { cx } from '@eum/ui/lib/cx';
import { Star } from 'lucide-react';

const STAR_COUNT = 5;

/**
 * 별점 5개(Figma 16px, 모바일 14px · 간격 2). 평점을 내림한 개수만큼 채웁니다
 * (4.7점이 별 5개로 보여 실제보다 높아 보이지 않게). 화면낭독기에는 "평점 4.7점" 또는 "평점 없음"을 읽어 줍니다.
 */
export function ProductRatingStars({
  rating,
  className,
  variant = 'default',
}: {
  rating: number | null;
  className?: string;
  variant?: 'default' | 'home-carousel';
}) {
  const filledCount = rating === null ? 0 : Math.floor(rating);
  return (
    <span
      role="img"
      aria-label={rating === null ? '평점 없음' : `평점 ${rating}점`}
      className={cx('inline-flex items-center gap-2', className)}
    >
      {Array.from({ length: STAR_COUNT }, (_, starIndex) => {
        const isFilled = starIndex < filledCount;
        return (
          <Star
            key={starIndex}
            aria-hidden="true"
            strokeWidth={1.5}
            fill={
              isFilled
                ? variant === 'home-carousel'
                  ? '#F2B72F'
                  : 'var(--color-rating-star-fill)'
                : 'none'
            }
            className={cx(
              'size-14 lg:size-16',
              isFilled ? 'text-rating-star-stroke' : 'text-line-control',
            )}
          />
        );
      })}
    </span>
  );
}
