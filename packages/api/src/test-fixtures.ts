import type { ApiConfig } from './config';
import type { CartItem, Product } from './types';

/** 테스트용 상품을 만드는 함수. 필요한 값만 덮어씁니다. */
export function buildProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prd-test',
    name: '테스트 상품',
    brand: '테스트 브랜드',
    categoryId: 'cat-test',
    price: 10000,
    listPrice: null,
    priceVisible: true,
    stockStatus: 'inStock',
    thumbnailUrl: null,
    summary: '',
    ...overrides,
  };
}

/** 테스트용 장바구니 항목을 만드는 함수 */
export function buildCartItem(product: Product, quantity = 1): CartItem {
  return { id: `cart-${product.id}`, productId: product.id, quantity, product };
}

/** 테스트용 목 모드 ApiConfig(지연 0) */
export function buildMockConfig(overrides: Partial<ApiConfig> = {}): ApiConfig {
  return {
    mode: 'mock',
    baseUrl: '',
    mockLatencyMs: 0,
    mockScenario: 'normal',
    isProduction: false,
    isMockAllowedInProduction: false,
    ...overrides,
  };
}
