import { describe, expect, it } from 'vitest';
import { ApiConfigError } from './errors';
import { createMockApi } from './mock-api';
import { mockProducts } from './mock/products';
import { mockReviews } from './mock/reviews';
import { mockAddresses } from './mock/addresses';
import { mockNotices } from './mock/support';
import { buildMockConfig } from './test-fixtures';

const testConfig = buildMockConfig();

describe('목 API 시나리오', () => {
  it('공지 목은 Figma pagination 10페이지에 맞춰 100건을 제공합니다', () => {
    expect(mockNotices).toHaveLength(100);
  });

  it('normal: 목 상품을 돌려주고 금액 미표시 상품도 포함합니다', async () => {
    const productPage = await createMockApi(testConfig).products.list();
    expect(productPage.totalCount).toBeGreaterThan(0);
    expect(productPage.items.some((product) => !product.priceVisible)).toBe(true);
    expect(
      productPage.items
        .filter((product) => !product.priceVisible)
        .every((product) => product.price === null && product.listPrice === null),
    ).toBe(true);
  });

  it('숨김 가격은 범위 필터에서 빠지고, 가격 정렬에서도 별도 가격처럼 정렬되지 않습니다', async () => {
    const mockApi = createMockApi(testConfig);
    const priceFilteredPage = await mockApi.products.list({ minPrice: 1, maxPrice: 200000 });
    expect(priceFilteredPage.items.every((product) => product.priceVisible)).toBe(true);
    const priceSortedPage = await mockApi.products.list({ sortBy: 'priceAsc', pageSize: 100 });
    expect(priceSortedPage.items.at(-1)?.priceVisible).toBe(false);
  });

  it('키워드, 하위 카테고리, 브랜드·인증, 품절 제외, 정렬과 페이지 조건을 적용합니다', async () => {
    const mockApi = createMockApi(testConfig);
    const categoryPage = await mockApi.products.list({ categoryId: 'cat-ppe', pageSize: 100 });
    expect(categoryPage.items.map((product) => product.id)).toEqual(
      expect.arrayContaining(['prd-1001', 'prd-1002', 'prd-1003', 'prd-1004']),
    );
    // 개인보호장비 하위 카테고리 상품만 포함합니다(소방·표지 상품 제외).
    expect(categoryPage.items.map((product) => product.id)).not.toContain('prd-1005');
    expect(categoryPage.items.map((product) => product.id)).not.toContain('prd-1006');

    const brandPage = await mockApi.products.list({ brand: ['워크핏'], pageSize: 100 });
    expect(brandPage.items.map((product) => product.id)).toContain('prd-1002');
    expect(brandPage.items.every((product) => product.brand === '워크핏')).toBe(true);
    const certifiedPage = await mockApi.products.list({ certification: ['KCs 안전인증'] });
    expect(certifiedPage.items.map((product) => product.id)).toContain('prd-1002');

    const searchedPage = await mockApi.products.list({ keyword: '파이어킵' });
    expect(searchedPage.items.map((product) => product.id)).toEqual(['prd-2028', 'prd-1005']);

    const availablePage = await mockApi.products.list({ excludeSoldOut: true });
    expect(availablePage.items.every((product) => product.stockStatus === 'inStock')).toBe(true);
    const ascendingPage = await mockApi.products.list({ sortBy: 'priceAsc' });
    expect(ascendingPage.items[0]?.price).toBe(0);

    const secondPage = await mockApi.products.list({ page: 2, pageSize: 2 });
    expect(secondPage.items.map((product) => product.id)).toEqual(['prd-1003', 'prd-1004']);
    expect(secondPage).toMatchObject({ page: 2, pageSize: 2, totalCount: mockProducts.length });
  });

  it('평점순은 평점이 없는 상품을 뒤에 두고, 모든 정렬은 품절 상품을 페이지 분할 전에 뒤로 보냅니다', async () => {
    const mockApi = createMockApi(testConfig);
    const sortOrders = ['recommended', 'priceAsc', 'priceDesc', 'newest', 'ratingDesc'] as const;

    for (const sortBy of sortOrders) {
      const fullPage = await mockApi.products.list({ sortBy, pageSize: 100 });
      const firstPage = await mockApi.products.list({ sortBy, page: 1, pageSize: 5 });
      const secondPage = await mockApi.products.list({ sortBy, page: 2, pageSize: 5 });
      const pagedItems = [...firstPage.items, ...secondPage.items];
      const firstSoldOutIndex = fullPage.items.findIndex(
        (product) => product.stockStatus === 'soldOut',
      );

      expect(pagedItems).toEqual(fullPage.items.slice(0, 10));
      expect(firstSoldOutIndex).toBeGreaterThanOrEqual(0);
      expect(
        fullPage.items
          .slice(0, firstSoldOutIndex)
          .every((product) => product.stockStatus === 'inStock'),
      ).toBe(true);
      expect(
        fullPage.items
          .slice(firstSoldOutIndex)
          .every((product) => product.stockStatus === 'soldOut'),
      ).toBe(true);
    }

    const ratingPage = await mockApi.products.list({ sortBy: 'ratingDesc', pageSize: 100 });
    for (const stockStatus of ['inStock', 'soldOut'] as const) {
      const stockGroup = ratingPage.items.filter((product) => product.stockStatus === stockStatus);
      const ratedProducts = stockGroup.filter((product) => product.rating !== null);
      const unratedProducts = stockGroup.filter((product) => product.rating === null);
      expect(ratedProducts.map((product) => product.rating)).toEqual(
        [...ratedProducts.map((product) => product.rating)].sort(
          (leftRating, rightRating) => (rightRating ?? 0) - (leftRating ?? 0),
        ),
      );
      expect(stockGroup.slice(ratedProducts.length)).toEqual(unratedProducts);
    }
  });

  it('홈 콘텐츠는 공개 가격 projection이 적용된 featured 상품을 반환합니다', async () => {
    const homeContent = await createMockApi(testConfig).home.getContent();
    expect(homeContent.heroSlides.length).toBeGreaterThan(0);
    expect(homeContent.promoBanners).toHaveLength(3);
    expect(
      homeContent.featuredProducts.every(
        (product) => product.priceVisible || product.price === null,
      ),
    ).toBe(true);
  });

  it('홈 히어로는 데스크톱 세로 문구를, 상위 카테고리는 카테고리 바 소개를 함께 반환합니다', async () => {
    const mockApi = createMockApi(testConfig);
    const homeContent = await mockApi.home.getContent();
    expect(homeContent.heroSlides.every((slide) => Array.isArray(slide.tagline))).toBe(true);
    const categories = await mockApi.categories.list();
    const topLevelCategories = categories.filter((category) => category.parentId === null);
    expect(topLevelCategories.every((category) => category.description !== null)).toBe(true);
    expect(homeContent.heroSlides.every((slide) => slide.ctaLabel.trim().length > 0)).toBe(true);
    expect(homeContent.ctaBand).not.toBeNull();
  });

  it('사업자 정보는 푸터에 필요한 항목을 모두 반환하고, error 시나리오에서는 실패합니다', async () => {
    const companyInfo = await createMockApi(testConfig).company.getInfo();
    expect(
      Object.values(companyInfo).every(
        (fieldValue) => fieldValue === null || fieldValue.trim().length > 0,
      ),
    ).toBe(true);
    expect(companyInfo.customerCenterTel).toMatch(/^[0-9+]+$/);
    expect(companyInfo.email).toBe('info@example.com');
    expect(companyInfo.quoteEmail).toBe('quote@example.com');
    await expect(
      createMockApi({ ...testConfig, mockScenario: 'error' }).company.getInfo(),
    ).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('검색 자동완성은 이름과 브랜드에서 최대 5개를 찾습니다', async () => {
    const suggestions = await createMockApi(testConfig).products.suggest('안전');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(5);
  });

  it('필터 개수는 카테고리·검색어 범위에서 세고, 검색 카테고리 개수는 상위 카테고리로 모읍니다', async () => {
    const mockApi = createMockApi(testConfig);
    const categoryFacets = await mockApi.products.facets({ categoryId: 'cat-ppe' });
    const categoryPage = await mockApi.products.list({ categoryId: 'cat-ppe', pageSize: 100 });
    expect(categoryFacets.totalCount).toBe(categoryPage.totalCount);
    const brandCountSum = categoryFacets.brands.reduce(
      (countSum, facet) => countSum + facet.count,
      0,
    );
    expect(brandCountSum).toBe(categoryPage.totalCount);

    const searchFacets = await mockApi.products.facets({ keyword: '안전모' });
    expect(searchFacets.categories).toEqual([{ value: 'cat-ppe', count: searchFacets.totalCount }]);
  });

  it('카테고리를 넘겨도 categories와 keywordTotalCount는 검색어 범위 전체 기준 그대로입니다', async () => {
    const mockApi = createMockApi(testConfig);
    const keywordFacets = await mockApi.products.facets({ keyword: '안전' });
    const narrowedFacets = await mockApi.products.facets({
      keyword: '안전',
      categoryId: 'cat-ppe',
    });
    expect(narrowedFacets.categories).toEqual(keywordFacets.categories);
    expect(narrowedFacets.categories.length).toBeGreaterThan(1);
    expect(narrowedFacets.keywordTotalCount).toBe(keywordFacets.keywordTotalCount);
    // totalCount만 카테고리 범위로 좁혀집니다.
    expect(narrowedFacets.totalCount).toBeLessThan(narrowedFacets.keywordTotalCount);

    const keywordPage = await mockApi.products.list({ keyword: '안전', pageSize: 100 });
    expect(keywordFacets.keywordTotalCount).toBe(keywordPage.totalCount);
    const allFacets = await mockApi.products.facets();
    expect(allFacets.keywordTotalCount).toBe(mockProducts.length);
  });

  it('관련 상품은 기준 상품을 빼고 같은 상위 카테고리를 먼저, 개수 제한을 지켜 돌려줍니다', async () => {
    const mockApi = createMockApi(testConfig);
    const relatedProducts = await mockApi.products.listRelated('prd-1001', { limit: 4 });
    expect(relatedProducts).toHaveLength(4);
    expect(relatedProducts.map((product) => product.id)).not.toContain('prd-1001');
    expect(relatedProducts[0]?.categoryId).toMatch(/^cat-(head|eye|foot|mask|ear|fall|hand)$/);
    expect(relatedProducts.every((product) => product.priceVisible || product.price === null)).toBe(
      true,
    );
    expect(await mockApi.products.listRelated('none')).toEqual([]);
  });

  it('추천 상품은 개수 제한을 지키고 금액 비공개 상품의 가격을 숨깁니다', async () => {
    const recommendedProducts = await createMockApi(testConfig).products.listRecommended({
      limit: 10,
    });
    expect(recommendedProducts).toHaveLength(10);
    expect(
      recommendedProducts.every((product) => product.priceVisible || product.price === null),
    ).toBe(true);
    await expect(
      createMockApi({ ...testConfig, mockScenario: 'error' }).products.listRecommended(),
    ).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('목 상품의 평점·리뷰 수는 목 리뷰와 일치합니다(소수 첫째 자리 반올림)', () => {
    for (const product of mockProducts) {
      const productReviews = mockReviews.filter((review) => review.productId === product.id);
      expect(product.reviewCount, product.id).toBe(productReviews.length);
      if (productReviews.length === 0) {
        expect(product.rating, product.id).toBeNull();
        continue;
      }
      const ratingSum = productReviews.reduce((sum, review) => sum + review.rating, 0);
      expect(product.rating, product.id).toBe(
        Math.round((ratingSum / productReviews.length) * 10) / 10,
      );
    }
  });

  it('리뷰는 상품별 최신순으로 페이지를 나눠 돌려줍니다', async () => {
    const mockApi = createMockApi(testConfig);
    const reviewPage = await mockApi.products.listReviews('prd-1001', { pageSize: 2 });
    expect(reviewPage.totalCount).toBe(3);
    expect(reviewPage.items).toHaveLength(2);
    expect(reviewPage.items[0]!.createdAt >= reviewPage.items[1]!.createdAt).toBe(true);
    expect((await mockApi.products.listReviews('prd-1003')).items).toEqual([]);
  });

  it('추천 검색어를 돌려줍니다', async () => {
    const keywords = await createMockApi(testConfig).search.recommendedKeywords();
    expect(keywords.length).toBeGreaterThan(0);
  });

  it('empty: 빈 목록을 돌려줍니다', async () => {
    const productPage = await createMockApi({
      ...testConfig,
      mockScenario: 'empty',
    }).products.list();
    expect(productPage.items).toEqual([]);
  });

  it('error: NETWORK 오류를 냅니다', async () => {
    await expect(
      createMockApi({ ...testConfig, mockScenario: 'error' }).notices.list(),
    ).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('응답은 복사본이라 바꿔도 다음 응답에 영향이 없습니다', async () => {
    const mockApi = createMockApi(testConfig);
    const firstPage = await mockApi.products.list();
    firstPage.items[0]!.name = '변경';
    expect((await mockApi.products.list()).items[0]?.name).not.toBe('변경');
  });

  it('없는 상품은 NOT_FOUND입니다', async () => {
    await expect(createMockApi(testConfig).products.getById('none')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('₩0의 표시 가격 상품은 주문할 수 있고 숨김 가격·품절 상품은 거절합니다', async () => {
    const mockApi = createMockApi(testConfig);
    const address = mockAddresses[0]!;
    const zeroPriceReceipt = await mockApi.orders.create({
      lines: [{ productId: 'prd-1004', quantity: 1, optionId: null }],
      shippingAddress: address,
      deliveryRequest: '',
      paymentMethod: 'creditCard',
      couponId: null,
      pointsToUse: 0,
    });
    expect(zeroPriceReceipt.productTotal).toBe(0);
    expect(zeroPriceReceipt.shippingFee).toBe(0);
    expect(zeroPriceReceipt.paymentTotal).toBe(0);

    const hiddenPriceProduct = mockProducts.find((product) => !product.priceVisible);
    expect(hiddenPriceProduct).toBeDefined();
    await expect(
      mockApi.orders.create({
        lines: [{ productId: hiddenPriceProduct!.id, quantity: 1, optionId: null }],
        shippingAddress: address,
        deliveryRequest: '',
        paymentMethod: 'creditCard',
        couponId: null,
        pointsToUse: 0,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });

    await expect(
      mockApi.orders.create({
        lines: [{ productId: 'prd-1005', quantity: 1, optionId: 'mount:wall' }],
        shippingAddress: address,
        deliveryRequest: '',
        paymentMethod: 'creditCard',
        couponId: null,
        pointsToUse: 0,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('AbortSignal로 취소하면 AbortError로 끝납니다', async () => {
    const abortController = new AbortController();
    const pendingList = createMockApi({ ...testConfig, mockLatencyMs: 1000 }).products.list(
      {},
      { signal: abortController.signal },
    );
    abortController.abort();
    await expect(pendingList).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('운영에서 허용 플래그 없이 만들면 거부합니다', () => {
    expect(() => createMockApi({ ...testConfig, isProduction: true })).toThrow(ApiConfigError);
  });
});
