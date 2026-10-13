import { describe, expect, it } from 'vitest';
import { ApiConfigError } from './errors';
import { createMockApi } from './mock-api';
import { buildMockConfig } from './test-fixtures';

const testConfig = buildMockConfig();

describe('목 API 시나리오', () => {
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
    const priceSortedPage = await mockApi.products.list({ sortBy: 'priceAsc', pageSize: 20 });
    expect(priceSortedPage.items.at(-1)?.priceVisible).toBe(false);
  });

  it('키워드, 하위 카테고리, 브랜드·인증, 품절 제외, 정렬과 페이지 조건을 적용합니다', async () => {
    const mockApi = createMockApi(testConfig);
    const categoryPage = await mockApi.products.list({ categoryId: 'cat-ppe', pageSize: 20 });
    expect(categoryPage.items.map((product) => product.id)).toEqual([
      'prd-1001',
      'prd-1002',
      'prd-1003',
      'prd-1004',
    ]);

    const brandPage = await mockApi.products.list({ brand: ['워크핏'] });
    expect(brandPage.items.map((product) => product.id)).toEqual(['prd-1002']);
    const certifiedPage = await mockApi.products.list({ certification: ['KCs 안전인증'] });
    expect(certifiedPage.items.map((product) => product.id)).toContain('prd-1002');

    const searchedPage = await mockApi.products.list({ keyword: '그립원' });
    expect(searchedPage.items.map((product) => product.id)).toEqual(['prd-1004']);

    const availablePage = await mockApi.products.list({ excludeSoldOut: true });
    expect(availablePage.items.every((product) => product.stockStatus === 'inStock')).toBe(true);
    const ascendingPage = await mockApi.products.list({ sortBy: 'priceAsc' });
    expect(ascendingPage.items[0]?.price).toBe(0);

    const secondPage = await mockApi.products.list({ page: 2, pageSize: 2 });
    expect(secondPage.items.map((product) => product.id)).toEqual(['prd-1003', 'prd-1004']);
    expect(secondPage).toMatchObject({ page: 2, pageSize: 2, totalCount: 6 });
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
  });

  it('사업자 정보는 푸터에 필요한 항목을 모두 반환하고, error 시나리오에서는 실패합니다', async () => {
    const companyInfo = await createMockApi(testConfig).company.getInfo();
    expect(Object.values(companyInfo).every((fieldValue) => fieldValue.trim().length > 0)).toBe(
      true,
    );
    await expect(
      createMockApi({ ...testConfig, mockScenario: 'error' }).company.getInfo(),
    ).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('검색 자동완성은 이름과 브랜드에서 최대 5개를 찾습니다', async () => {
    const suggestions = await createMockApi(testConfig).products.suggest('안전');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(5);
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
