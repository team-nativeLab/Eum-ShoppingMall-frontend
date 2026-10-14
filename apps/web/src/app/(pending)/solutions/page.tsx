import type { Metadata } from 'next';
import { SolutionsPageContent } from '@/features/company-pages/solutions-page';

export const metadata: Metadata = {
  title: '안전 솔루션 견적 문의',
  description: '현장에 필요한 안전용품과 납품 조건을 확인하고 맞춤 견적을 문의합니다.',
  robots: { index: true, follow: true },
};

export default function SolutionsPage() {
  return <SolutionsPageContent />;
}
