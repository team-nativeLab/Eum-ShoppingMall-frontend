import Link from 'next/link';
import { CartLink } from './cart-link';
import { PageContainer } from './page-container';

/** 임시 상단 바(빈 레이아웃 골격). 2단계에서 HF/Web/GNB로 바꿉니다. */
export function SiteHeader() {
  return (
    <header className="border-b border-line bg-bg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-16 focus:left-16 focus:z-10 focus:rounded-8 focus:bg-text-1 focus:px-16 focus:py-8 focus:text-label-m focus:text-inverse"
      >
        본문 바로가기
      </a>
      <PageContainer className="flex h-72 items-center justify-between">
        <Link href="/" className="rounded-4 text-h3 focus-ring">
          이음산업건설
        </Link>
        <CartLink />
      </PageContainer>
    </header>
  );
}
