import { HomeView } from '@/features/products/home-view';

/** 요청마다 상품·재고·프로모션 콘텐츠를 다시 조회합니다. */
export const dynamic = 'force-dynamic';

export default function HomePage() {
  return <HomeView />;
}
