import { beforeEach, describe, expect, it, vi } from 'vitest';
import SearchPage from './page';

const navigationMocks = vi.hoisted(() => ({
  redirect: vi.fn((destination: string) => {
    // Next redirect()처럼 렌더링을 멈추도록 예외를 던집니다.
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
}));

vi.mock('next/navigation', () => ({ redirect: navigationMocks.redirect }));

describe('SearchPage navigation parameters', () => {
  beforeEach(() => {
    navigationMocks.redirect.mockClear();
  });

  it('forwards repeated brand filters to the listing view and ignores the legacy browse value', async () => {
    const pageElement = await SearchPage({
      searchParams: Promise.resolve({
        q: 'glove',
        brand: ['3M', '동아'],
        browse: 'brands',
      }),
    });

    expect(navigationMocks.redirect).not.toHaveBeenCalled();
    expect(pageElement).toMatchObject({
      props: {
        initialKeyword: 'glove',
        initialBrands: ['3M', '동아'],
        initialSearchParams: 'q=glove&brand=3M&brand=%EB%8F%99%EC%95%84&browse=brands',
      },
    });
    expect(pageElement.props).not.toHaveProperty('initialBrowseBrands');
  });

  it('redirects the legacy brand browse address without a brand or keyword to /brands', async () => {
    await expect(
      SearchPage({ searchParams: Promise.resolve({ browse: 'brands' }) }),
    ).rejects.toThrow('NEXT_REDIRECT:/brands');
    await expect(
      SearchPage({ searchParams: Promise.resolve({ browse: ['other', 'brands'], q: ' ' }) }),
    ).rejects.toThrow('NEXT_REDIRECT:/brands');
    expect(navigationMocks.redirect).toHaveBeenCalledWith('/brands');
  });

  it('keeps the product listing when browse=brands comes with a brand filter or a keyword', async () => {
    const brandFilteredPage = await SearchPage({
      searchParams: Promise.resolve({ browse: 'brands', brand: '3M' }),
    });
    const keywordPage = await SearchPage({
      searchParams: Promise.resolve({ browse: 'brands', q: '장갑' }),
    });

    expect(navigationMocks.redirect).not.toHaveBeenCalled();
    expect(brandFilteredPage).toMatchObject({ props: { initialBrands: ['3M'] } });
    expect(keywordPage).toMatchObject({ props: { initialKeyword: '장갑' } });
  });
});
