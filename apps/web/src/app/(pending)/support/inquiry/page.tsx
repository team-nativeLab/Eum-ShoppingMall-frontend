import type { Metadata } from 'next';
import { Suspense } from 'react';
import { InquiryPage } from '@/features/company-support/support-pages';

export const metadata: Metadata = { title: '1:1 문의' };

export default function InquiryRoute() {
  return (
    <Suspense
      fallback={
        <main className="px-20 py-40 text-center text-body-s text-text-3">
          문의 화면을 불러오는 중입니다.
        </main>
      }
    >
      <InquiryPage />
    </Suspense>
  );
}
