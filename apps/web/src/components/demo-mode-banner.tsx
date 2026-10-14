'use client';

import { usePathname } from 'next/navigation';

/**
 * 목 데이터로 동작하는 데모 배포임을 알리는 얇은 안내 띠.
 * 레이아웃이 API mock mode에서만 그리므로 real 빌드에서는 산출물에서 빠집니다.
 * 상호·연락처처럼 실제처럼 보이는 자리표시 값이 진짜로 오해되지 않게 하는 용도입니다(보안 검토 M1).
 */
export function DemoModeBanner() {
  const pathname = usePathname();
  if (pathname === '/login' || pathname === '/signup') return null;
  const isFigmaPresentationRoute =
    pathname === '/about' || pathname === '/solutions' || pathname.startsWith('/support/');

  return (
    <aside aria-label="데모 안내">
      {!isFigmaPresentationRoute ? (
        <div
          data-demo-banner-visual=""
          aria-hidden="true"
          className="bg-warning-tint px-16 py-4 text-center text-caption-medium text-warning"
        >
          데모 화면입니다. 상품·가격·회사 정보는 목 데이터이며 주문과 결제는 처리되지 않습니다.
        </div>
      ) : null}
      <span className="sr-only">
        데모 화면입니다. 상품·가격·회사 정보는 목 데이터이며 주문과 결제는 처리되지 않습니다.
      </span>
    </aside>
  );
}
