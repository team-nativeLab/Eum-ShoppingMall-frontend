import { createRealApi } from '@eum/api/real-api';
import type { ShopApi } from '@eum/api/shop-api';
import { getAdminApiConfig } from './api-config';

let shopApiPromise: Promise<ShopApi> | null = null;

// 설정에 맞는 ShopApi 구현을 만드는 함수
async function loadShopApi(): Promise<ShopApi> {
  const apiConfig = getAdminApiConfig();
  // import.meta.env.VITE_API_MODE는 빌드 때 문자열로 치환됩니다.
  // "real"로 빌드하면 이 조건이 항상 false가 되어 목 구현·목 데이터 chunk가 산출물에서 빠집니다.
  if (import.meta.env.VITE_API_MODE !== 'real' && apiConfig.mode === 'mock') {
    const { createMockApi } = await import('@eum/api/mock-api');
    return createMockApi(apiConfig);
  }
  return createRealApi(apiConfig);
}

/** admin 앱에서 쓰는 ShopApi를 한 번만 만들어 돌려주는 함수. 설정 오류는 첫 조회에서 드러납니다. */
export function getShopApi(): Promise<ShopApi> {
  shopApiPromise ??= loadShopApi().catch((loadError: unknown) => {
    shopApiPromise = null;
    throw loadError;
  });
  return shopApiPromise;
}
