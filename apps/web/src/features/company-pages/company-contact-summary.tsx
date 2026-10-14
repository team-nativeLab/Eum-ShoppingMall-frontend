'use client';

import type { CompanyInfo } from '@eum/api/types';
import { Button } from '@eum/ui/components/Button';
import { useCompanyInfoQuery } from '@/features/company/use-company-info-query';

type CompanyContactSummaryProps = {
  variant: 'about' | 'quote';
};

function getPhoneHref(companyInfo: CompanyInfo): string | null {
  const explicitNumber = companyInfo.customerCenterTel?.replace(/[^0-9+]/g, '') ?? '';
  if (explicitNumber) return `tel:${explicitNumber}`;
  const firstNumber = companyInfo.customerCenterPhone.match(/\+?[0-9][0-9\s-]*/)?.[0] ?? '';
  const phoneNumber = firstNumber.replace(/[^0-9+]/g, '');
  return phoneNumber ? `tel:${phoneNumber}` : null;
}

function CompanyInfoRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <Button type="button" variant="ghost" size="s" onClick={onRetry}>
      다시 시도
    </Button>
  );
}

/** 회사 페이지에서 쓰는 전화·이메일·주소를 공통 회사 정보 API로 채웁니다. */
export function CompanyContactSummary({ variant }: CompanyContactSummaryProps) {
  const companyQuery = useCompanyInfoQuery();
  const companyInfo = companyQuery.data;
  const phoneHref = companyInfo ? getPhoneHref(companyInfo) : null;
  const phone = companyInfo?.customerCenterPhone.trim() ?? '';
  const email = (variant === 'quote' ? companyInfo?.quoteEmail : companyInfo?.email)?.trim() ?? '';
  const address = companyInfo?.address.trim() ?? '';
  const hours = companyInfo?.customerCenterHours.trim() ?? '';
  const emptyValueLabel = companyQuery.isLoading
    ? '정보 확인 중'
    : companyQuery.isError
      ? '정보를 불러오지 못했습니다'
      : '등록된 정보가 없습니다';

  if (variant === 'quote') {
    return (
      <div className="flex flex-col gap-12">
        <dl className="grid grid-cols-1 gap-12 text-body-s min-[600px]:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-4">
            <dt className="text-text-3">고객센터</dt>
            <dd className="min-w-0 break-words text-text-2">
              {phone ? (
                <>
                  {phoneHref ? (
                    <a href={phoneHref} className="rounded-4 focus-ring">
                      {phone}
                    </a>
                  ) : (
                    phone
                  )}
                </>
              ) : (
                <span className="text-text-3">{emptyValueLabel}</span>
              )}
            </dd>
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <dt className="text-text-3">이메일</dt>
            <dd className="min-w-0 break-words text-text-2">
              {email ? (
                <a href={`mailto:${email}`} className="rounded-4 focus-ring">
                  {email}
                </a>
              ) : (
                <span className="text-text-3">{emptyValueLabel}</span>
              )}
            </dd>
          </div>
        </dl>
        {companyQuery.isError ? (
          <CompanyInfoRetry onRetry={() => void companyQuery.refetch()} />
        ) : null}
      </div>
    );
  }

  const contactRows = [
    { label: '주소', value: address },
    {
      label: '고객센터',
      value: [phone, hours].filter(Boolean).join(' · '),
    },
    { label: '이메일', value: email },
  ];

  return (
    <div className="flex flex-col gap-8">
      <dl className="flex flex-col gap-12 text-body-s lg:flex-row lg:flex-wrap lg:gap-x-48">
        {contactRows.map((contactRow) => (
          <div key={contactRow.label} className="flex flex-wrap items-center gap-12">
            <dt className="shrink-0 text-body-s-medium text-text-3">{contactRow.label}</dt>
            <dd className="min-w-0 break-words text-text-1">
              {contactRow.value ? (
                contactRow.label === '고객센터' && phoneHref ? (
                  <>
                    <a href={phoneHref} className="rounded-4 focus-ring">
                      {phone}
                    </a>
                    {hours ? ` · ${hours}` : null}
                  </>
                ) : contactRow.label === '이메일' ? (
                  <a href={`mailto:${email}`} className="rounded-4 focus-ring">
                    {email}
                  </a>
                ) : (
                  contactRow.value
                )
              ) : (
                <span className="text-text-3">{emptyValueLabel}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {companyQuery.isError ? (
        <CompanyInfoRetry onRetry={() => void companyQuery.refetch()} />
      ) : null}
    </div>
  );
}
