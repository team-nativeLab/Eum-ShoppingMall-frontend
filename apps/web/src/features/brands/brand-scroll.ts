/**
 * sticky 사이트 헤더가 화면 위쪽을 가리는 높이(px)입니다. 헤더 높이 + 16px 여백의 근거는 아래와 같습니다.
 * 근거: site-header.tsx의 모바일 상단 행 h-56(56px, 경계선 없음 → 72px),
 * 데스크톱 헤더 h-72 + lg:border-b 1px(스크롤 후 h-64 → 최대 73px, 그래서 89px).
 */
export const BRAND_HEADER_OFFSET_PX = { mobile: 72, desktop: 89 } as const;

/**
 * 브랜드 화면에서 스크롤로 옮겨지는 블록(선택 밴드, 선택 브랜드 상품 섹션)이 헤더 아래에 보이도록 주는 scroll-margin 클래스입니다.
 * Tailwind가 클래스를 찾으려면 문자열 리터럴이어야 하므로 값을 템플릿으로 만들지 않습니다.
 * 위 BRAND_HEADER_OFFSET_PX와 같은 값인지는 brand-directory-view.test.tsx에서 확인합니다.
 */
export const BRAND_SCROLL_MARGIN_CLASS = 'scroll-mt-72 lg:scroll-mt-89';
