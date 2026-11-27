import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import { createRealApi } from './real-api';
import { buildMockConfig } from './test-fixtures';

afterEach(() => vi.unstubAllGlobals());

function stubApiResponse(data: unknown) {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL) =>
      new Response(JSON.stringify({ success: true, data }), { status: 200 }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('real ShopApi stubs', () => {
  it('maps catalog summaries without inventing full Product fields and serializes browse filters', async () => {
    const fetchMock = stubApiResponse({
      content: [
        {
          id: 9007199254740991,
          categoryId: 17,
          name: '안전모',
          brand: null,
          imageUrl: null,
          price: null,
          listPrice: null,
          priceVisible: false,
          rating: null,
          defaultSkuId: null,
          certifications: [{ code: 'KCS', label: 'KCS' }],
          status: 'ON_SALE',
          soldOut: false,
          optionRequired: false,
          reviewCount: 0,
          featured: true,
          todayDeal: false,
        },
      ],
      page: 1,
      size: 12,
      totalElements: 25,
      totalPages: 3,
    });
    const api = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );

    const page = await api.products.listCatalog({
      categoryId: '17',
      keyword: '안전모',
      brand: ['브랜드 A', '브랜드 B'],
      certification: ['KCS', 'TYPE_APPROVAL'],
      minPrice: 1000,
      maxPrice: 9000,
      excludeSoldOut: true,
      sortBy: 'popular',
      collection: 'featured',
      page: 2,
      pageSize: 12,
    });
    const requestUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(requestUrl.pathname).toBe('/api/v1/products');
    expect(requestUrl.searchParams.get('query')).toBe('안전모');
    expect(requestUrl.searchParams.getAll('brand')).toEqual(['브랜드 A', '브랜드 B']);
    expect(requestUrl.searchParams.getAll('certification')).toEqual(['KCS', 'TYPE_APPROVAL']);
    expect(requestUrl.searchParams.get('page')).toBe('1');
    expect(requestUrl.searchParams.get('size')).toBe('12');
    expect(requestUrl.searchParams.get('sort')).toBe('popular');
    expect(requestUrl.searchParams.has('today')).toBe(false);
    expect(page).toMatchObject({ page: 2, pageSize: 12, totalCount: 25 });
    expect(page.items[0]).toMatchObject({
      kind: 'summary',
      id: '9007199254740991',
      categoryId: '17',
      stockStatus: 'inStock',
      certifications: ['KCS'],
    });
    expect(page.items[0]).not.toHaveProperty('options');
  });

  it('caps discovery recommendation limits at the Swagger maximum', async () => {
    const fetchMock = stubApiResponse([]);
    const api = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );

    await api.products.listCatalogRecommended({ limit: 48 });

    const requestUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(requestUrl.pathname).toBe('/api/v1/products/recommended');
    expect(requestUrl.searchParams.get('limit')).toBe('20');
  });

  it('keeps an uncategorized product summary when the API categoryId is null', async () => {
    stubApiResponse({
      content: [
        {
          id: 81,
          categoryId: null,
          name: '분류 전 상품',
          brand: null,
          imageUrl: null,
          price: null,
          listPrice: null,
          priceVisible: false,
          rating: null,
          defaultSkuId: null,
          certifications: [],
          status: 'ON_SALE',
          soldOut: false,
          optionRequired: false,
          reviewCount: 0,
          featured: false,
          todayDeal: false,
        },
      ],
      page: 0,
      size: 24,
      totalElements: 1,
      totalPages: 1,
    });
    const api = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );

    await expect(api.products.listCatalog()).resolves.toMatchObject({
      items: [{ kind: 'summary', id: '81', categoryId: null }],
      totalCount: 1,
    });
  });

  it('rejects unsafe IDs and buyer-hidden catalog items', async () => {
    stubApiResponse({
      content: [{ id: 9007199254740992 }],
      page: 0,
      size: 24,
      totalElements: 1,
      totalPages: 1,
    });
    const api = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );
    await expect(api.products.listCatalog()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });

    stubApiResponse({
      content: [{ id: 1, categoryId: 1, status: 'HIDDEN' }],
      page: 0,
      size: 24,
      totalElements: 1,
      totalPages: 1,
    });
    const hiddenApi = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );
    await expect(hiddenApi.products.listCatalog()).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('maps discovery endpoints with numeric IDs and existing UI categories', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      const data = path.endsWith('/categories')
        ? [
            {
              id: 2,
              parentId: null,
              name: '안전용품',
              slug: 'safety',
              description: null,
              iconKey: null,
            },
          ]
        : path.endsWith('/brands')
          ? [
              {
                id: 3,
                name: '브랜드',
                englishName: null,
                logoUrl: null,
                tagline: null,
                productCount: 4,
              },
            ]
          : path.endsWith('/suggestions')
            ? [{ productId: 4, name: '상품', brand: null }]
            : path.endsWith('/recommended-keywords')
              ? ['안전모']
              : {
                  totalCount: 1,
                  keywordTotalCount: 2,
                  categories: [{ value: 2, label: '안전용품', count: 1 }],
                  brands: [],
                  certifications: [],
                };
      return new Response(JSON.stringify({ success: true, data }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const api = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );

    await expect(api.categories.list()).resolves.toMatchObject([
      { id: '2', slug: 'safety', description: null },
    ]);
    await expect(api.brands.list()).resolves.toMatchObject([{ id: '3', productCount: 4 }]);
    await expect(api.products.suggest('안전')).resolves.toMatchObject([
      { productId: '4', brand: '' },
    ]);
    await expect(api.products.facets({ categoryId: '2' })).resolves.toMatchObject({
      totalCount: 1,
      categories: [{ value: '2', label: '안전용품', count: 1 }],
    });
    await expect(api.search.recommendedKeywords()).resolves.toEqual(['안전모']);
  });

  it('reports review summary and event endpoints as NOT_IMPLEMENTED', async () => {
    const api = createRealApi(buildMockConfig());

    await expect(api.products.getReviewSummary('product-a')).rejects.toBeInstanceOf(ApiError);
    await expect(api.products.getReviewSummary('product-a')).rejects.toMatchObject({
      code: 'NOT_IMPLEMENTED',
    });
    await expect(api.events.list()).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
    await expect(api.events.getById('event-a')).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
  });

  it('keeps inquiry submission as a real API stub', async () => {
    const api = createRealApi(buildMockConfig());
    await expect(
      api.inquiries.submit({ memberId: 'mem-001', title: '문의', body: '문의 내용' }),
    ).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
  });
});
