import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Image as ImageIcon } from 'lucide-react';
import { Icon } from '@eum/ui/components/Icon';
import type { ReactNode } from 'react';
import { PageContainer } from '@/components/page-container';
import { AboutSectionNavigation } from './about-section-navigation';
import { CompanyContactSummary } from './company-contact-summary';

const ABOUT_SECTIONS = [
  { id: 'overview', label: '개요' },
  { id: 'business', label: '사업분야' },
  { id: 'history', label: '연혁' },
  { id: 'certifications', label: '인증' },
  { id: 'partners', label: '파트너' },
  { id: 'location', label: '오시는 길' },
] as const;

const BUSINESS_AREAS = [
  {
    title: '안전용품 유통',
    description: '개인보호장비·작업복 등 현장 필수품',
    image: '/assets/web/about-warehouse.png',
    imageAlt: '안전용품을 보관한 창고',
  },
  {
    title: '현장 납품',
    description: '건설·산업 현장 정기 납품',
    image: '/assets/web/about-delivery.png',
    imageAlt: '현장에 전달할 안전용품',
  },
  {
    title: '맞춤 제작',
    description: '로고 인쇄·사양 맞춤 제작',
    image: '/assets/web/promo-blueprint-v2.png',
    imageAlt: '맞춤 제작을 위한 설계 도면',
  },
  {
    title: '안전 솔루션',
    description: '현장 진단과 맞춤 안전 제안',
    image: '/assets/web/hero-v3.webp',
    imageAlt: '현장 도시를 배경으로 놓인 안전모',
  },
] as const;

const HISTORY_ROWS = [0, 1, 2, 3] as const;
const CERTIFICATION_PLACEHOLDERS = [0, 1, 2, 3, 4, 5] as const;
const PARTNER_PLACEHOLDERS = [0, 1, 2, 3, 4, 5] as const;

function SectionHeading({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-8">
      <p className="text-overline text-text-3">{eyebrow}</p>
      <h2 className="text-web-h2">{children}</h2>
    </div>
  );
}

