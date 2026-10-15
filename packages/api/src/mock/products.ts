import type { AdminProduct, ProductImage, ProductPurchaseNotice, ProductShipping } from '../types';

/** 일반 배송 상품의 배송/교환/반품 안내 본문(목 운영 정책) */
const STANDARD_SHIPPING_POLICY =
  '결제 완료 후 영업일 기준 2~3일 이내 출고됩니다. 단순 변심에 의한 교환·반품은 수령 후 7일 이내 가능하며, 왕복 배송비가 부과됩니다. 맞춤 제작 상품은 교환·반품이 제한될 수 있습니다.';

/** 견적 후 공급 상품의 안내 본문 */
const QUOTE_SHIPPING_POLICY =
  '견적 문의 후 수량과 현장 일정에 맞춰 출고 일정을 안내합니다. 교환·반품 조건은 견적서에 함께 안내됩니다.';

/** 일반 배송 상품의 구매 전 안내 */
const STANDARD_PURCHASE_NOTICES: ProductPurchaseNotice[] = [
  { label: '출고', description: '평일 오후 2시 이전 결제 시 당일 출고' },
  { label: '증빙', description: '세금계산서·현금영수증 발행 가능' },
  { label: '교환·반품', description: '수령 후 7일 이내 접수' },
];

/** 견적 후 공급 상품의 구매 전 안내 */
const QUOTE_PURCHASE_NOTICES: ProductPurchaseNotice[] = [
  { label: '출고', description: '견적 확정 후 일정 안내' },
  { label: '증빙', description: '세금계산서 발행 가능' },
];

// 목 갤러리 배경 톤(플레이스홀더와 같은 무채색 계열). 사진 대신 쓰는 개발용 이미지입니다.
const GALLERY_TONES = [
  ['#ececec', '#dcdcdc'],
  ['#f2f2f2', '#e2e2e2'],
  ['#e8e8e8', '#d6d6d6'],
  ['#f0f0f0', '#dedede'],
  ['#e4e4e4', '#d2d2d2'],
] as const;

/**
 * 상품 상세 갤러리용 목 이미지를 만드는 함수. 실제 사진이 없어 무채색 SVG(data URL)를 씁니다.
 * real 모드에서는 서버가 이미지 URL을 내려줍니다.
 */
function createMockGallery(
  productId: string,
  imageCount: number = GALLERY_TONES.length,
): ProductImage[] {
  return GALLERY_TONES.slice(0, imageCount).map(([startColor, endColor], imageIndex) => {
    const svgMarkup =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0.25" stop-color="${startColor}"/><stop offset="0.75" stop-color="${endColor}"/>` +
      `</linearGradient></defs><rect width="600" height="600" fill="url(#g)"/>` +
      `<rect x="${180 + imageIndex * 12}" y="${200 + imageIndex * 8}" width="240" height="200" rx="12" fill="#d6d6d6"/></svg>`;
    return {
      id: `${productId}-image-${imageIndex + 1}`,
      url: `data:image/svg+xml,${encodeURIComponent(svgMarkup)}`,
      alt: `상품 이미지 ${imageIndex + 1}`,
    };
  });
}

/**
 * 목 상품. 금액 표시/미표시, ₩0, 할인, 품절 상태를 골고루 담아 화면 상태를 재현합니다.
 * 구매자 응답으로 변환하기 전의 관리자 편집용 가격도 보관합니다.
 */
