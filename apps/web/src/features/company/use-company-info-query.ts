'use client';

import { queryKeys } from '@eum/api/query-keys';
import { useQuery } from '@tanstack/react-query';
import { getShopApi } from '@/lib/shop-api';

/** 푸터에 표시할 사업자·고객센터 정보를 서버에서 가져옵니다. 자주 바뀌지 않아 오래 캐시합니다. */
export function useCompanyInfoQuery() {
  return useQuery({
    queryKey: queryKeys.company.info,
    queryFn: async ({ signal }) => (await getShopApi()).company.getInfo({ signal }),
    staleTime: 10 * 60_000,
  });
}