/** 회사 개요·사업·연혁·인증·위치 정보를 보여 줍니다. */
export function AboutPageContent() {
  return (
    <>
      <section
        aria-labelledby="about-title"
        className="relative h-[320px] overflow-hidden bg-bg-subtle lg:h-480"
      >
        <Image
          src="/assets/web/about-hero-v2.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[60%_center]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-bg via-bg/90 to-transparent"
        />
        <PageContainer className="relative flex h-full flex-col justify-center gap-20 py-32 max-[600px]:px-16 lg:justify-start lg:pt-120">
          <div className="flex flex-col gap-16">
            <p className="text-overline tracking-[0.16em] text-text-2">About Us</p>
            <h1 id="about-title" className="text-h1 lg:text-web-display-l">
              사람이 있는 곳에,
              <span className="block text-text-2">더 안전한 내일을 연결합니다.</span>
            </h1>
          </div>
          <p className="max-w-[640px] text-body-m text-text-2 lg:text-web-body-xl">
            이음산업건설은 현장과 사람을 잇는 안전용품 전문 기업입니다.
          </p>
        </PageContainer>
      </section>

      <AboutSectionNavigation sections={ABOUT_SECTIONS} />

      <PageContainer className="flex flex-col gap-64 py-64 max-[600px]:px-16 lg:gap-120 lg:py-120">
        <section
          id="overview"
          aria-labelledby="overview-title"
          tabIndex={-1}
          className="scroll-mt-80 focus-ring"
        >
          <div className="flex flex-col gap-40">
            <SectionHeading eyebrow="Overview">
              <span id="overview-title">현장의 안전을 연결하는 회사</span>
            </SectionHeading>
            <div className="max-w-[636px] space-y-16 leading-[26px]">
              <h3 className="text-h3">작은 변화가 큰 안전을 만듭니다.</h3>
              <p className="text-body-l text-text-2">
                이음산업건설은 개인보호장비부터 현장 안전용품, 맞춤 제작까지 현장에 필요한 안전
                솔루션을 제공합니다. 고객의 현장 환경을 이해하고, 가장 알맞은 제품과 서비스를
                제안합니다.
              </p>
            </div>
          </div>
        </section>

        <section
          id="business"
          aria-labelledby="business-title"
          tabIndex={-1}
          className="scroll-mt-80 focus-ring"
        >
          <div className="flex flex-col gap-40">
            <SectionHeading eyebrow="Business">
              <span id="business-title">사업분야</span>
            </SectionHeading>
            <div className="grid grid-cols-1 gap-16 sm:grid-cols-2 lg:grid-cols-4 lg:gap-24">
              {BUSINESS_AREAS.map((businessArea) => (
                <article key={businessArea.title} className="rounded-12 border border-line p-16">
                  <div className="relative h-[180px] overflow-hidden rounded-6">
                    <Image
                      src={businessArea.image}
                      alt={businessArea.imageAlt}
                      fill
                      sizes="(min-width: 1024px) 306px, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="mt-16 flex flex-col gap-4">
                    <h3 className="text-h3">{businessArea.title}</h3>
                    <p className="text-body-s text-text-3">{businessArea.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="history"
          aria-labelledby="history-title"
          tabIndex={-1}
          className="scroll-mt-80 focus-ring"
        >
          <div className="flex flex-col gap-40">
            <SectionHeading eyebrow="History">
              <span id="history-title">연혁</span>
            </SectionHeading>
            <div className="border-t-2 border-text-1">
              {HISTORY_ROWS.map((historyRow) => (
                <div
                  key={historyRow}
                  className="flex gap-16 border-b border-line py-24 sm:gap-24 sm:py-32"
                >
                  <p className="w-[100px] shrink-0 text-h2 sm:w-196 lg:text-[28px] lg:leading-[38px]">
                    0000
                  </p>
                  <div className="flex flex-col gap-8 pt-4 text-body-s leading-24 text-text-2">
                    <p>00월 연혁 내용이 들어갑니다.</p>
                    <p>00월 연혁 내용이 들어갑니다.</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="certifications"
          aria-labelledby="certifications-title"
          tabIndex={-1}
          className="scroll-mt-80 focus-ring"
        >
          <div className="flex flex-col gap-40">
            <SectionHeading eyebrow="Certification & Partners">
              <span id="certifications-title">인증 · 파트너</span>
            </SectionHeading>
            <div className="flex flex-col gap-24">
              <div
                role="group"
                aria-label="인증서 자리표시자"
                className="grid grid-cols-2 gap-12 sm:grid-cols-3 lg:grid-cols-6 lg:gap-24"
              >
                {CERTIFICATION_PLACEHOLDERS.map((placeholder) => (
                  <div
                    key={placeholder}
                    className="flex h-96 items-center justify-center rounded-12 bg-surface text-caption text-text-3"
                  >
                    인증서
                  </div>
                ))}
              </div>
              <div
                id="partners"
                role="group"
                aria-label="파트너 로고 자리표시자"
                tabIndex={-1}
                className="grid scroll-mt-80 grid-cols-2 gap-12 focus-ring sm:grid-cols-3 lg:grid-cols-6 lg:gap-24"
              >
                {PARTNER_PLACEHOLDERS.map((placeholder) => (
                  <div
                    key={placeholder}
                    className="flex h-96 items-center justify-center rounded-12 bg-surface text-caption text-text-3"
                  >
                    파트너 로고
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="location"
          aria-labelledby="location-title"
          tabIndex={-1}
          className="scroll-mt-80 focus-ring"
        >
          <div className="flex flex-col gap-64 lg:gap-96">
            <div className="flex flex-col gap-40">
              <SectionHeading eyebrow="Location">
                <span id="location-title">오시는 길</span>
              </SectionHeading>
              <div className="flex flex-col gap-24">
                <div
                  role="img"
                  aria-label="지도 자리표시자"
                  className="flex h-[240px] items-center justify-center overflow-hidden rounded-12 bg-surface lg:h-400"
                >
                  <Icon icon={ImageIcon} size={28} className="text-ph-glyph" />
                </div>
                <CompanyContactSummary variant="about" />
              </div>
            </div>
            <div className="flex flex-col items-start justify-between gap-24 rounded-12 bg-text-1 px-24 py-24 lg:flex-row lg:items-center lg:px-48 lg:py-40">
              <div className="flex flex-col gap-8">
                <p className="text-overline tracking-[0.16em] text-inverse-2">Custom Order</p>
                <p className="text-h3 text-inverse lg:text-h2">
                  현장에 꼭 맞는 안전 솔루션, 지금 상담받아 보세요.
                </p>
              </div>
              <Link
                href="/solutions"
                className="inline-flex h-56 shrink-0 items-center gap-8 rounded-8 border border-inverse px-24 text-label-l text-inverse focus-ring hover:bg-inverse/10"
              >
                견적 문의하기
                <Icon icon={ArrowRight} size={20} />
              </Link>
            </div>
          </div>
        </section>
      </PageContainer>
    </>
  );
}
