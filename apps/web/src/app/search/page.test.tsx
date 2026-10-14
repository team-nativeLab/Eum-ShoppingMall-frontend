import { describe, expect, it } from 'vitest';
import SearchPage from './page';

describe('SearchPage navigation parameters', () => {
  it('forwards repeated brand filters and browse intent to the listing view', async () => {
    const pageElement = await SearchPage({
      searchParams: Promise.resolve({
        q: 'glove',
        brand: ['3M', '동아'],
        browse: 'brands',
      }),
    });

    expect(pageElement).toMatchObject({
      props: {
        initialKeyword: 'glove',
        initialBrands: ['3M', '동아'],
        initialBrowseBrands: true,
        initialSearchParams: 'q=glove&brand=3M&brand=%EB%8F%99%EC%95%84&browse=brands',
      },
    });
  });
});
