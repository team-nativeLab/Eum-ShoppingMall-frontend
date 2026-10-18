'use client';

import { Button } from '@eum/ui/components/Button';
import { NoticeInline } from '@eum/ui/components/NoticeInline';
import { PageContainer } from '@/components/page-container';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AdminLegalDocument } from '@eum/api/types';
import { getShopApi } from '@/lib/shop-api';

type LegalDocument = 'terms' | 'privacy' | 'guide' | 'shipping';
type PolicyDocument = Extract<LegalDocument, 'terms' | 'privacy'>;
type GuideDocument = Extract<LegalDocument, 'guide' | 'shipping'>;
type LegalVersion = 'current' | 'previous' | 'upcoming';

interface DocumentSection {
  id: string;
  title: string;
  paragraphs: string[];
}

interface PolicyArticle {
  id: string;
  title: string;
  hasList?: boolean;
}

interface TermsChapter {
  id: string;
  title: string;
  articles: PolicyArticle[];
}

interface PrivacyTable {
  headers: string[];
  rows: string[][];
}

interface PrivacySection {
  id: string;
  title: string;
  hasList?: boolean;
  table?: PrivacyTable;
  isContact?: boolean;
}

const POLICY_SAMPLE_BODY = '조항 내용이 들어갑니다.';
const POLICY_SAMPLE_ITEMS = ['① 항 내용이 들어갑니다.', '② 항 내용이 들어갑니다.'];

const TERMS_CHAPTERS: TermsChapter[] = [
  {
    id: 'chapter-general',
    title: '제1장 총칙',
    articles: [
      { id: 'term-1', title: '제1조(목적)' },
      { id: 'term-2', title: '제2조(정의)', hasList: true },
      { id: 'term-3', title: '제3조(약관 등의 명시와 설명 및 개정)' },
      { id: 'term-4', title: '제4조(서비스의 제공 및 변경)' },
      { id: 'term-5', title: '제5조(서비스의 중단)' },
    ],
  },
  {
    id: 'chapter-members',
    title: '제2장 회원',
    articles: [
      { id: 'term-6', title: '제6조(회원가입)' },
      { id: 'term-7', title: '제7조(사업자 회원)' },
      { id: 'term-8', title: '제8조(회원 탈퇴 및 자격 상실 등)' },
      { id: 'term-9', title: '제9조(회원에 대한 통지)' },
    ],
  },
  {
    id: 'chapter-purchase',
    title: '제3장 구매·결제',
    articles: [
      { id: 'term-10', title: '제10조(구매신청)' },
      { id: 'term-11', title: '제11조(계약의 성립)' },
      { id: 'term-12', title: '제12조(지급방법)' },
      { id: 'term-13', title: '제13조(가격 문의 상품과 견적 문의)' },
      { id: 'term-14', title: '제14조(세금계산서 및 현금영수증)' },
    ],
  },
  {
    id: 'chapter-delivery',
    title: '제4장 배송·청약철회',
    articles: [
      { id: 'term-15', title: '제15조(재화 등의 공급)' },
      { id: 'term-16', title: '제16조(환급)' },
      { id: 'term-17', title: '제17조(청약철회 등)', hasList: true },
      { id: 'term-18', title: '제18조(청약철회 등의 효과)' },
    ],
  },
  {
    id: 'chapter-provisions',
    title: '제5장 보칙',
    articles: [
      { id: 'term-19', title: '제19조(개인정보보호)' },
      { id: 'term-20', title: '제20조(회사의 의무)' },
      { id: 'term-21', title: '제21조(회원의 아이디 및 비밀번호에 대한 의무)' },
      { id: 'term-22', title: '제22조(이용자의 의무)' },
      { id: 'term-23', title: '제23조(분쟁해결)' },
      { id: 'term-24', title: '제24조(재판권 및 준거법)' },
    ],
  },
];

