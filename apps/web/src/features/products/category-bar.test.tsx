import type { Category } from '@eum/api/types';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CategoryBar, MobileCategoryGrid } from './category-bar';

const categories: Category[] = [
  {
    id: 'general-category',
    slug: 'safety/gear',
    name: '개인보호장비',
    parentId: null,
    description: null,
    iconKey: null,
  },
  {
    id: 'general-child',
    slug: 'safety/helmet',
    name: '안전모',
    parentId: 'general-category',
    description: null,
    iconKey: null,
  },
];

describe('category shortcuts', () => {
  it('links the desktop category tile to its product list', () => {
    render(<CategoryBar categories={categories} />);

    const categoryNavigation = screen.getByRole('navigation', { name: '상품 카테고리' });
    expect(within(categoryNavigation).getByRole('link', { name: '개인보호장비' })).toHaveAttribute(
      'href',
      '/category/safety%2Fgear',
    );
  });

  it('links the mobile category tile to its product list', () => {
    render(<MobileCategoryGrid categories={categories} />);

    const categoryNavigation = screen.getByRole('navigation', { name: '상품 카테고리' });

    expect(within(categoryNavigation).getByRole('link', { name: '개인보호장비' })).toHaveAttribute(
      'href',
      '/category/safety%2Fgear',
    );
  });

  it('does not add a 전체보기 tile to the desktop bar', () => {
    render(<CategoryBar categories={categories} />);

    const categoryNavigation = screen.getByRole('navigation', { name: '상품 카테고리' });
    expect(within(categoryNavigation).queryByRole('link', { name: '전체보기' })).toBeNull();
    expect(within(categoryNavigation).getAllByRole('link')).toHaveLength(1);
  });

  it('does not add a 전체보기 tile to the mobile grid and shows one tile per top-level category', () => {
    render(<MobileCategoryGrid categories={categories} />);

    const categoryNavigation = screen.getByRole('navigation', { name: '상품 카테고리' });
    expect(within(categoryNavigation).queryByRole('link', { name: '전체보기' })).toBeNull();
    expect(within(categoryNavigation).getAllByRole('link')).toHaveLength(1);
  });
});
