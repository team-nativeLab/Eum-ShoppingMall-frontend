import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SiteFooter } from './site-footer';

vi.mock('@/features/company/use-company-info-query', () => ({
  useCompanyInfoQuery: () => ({ data: undefined, refetch: vi.fn() }),
}));

describe('SiteFooter product links', () => {
  it('links 추천상품 to the recommended page next to the best and today links', () => {
    render(<SiteFooter />);

    const footerLinks = screen.getAllByRole('link', { name: '추천상품' });
    expect(footerLinks.length).toBeGreaterThan(0);
    for (const footerLink of footerLinks) {
      expect(footerLink).toHaveAttribute('href', '/recommended');
    }
    const footerNavigation = screen.getAllByRole('navigation')[0];
    if (!footerNavigation) throw new Error('푸터 탐색을 찾을 수 없습니다.');
    expect(within(footerNavigation).getByRole('link', { name: '베스트' })).toHaveAttribute(
      'href',
      '/best',
    );
  });
});
