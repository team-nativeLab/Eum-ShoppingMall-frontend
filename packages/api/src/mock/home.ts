import type { HeroSlide, HomeCtaBand, PromoBanner, ServiceBenefit } from '../types';

/** 홈 히어로 콘텐츠. 이미지 경로는 앱의 정적 HF Imagery 자산을 가리킵니다. */
export const mockHeroSlides: HeroSlide[] = [
  {
    id: 'safe-tomorrow',
    eyebrow: 'SAFE TOMORROW',
    title: ['사람이 있는 곳에,', '더 안전한 내일을.'],
    description: '현장의 안전이, 모두의 일상을 지킵니다.\n이음산업건설이 안전한 세상을 연결합니다.',
    tagline: ['안전이', '연결하는', '더 큰 가치,', '이음산업건설'],
    imageUrl: '/assets/web/hero-v3.webp',
    destination: '/category/personal-protective-equipment',
    ctaLabel: '제품 둘러보기',
    secondaryCta: { label: '회사소개 보기', destination: '/about' },
  },
  {
    id: 'custom-solution',
    eyebrow: 'CUSTOM SOLUTION',
    title: ['현장에 꼭 맞는,', '맞춤 안전 솔루션.'],
    description:
      '공간과 환경에 맞는 최적의 솔루션을 제안합니다.\n대량·맞춤 견적도 함께 상담합니다.',
    tagline: ['안전이', '연결하는', '더 큰 가치,', '이음산업건설'],
    imageUrl: '/assets/web/promo-blueprint-v2.webp',
    destination: '/solutions',
    ctaLabel: '견적 문의하기',
    secondaryCta: { label: '회사소개 보기', destination: '/about' },
  },
  {
    id: 'sustainable-value',
    eyebrow: 'SUSTAINABLE VALUE',
    title: ['지속 가능한', '안전의 가치.'],
    description: '제조부터 현장까지, 안전의 기준을 지킵니다.\n이음산업건설이 함께합니다.',
    tagline: ['안전이', '연결하는', '더 큰 가치,', '이음산업건설'],
    imageUrl: '/assets/web/promo-concrete-v2.webp',
    destination: '/about',
    ctaLabel: '회사소개 보기',
  },
];

/** 홈 안전 솔루션 배너 콘텐츠 */
export const mockPromoBanners: PromoBanner[] = [
  {
    id: 'safer-worksite',
    title: ['작은 변화가', '큰 안전을 만듭니다.'],
    description: '이음산업건설이 제안하는\n안전 솔루션을 경험해 보십시오.',
    imageUrl: '/assets/web/promo-concrete-v2.webp',
    tone: 'dark',
    destination: '/solutions',
  },
  {
    id: 'custom-solution',
    title: ['현장을 위한', '맞춤 안전 솔루션'],
    description: '공간과 환경에 맞는\n최적의 솔루션을 제안합니다.',
    imageUrl: '/assets/web/promo-blueprint-v2.webp',
    tone: 'light',
    destination: '/solutions',
  },
  {
    id: 'sustainable-value',
    title: ['지속 가능한', '안전의 가치'],
    description: '지금도, 더 안전한 내일을 위해\n이음산업건설이 함께합니다.',
    imageUrl: '/assets/web/promo-forest-v2.webp',
    tone: 'dark',
    destination: '/about',
  },
];

/** 홈에 표시하는 기본 배송/서비스 안내 */
export const mockServiceBenefits: ServiceBenefit[] = [
  { id: 'free-shipping', title: '무료배송', description: '₩50,000 이상 주문 시' },
  { id: 'same-day', title: '당일 출고', description: '평일 오후 2시 이전 결제' },
  { id: 'tax-invoice', title: '세금계산서', description: '제품 구매 시 발행' },
  { id: 'bulk-order', title: '대량·맞춤 견적', description: '수량·상황 맞춤 견적' },
];

/** 홈 하단 견적 문의 띠 */
export const mockHomeCtaBand: HomeCtaBand = {
  eyebrow: 'CUSTOM ORDER',
  title: '현장에 꼭 맞는 안전 솔루션, 지금 상담받으실 수 있습니다.',
  cta: { label: '견적 문의하기', destination: '/solutions' },
};