const baseMockProducts: AdminProduct[] = [
  {
    id: 'prd-1001',
    name: 'ABS 안전모 (내관 조절형)',
    brand: '세이프가드',
    categoryId: 'cat-head',
    price: 18000,
    listPrice: 22000,
    priceVisible: true,
    stockStatus: 'inStock',
    thumbnailUrl: null,
    summary: 'KCs 인증 ABS 소재, 땀받이 교체형 내관',
    modelName: 'SG-H100',
    images: createMockGallery('prd-1001'),
    options: [
      {
        id: 'color',
        label: '색상',
        required: true,
        choices: [
          { id: 'white', label: '백색', priceDelta: 0 },
          { id: 'yellow', label: '노란색', priceDelta: 0 },
        ],
      },
    ],
    specifications: [
      { label: '인증', value: 'KCs 안전인증' },
      { label: '재질', value: 'ABS' },
      { label: '조절 방식', value: '내관 조절형' },
      { label: '원산지', value: '대한민국' },
    ],
    certifications: ['KCs 안전인증'],
    shipping: {
      method: '일반 배송 (2~3일)',
      estimate: '평일 기준 2~3일 이내 출고',
      fee: 0,
      countryOfOrigin: '대한민국',
      policy: STANDARD_SHIPPING_POLICY,
    },
    purchaseNotices: STANDARD_PURCHASE_NOTICES,
    rating: 4.7,
    reviewCount: 3,
    createdAt: '2026-09-12T09:00:00.000Z',
    isFeatured: true,
  },
  {
    id: 'prd-1002',
    name: '경량 안전화 4인치',
    brand: '워크핏',
    categoryId: 'cat-foot',
    price: 54000,
    listPrice: null,
    priceVisible: true,
    stockStatus: 'inStock',
    thumbnailUrl: null,
    summary: '강철 선심, 미끄럼 방지 밑창',
    modelName: 'WF-401',
    images: createMockGallery('prd-1002'),
    options: [
      {
        id: 'size',
        label: '사이즈',
        required: true,
        choices: [
          { id: '250', label: '250mm', priceDelta: 0 },
          { id: '260', label: '260mm', priceDelta: 0 },
          { id: '270', label: '270mm', priceDelta: 0 },
        ],
      },
    ],
    specifications: [
      { label: '종류', value: '4인치 안전화' },
      { label: '소재', value: '천연가죽' },
      { label: '선심', value: '강철 선심' },
      { label: '원산지', value: '대한민국' },
    ],
    certifications: ['KCs 안전인증'],
    shipping: {
      method: '일반 배송 (2~3일)',
      estimate: '평일 기준 2~3일 이내 출고',
      fee: 0,
      countryOfOrigin: '대한민국',
      policy: STANDARD_SHIPPING_POLICY,
    },
    purchaseNotices: STANDARD_PURCHASE_NOTICES,
    rating: 4.7,
    reviewCount: 6,
    createdAt: '2026-09-20T09:00:00.000Z',
    isFeatured: true,
  },
  {
    id: 'prd-1003',
    name: '전신 안전벨트 (그네식)',
    brand: '하이세이프',
    categoryId: 'cat-fall',
    price: 126000,
    listPrice: null,
    priceVisible: false,
    stockStatus: 'inStock',
    thumbnailUrl: null,
    summary: '현장 규격에 따라 견적 후 공급합니다',
    modelName: 'HS-FB200',
    images: createMockGallery('prd-1003'),
    options: [],
    specifications: [
      { label: '종류', value: '그네식 안전벨트' },
      { label: '인증', value: 'KCs 안전인증' },
      { label: '사이즈', value: 'Free' },
      { label: '원산지', value: '대한민국' },
    ],
    certifications: ['KCs 안전인증'],
    shipping: {
      method: '견적 후 안내',
      estimate: '견적 문의 후 별도 안내',
      fee: 0,
      countryOfOrigin: '대한민국',
      policy: QUOTE_SHIPPING_POLICY,
    },
    purchaseNotices: QUOTE_PURCHASE_NOTICES,
    rating: null,
    reviewCount: 0,
    createdAt: '2026-09-18T09:00:00.000Z',
    isFeatured: true,
  },
  {
    id: 'prd-1004',
    name: '코팅 장갑 10켤레',
    brand: '그립원',
    categoryId: 'cat-hand',
    price: 0,
    listPrice: null,
    priceVisible: true,
    stockStatus: 'inStock',
    thumbnailUrl: null,
    summary: '이벤트 증정 상품',
    modelName: null,
    images: createMockGallery('prd-1004'),
    options: [],
    specifications: [
      { label: '종류', value: '코팅 장갑' },
      { label: '구성', value: '10켤레' },
      { label: '원산지', value: '대한민국' },
    ],
    certifications: [],
    shipping: {
      method: '일반 배송 (2~3일)',
      estimate: '평일 기준 2~3일 이내 출고',
      fee: 0,
      countryOfOrigin: '대한민국',
      policy: STANDARD_SHIPPING_POLICY,
    },
    purchaseNotices: STANDARD_PURCHASE_NOTICES,
    rating: 4,
    reviewCount: 1,
    createdAt: '2026-09-10T09:00:00.000Z',
    isFeatured: true,
  },
  {
    id: 'prd-1005',
    name: '분말 소화기 3.3kg',
    brand: '파이어킵',
    categoryId: 'cat-fire',
    price: 32000,
    listPrice: 35000,
    priceVisible: true,
    stockStatus: 'soldOut',
    thumbnailUrl: null,
    summary: '형식승인 제품, 벽걸이 브래킷 포함',
    modelName: 'FK-ABC33',
    images: createMockGallery('prd-1005'),
    options: [
      {
        id: 'mount',
        label: '설치 옵션',
        required: true,
        choices: [
          { id: 'wall', label: '벽걸이형', priceDelta: 0 },
          { id: 'stand', label: '스탠드형', priceDelta: 3000 },
        ],
      },
    ],
    specifications: [
      { label: '용량', value: '3.3kg' },
      { label: '종류', value: '분말 소화기' },
      { label: '인증', value: '형식승인' },
      { label: '원산지', value: '대한민국' },
    ],
    certifications: ['형식승인'],
    shipping: {
      method: '일반 배송 (2~3일)',
      estimate: '평일 기준 2~3일 이내 출고',
      fee: 0,
      countryOfOrigin: '대한민국',
      policy: STANDARD_SHIPPING_POLICY,
    },
    purchaseNotices: STANDARD_PURCHASE_NOTICES,
    rating: 5,
    reviewCount: 1,
    createdAt: '2026-08-18T09:00:00.000Z',
    isFeatured: true,
  },
  {
    id: 'prd-1006',
    name: '산업용 CCTV 경고 표지판',
    brand: '사인랩',
    categoryId: 'cat-sign',
    price: 9500,
    listPrice: null,
    priceVisible: false,
    stockStatus: 'soldOut',
    thumbnailUrl: null,
    summary: '알루미늄 복합판 300×400',
    modelName: 'SL-CCTV34',
    images: createMockGallery('prd-1006'),
    options: [],
    specifications: [
      { label: '재질', value: '알루미늄 복합판' },
      { label: '크기', value: '300 × 400mm' },
      { label: '원산지', value: '대한민국' },
    ],
    certifications: [],
    shipping: {
      method: '견적 후 안내',
      estimate: '견적 문의 후 별도 안내',
      fee: 0,
      countryOfOrigin: '대한민국',
      policy: QUOTE_SHIPPING_POLICY,
    },
    purchaseNotices: QUOTE_PURCHASE_NOTICES,
    rating: null,
    reviewCount: 0,
    createdAt: '2026-08-20T09:00:00.000Z',
    isFeatured: true,
  },
  {
    // 선택 옵션만 있는 상품: 옵션을 고르지 않아도 "추가"로 기본 구성을 담을 수 있습니다.
    id: 'prd-1007',
    name: '충전식 헤드 랜턴',
    brand: '하이세이프',
    categoryId: 'cat-industrial',
    price: 27000,
    listPrice: null,
    priceVisible: true,
    stockStatus: 'inStock',
    thumbnailUrl: null,
    summary: 'USB-C 충전, 안전모 클립 겸용 헤드밴드',
    modelName: 'HS-HL30',
    images: createMockGallery('prd-1007', 3),
    options: [
      {
        id: 'extra',
        label: '추가 구성',
        required: false,
        choices: [
          { id: 'battery', label: '예비 배터리', priceDelta: 6000 },
          { id: 'band', label: '교체용 헤드밴드', priceDelta: 2000 },
        ],
      },
    ],
    specifications: [
      { label: '밝기', value: '300lm' },
      { label: '충전', value: 'USB-C' },
      { label: '원산지', value: '중국' },
    ],
    certifications: [],
    shipping: {
      method: '일반 배송 (2~3일)',
      estimate: '평일 기준 2~3일 이내 출고',
      fee: 0,
      countryOfOrigin: '중국',
      policy: STANDARD_SHIPPING_POLICY,
    },
    purchaseNotices: STANDARD_PURCHASE_NOTICES,
    rating: null,
    reviewCount: 0,
    createdAt: '2026-09-25T09:00:00.000Z',
    isFeatured: false,
  },
  {
    // 필수 + 선택 옵션 혼합 상품: 필수 옵션을 모두 고르는 순간 선택 옵션과 함께 한 줄이 됩니다.
    id: 'prd-1008',
    name: '방한 작업 장갑',
    brand: '워크핏',
    categoryId: 'cat-hand',
    price: 12000,
    listPrice: null,
    priceVisible: true,
    stockStatus: 'inStock',
    thumbnailUrl: null,
    summary: '기모 안감, 손바닥 미끄럼 방지 코팅',
    modelName: 'WF-WG12',
    images: createMockGallery('prd-1008', 3),
    options: [
      {
        id: 'size',
        label: '사이즈',
        required: true,
        choices: [
          { id: 'm', label: 'M', priceDelta: 0 },
          { id: 'l', label: 'L', priceDelta: 0 },
        ],
      },
      {
        id: 'wrist',
        label: '손목 토시',
        required: false,
        choices: [{ id: 'add', label: '손목 토시 추가', priceDelta: 3000 }],
      },
    ],
    specifications: [
      { label: '소재', value: '폴리에스터, 기모 안감' },
      { label: '원산지', value: '대한민국' },
    ],
    certifications: [],
    shipping: {
      method: '일반 배송 (2~3일)',
      estimate: '평일 기준 2~3일 이내 출고',
      fee: 0,
      countryOfOrigin: '대한민국',
      policy: STANDARD_SHIPPING_POLICY,
    },
    purchaseNotices: STANDARD_PURCHASE_NOTICES,
    rating: null,
    reviewCount: 0,
    createdAt: '2026-09-28T09:00:00.000Z',
    isFeatured: false,
  },
];

