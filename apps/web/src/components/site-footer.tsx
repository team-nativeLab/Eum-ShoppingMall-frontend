'use client';

import type { CompanyInfo } from '@eum/api/types';
import { Icon } from '@eum/ui/components/Icon';
import { cx } from '@eum/ui/lib/cx';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useCompanyInfoQuery } from '@/features/company/use-company-info-query';
import { PageContainer } from './page-container';

const FOOTER_LINKS = [
  { label: '이용약관', href: '/terms', isEmphasized: false, isDesktopOnly: false },
  { label: '개인정보처리방침', href: '/privacy', isEmphasized: true, isDesktopOnly: false },
  { label: '이용안내', href: '/support/faq', isEmphasized: false, isDesktopOnly: true },
  { label: '고객센터', href: '/support/notices', isEmphasized: false, isDesktopOnly: false },
];

/** 사업자 정보를 Figma 푸터처럼 "항목 값" 묶음을 줄 단위로 나눕니다. */
function getBusinessInfoLines(companyInfo: CompanyInfo): string[][] {
  return [
    [
      `상호 ${companyInfo.companyName}`,
      `대표자 ${companyInfo.representative}`,
      `사업자등록번호 ${companyInfo.businessRegistrationNumber}`,
    ],
    [`통신판매업신고 ${companyInfo.mailOrderSalesNumber}`, `주소 ${companyInfo.address}`],
    [`이메일 ${companyInfo.email}`, `개인정보보호책임자 ${companyInfo.privacyOfficer}`],
  ];
}

/** 사업자 정보 줄 목록. 항목 사이를 세로 구분선(|)으로 나눕니다. */
function BusinessInfo({ companyInfo }: { companyInfo: CompanyInfo }) {
  return (
    <div className="flex flex-col gap-4 text-caption text-text-3">
      {getBusinessInfoLines(companyInfo).map((lineItems) => (
        <p key={lineItems[0]} className="flex flex-wrap items-center gap-x-8">
          {lineItems.map((lineItem, itemIndex) => (
            <span key={lineItem} className="inline-flex items-center gap-8">
              {itemIndex > 0 ? (
                <span aria-hidden="true" className="text-line-strong">
                  |
                </span>
              ) : null}
              {lineItem}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

/**
 * HF/Web/Footer(데스크톱)와 W-01m 모바일 푸터.
 * 사업자·고객센터 정보는 서버 응답으로 채우고, 불러오는 중이거나 실패하면 해당 줄을 그리지 않습니다.
 */
export function SiteFooter() {
  const companyInfoQuery = useCompanyInfoQuery();
  const companyInfo = companyInfoQuery.data;

  return (
    <footer className="mt-64 border-t border-line-strong bg-bg">
      <PageContainer className="hidden pt-56 pb-48 lg:block">
        <div className="flex items-center justify-between gap-24">
          <Link href="/" className="rounded-4 text-h3 focus-ring">
            이음산업건설
          </Link>
          <nav aria-label="푸터 메뉴" className="flex items-center gap-24">
            {FOOTER_LINKS.map((footerLink) => (
              <Link
                key={footerLink.label}
                href={footerLink.href}
                className={cx(
                  'rounded-4 text-label-s focus-ring hover:text-text-1',
                  footerLink.isEmphasized ? 'font-bold text-text-1' : 'text-text-2',
                )}
              >
                {footerLink.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="my-32 h-1 bg-line-strong" />
        <div className="flex items-start justify-between gap-32">
          <div>
            {companyInfo ? <BusinessInfo companyInfo={companyInfo} /> : null}
            <p className={cx('text-caption text-text-3', companyInfo && 'mt-24')}>
              © 이음산업건설. All rights reserved.
            </p>
          </div>
          {companyInfo ? (
            <div className="flex w-306 shrink-0 flex-col gap-4">
              <p className="text-overline text-text-3">CUSTOMER CENTER</p>
              <a
                href={`tel:${companyInfo.customerCenterPhone.replace(/[^0-9+]/g, '')}`}
                className="self-start rounded-4 text-h2 focus-ring"
              >
                {companyInfo.customerCenterPhone}
              </a>
              <p className="text-caption text-text-3">{companyInfo.customerCenterHours}</p>
            </div>
          ) : null}
        </div>
      </PageContainer>

      <PageContainer className="flex flex-col gap-12 pt-32 pb-40 lg:hidden">
        <Link href="/" className="self-start rounded-4 text-h3 focus-ring">
          이음산업건설
        </Link>
        {companyInfo ? (
          <details className="group">
            <summary className="flex min-h-20 cursor-pointer list-none items-center justify-between rounded-4 text-body-s-medium text-text-2 focus-ring [&::-webkit-details-marker]:hidden">
              사업자 정보
              <Icon
                icon={ChevronDown}
                size={16}
                className="transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="pt-8">
              <BusinessInfo companyInfo={companyInfo} />
              <p className="mt-8 text-caption text-text-3">
                고객센터 {companyInfo.customerCenterPhone} · {companyInfo.customerCenterHours}
              </p>
            </div>
          </details>
        ) : null}
        <nav aria-label="푸터 메뉴" className="flex flex-wrap gap-x-16 gap-y-8">
          {FOOTER_LINKS.filter((footerLink) => !footerLink.isDesktopOnly).map((footerLink) => (
            <Link
              key={footerLink.label}
              href={footerLink.href}
              className={cx(
                'rounded-4 text-label-s focus-ring',
                footerLink.isEmphasized ? 'font-bold text-text-1' : 'text-text-2',
              )}
            >
              {footerLink.label}
            </Link>
          ))}
        </nav>
        <p className="text-caption text-text-3">© 이음산업건설. All rights reserved.</p>
      </PageContainer>
    </footer>
  );
}
