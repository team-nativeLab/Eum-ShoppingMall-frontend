import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './globals.css';
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

/** web 앱 루트 레이아웃. GNB·Footer는 2단계에서 Figma HF/Web/GNB·Footer로 채웁니다. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh bg-bg text-body-m text-text-1">
        <Providers>
          <div className="flex min-h-dvh flex-col">
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