/** 목록 페이지네이션·필터 개수를 확인하기 위한 추가 목 상품 원본: [이름, 브랜드, 카테고리, 가격, 정가, 인증] */
type GeneratedProductSeed = [string, string, string, number, number | null, string[]];

const GENERATED_PRODUCT_SEEDS: GeneratedProductSeed[] = [
  ['고급형 안전모 (통풍형)', '세이프가드', 'cat-head', 24000, null, ['KCs 안전인증']],
  ['경량 안전모 (턱끈 포함)', '하이세이프', 'cat-head', 15000, 17000, ['KCs 안전인증']],
  ['전기용 절연 안전모', '세이프가드', 'cat-head', 29000, null, ['KCs 안전인증']],
  ['안전모 땀받이 교체용 10개', '세이프가드', 'cat-head', 8000, null, []],
  ['투명 보안경 (김서림 방지)', '클리어뷰', 'cat-eye', 6500, null, ['자율안전확인']],
  ['고글형 보안경', '클리어뷰', 'cat-eye', 12000, 14000, ['자율안전확인']],
  ['차광 보안경 5번', '클리어뷰', 'cat-eye', 9000, null, ['자율안전확인']],
  ['오버글라스 보안경', '하이세이프', 'cat-eye', 11000, null, []],
  ['니트릴 코팅 장갑 10켤레', '그립원', 'cat-hand', 13000, null, []],
  ['절단 방지 장갑 5등급', '그립원', 'cat-hand', 18000, 21000, ['자율안전확인']],
  ['내열 장갑 (용접용)', '워크핏', 'cat-hand', 16000, null, []],
  ['방진마스크 1급 20매', '에어가드', 'cat-mask', 22000, 25000, ['KCs 안전인증']],
  ['방진마스크 특급 10매', '에어가드', 'cat-mask', 26000, null, ['KCs 안전인증']],
  ['반면형 방독마스크', '에어가드', 'cat-mask', 34000, null, ['KCs 안전인증']],
  ['방진마스크 필터 교체용', '에어가드', 'cat-mask', 9000, null, []],
  ['경량 안전화 6인치', '워크핏', 'cat-foot', 62000, 68000, ['KCs 안전인증']],
  ['방수 안전화 (겨울용)', '워크핏', 'cat-foot', 74000, null, ['KCs 안전인증']],
  ['안전 슬리퍼', '하이세이프', 'cat-foot', 28000, null, []],
  ['절연 안전화', '세이프가드', 'cat-foot', 81000, null, ['KCs 안전인증']],
  ['폼 귀마개 100쌍', '사일런트', 'cat-ear', 15000, null, ['자율안전확인']],
  ['귀덮개 (헤드밴드형)', '사일런트', 'cat-ear', 23000, 26000, ['자율안전확인']],
  ['밴드형 귀마개', '사일런트', 'cat-ear', 7000, null, []],
  ['상체식 안전대', '하이세이프', 'cat-fall', 48000, null, ['KCs 안전인증']],
  ['안전대 죔줄 (충격흡수형)', '하이세이프', 'cat-fall', 36000, null, ['KCs 안전인증']],
  ['동계 작업복 상하 세트', '워크핏', 'cat-clothing', 89000, 99000, []],
  ['반사 안전조끼', '사인랩', 'cat-road', 9000, null, []],
  ['LED 경광봉', '사인랩', 'cat-road', 14000, null, []],
  ['소화기 거치대 (벽걸이)', '파이어킵', 'cat-fire', 18000, null, []],
  ['구급함 (현장용)', '그립원', 'cat-industrial', 42000, null, []],
  ['CCTV 작동 중 표지판', '사인랩', 'cat-sign', 7000, null, []],
  // 영문 브랜드(W-32 A–Z 색인 확인용)
  ['Duraguard 내충격 안전모', 'Duraguard', 'cat-head', 32000, null, ['KCs 안전인증']],
  ['Duraguard 코팅 장갑 5켤레', 'Duraguard', 'cat-hand', 11000, null, []],
];

