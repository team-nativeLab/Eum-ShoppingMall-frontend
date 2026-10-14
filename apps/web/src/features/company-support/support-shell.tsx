'use client';

import type { CompanyInfo } from '@eum/api/types';
import { Breadcrumb } from '@eum/ui/components/Breadcrumb';
import { Button } from '@eum/ui/components/Button';
import { Icon } from '@eum/ui/components/Icon';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { cx } from '@eum/ui/lib/cx';
import { ArrowRight, Headphones, MessageCircle, Phone } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { getCustomerCenterTelHref } from '@/components/site-footer';
import { useCompanyInfoQuery } from '@/features/company/use-company-info-query';
import { PageContainer } from '@/components/page-container';

const SUPPORT_TABS = [
  { label: '공지사항', href: '/support/notices' },
  { label: 'FAQ', href: '/support/faq' },
  { label: '1:1 문의', href: '/support/inquiry' },
] as const;

/** 공통 고객지원 우측 상담 정보. 실제 값이 없는 경우 임의 값 대신 상태를 표시합니다. */
function SupportContactCard({ activePath }: { activePath: (typeof SUPPORT_TABS)[number]['href'] }) {
  const companyQuery = useCompanyInfoQuery();
  const companyInfo = companyQuery.data;
  const contactLink =
    activePath === '/support/notices'
      ? { label: '1:1 문의하기', href: '/support/inquiry' }
      : activePath === '/support/faq'
        ? { label: '1:1 문의하기', href: '/support/inquiry' }
        : { label: '자주 묻는 질문', href: '/support/faq' };

  return (
    <aside className="h-fit rounded-12 bg-surface p-24 lg:sticky lg:top-88">
      <div className="mb-20 flex items-center gap-10">
        <span className="inline-flex size-40 items-center justify-center rounded-capsule bg-bg">
          <Icon icon={Headphones} size={20} />
        </span>
        <h2 className="text-h4">고객센터</h2>
      </div>
      {companyQuery.isLoading ? (
        <p className="text-body-s text-text-3" role="status">
          고객센터 정보를 불러오는 중입니다.
        </p>
      ) : companyQuery.isError ? (
        <div className="space-y-8">
          <p role="alert" className="text-body-s text-text-3">
            고객센터 정보를 불러오지 못했습니다.
          </p>
          <button
            type="button"
            onClick={() => void companyQuery.refetch()}
            className="rounded-4 text-label-s underline focus-ring"
          >
            다시 시도
          </button>
        </div>
      ) : companyInfo ? (
        <ContactDetails companyInfo={companyInfo} />
      ) : null}
      <div className="mt-24 border-t border-line pt-20">
        <Link
          href={contactLink.href}
          className="flex min-h-48 items-center justify-between rounded-8 bg-bg px-12 text-label-m focus-ring hover:bg-surface-2"
        >
          <span className="inline-flex items-center gap-8">
            <Icon icon={MessageCircle} size={20} /> {contactLink.label}
          </span>
          <Icon icon={ArrowRight} size={16} />
        </Link>
      </div>
    </aside>
  );
}

function ContactDetails({ companyInfo }: { companyInfo: CompanyInfo }) {
  const hasPhone = companyInfo.customerCenterPhone.trim().length > 0;
  const phoneHref = getCustomerCenterTelHref(companyInfo);

  return (
    <div className="space-y-10">
      {hasPhone ? (
        <p className="flex items-center gap-8 text-body-l font-semibold">
          <Icon icon={Phone} size={20} />
          {phoneHref ? (
            <a href={phoneHref} className="rounded-4 focus-ring">
              {companyInfo.customerCenterPhone}
            </a>
          ) : (
            companyInfo.customerCenterPhone
          )}
        </p>
      ) : (
        <p className="text-body-s text-text-3">전화번호 미제공</p>
      )}
      {companyInfo.customerCenterHours ? (
        <p className="text-body-s text-text-2">{companyInfo.customerCenterHours}</p>
      ) : (
        <p className="text-body-s text-text-3">운영 시간 미제공</p>
      )}
    </div>
  );
}

/** 공지·FAQ·문의 페이지의 타이틀, 탭, 메인/사이드 12열 그리드. */
export function SupportShell({
  activePath,
  children,
}: {
  activePath: (typeof SUPPORT_TABS)[number]['href'];
  children: ReactNode;
}) {
  const activeLabel = SUPPORT_TABS.find((tab) => tab.href === activePath)?.label ?? '고객지원';
  return (
    <PageContainer className="px-16 pt-24 pb-64 sm:px-20 lg:pt-32 lg:pb-80">
      <Breadcrumb
        items={[
          { label: '홈', href: '/' },
          { label: '고객지원', href: '/support/notices' },
          { label: activeLabel },
        ]}
        className="mb-20"
        renderLink={(item, className) => (
          <Link href={item.href} className={className}>
            {item.label}
          </Link>
        )}
      />
      <div className="mb-32 border-b border-line">
        <h1 className="pb-40 text-display">고객지원</h1>
        <nav aria-label="고객지원 메뉴" className="flex gap-24 overflow-x-auto">
          {SUPPORT_TABS.map((tab) => {
            const selected = tab.href === activePath;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={selected ? 'page' : undefined}
                className={cx(
                  'relative inline-flex h-48 shrink-0 items-center text-label-m focus-ring after:absolute after:inset-x-0 after:bottom-0 after:h-2',
                  selected
                    ? 'text-text-1 after:bg-text-1'
                    : 'text-text-3 after:bg-transparent hover:text-text-1',
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="grid items-start gap-32 lg:grid-cols-[minmax(0,966px)_306px] lg:gap-24">
        <div className="min-w-0">{children}</div>
        <SupportContactCard activePath={activePath} />
      </div>
    </PageContainer>
  );
}

export function SupportQueryError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <NoticeInline tone="danger" role="alert">
      <p>{message}</p>
      <Button type="button" variant="secondary" size="s" onClick={onRetry} className="mt-12">
        다시 시도
      </Button>
    </NoticeInline>
  );
}
