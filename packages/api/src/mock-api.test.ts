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
