import type { Brand } from '../types';

/**
 * 목 브랜드 원본. productCount는 응답할 때 목 상품에서 계산하므로 여기에는 두지 않습니다.
 * isVisible·isFeatured는 관리자 설정을 흉내 낸 값이며 구매자 응답에는 넣지 않습니다.
 */
export interface MockBrandRecord extends Omit<Brand, 'productCount'> {
  /** false이면 구매자 목록에서 빠지고 상세는 NOT_FOUND입니다. */
  isVisible: boolean;
  /** W-32 "이달의 브랜드" 지정 여부 */
  isFeatured: boolean;
}

/**
 * 개발용 로고 이미지(무채색 SVG data URL). 실제 로고가 없어 브랜드명을 글자로 그립니다.
 * real 모드에서는 서버가 로고 URL을 내려줍니다.
 */
function createMockLogo(label: string): string {
  const svgMarkup =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 96">` +
    `<rect width="240" height="96" fill="#ffffff"/>` +
    `<text x="120" y="58" text-anchor="middle" font-family="sans-serif" font-size="26" font-weight="700" fill="#333333">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svgMarkup)}`;
}

/** Figma W32/W33 히어로와 같은 기존 창고 사진을 mock 커버로 재사용합니다. */
const MOCK_WAREHOUSE_COVER = '/assets/web/about-warehouse.png';

/** 사진이 없는 임의 브랜드 상태를 위한 개발용 커버 자리표시자입니다. */
function createMockCover(startColor: string, endColor: string): string {
  const svgMarkup =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 704">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${startColor}"/><stop offset="1" stop-color="${endColor}"/>` +
    `</linearGradient></defs><rect width="1200" height="704" fill="url(#g)"/>` +
    `<rect x="420" y="232" width="360" height="240" rx="16" fill="#9a9a9a"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svgMarkup)}`;
}

/**
 * 목 브랜드. 상품 목(mock/products.ts)의 brand 값과 이름이 정확히 같아야 상품 수·상품 목록이 연결됩니다.
 * 로고·사진 유무, 스토리·사실 정보 유무, 비노출 브랜드를 섞어 화면 상태를 재현합니다.
 */
export const mockBrands: MockBrandRecord[] = [
  {
    id: 'brd-safeguard',
    name: '세이프가드',
    englishName: 'SAFEGUARD',
    logoUrl: createMockLogo('SAFEGUARD'),
    tagline: '머리 보호구 한 분야에 집중해 온 안전모 전문 브랜드입니다.',
    coverImageUrl: MOCK_WAREHOUSE_COVER,
    mainField: '개인보호장비',
    originCountry: '대한민국',
    certification: 'KCs 안전인증',
    story: {
      title: '현장의 머리를 지키는 일에\n집중합니다.',
      body:
        '세이프가드는 건설 현장에서 가장 먼저 지급되는 보호구인 안전모를 중심으로 제품을 만들어 왔습니다.\n\n' +
        '내관 조절, 통풍, 절연처럼 현장에서 요구하는 조건별로 제품을 나누고, 모든 안전모를 안전인증 기준에 맞춰 출고합니다.',
    },
    isVisible: true,
    isFeatured: true,
  },
  {
    id: 'brd-workfit',
    name: '워크핏',
    englishName: 'WORKFIT',
    logoUrl: createMockLogo('WORKFIT'),
    tagline: '하루 종일 신고 입는 안전화·작업복을 만듭니다.',
    coverImageUrl: createMockCover('#e0e0e0', '#c4c4c4'),
    mainField: '안전화·작업복',
    originCountry: '대한민국',
    certification: 'KCs 안전인증',
    story: {
      title: '오래 서 있는 사람을 위한 설계',
      body: '워크핏은 장시간 서서 일하는 작업자의 발과 몸을 기준으로 안전화와 작업복을 설계합니다.',
    },
    isVisible: true,
    isFeatured: false,
  },
  {
    id: 'brd-hisafe',
    name: '하이세이프',
    englishName: 'HISAFE',
    logoUrl: null,
    tagline: '추락 방지와 개인보호장비를 함께 공급합니다.',
    coverImageUrl: null,
    mainField: '추락 방지',
    originCountry: '대한민국',
    certification: null,
    story: null,
    isVisible: true,
    isFeatured: false,
  },
  {
    id: 'brd-gripone',
    name: '그립원',
    englishName: 'GRIPONE',
    logoUrl: createMockLogo('GRIPONE'),
    tagline: '손을 보호하는 작업 장갑 브랜드입니다.',
    coverImageUrl: null,
    mainField: '작업 장갑',
    originCountry: '베트남',
    certification: '자율안전확인',
    story: null,
    isVisible: true,
    isFeatured: false,
  },
  {
    id: 'brd-firekeep',
    name: '파이어킵',
    englishName: null,
    logoUrl: null,
    tagline: null,
    coverImageUrl: null,
    mainField: '소방 안전',
    originCountry: null,
    certification: null,
    story: null,
    isVisible: true,
    isFeatured: false,
  },
  {
    id: 'brd-signlab',
    name: '사인랩',
    englishName: 'SIGNLAB',
    logoUrl: null,
    tagline: '현장 안전 표지와 교통 안전용품을 만듭니다.',
    coverImageUrl: null,
    mainField: '안전 표지',
    originCountry: '대한민국',
    certification: null,
    story: null,
    isVisible: true,
    isFeatured: false,
  },
  {
    id: 'brd-clearview',
    name: '클리어뷰',
    englishName: 'CLEARVIEW',
    logoUrl: createMockLogo('CLEARVIEW'),
    tagline: '김서림 없는 시야를 위한 보안경 브랜드입니다.',
    coverImageUrl: null,
    mainField: '눈 보호구',
    originCountry: '대한민국',
    certification: '자율안전확인',
    story: null,
    isVisible: true,
    isFeatured: false,
  },
  {
    id: 'brd-airguard',
    name: '에어가드',
    englishName: 'AIRGUARD',
    logoUrl: null,
    tagline: '방진·방독 마스크를 전문으로 만듭니다.',
    coverImageUrl: null,
    mainField: '호흡 보호구',
    originCountry: '대한민국',
    certification: 'KCs 안전인증',
    story: null,
    isVisible: true,
    isFeatured: false,
  },
  {
    id: 'brd-silent',
    name: '사일런트',
    englishName: 'SILENT',
    logoUrl: null,
    tagline: '소음 현장을 위한 귀마개·귀덮개 브랜드입니다.',
    coverImageUrl: null,
    mainField: '청력 보호구',
    originCountry: '대한민국',
    certification: '자율안전확인',
    story: null,
    isVisible: true,
    isFeatured: false,
  },
  {
    id: 'brd-duraguard',
    name: 'Duraguard',
    englishName: 'DURAGUARD',
    logoUrl: createMockLogo('Duraguard'),
    tagline: '해외 현장 기준으로 만든 내구성 보호구입니다.',
    coverImageUrl: null,
    mainField: '개인보호장비',
    originCountry: '미국',
    certification: null,
    story: null,
    isVisible: true,
    isFeatured: false,
  },
  {
    id: 'brd-hidden-preview',
    name: '준비중브랜드',
    englishName: null,
    logoUrl: null,
    tagline: '아직 공개하지 않은 브랜드입니다.',
    coverImageUrl: null,
    mainField: null,
    originCountry: null,
    certification: null,
    story: null,
    isVisible: false,
    isFeatured: false,
  },
];
