import type { Category } from '@eum/api/types';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CategoryBar, MobileCategoryGrid } from './category-bar';

const categories: Category[] = [
  {
    id: 'custom-category',
    slug: 'custom-order',
    name: '맞춤 제작/납품',
    parentId: null,
    description: '기업 맞춤 솔루션',
    iconKey: null,
  },
  {
    id: 'general-category',
    slug: 'safety/gear',
    name: '개인보호장비',
    parentId: null,
    description: null,
    iconKey: null,
  },
];

describe('category shortcuts', () => {
  it('routes the desktop custom-order tile to solutions and preserves other category links', () => {
    render(<CategoryBar categories={categories} />);

    const categoryNavigation = screen.getByRole('navigation', { name: '상품 카테고리' });
    const customOrderLink = within(categoryNavigation).getByRole('link', {
      name: /맞춤 제작\/납품/,
    });

    expect(customOrderLink).toHaveAttribute('href', '/solutions');
    expect(customOrderLink).toHaveTextContent('기업 맞춤 솔루션');
    expect(within(categoryNavigation).getByRole('link', { name: '개인보호장비' })).toHaveAttribute(
      'href',
      '/category/safety%2Fgear',
    );
  });

  it('routes the mobile custom-order tile to solutions and preserves other category links', () => {
    render(<MobileCategoryGrid categories={categories} />);

    const categoryNavigation = screen.getByRole('navigation', { name: '상품 카테고리' });

    expect(
      within(categoryNavigation).getByRole('link', { name: /맞춤 제작\/납품/ }),
    ).toHaveAttribute('href', '/solutions');
    expect(within(categoryNavigation).getByRole('link', { name: '개인보호장비' })).toHaveAttribute(
      'href',
      '/category/safety%2Fgear',
    );
  });
});
