import type { ApiFailureKind } from '@eum/api/errors';

/** 브랜드 조회 실패 종류별 안내 문구(합니다체). 다시 시도는 temporary에서만 보여 줍니다. */
export const BRAND_LOAD_ERROR_COPY: Record<ApiFailureKind, { title: string; description: string }> =
  {
    config: {
      title: '서비스 설정 문제로 브랜드를 불러올 수 없습니다',
      description: '관리자에게 문의해 주세요.',
    },
    notImplemented: {
      title: '브랜드 조회 기능을 준비하고 있습니다',
      description: '조금만 기다려 주세요.',
    },
    notFound: {
      title: '브랜드를 찾을 수 없습니다',
      description: '주소가 바뀌었거나 더 이상 공개하지 않는 브랜드입니다.',
    },
    temporary: {
      title: '브랜드를 불러오지 못했습니다',
      description: '잠시 후 다시 시도해 주세요.',
    },
  };
