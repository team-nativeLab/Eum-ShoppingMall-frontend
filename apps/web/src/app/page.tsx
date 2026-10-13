import { HomeView } from '@/features/products/home-view';

/**
 * W-01 메인. 가격·재고·프로모션은 HomeView가 브라우저에서 요청마다 조회하므로(서버 HTML에 가격이 들어가지 않음)
 * 이 페이지 껍데기는 정적으로 만들어도 오래된 가격이 노출되지 않습니다.
 * 서버에서 상품 데이터를 조회하도록 바꾸면 그때 요청마다 렌더링하도록(예: fetch no-store, connection()) 다시 설정합니다.
 */
export default function HomePage() {
  return <HomeView />;
}
