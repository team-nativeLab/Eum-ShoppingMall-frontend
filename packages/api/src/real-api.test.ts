import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import { createRealApi } from './real-api';
import { buildMockConfig } from './test-fixtures';

afterEach(() => vi.unstubAllGlobals());

function stubApiResponse(data: unknown) {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, _options?: RequestInit) =>
      new Response(JSON.stringify({ success: true, data }), { status: 200 }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function productDetailResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 12,
    categoryId: null,
    name: '안전모',
    brand: null,
    description: '상품 설명',
    imageUrl: 'https://images.example.test/main.jpg',
    price: 12000,
    listPrice: 15000,
    priceVisible: true,
    certifications: [{ code: 'KCS', label: 'KCs 안전인증' }],
    status: 'ON_SALE',
    soldOut: false,
    skus: [{ id: 1201, optionName: '기본', price: 12000, soldOut: false }],
    rating: 4.5,
    reviewCount: 3,
    modelName: null,
    summary: null,
    countryOfOrigin: '대한민국',
    shippingEstimate: '3일 이내 출고',
    descriptionFormat: 'RICH_V1',
    images: [{ url: 'https://images.example.test/gallery.jpg', alt: '안전모 옆면' }],
    specifications: [{ label: '재질', value: '합성수지' }],
    featured: false,
    todayDeal: false,
    ...overrides,
  };
}

function homeResponse(overrides: Record<string, unknown> = {}) {
  return {
    heroSlides: [
      {
        id: 1,
        eyebrow: '현장 안전',
        title: ['안전한 하루'],
        description: '설명',
        tagline: [],
        imageUrl: 'https://images.example.test/hero.jpg',
        destination: '/about',
        ctaLabel: '보기',
        secondaryCta: { label: '안내', destination: 'https://evil.example/path' },
      },
    ],
    promoBanners: [
      {
        id: 2,
        title: ['프로모션'],
        description: '설명',
        imageUrl: 'https://images.example.test/promo.jpg',
        tone: 'dark',
        destination: '//evil.example/path',
      },
    ],
    serviceBenefits: [{ id: 3, title: '배송 안내', description: '설명', visible: true }],
    featuredProducts: [
      {
        id: 12,
        name: '안전모',
        brand: null,
        categoryId: null,
        imageUrl: null,
        price: 12000,
        listPrice: null,
        priceVisible: true,
        status: 'ON_SALE',
        soldOut: false,
        optionRequired: true,
        certifications: [],
        rating: null,
        reviewCount: 0,
        featured: true,
        todayDeal: false,
      },
    ],
    banners: [{ id: 999 }],
    newProducts: [{ id: 998 }],
    ...overrides,
  };
}

