import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminLegalDocument } from '@eum/api/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminInquiriesPage } from './AdminInquiriesPage';
import { AdminProductQuestionsPage } from './AdminProductQuestionsPage';
import { AdminReviewsPage } from './AdminReviewsPage';
import { AdminCompanyPoliciesPage } from './AdminCompanyPoliciesPage';

const mocks = vi.hoisted(() => ({
  getShopApi: vi.fn(),
  updateInquiry: vi.fn(),
  updateQuestion: vi.fn(),
  updateReview: vi.fn(),
}));
vi.mock('@/lib/shop-api', () => ({ getShopApi: mocks.getShopApi }));

function renderPage(page: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{page}</QueryClientProvider>);
}

describe('고객지원 운영 화면', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getShopApi.mockResolvedValue({
      inquiries: {
        adminList: async () => [
          {
            id: 'inq-test',
            memberId: 'mem-test',
            title: '배송 문의',
            body: '일정 확인 부탁드립니다.',
            status: 'waiting',
            createdAt: '2026-10-18T09:00:00Z',
            answer: null,
            attachments: [],
            adminMemo: '',
            statusHistory: [
              { status: 'waiting', occurredAt: '2026-10-18T09:00:00Z', note: '문의 접수' },
            ],
          },
        ],
        updateAdmin: mocks.updateInquiry.mockResolvedValue(undefined),
      },
      products: {
        adminList: async () => [{ id: 'p-1', name: '안전모' }],
        adminListReviews: async () => [
          {
            id: 'r-1',
            productId: 'p-1',
            authorName: '김*수',
            rating: 5,
            content: '잘 받았습니다.',
            optionLabel: null,
            createdAt: '2026-10-18T09:00:00Z',
            isVisible: true,
            adminReply: '',
            adminMemo: '',
          },
        ],
        updateReviewAdmin: mocks.updateReview.mockResolvedValue(undefined),
        adminListQuestions: async () => [
          {
            id: 'q-1',
            productId: 'p-1',
            authorName: '이*영',
            title: '사이즈 문의',
            body: '58cm에 맞나요?',
            isPrivate: false,
            status: 'waiting',
            createdAt: '2026-10-18T09:00:00Z',
            answer: null,
            adminMemo: '',
            statusHistory: [
              { status: 'waiting', occurredAt: '2026-10-18T09:00:00Z', note: '문의 접수' },
            ],
          },
        ],
        updateQuestionAdmin: mocks.updateQuestion.mockResolvedValue(undefined),
      },
      company: {
        getAdminInfo: async () => ({
          companyName: '이음산업건설',
          representative: '대표',
          businessRegistrationNumber: '000-00-00000',
          mailOrderSalesNumber: '',
          address: '서울',
          email: 'info@example.com',
          quoteEmail: '',
          privacyOfficer: '담당자',
          customerCenterPhone: '02-000-0000',
          customerCenterTel: '0200000000',
          customerCenterHours: '평일 9-18시',
        }),
        saveAdminInfo: vi.fn(async (input) => input),
      },
      legalDocuments: { adminList: async () => [], saveAdmin: vi.fn(async (input) => input) },
    });
  });

  it('1:1 문의 공개답변과 내부 메모를 별도 필드로 저장한다', async () => {
    const user = userEvent.setup();
    renderPage(<AdminInquiriesPage />);
    await screen.findByRole('heading', { name: '배송 문의' });
    await user.type(screen.getByLabelText('고객 공개 답변'), '내일 출고 예정입니다.');
    await user.type(screen.getByLabelText('내부 메모'), '창고 확인 완료');
    await user.selectOptions(screen.getByLabelText('처리 상태'), 'answered');
    await user.click(screen.getByRole('button', { name: '답변 저장' }));
    expect(mocks.updateInquiry).toHaveBeenCalledWith(
      'inq-test',
      expect.objectContaining({
        answer: '내일 출고 예정입니다.',
        adminMemo: '창고 확인 완료',
        status: 'answered',
      }),
    );
  });

  it('상품 문의 답변을 공개 필드와 내부 메모에 나누어 저장한다', async () => {
    const user = userEvent.setup();
    renderPage(<AdminProductQuestionsPage />);
    await screen.findByRole('heading', { name: '안전모' });
    await user.type(screen.getByLabelText('고객 공개 답변'), '착용 가능합니다.');
    await user.type(screen.getByLabelText('내부 메모'), '제품팀 확인 완료');
    await user.click(screen.getByRole('button', { name: '답변 저장' }));
    expect(mocks.updateQuestion).toHaveBeenCalledWith(
      'q-1',
      expect.objectContaining({
        answer: '착용 가능합니다.',
        adminMemo: '제품팀 확인 완료',
        status: 'answered',
      }),
    );
  });

  it('리뷰 공개 여부·답변·내부 메모를 저장한다', async () => {
    const user = userEvent.setup();
    renderPage(<AdminReviewsPage />);
    await screen.findByRole('heading', { name: '안전모' });
    await user.type(screen.getByLabelText('고객 공개 답변'), '리뷰 감사합니다.');
    await user.type(screen.getByLabelText('내부 메모'), '추가 조치 없음');
    await user.click(screen.getByRole('button', { name: '변경 저장' }));
    expect(mocks.updateReview).toHaveBeenCalledWith(
      'r-1',
      expect.objectContaining({
        adminReply: '리뷰 감사합니다.',
        adminMemo: '추가 조치 없음',
        isVisible: true,
      }),
    );
  });

  it('회사·정책 Admin에서 시행일·버전·공개 상태를 포함해 문서를 저장한다', async () => {
    const user = userEvent.setup();
    const saveLegal = vi.fn(async (input: AdminLegalDocument) => input);
    const shopApi = await mocks.getShopApi();
    shopApi.legalDocuments.saveAdmin = saveLegal;
    mocks.getShopApi.mockResolvedValue(shopApi);
    renderPage(<AdminCompanyPoliciesPage />);
    await screen.findByRole('heading', { name: '회사·정책 정보' });
    await user.clear(screen.getByLabelText('버전'));
    await user.type(screen.getByLabelText('버전'), '2.0');
    await user.type(screen.getByLabelText('시행일'), '2026-11-01');
    await user.type(screen.getByLabelText('문서 본문'), '개정 이용약관 본문');
    await user.click(screen.getByRole('checkbox', { name: 'Web에 공개' }));
    await user.click(screen.getByRole('button', { name: '정책 문서 저장' }));
    expect(saveLegal).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'terms',
        version: '2.0',
        effectiveAt: '2026-11-01',
        body: '개정 이용약관 본문',
        isPublished: true,
      }),
    );
  });
});
