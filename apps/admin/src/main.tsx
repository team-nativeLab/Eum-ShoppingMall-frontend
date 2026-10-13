import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './index.css';
import { shouldRetryQuery } from '@eum/api/errors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { adminRoutes } from './routes';

// SPA라 앱 전체에서 QueryClient 하나를 씁니다.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 설정 오류·스텁(NOT_IMPLEMENTED) 등 다시 시도해도 같은 오류는 재시도하지 않습니다.
      retry: (failureCount, error) => shouldRetryQuery(failureCount, error),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createBrowserRouter(adminRoutes);

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root 요소를 찾을 수 없습니다.');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