const PRIVACY_SECTIONS: PrivacySection[] = [
  { id: 'privacy-1', title: '1. 개인정보의 처리 목적' },
  { id: 'privacy-2', title: '2. 처리하는 개인정보의 항목', hasList: true },
  { id: 'privacy-3', title: '3. 개인정보의 처리 및 보유 기간', hasList: true },
  {
    id: 'privacy-4',
    title: '4. 개인정보의 제3자 제공',
    table: {
      headers: ['제공받는 자', '제공 목적', '제공 항목', '보유·이용 기간'],
      rows: [
        ['000', '000', '000', '000'],
        ['000', '000', '000', '000'],
      ],
    },
  },
  {
    id: 'privacy-5',
    title: '5. 개인정보 처리업무의 위탁',
    table: {
      headers: ['수탁자', '위탁 업무', '위탁 항목', '보유·이용 기간'],
      rows: [
        ['000', '000', '000', '000'],
        ['000', '000', '000', '000'],
      ],
    },
  },
  { id: 'privacy-6', title: '6. 개인정보의 파기 절차 및 방법' },
  { id: 'privacy-7', title: '7. 정보주체와 법정대리인의 권리·의무 및 행사방법' },
  { id: 'privacy-8', title: '8. 개인정보의 안전성 확보조치' },
  { id: 'privacy-9', title: '9. 개인정보 자동 수집 장치의 설치·운영 및 거부' },
  { id: 'privacy-10', title: '10. 개인정보 보호책임자', isContact: true },
  { id: 'privacy-11', title: '11. 권익침해 구제방법' },
  { id: 'privacy-12', title: '12. 개인정보 처리방침의 변경' },
];

const PRIVACY_CONTACT = [
  ['성명', '000'],
  ['직책', '000'],
  ['연락처', '0000-0000'],
  ['이메일', '000@000'],
];

const GUIDE_DOCUMENTS: Record<GuideDocument, { title: string; sections: DocumentSection[] }> = {
  guide: {
    title: '이용안내',
    sections: [
      {
        id: 'join',
        title: '회원가입 안내',
        paragraphs: [
          '회원가입 후 상품 주문, 배송 확인과 견적 문의를 이용할 수 있습니다.',
          '사업자 회원은 가입 화면에서 회원 유형을 선택해 주십시오.',
        ],
      },
      {
        id: 'order',
        title: '주문 안내',
        paragraphs: [
          '상품과 수량을 선택해 장바구니에 담은 다음 주문서에서 배송지와 결제 방법을 확인합니다.',
          '가격이 표시되지 않는 상품은 견적 또는 고객센터를 통해 문의해 주십시오.',
        ],
      },
      {
        id: 'payment',
        title: '결제 안내',
        paragraphs: ['주문서에서 제공되는 결제 수단과 결제 금액을 확인한 뒤 주문을 진행합니다.'],
      },
      {
        id: 'delivery',
        title: '배송 안내',
        paragraphs: [
          '상품별 배송 방법과 예상 일정은 상품 상세의 배송 정보를 확인해 주십시오.',
          '출고 상황에 따라 배송 일정이 달라질 수 있습니다.',
        ],
      },
      {
        id: 'exchange',
        title: '교환 및 반품 안내',
        paragraphs: [
          '교환·반품 신청 전 상품 상태와 신청 가능 기간을 배송·교환 정책에서 확인해 주십시오.',
          '상품과 주문에 따라 접수 방법이 다를 수 있습니다.',
        ],
      },
      {
        id: 'contact',
        title: '고객센터 안내',
        paragraphs: ['주문과 서비스 이용 문의는 고객지원의 FAQ 또는 1:1 문의를 이용해 주십시오.'],
      },
    ],
  },
  shipping: {
    title: '배송·교환·반품 안내',
    sections: [
      {
        id: 'delivery',
        title: '01. 배송 안내',
        paragraphs: [
          '배송 방법, 배송비와 예상 일정은 상품 상세 화면에 안내된 내용을 확인해 주십시오.',
          '주문 제작 상품이나 공급처 상황에 따라 출고 일정이 달라질 수 있으며 변경 사항은 주문 조회에서 확인할 수 있습니다.',
        ],
      },
      {
        id: 'exchange',
        title: '02. 교환 및 반품 신청',
        paragraphs: [
          '상품 수령 후 교환 또는 반품이 필요한 경우 마이페이지의 취소·반품 내역에서 신청할 수 있습니다.',
          '상품과 포장 상태를 유지하고 신청 사유를 함께 작성해 주십시오.',
        ],
      },
      {
        id: 'exceptions',
        title: '03. 신청이 제한되는 경우',
        paragraphs: [
          '사용 또는 훼손으로 상품 가치가 현저히 감소한 경우, 주문 제작 상품인 경우에는 신청이 제한될 수 있습니다.',
          '상품별 상세 안내와 관계 법령에 따른 기준을 확인해 주십시오.',
        ],
      },
      {
        id: 'refund',
        title: '04. 회수 및 환불',
        paragraphs: [
          '신청이 접수되면 상품 확인 후 회수, 교환 또는 환불 절차를 안내합니다.',
          '정확한 처리 상태는 마이페이지의 신청 상세에서 확인해 주십시오.',
        ],
      },
    ],
  },
};

