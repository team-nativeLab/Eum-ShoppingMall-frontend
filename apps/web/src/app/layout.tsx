import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './globals.css';
import { DemoModeBanner } from '@/components/demo-mode-banner';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    default: '이음산업건설 쇼핑몰',
    template: '%s | 이음산업건설 쇼핑몰',
  },
  description: '산업 안전용품 온라인 쇼핑몰',
};

/** web 앱 루트 레이아웃. 데모 안내 띠(목 모드) · GNB · 본문 · Footer 순서로 그립니다. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh bg-bg text-body-m text-text-1">
        <Providers>
          <div className="flex min-h-dvh flex-col">
            {/* 빌드 때 문자열로 치환되므로 real 빌드에서는 이 분기와 띠가 산출물에서 빠집니다. */}
            {process.env.NEXT_PUBLIC_API_MODE !== 'real' ? <DemoModeBanner /> : null}
            <SiteHeader />
            <main id="main-content" className="flex-1">
              {children}
            </main>
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
