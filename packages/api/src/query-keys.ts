import type { ProductListParams } from './shop-api';

/** TanStack Query 키 모음. web과 admin이 같은 키 규칙을 씁니다. */
export const queryKeys = {
  products: {
    all: ['products'] as const,
    list: (params: ProductListParams = {}) => ['products', 'list', params] as const,
    detail: (productId: string) => ['products', 'detail', productId] as const,
  },
  categories: { all: ['categories'] as const },
  quotes: { all: ['quotes'] as const },
  notices: { all: ['notices'] as const },
  faqs: { all: ['faqs'] as const },
  members: { all: ['members'] as const },
  orders: {
    byMember: (memberId: string) => ['orders', 'member', memberId] as const,
    detail: (orderId: string) => ['orders', 'detail', orderId] as const,
  },
};
