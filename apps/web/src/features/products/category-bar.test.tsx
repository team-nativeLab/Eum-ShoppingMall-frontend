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
  it('routes the desktop custom-order tile to solutions and preserves other category links', () => {
    render(<CategoryBar categories={categories} />);

    const categoryNavigation = screen.getByRole('navigation', { name: '상품 카테고리' });
    const customOrderLink = within(categoryNavigation).getByRole('link', {
      name: /맞춤 제작\/납품/,
    });

    expect(customOrderLink).toHaveAttribute('href', '/solutions');
    // 데스크톱 타일은 이름만 보여 주므로 소개 문구는 렌더링되지 않습니다.
    expect(customOrderLink).not.toHaveTextContent('기업 맞춤 솔루션');
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

  it('does not add a 전체보기 tile to the desktop bar', () => {
    render(<CategoryBar categories={categories} />);

    const categoryNavigation = screen.getByRole('navigation', { name: '상품 카테고리' });
    expect(within(categoryNavigation).queryByRole('link', { name: '전체보기' })).toBeNull();
    expect(within(categoryNavigation).getAllByRole('link')).toHaveLength(2);
  });

  it('does not add a 전체보기 tile to the mobile grid and shows one tile per top-level category', () => {
    render(<MobileCategoryGrid categories={categories} />);

    const categoryNavigation = screen.getByRole('navigation', { name: '상품 카테고리' });
    expect(within(categoryNavigation).queryByRole('link', { name: '전체보기' })).toBeNull();
    expect(within(categoryNavigation).getAllByRole('link')).toHaveLength(2);
  });
});
