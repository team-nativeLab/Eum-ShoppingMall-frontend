import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { createRealApi } from './real-api';
import { buildMockConfig } from './test-fixtures';

describe('real ShopApi stubs', () => {
  it('reports review summary and event endpoints as NOT_IMPLEMENTED', async () => {
    const api = createRealApi(buildMockConfig());

    await expect(api.products.getReviewSummary('product-a')).rejects.toBeInstanceOf(ApiError);
    await expect(api.products.getReviewSummary('product-a')).rejects.toMatchObject({
      code: 'NOT_IMPLEMENTED',
    });
    await expect(api.events.list()).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
    await expect(api.events.getById('event-a')).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
  });
});
