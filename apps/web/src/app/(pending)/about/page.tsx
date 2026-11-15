import type { Metadata } from 'next';
import { AboutPageContent } from '@/features/company-pages/about-page';

export const metadata: Metadata = {
  title: '회사소개',
  description: '안전맛집의 사업 분야와 위치를 소개합니다.',
  robots: { index: true, follow: true },
};

export default function AboutPage() {
  return <AboutPageContent />;
}