describe('real ShopApi stubs', () => {
  it('forwards member lookup options to the injected buyer auth client', async () => {
    const currentMember = {
      id: 'member-1',
      email: 'member@example.test',
      name: '회원',
      phone: null,
    };
    const getCurrentMember = vi.fn(async () => currentMember);
    const api = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
      { getCurrentMember },
    );
    const controller = new AbortController();

    await expect(api.members.getCurrent({ signal: controller.signal })).resolves.toBe(
      currentMember,
    );
    expect(getCurrentMember).toHaveBeenCalledWith({ signal: controller.signal });
  });

  it('maps home fields to current UI models, drops unsafe links, ignores extra sections, and forwards AbortSignal', async () => {
    const fetchMock = stubApiResponse(homeResponse());
    const api = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );
    const abortController = new AbortController();

    const home = await api.home.getContent({ signal: abortController.signal });

    expect(home.heroSlides[0]).toMatchObject({ id: '1', destination: '/about' });
    expect(home.heroSlides[0]?.secondaryCta).toBeUndefined();
    expect(home.promoBanners[0]?.destination).toBe('');
    expect(home.serviceBenefits[0]?.isVisible).toBe(true);
    expect(home.featuredProducts[0]).toMatchObject({
      kind: 'summary',
      id: '12',
      optionRequired: true,
    });
    expect('banners' in home).toBe(false);
    expect('newProducts' in home).toBe(false);
    expect(new URL(fetchMock.mock.calls[0]?.[0] as string).pathname).toBe('/api/v1/home');
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(abortController.signal);
  });

  it('requires a success/data envelope for home and rejects raw, missing, and malformed envelopes', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const api = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );
    const invalidResponses: unknown[] = [
      homeResponse(),
      {},
      { success: true },
      { success: true, data: null },
    ];

    for (const body of invalidResponses) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 }));
      await expect(api.home.getContent()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    }
  });

  it('preserves success:false server errors on strict home requests', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, code: 'HOME_UNAVAILABLE', message: '일시 오류' }),
        {
          status: 503,
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );

    await expect(api.home.getContent()).rejects.toMatchObject({
      code: 'HTTP',
      status: 503,
      serverCode: 'HOME_UNAVAILABLE',
      message: '일시 오류',
    });
  });

  it('requires a success/data envelope for popups and rejects raw, missing, and malformed envelopes', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const api = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );
    const invalidResponses: unknown[] = [[], {}, { success: true }, { success: true, data: {} }];

    for (const body of invalidResponses) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 }));
      await expect(api.popups.list()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    }
  });

  it('maps an empty popup data array and defaults optional home collections and fields', async () => {
    stubApiResponse([]);
    const api = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );
    await expect(api.popups.list()).resolves.toEqual([]);

    stubApiResponse({
      heroSlides: [
        {
          id: 1,
          eyebrow: '안내',
          title: ['제목'],
          imageUrl: 'https://images.example.test/hero.jpg',
          destination: '/',
          ctaLabel: '보기',
        },
      ],
      promoBanners: [
        {
          id: 2,
          title: ['프로모션'],
          imageUrl: 'https://images.example.test/promo.jpg',
          tone: 'light',
          destination: '/',
        },
      ],
      serviceBenefits: [{ id: 3, title: '배송' }],
    });
    const homeApi = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );
    await expect(homeApi.home.getContent()).resolves.toMatchObject({
      heroSlides: [{ description: '', tagline: [] }],
      promoBanners: [{ description: '' }],
      serviceBenefits: [{ description: '', isVisible: true }],
      featuredProducts: [],
    });
  });

  it('rejects malformed home arrays, unknown enum values, and unsafe product status', async () => {
    const fetchMock = stubApiResponse(
      homeResponse({ promoBanners: [{ ...homeResponse().promoBanners[0], tone: 'bright' }] }),
    );
    const api = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );
    await expect(api.home.getContent()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: homeResponse({
              featuredProducts: [{ ...homeResponse().featuredProducts[0], status: 'PAUSED' }],
            }),
          }),
          { status: 200 },
        ),
    );
    await expect(api.home.getContent()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ success: true, data: homeResponse({ serviceBenefits: null }) }),
          { status: 200 },
        ),
    );
    await expect(api.home.getContent()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('maps popup order and nullable images while forwarding AbortSignal', async () => {
    const fetchMock = stubApiResponse([
      { id: 8, title: '첫째', imageUrl: null, body: '본문' },
      { id: 7, title: '둘째', imageUrl: '/popup.jpg', body: '본문2' },
    ]);
    const api = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );
    const abortController = new AbortController();
    const popups = await api.popups.list({ signal: abortController.signal });
    expect(popups.map(({ id }) => id)).toEqual(['8', '7']);
    expect(popups[0]?.imageUrl).toBeNull();
    expect(popups[1]?.imageUrl).toBe('/popup.jpg');
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(abortController.signal);
  });

  it('maps product detail fields, preserves image order, and forwards the request signal', async () => {
    const fetchMock = stubApiResponse(productDetailResponse());
    const api = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );
    const abortController = new AbortController();

    const product = await api.products.getDetailById('12', { signal: abortController.signal });

    expect(product).toMatchObject({
      kind: 'api-detail',
      id: '12',
      categoryId: null,
      brand: null,
      price: 12000,
      listPrice: 15000,
      priceVisible: true,
      stockStatus: 'inStock',
      summary: null,
      detailDescription: '상품 설명',
      detailDescriptionFormat: 'rich-v1',
      modelName: null,
      countryOfOrigin: '대한민국',
      shippingEstimate: '3일 이내 출고',
      certifications: ['KCs 안전인증'],
      specifications: [{ label: '재질', value: '합성수지' }],
    });
    expect(product.images.map(({ url }) => url)).toEqual([
      'https://images.example.test/gallery.jpg',
    ]);
    expect(product.images[0]?.id).toBe('api-12-image-0');
    const requestUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(requestUrl.pathname).toBe('/api/v1/products/12');
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(abortController.signal);
  });

  it('hides all prices for private-price products and uses imageUrl when no gallery images exist', async () => {
    stubApiResponse(
      productDetailResponse({
        priceVisible: false,
        price: 12000,
        listPrice: 15000,
        skus: [{ id: 1201, optionName: '기본', price: 13500, soldOut: false }],
        images: [],
      }),
    );
    const api = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );

    const product = await api.products.getDetailById('12');

    expect(product).toMatchObject({
      priceVisible: false,
      price: null,
      listPrice: null,
      thumbnailUrl: 'https://images.example.test/main.jpg',
      images: [],
      skus: [{ id: '1201', optionName: '기본', price: null, soldOut: false }],
    });
  });

  it('rejects a missing visible SKU price but redacts prices for hidden-price products', async () => {
    const fetchMock = stubApiResponse(
      productDetailResponse({
        skus: [{ id: 1201, optionName: '기본', price: null, soldOut: false }],
      }),
    );
    const api = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );

    await expect(api.products.getDetailById('12')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });

    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: productDetailResponse({
              priceVisible: false,
              skus: [{ id: 1201, optionName: '기본', price: 13500, soldOut: false }],
            }),
          }),
          { status: 200 },
        ),
    );
    const hiddenPriceProduct = await api.products.getDetailById('12');
    expect(hiddenPriceProduct).toMatchObject({
      kind: 'api-detail',
      skus: [{ price: null }],
    });
  });

  it('rejects unsafe, malformed, or mismatched product IDs before exposing detail data', async () => {
    const fetchMock = stubApiResponse(productDetailResponse());
    const api = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );

    await expect(api.products.getDetailById('12/../outside')).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    await expect(api.products.getDetailById('9007199254740992')).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    await expect(api.products.getDetailById('13')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(['HIDDEN', 'DELETED'])('maps %s details to NOT_FOUND', async (status) => {
    stubApiResponse(productDetailResponse({ status }));
    const api = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );

    await expect(api.products.getDetailById('12')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects unknown status, sold-out mismatch, and visible products without a price', async () => {
    const fetchMock = stubApiResponse(productDetailResponse({ status: 'PAUSED' }));
    const api = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );

    await expect(api.products.getDetailById('12')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });

    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: productDetailResponse({ status: 'SOLD_OUT', soldOut: false }),
          }),
          { status: 200 },
        ),
    );
    await expect(api.products.getDetailById('12')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });

    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ success: true, data: productDetailResponse({ price: null }) }),
          {
            status: 200,
          },
        ),
    );
    await expect(api.products.getDetailById('12')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('rejects unsupported description formats and unsafe image URLs', async () => {
    const fetchMock = stubApiResponse(productDetailResponse({ descriptionFormat: 'HTML' }));
    const api = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );

    await expect(api.products.getDetailById('12')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });

    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: productDetailResponse({ imageUrl: 'javascript:alert(1)', images: [] }),
          }),
          { status: 200 },
        ),
    );
    await expect(api.products.getDetailById('12')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });

    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: productDetailResponse({
              images: [{ url: '//images.example.test/image.jpg', alt: '이미지' }],
            }),
          }),
          { status: 200 },
        ),
    );
    await expect(api.products.getDetailById('12')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

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

  it.each([
    'javascript:alert(1)',
    '//images.example.test/image.jpg',
    '/\\\\images.example.test/image.jpg',
    'https://user:password@images.example.test/image.jpg',
  ])('rejects unsafe catalog summary image URL %s', async (imageUrl) => {
    stubApiResponse({
      content: [
        {
          id: 12,
          categoryId: null,
          name: '안전모',
          brand: null,
          imageUrl,
          price: null,
          listPrice: null,
          priceVisible: false,
          rating: null,
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
      size: 12,
      totalElements: 1,
    });
    const api = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );

    await expect(api.products.listCatalog()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
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

  it('maps related product summaries, bounds the limit, and forwards cancellation', async () => {
    const fetchMock = stubApiResponse([
      {
        id: 21,
        categoryId: null,
        name: '안전장갑',
        brand: null,
        imageUrl: null,
        price: null,
        listPrice: null,
        priceVisible: false,
        rating: null,
        certifications: [],
        status: 'ON_SALE',
        soldOut: false,
        optionRequired: false,
        reviewCount: 0,
        featured: false,
        todayDeal: false,
      },
    ]);
    const api = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );
    const abortController = new AbortController();

    await expect(
      api.products.listRelated('12', { limit: 48 }, { signal: abortController.signal }),
    ).resolves.toMatchObject([
      {
        kind: 'summary',
        id: '21',
        categoryId: null,
        price: null,
        priceVisible: false,
        stockStatus: 'inStock',
      },
    ]);

    const requestUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(requestUrl.pathname).toBe('/api/v1/products/12/related');
    expect(requestUrl.searchParams.get('limit')).toBe('20');
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(abortController.signal);
  });

  it('uses the related endpoint default limit and rejects non-numeric or unsafe product IDs', async () => {
    const fetchMock = stubApiResponse([]);
    const api = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );

    await expect(api.products.listRelated('8')).resolves.toEqual([]);
    const requestUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(requestUrl.searchParams.get('limit')).toBe('10');

    await expect(api.products.listRelated('8', { limit: 0 })).resolves.toEqual([]);
    const boundedRequestUrl = new URL(fetchMock.mock.calls[1]?.[0] as string);
    expect(boundedRequestUrl.searchParams.get('limit')).toBe('1');

    await expect(api.products.listRelated('8/../../outside')).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    await expect(api.products.listRelated('9007199254740992')).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid related summaries and maps a hidden source product 404', async () => {
    stubApiResponse([{ id: 21, status: 'HIDDEN' }]);
    const invalidApi = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );
    await expect(invalidApi.products.listRelated('12')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });

    const notFoundFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ success: false, code: 'NOT_FOUND' }), { status: 404 }),
    );
    vi.stubGlobal('fetch', notFoundFetch);
    const notFoundApi = createRealApi(
      buildMockConfig({ mode: 'real', baseUrl: 'https://api.example.test' }),
    );
    await expect(notFoundApi.products.listRelated('12')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
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
