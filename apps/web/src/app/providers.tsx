'use client';

import { shouldRetryQuery } from '@eum/api/errors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { CartProvider } from '@/features/cart/cart-context';
import { MemberSessionProvider } from '@/features/auth/member-session';
import { CheckoutProvider } from '@/features/checkout/checkout-context';
import { LocalCollectionsProvider } from '@/features/products/local-collections-context';

// 기본값: 재시도할 가치가 있는 오류(네트워크 등)만 1번 재시도, 30초 동안은 새로 받지 않음
function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => shouldRetryQuery(failureCount, error),
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  });
}

/** 클라이언트 전역 provider 묶음(QueryClient, 장바구니). 요청마다 QueryClient가 공유되지 않도록 useState로 만듭니다. */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <LocalCollectionsProvider>
        <MemberSessionProvider>
          <CheckoutProvider>
            <CartProvider>{children}</CartProvider>
          </CheckoutProvider>
        </MemberSessionProvider>
      </LocalCollectionsProvider>
    </QueryClientProvider>
  );
}
