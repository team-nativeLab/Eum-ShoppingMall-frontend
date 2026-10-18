import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LegalDocumentPage } from './legal-pages';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/page-container', () => ({
  PageContainer: ({ children, ...props }: { children: ReactNode; className?: string }) => (
    <main {...props}>{children}</main>
  ),
}));

const mocks = vi.hoisted(() => ({ getShopApi: vi.fn() }));
vi.mock('@/lib/shop-api', () => ({ getShopApi: mocks.getShopApi }));

function renderLegalPage(document: 'terms' | 'privacy' | 'guide' | 'shipping') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LegalDocumentPage document={document} />
    </QueryClientProvider>,
  );
}

describe('법률 문서 페이지', () => {
  beforeEach(() => {
    mocks.getShopApi.mockResolvedValue({
      legalDocuments: {
        getPublished: async () => {
          throw new Error('NOT_FOUND');
        },
      },
    });
  });
  it('약관 페이지 제목과 탭, 문서 헤더, 목차를 Figma 순서로 표시합니다', () => {
    renderLegalPage('terms');

    const pageHeading = screen.getByRole('heading', { level: 1, name: '약관 및 정책' });
    const tabs = screen.getByRole('navigation', { name: '이용 안내 메뉴' });
    const documentHeading = screen.getByRole('heading', { level: 2, name: '이용약관' });
    const tableOfContents = screen.getByRole('navigation', { name: '문서 목차' });

    expect(
      pageHeading.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      tabs.compareDocumentPosition(documentHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      documentHeading.compareDocumentPosition(tableOfContents) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByText(
        '이 약관은 이음산업건설 쇼핑몰 이용 조건과 절차를 정합니다. 조항 내용이 들어갑니다.',
      ),
    ).toBeInTheDocument();
  });

  it('약관의 다섯 장, 스물네 조항과 샘플 조항을 표시합니다', () => {
    renderLegalPage('terms');

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(24);
    expect(screen.getByRole('heading', { name: '제1장 총칙' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '제2장 회원' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '제3장 구매·결제' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '제4장 배송·청약철회' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '제5장 보칙' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '제24조(재판권 및 준거법)' })).toBeInTheDocument();
    expect(screen.getAllByText('조항 내용이 들어갑니다.')).toHaveLength(24);
    expect(screen.getAllByText('① 항 내용이 들어갑니다.')).toHaveLength(2);
    expect(screen.getAllByText('② 항 내용이 들어갑니다.')).toHaveLength(2);
  });

  it('개인정보처리방침의 12개 항목과 Figma 샘플 표를 표시합니다', () => {
    renderLegalPage('privacy');

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(12);
    expect(
      screen.getByRole('heading', { name: '12. 개인정보 처리방침의 변경' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('table')).toHaveLength(2);
    expect(screen.getAllByRole('columnheader')).toHaveLength(8);
    expect(screen.getAllByRole('row')).toHaveLength(6);
    expect(screen.getAllByText('조항 내용이 들어갑니다.')).toHaveLength(12);
    expect(
      screen.getByText('이 개인정보 처리방침은 0000년 00월 00일부터 적용합니다.'),
    ).toBeInTheDocument();
  });

  it('이전 약관과 개정 예정 고지를 Figma 샘플 문구로 표시합니다', () => {
    renderLegalPage('terms');

    fireEvent.change(screen.getByLabelText('시행일'), { target: { value: 'previous' } });
    expect(screen.getByRole('status')).toHaveTextContent(
      '이전 약관입니다. 현재 약관은 0000.00.00부터 시행 중입니다.',
    );

    fireEvent.change(screen.getByLabelText('시행일'), { target: { value: 'upcoming' } });
    expect(screen.getByRole('status')).toHaveTextContent(
      '0000.00.00부터 개정 약관이 시행됩니다. 주요 변경: 개정 요약이 들어갑니다.',
    );
  });

  it('공개 ShopApi 약관 문서가 있으면 정적 샘플 대신 저장된 버전 본문을 표시합니다', async () => {
    mocks.getShopApi.mockResolvedValue({
      legalDocuments: {
        getPublished: async () => ({
          id: 'terms',
          title: '운영 이용약관',
          version: '2.0',
          effectiveAt: '2026-11-01',
          body: '운영자가 저장한 약관 본문',
          isPublished: true,
        }),
      },
    });
    renderLegalPage('terms');
    expect(await screen.findByText('운영자가 저장한 약관 본문')).toBeInTheDocument();
    expect(screen.getByText('버전 2.0 · 시행일 2026-11-01')).toBeInTheDocument();
  });
});