const DOCUMENT_TABS: { id: PolicyDocument | 'guide'; label: string; href: string }[] = [
  { id: 'terms', label: '이용약관', href: '/terms' },
  { id: 'privacy', label: '개인정보처리방침', href: '/privacy' },
  { id: 'guide', label: '이용안내', href: '/guide' },
];

export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  if (document === 'terms' || document === 'privacy') {
    return <PolicyDocumentPage document={document} />;
  }

  return <GuideOrShippingPage document={document} />;
}

function PolicyDocumentPage({ document }: { document: PolicyDocument }) {
  const [version, setVersion] = useState<LegalVersion>('current');
  const publicDocumentQuery = useQuery({
    queryKey: ['legal-document', document],
    queryFn: async ({ signal }) =>
      (await getShopApi()).legalDocuments.getPublished(document, { signal }),
  });
  if (publicDocumentQuery.data)
    return <PublishedLegalDocument document={publicDocumentQuery.data} />;
  const isTerms = document === 'terms';
  const title = isTerms ? '이용약관' : '개인정보처리방침';

  return (
    <PageContainer className="px-20 pt-24 pb-48 lg:pb-80">
      <nav aria-label="현재 위치" className="mb-24 text-caption text-text-3">
        <Link href="/" className="rounded-4 focus-ring">
          홈
        </Link>
        <span aria-hidden="true" className="px-8">
          /
        </span>
        <span>약관 및 정책</span>
        <span aria-hidden="true" className="px-8">
          /
        </span>
        <span aria-current="page">{title}</span>
      </nav>

      <h1 className="mb-24 text-h2 lg:text-web-h2">약관 및 정책</h1>
      <PolicyDocumentTabs document={document} />

      <div className="grid gap-24 lg:grid-cols-[306px_minmax(0,1fr)] lg:gap-48 xl:grid-cols-[306px_856px] xl:justify-between">
        <PolicyDocumentHeader document={document} version={version} onVersionChange={setVersion} />
        <PolicyTableOfContents document={document} />
        <div className="min-w-0 space-y-40 lg:col-start-2 lg:row-start-2 xl:max-w-[856px]">
          {isTerms ? (
            <TermsContent version={version} onVersionChange={setVersion} />
          ) : (
            <PrivacyContent />
          )}
        </div>
      </div>
    </PageContainer>
  );
}