/** 시드를 관리자 목 상품으로 바꾸는 함수. 7번째마다 금액 미표시, 9번째마다 품절로 상태를 섞습니다. */
function buildGeneratedProduct(seed: GeneratedProductSeed, seedIndex: number): AdminProduct {
  const [name, brand, categoryId, price, listPrice, certifications] = seed;
  const productId = `prd-${2001 + seedIndex}`;
  const isPriceHidden = (seedIndex + 1) % 7 === 0;
  const shipping: ProductShipping = {
    method: '일반 배송 (2~3일)',
    estimate: '평일 기준 2~3일 이내 출고',
    fee: 0,
    countryOfOrigin: '대한민국',
    policy: STANDARD_SHIPPING_POLICY,
  };
  return {
    id: productId,
    name,
    brand,
    categoryId,
    price,
    listPrice,
    priceVisible: !isPriceHidden,
    stockStatus: (seedIndex + 1) % 9 === 0 ? 'soldOut' : 'inStock',
    thumbnailUrl: null,
    summary: `${brand} ${name}`,
    modelName: `${brand.slice(0, 2)}-${2001 + seedIndex}`,
    images: createMockGallery(productId, 3),
    options: [],
    specifications: [
      { label: '인증', value: certifications.join(', ') || '해당 없음' },
      { label: '원산지', value: '대한민국' },
    ],
    certifications,
    shipping,
    purchaseNotices: STANDARD_PURCHASE_NOTICES,
    rating: null,
    reviewCount: 0,
    // 최신순 정렬이 섞이도록 날짜를 하루씩 다르게 둡니다.
    createdAt: new Date(Date.UTC(2026, 7, 1 + seedIndex, 9)).toISOString(),
    // 베스트 셀러 캐러셀이 여러 페이지가 되도록 일부를 포함합니다.
    isFeatured: seedIndex % 5 === 0,
  };
}

/** 화면 상태 재현용 기본 상품 + 목록 확인용 추가 상품 */
export const mockProducts: AdminProduct[] = [
  ...baseMockProducts,
  ...GENERATED_PRODUCT_SEEDS.map(buildGeneratedProduct),
];
