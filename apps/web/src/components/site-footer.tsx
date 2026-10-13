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

/**
 * 고객센터 전화 걸기 링크(tel:)에 쓸 번호를 고르는 함수.
 * 서버가 준 customerCenterTel을 우선하고, 없을 때만 표시 문자열에서 숫자와 +를 뽑습니다.
 * 표시 문자열에 내선 안내가 붙으면 숫자가 섞이므로 첫 번호 덩어리(숫자·-·공백·+)만 씁니다.
 * 쓸 수 있는 번호가 없으면 null(링크를 만들지 않음)입니다.
 */
export function getCustomerCenterTelHref(
  companyInfo: Pick<CompanyInfo, 'customerCenterPhone' | 'customerCenterTel'>,
): string | null {
  const explicitTel = companyInfo.customerCenterTel?.replace(/[^0-9+]/g, '') ?? '';
  if (explicitTel) return `tel:${explicitTel}`;
  const firstNumberGroup = companyInfo.customerCenterPhone.match(/\+?[0-9][0-9\s-]*/)?.[0] ?? '';
  const extractedTel = firstNumberGroup.replace(/[^0-9+]/g, '');
  return extractedTel ? `tel:${extractedTel}` : null;
}

/** 고객센터 번호. 걸 수 있는 번호면 tel: 링크로, 아니면 글자로만 보여 줍니다. */
function CustomerCenterPhone({
  companyInfo,
  className,
}: {
  companyInfo: CompanyInfo;
  className?: string;
}) {
  const telHref = getCustomerCenterTelHref(companyInfo);
  if (!companyInfo.customerCenterPhone.trim()) return null;
  return telHref ? (
    <a href={telHref} className={cx('rounded-4 focus-ring', className)}>
      {companyInfo.customerCenterPhone}
    </a>
  ) : (
    <span className={className}>{companyInfo.customerCenterPhone}</span>
  );
}

/** 사업자 정보 조회 실패 안내와 다시 시도 버튼 */
function CompanyInfoError({ onRetry }: { onRetry: () => void }) {
  return (
    <p role="alert" className="text-caption text-text-3">
      사업자 정보를 불러오지 못했습니다.{' '}
      <button type="button" onClick={onRetry} className="rounded-4 underline focus-ring">
        다시 시도
      </button>
    </p>
  );
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
 * 사업자·고객센터 정보와 저작권 상호는 서버 응답으로 채웁니다.
 * 불러오는 중에는 해당 줄을 그리지 않고, 실패하면 다시 시도 안내를 보여 줍니다.
 */
export function SiteFooter() {
  const companyInfoQuery = useCompanyInfoQuery();
  const companyInfo = companyInfoQuery.data;
  const retryCompanyInfo = () => void companyInfoQuery.refetch();
  const copyrightText = companyInfo ? `© ${companyInfo.companyName}. All rights reserved.` : null;

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
            {companyInfoQuery.isError ? <CompanyInfoError onRetry={retryCompanyInfo} /> : null}
            {copyrightText ? (
              <p className="mt-24 text-caption text-text-3">{copyrightText}</p>
            ) : null}
          </div>
          {companyInfo ? (
            <div className="flex w-306 shrink-0 flex-col gap-4">
              <p className="text-overline text-text-3">CUSTOMER CENTER</p>
              <CustomerCenterPhone companyInfo={companyInfo} className="self-start text-h2" />
              <p className="text-caption text-text-3">{companyInfo.customerCenterHours}</p>
            </div>
          ) : null}
        </div>
      </PageContainer>

      <PageContainer className="flex flex-col gap-12 pt-32 pb-40 lg:hidden">
        <Link href="/" className="self-start rounded-4 text-h3 focus-ring">
          이음산업건설
        </Link>
        {companyInfoQuery.isError ? <CompanyInfoError onRetry={retryCompanyInfo} /> : null}
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
                고객센터{' '}
                <CustomerCenterPhone
                  companyInfo={companyInfo}
                  className="text-text-2 underline underline-offset-2"
                />{' '}
                · {companyInfo.customerCenterHours}
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
        {copyrightText ? <p className="text-caption text-text-3">{copyrightText}</p> : null}
      </PageContainer>
    </footer>
  );
}
