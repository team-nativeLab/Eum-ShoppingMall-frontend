import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductRatingStars } from './product-rating-stars';

describe('ProductRatingStars', () => {
  it('uses a modern yellow fill and dark gold stroke while flooring fractional ratings', () => {
    render(<ProductRatingStars rating={4.7} />);

    const rating = screen.getByRole('img', { name: '평점 4.7점' });
    const svgStars = rating.querySelectorAll('svg');

    expect(svgStars).toHaveLength(5);
    Array.from(svgStars)
      .slice(0, 4)
      .forEach((star) => {
        expect(star).toHaveAttribute('fill', 'var(--color-rating-star-fill)');
        expect(star).toHaveClass('text-rating-star-stroke');
      });
    const emptyStar = svgStars.item(4);
    expect(emptyStar).toHaveAttribute('fill', 'none');
    expect(emptyStar).toHaveClass('text-line-control');
  });

  it('keeps unrated stars empty and preserves the accessible unrated label', () => {
    render(<ProductRatingStars rating={null} />);

    const rating = screen.getByRole('img', { name: '평점 없음' });
    const svgStars = rating.querySelectorAll('svg');

    expect(svgStars).toHaveLength(5);
    expect(Array.from(svgStars).every((star) => star.getAttribute('fill') === 'none')).toBe(true);
    expect(Array.from(svgStars).every((star) => star.classList.contains('text-line-control'))).toBe(
      true,
    );
  });
});