function PublishedLegalDocument({ document }: { document: AdminLegalDocument }) {
  const route =
    document.id === 'terms'
      ? '/terms'
      : document.id === 'privacy'
        ? '/privacy'
        : document.id === 'guide'
          ? '/guide'
          : '/shipping-policy';
  return (
    <PageContainer className="px-20 pt-24 pb-48 lg:pb-80">
      <nav aria-label="현재 위치" className="mb-24 text-caption text-text-3">
        <Link href="/" className="rounded-4 focus-ring">
          홈
        </Link>
        <span aria-hidden="true" className="px-8">
          /
        </span>
        <span>약관 및 정책</span>
        <span aria-hidden="true" className="px-8">
          /
        </span>
        <span aria-current="page">{document.title}</span>
      </nav>
      <h1 className="mb-24 text-h2 lg:text-web-h2">약관 및 정책</h1>
      {document.id === 'terms' || document.id === 'privacy' ? (
        <PolicyDocumentTabs document={document.id} />
      ) : null}
      <article className="mx-auto max-w-856">
        <header className="border-b border-line-strong pb-20">
          <h2 className="text-h2">{document.title}</h2>
          <p className="mt-4 text-caption text-text-3">
            버전 {document.version} · 시행일 {document.effectiveAt.slice(0, 10)}
          </p>
        </header>
        <div className="mt-24 text-body-m whitespace-pre-wrap text-text-2">{document.body}</div>
        <Link href={route} className="sr-only">
          현재 문서
        </Link>
      </article>
    </PageContainer>
  );
}

function PolicyDocumentTabs({ document }: { document: PolicyDocument }) {
  return (
    <nav
      aria-label="이용 안내 메뉴"
      className="mb-24 flex h-56 overflow-x-auto border-b border-line"
    >
      {DOCUMENT_TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          aria-current={tab.id === document ? 'page' : undefined}
          className={
            'relative inline-flex h-56 flex-1 shrink-0 items-center justify-center px-24 text-label-l focus-ring ' +
            (tab.id === document ? 'border-b-2 border-text-1 text-text-1' : 'text-text-3')
          }
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function PolicyDocumentHeader({
  document,
  version,
  onVersionChange,
}: {
  document: PolicyDocument;
  version: LegalVersion;
  onVersionChange: (version: LegalVersion) => void;
}) {
  const isTerms = document === 'terms';
  const title = isTerms ? '이용약관' : '개인정보처리방침';
  const versionDescription =
    isTerms && version === 'previous'
      ? '시행일 0000.00.00 · 버전 0.0 · 이전 약관'
      : '시행일 0000.00.00 · 버전 0.0';

  return (
    <header className="border-b border-line-strong pb-20 lg:col-start-2 lg:row-start-1 lg:pb-24 xl:max-w-[856px]">
      <div className="flex flex-col gap-16 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-4">
          <h2 className="text-h2">{title}</h2>
          <p className="text-caption text-text-3">{versionDescription}</p>
        </div>
        <div className="w-full lg:w-280">
          <label htmlFor="legal-version" className="sr-only">
            시행일
          </label>
          <select
            id="legal-version"
            className="h-48 w-full rounded-8 border border-line-control bg-bg px-14 text-body-m text-text-1 focus-ring"
            value={isTerms ? version : 'current'}
            onChange={(event) => {
              const selectedVersion = event.currentTarget.value;
              if (isLegalVersion(selectedVersion)) onVersionChange(selectedVersion);
            }}
          >
            <option value="current">0000.00.00 시행 (현재)</option>
            {isTerms ? (
              <>
                <option value="previous">0000.00.00 시행</option>
                <option value="upcoming">0000.00.00 시행 (예정)</option>
              </>
            ) : null}
          </select>
        </div>
      </div>
      <p className="mt-16 text-body-m text-text-2">
        {isTerms
          ? '이 약관은 이음산업건설 쇼핑몰 이용 조건과 절차를 정합니다. 조항 내용이 들어갑니다.'
          : '이음산업건설은 정보주체의 개인정보를 보호하고 관련 고충을 원활하게 처리하기 위해 다음과 같이 개인정보 처리방침을 수립·공개합니다. 내용이 들어갑니다.'}
      </p>
    </header>
  );
}

function isLegalVersion(value: string): value is LegalVersion {
  return value === 'current' || value === 'previous' || value === 'upcoming';
}

function PolicyTableOfContents({ document }: { document: PolicyDocument }) {
  const itemCount = document === 'terms' ? '24개 조항' : '12개 항목';

  return (
    <>
      <details className="group rounded-12 border border-line bg-bg-subtle px-16 lg:hidden">
        <summary className="flex min-h-48 cursor-pointer list-none items-center gap-8 focus-ring [&::-webkit-details-marker]:hidden">
          <span className="text-label-m text-text-1">목차</span>
          <span className="flex-1 text-caption text-text-3">{itemCount}</span>
          <ChevronDown
            aria-hidden="true"
            size={20}
            className="shrink-0 text-text-1 transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="border-t border-line pt-8 pb-16">
          <PolicyTocList document={document} />
        </div>
      </details>
      <nav
        aria-label="문서 목차"
        className="hidden h-fit rounded-12 border border-line bg-bg p-24 lg:sticky lg:top-96 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:block"
      >
        <p className="mb-16 text-label-m text-text-3">목차</p>
        <PolicyTocList document={document} />
      </nav>
    </>
  );
}

function PolicyTocList({ document }: { document: PolicyDocument }) {
  if (document === 'privacy') {
    return (
      <ol className="space-y-4">
        {PRIVACY_SECTIONS.map((section) => (
          <li key={section.id}>
            <a
              href={'#' + section.id}
              className="flex min-h-36 items-center rounded-8 px-12 text-body-s text-text-2 focus-ring hover:bg-surface hover:text-text-1"
            >
              {section.title}
            </a>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol className="space-y-4">
      {TERMS_CHAPTERS.map((chapter) => (
        <li key={chapter.id}>
          <p className="flex min-h-36 items-center rounded-8 px-12 text-label-m text-text-1">
            {chapter.title}
          </p>
          <ol className="space-y-4">
            {chapter.articles.map((article, index) => (
              <li key={article.id}>
                <a
                  href={'#' + article.id}
                  aria-current={
                    index === 0 && chapter.id === 'chapter-general' ? 'location' : undefined
                  }
                  className={
                    'flex min-h-36 items-center rounded-8 pr-12 pl-24 text-body-s focus-ring hover:bg-surface hover:text-text-1 ' +
                    (index === 0 && chapter.id === 'chapter-general'
                      ? 'bg-surface text-text-1'
                      : 'text-text-2')
                  }
                >
                  {article.title}
                </a>
              </li>
            ))}
          </ol>
        </li>
      ))}
      <li>
        <a
          href="#terms-addenda"
          className="flex min-h-36 items-center rounded-8 px-12 text-label-m text-text-1 focus-ring hover:bg-surface"
        >
          부칙
        </a>
      </li>
    </ol>
  );
}

function TermsContent({
  version,
  onVersionChange,
}: {
  version: LegalVersion;
  onVersionChange: (version: LegalVersion) => void;
}) {
  return (
    <>
      {version === 'previous' ? (
        <NoticeInline tone="info" role="status">
          <div className="flex flex-wrap items-center justify-between gap-12">
            <p>이전 약관입니다. 현재 약관은 0000.00.00부터 시행 중입니다.</p>
            <Button size="s" variant="secondary" onClick={() => onVersionChange('current')}>
              현재 약관 보기
            </Button>
          </div>
        </NoticeInline>
      ) : null}
      {version === 'upcoming' ? (
        <NoticeInline tone="info" role="status">
          <div className="flex flex-wrap items-center justify-between gap-12">
            <p>0000.00.00부터 개정 약관이 시행됩니다. 주요 변경: 개정 요약이 들어갑니다.</p>
            <a
              href="#term-1"
              className="inline-flex min-h-36 items-center text-label-m text-text-1 focus-ring"
            >
              개정 약관 보기
            </a>
          </div>
        </NoticeInline>
      ) : null}
      <div className="space-y-40">
        {TERMS_CHAPTERS.map((chapter) => (
          <section key={chapter.id} aria-labelledby={chapter.id} className="space-y-32">
            <h2 id={chapter.id} className="pt-8 text-h3">
              {chapter.title}
            </h2>
            {chapter.articles.map((article) => (
              <PolicyArticle
                key={article.id}
                id={article.id}
                title={article.title}
                hasList={article.hasList}
              />
            ))}
          </section>
        ))}
        <section
          id="terms-addenda"
          aria-labelledby="terms-addenda-title"
          className="border-t border-line pt-24"
        >
          <h2 id="terms-addenda-title" className="pt-8 text-h3">
            부칙
          </h2>
          <p className="mt-12 text-body-m text-text-2">
            이 약관은 0000년 00월 00일부터 시행합니다.{version === 'previous' ? ' (이전 약관)' : ''}
          </p>
        </section>
      </div>
    </>
  );
}

function PrivacyContent() {
  return (
    <div className="space-y-32">
      {PRIVACY_SECTIONS.map((section) => (
        <section
          key={section.id}
          id={section.id}
          aria-labelledby={section.id + '-article-heading'}
          className="space-y-16"
        >
          <PolicyArticle
            id={section.id + '-article'}
            title={section.title}
            hasList={section.hasList}
          />
          {section.table ? <PrivacyDisclosureTable section={section} /> : null}
          {section.isContact ? <PrivacyContactCard /> : null}
        </section>
      ))}
      <section id="privacy-addenda" className="border-t border-line pt-24">
        <h2 className="hidden pt-8 text-h3 lg:block">부칙</h2>
        <p className="text-body-m text-text-2">
          이 개인정보 처리방침은 0000년 00월 00일부터 적용합니다.
        </p>
      </section>
    </div>
  );
}

function PolicyArticle({ id, title, hasList }: { id: string; title: string; hasList?: boolean }) {
  return (
    <article id={id} className="scroll-mt-96 space-y-12">
      <h3 id={id + '-heading'} className="text-body-l-medium text-text-1">
        {title}
      </h3>
      <p className="text-body-m text-text-2">{POLICY_SAMPLE_BODY}</p>
      {hasList ? (
        <ol className="space-y-8 text-body-m text-text-2">
          {POLICY_SAMPLE_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      ) : null}
    </article>
  );
}

function PrivacyDisclosureTable({ section }: { section: PrivacySection }) {
  if (!section.table) return null;

  return (
    <>
      <div className="space-y-8 lg:hidden">
        {section.table.rows.slice(0, 1).map((row, rowIndex) => (
          <dl
            key={section.id + '-mobile-row-' + rowIndex}
            className="space-y-8 rounded-12 border border-line p-16"
          >
            {section.table?.headers.map((header, index) => (
              <div key={header} className="flex items-start gap-12">
                <dt className="w-88 shrink-0 text-caption text-text-3">{header}</dt>
                <dd className="min-w-0 text-body-s text-text-1">{row[index]}</dd>
              </div>
            ))}
          </dl>
        ))}
      </div>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-640 border-collapse text-left">
          <caption className="sr-only">{section.title}</caption>
          <thead className="border-y-2 border-text-1 bg-bg-subtle">
            <tr>
              {section.table.headers.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="h-44 px-16 py-12 text-label-s font-medium text-text-2"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.table.rows.map((row, rowIndex) => (
              <tr key={section.id + '-row-' + rowIndex} className="border-b border-line">
                {row.map((cell, cellIndex) => (
                  <td
                    key={cell + '-' + cellIndex}
                    className="h-52 px-16 py-16 text-body-s text-text-1"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PrivacyContactCard() {
  return (
    <dl className="space-y-8 rounded-8 bg-bg-subtle p-16 lg:p-20">
      {PRIVACY_CONTACT.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[88px_minmax(0,1fr)] gap-12">
          <dt className="text-caption text-text-3">{label}</dt>
          <dd className="min-w-0 text-body-s text-text-1">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function GuideOrShippingPage({ document }: { document: GuideDocument }) {
  const content = GUIDE_DOCUMENTS[document];
  const publicDocumentQuery = useQuery({
    queryKey: ['legal-document', document],
    queryFn: async ({ signal }) =>
      (await getShopApi()).legalDocuments.getPublished(document, { signal }),
  });
  if (publicDocumentQuery.data)
    return <PublishedLegalDocument document={publicDocumentQuery.data} />;

  return (
    <PageContainer className="px-16 pt-24 pb-64 sm:px-20 lg:pt-40 lg:pb-80">
      <nav aria-label="현재 위치" className="mb-20 text-caption text-text-3">
        <Link href="/" className="rounded-4 focus-ring">
          홈
        </Link>
        <span aria-hidden="true" className="px-8">
          /
        </span>
        <span aria-current="page">{content.title}</span>
      </nav>
      <header className="mb-24 border-b border-line pb-24">
        <p className="text-caption text-text-3">고객지원</p>
        <h1 className="mt-8 text-h1 lg:text-web-h2">{content.title}</h1>
      </header>
      {document === 'guide' ? <GuideSteps /> : null}
      {document !== 'shipping' ? <GuideTabs active="guide" /> : null}
      <div className="grid gap-24 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-48">
        <nav aria-label="문서 목차" className="lg:sticky lg:top-96 lg:h-fit">
          <label htmlFor="document-toc" className="sr-only">
            목차에서 이동
          </label>
          <select
            id="document-toc"
            className="h-48 w-full rounded-8 border border-line-strong bg-bg px-12 text-body-s lg:hidden"
            defaultValue=""
            onChange={(event) => {
              if (event.currentTarget.value)
                globalThis.document
                  .getElementById(event.currentTarget.value)
                  ?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <option value="">목차를 선택해 주세요</option>
            {content.sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.title}
              </option>
            ))}
          </select>
          <ol className="hidden space-y-4 border-l border-line pl-16 lg:block">
            {content.sections.map((section) => (
              <li key={section.id}>
                <a
                  href={'#' + section.id}
                  className="inline-flex min-h-40 items-center rounded-4 text-body-s text-text-2 focus-ring hover:text-text-1"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="divide-y divide-line border-t border-line">
          {content.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-96 py-24 first:pt-24 lg:py-32"
            >
              <h2 className="text-h3">{section.title}</h2>
              <div className="mt-12 space-y-8 text-body-s text-text-2">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      {document === 'shipping' ? (
        <div className="mt-32 flex flex-wrap gap-8">
          <Link
            href="/mypage/claims/new"
            className="inline-flex min-h-48 items-center rounded-8 bg-text-1 px-16 text-label-m text-inverse focus-ring"
          >
            교환·반품 신청
          </Link>
          <Link
            href="/support/inquiry"
            className="inline-flex min-h-48 items-center rounded-8 border border-line-strong px-16 text-label-m focus-ring"
          >
            1:1 문의
          </Link>
        </div>
      ) : null}
    </PageContainer>
  );
}

function GuideTabs({ active }: { active: 'guide' }) {
  return (
    <nav
      aria-label="이용 안내 메뉴"
      className="mb-24 flex h-56 overflow-x-auto border-b border-line"
    >
      {DOCUMENT_TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          aria-current={tab.id === active ? 'page' : undefined}
          className={
            'relative inline-flex h-56 shrink-0 items-center justify-center px-24 text-label-l focus-ring ' +
            (tab.id === active ? 'border-b-2 border-text-1 text-text-1' : 'text-text-3')
          }
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function GuideSteps() {
  const steps = [
    ['01', '상품 선택', '카테고리와 검색을 이용해 필요한 현장 상품을 찾아보세요.'],
    ['02', '주문 및 결제', '옵션과 수량을 확인하고 주문서를 작성합니다.'],
    ['03', '배송 확인', '마이페이지에서 주문과 배송 진행 상황을 확인합니다.'],
  ];

  return (
    <ol className="mb-40 grid gap-12 lg:grid-cols-3 lg:gap-16">
      {steps.map(([number, title, description]) => (
        <li
          key={number}
          className="flex gap-16 rounded-12 border border-line p-20 lg:block lg:p-24"
        >
          <span className="text-web-h2 font-semibold text-text-3">{number}</span>
          <div className="min-w-0">
            <h2 className="text-h3">{title}</h2>
            <p className="mt-8 text-body-s text-text-2">{description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
