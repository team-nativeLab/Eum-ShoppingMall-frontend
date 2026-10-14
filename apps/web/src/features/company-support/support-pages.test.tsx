import type { ShopApi } from '@eum/api/shop-api';
import { queryKeys } from '@eum/api/query-keys';
import type { CompanyInfo, Faq, Inquiry, Member, Notice } from '@eum/api/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMemberSession } from '@/features/auth/member-session';
import { getShopApi } from '@/lib/shop-api';
import { FaqPage, InquiryPage, NoticesPage } from './support-pages';

vi.mock('@/lib/shop-api', () => ({ getShopApi: vi.fn() }));
vi.mock('@/features/auth/member-session', () => ({ useMemberSession: vi.fn() }));

const companyInfo: CompanyInfo = {
  companyName: '이음산업건설',
  representative: '',
  businessRegistrationNumber: '',
  mailOrderSalesNumber: '',
  address: '',
  email: 'support@example.com',
  privacyOfficer: '',
  customerCenterPhone: '0000-0000',
  customerCenterTel: null,
  customerCenterHours: '평일 운영',
};

const faqs: Faq[] = [
  {
    id: 'faq-1',
    category: '배송',
    question: '주문 후 배송까지 얼마나 걸리나요?',
    answer: '평균 2~3일 이내 출고됩니다.',
  },
  {
    id: 'faq-2',
    category: '주문/결제',
    question: '세금계산서 발행이 가능한가요?',
    answer: '주문 정보를 확인합니다.',
  },
];

const inquiries: Inquiry[] = [
  {
    id: 'inq-1',
    memberId: 'mem-001',
    title: '배송 일정 문의드립니다',
    body: '',
    status: 'answered',
    createdAt: '2026-10-02T09:00:00+09:00',
    answer: '확인했습니다.',
  },
  {
    id: 'inq-2',
    memberId: 'mem-001',
    title: '세금계산서 발행 요청',
    body: '',
    status: 'waiting',
    createdAt: '2026-09-25T09:00:00+09:00',
    answer: null,
  },
  {
    id: 'inq-3',
    memberId: 'mem-001',
    title: '대량 구매 견적 문의',
    body: '',
    status: 'answered',
    createdAt: '2026-09-12T09:00:00+09:00',
    answer: '확인했습니다.',
  },
];

function createApi(notices: Notice[], apiFaqs: Faq[] = faqs): ShopApi {
  return {
    company: { getInfo: async () => companyInfo },
    notices: { list: async () => notices },
    faqs: { list: async () => apiFaqs },
    members: { list: vi.fn(async () => [{ id: 'mem-001' }]) },
    inquiries: {
      listByMember: vi.fn(async (memberId: string) =>
        inquiries.filter((inquiry) => inquiry.memberId === memberId),
      ),
    },
  } as unknown as ShopApi;
}

function createMember(id: string): Member {
  return {
    id,
    email: `${id}@example.com`,
    name: '목 회원',
    phone: '',
    joinedAt: '2026-10-01T00:00:00+09:00',
    pointBalance: 0,
  };
}

function mockMemberSession(member: Member | null) {
  vi.mocked(useMemberSession).mockReturnValue({
    member,
    status: 'ready',
    refreshMember: async () => member,
    setMember: vi.fn(),
    clearMember: vi.fn(async () => undefined),
  });
}

function renderWithQuery(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
  };
}

function getPageNavigations() {
  const navigations = screen.getAllByRole('navigation', { name: '페이지 이동' });
  const desktop = navigations[0];
  const mobile = navigations[1];
  if (!desktop || !mobile) throw new Error('데스크톱/모바일 페이지 이동 UI를 찾지 못했습니다.');
  return { desktop, mobile };
}

beforeEach(() => {
  mockMemberSession(null);
  const notices = Array.from({ length: 12 }, (_, index) => ({
    id: `ntc-${index + 1}`,
    title: `공지 ${index + 1}`,
    body: `안내 ${index + 1}`,
    isPinned: index < 2,
    publishedAt: new Date(Date.UTC(2026, 9, 14 - index)).toISOString(),
    viewCount: index * 4,
  }));
  vi.mocked(getShopApi).mockResolvedValue(createApi(notices));
});

describe('company support routes', () => {
  it('공지 목록은 열 행씩 페이지 이동하고 검색 후 첫 페이지로 돌아옵니다', async () => {
    renderWithQuery(<NoticesPage />);
    await screen.findAllByText('공지 1');
    const desktopPagination = within(getPageNavigations().desktop);
    fireEvent.click(desktopPagination.getByRole('button', { name: '2페이지' }));
    await screen.findAllByText('공지 12');
    expect(screen.queryByText('공지 1')).not.toBeInTheDocument();

    const searchInput = screen.getByRole('searchbox', { name: '공지사항 검색' });
    fireEvent.change(searchInput, { target: { value: '공지 1' } });
    fireEvent.submit(searchInput.closest('form') as HTMLFormElement);
    await waitFor(() => expect(screen.getAllByText('공지 1')).toHaveLength(2));
    expect(screen.queryAllByRole('button', { name: '2페이지' })).toHaveLength(0);
    fireEvent.change(searchInput, { target: { value: '없는 공지' } });
    fireEvent.submit(searchInput.closest('form') as HTMLFormElement);
    expect(await screen.findByText('검색 결과가 없습니다.')).toBeInTheDocument();
  });

  it('공지 데이터가 줄면 현재 페이지를 최대 페이지 안으로 보정합니다', async () => {
    const { queryClient } = renderWithQuery(<NoticesPage />);
    await screen.findAllByText('공지 1');
    const desktopPagination = within(getPageNavigations().desktop);
    fireEvent.click(desktopPagination.getByRole('button', { name: '2페이지' }));
    await screen.findAllByText('공지 12');

    const api = await getShopApi();
    const allNotices = await api.notices.list();
    queryClient.setQueryData(queryKeys.notices.all, allNotices.slice(0, 5), {
      updatedAt: Date.now() + 1_000,
    });
    await screen.findAllByText('공지 1');
    await waitFor(() => expect(screen.queryByRole('button', { name: '2페이지' })).toBeNull());
    expect(screen.queryByText('공지 12')).not.toBeInTheDocument();
  });

  it('공지 데이터 refetch는 동일한 결과일 때 현재 페이지를 유지합니다', async () => {
    const { queryClient } = renderWithQuery(<NoticesPage />);
    await screen.findAllByText('공지 1');
    const desktopPagination = within(getPageNavigations().desktop);
    fireEvent.click(desktopPagination.getByRole('button', { name: '2페이지' }));
    await screen.findAllByText('공지 12');

    const api = await getShopApi();
    const allNotices = await api.notices.list();
    queryClient.setQueryData(queryKeys.notices.all, [...allNotices], {
      updatedAt: Date.now() + 1_000,
    });

    await waitFor(() =>
      expect(
        within(getPageNavigations().desktop).getByRole('button', { name: '2페이지' }),
      ).toHaveAttribute('aria-current', 'page'),
    );
    expect(screen.getAllByText('공지 12')).toHaveLength(2);
  });

  it('공지 페이지네이션은 데스크톱에서 Figma의 1–5 창을 쓰고 모바일은 축약합니다', async () => {
    const notices = Array.from({ length: 100 }, (_, index) => ({
      id: `ntc-${index + 1}`,
      title: `공지 ${index + 1}`,
      body: `안내 ${index + 1}`,
      isPinned: index < 2,
      publishedAt: new Date(Date.UTC(2026, 9, 14 - index)).toISOString(),
      viewCount: index * 4,
    }));
    vi.mocked(getShopApi).mockResolvedValue(createApi(notices));
    renderWithQuery(<NoticesPage />);
    await screen.findAllByText('공지 1');

    const { desktop: desktopNav, mobile: mobileNav } = getPageNavigations();
    expect(desktopNav).toHaveClass('lg:flex');
    expect(mobileNav).toHaveClass('lg:hidden');
    expect(
      within(desktopNav)
        .getAllByRole('button', { name: /^\d+페이지$/ })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['1페이지', '2페이지', '3페이지', '4페이지', '5페이지', '10페이지']);
    expect(
      within(mobileNav)
        .getAllByRole('button', { name: /^\d+페이지$/ })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['1페이지', '2페이지', '3페이지', '10페이지']);
    expect(
      screen.queryByText('이음산업건설의 소식과 이용 안내를 확인하세요.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/전체\s*100건/)).not.toBeInTheDocument();
  });

  it('공지와 FAQ의 원본 빈 상태와 검색 결과 없음 상태를 구분합니다', async () => {
    vi.mocked(getShopApi).mockResolvedValue(createApi([], []));
    const { unmount } = renderWithQuery(<NoticesPage />);
    expect(await screen.findByText('등록된 공지사항이 없습니다.')).toBeInTheDocument();
    unmount();

    vi.mocked(getShopApi).mockResolvedValue(createApi([], []));
    const faqView = renderWithQuery(<FaqPage />);
    expect(await screen.findByText('등록된 FAQ가 없습니다.')).toBeInTheDocument();
    faqView.unmount();
  });

  it('FAQ는 첫 항목을 열고 분류 칩과 아코디언을 동작시킵니다', async () => {
    renderWithQuery(<FaqPage />);
    const firstQuestion = await screen.findByRole('button', {
      name: /주문 후 배송까지 얼마나 걸리나요/,
    });
    expect(firstQuestion).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('평균 2~3일 이내 출고됩니다.')).toBeInTheDocument();
    fireEvent.click(firstQuestion);
    expect(firstQuestion).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: '주문/결제' }));
    expect(await screen.findByText('세금계산서 발행이 가능한가요?')).toBeInTheDocument();
    expect(screen.queryByText('주문 후 배송까지 얼마나 걸리나요?')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '전체' }));
    const faqSearch = screen.getByRole('searchbox', { name: '자주 묻는 질문 검색' });
    fireEvent.change(faqSearch, { target: { value: '세금계산서' } });
    fireEvent.submit(faqSearch.closest('form') as HTMLFormElement);
    expect(await screen.findByText('세금계산서 발행이 가능한가요?')).toBeInTheDocument();
    expect(screen.queryByText('주문 후 배송까지 얼마나 걸리나요?')).not.toBeInTheDocument();
    fireEvent.change(faqSearch, { target: { value: '없는 질문' } });
    fireEvent.submit(faqSearch.closest('form') as HTMLFormElement);
    expect(await screen.findByText('검색 또는 선택한 분류 결과가 없습니다.')).toBeInTheDocument();
    expect(screen.getAllByText('배송', { exact: true })).toHaveLength(1);
  });

  it('문의 내역 세 행을 보여 주고 연결되지 않은 제출은 비활성화합니다', async () => {
    mockMemberSession(createMember('mem-001'));
    renderWithQuery(<InquiryPage />);
    expect(await screen.findAllByText('배송 일정 문의드립니다')).toHaveLength(2);
    expect(screen.getAllByText('세금계산서 발행 요청')).toHaveLength(2);
    expect(screen.getAllByText('대량 구매 견적 문의')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '등록' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeEnabled();
    expect(screen.getByRole('link', { name: '문의 작성' })).toHaveAttribute(
      'href',
      '#inquiry-form-heading',
    );
    expect(screen.getByRole('heading', { name: '문의 작성' }).closest('form')).not.toBeNull();
    expect(screen.getByRole('heading', { name: '문의 작성' })).toHaveClass('scroll-mt-96');
    expect(screen.getByLabelText('문의 유형 *')).toBeRequired();
    expect(screen.getByLabelText('제목 *')).toBeRequired();
    expect(screen.getByLabelText('문의 내용 *')).toBeRequired();
    expect(screen.getByText('문의 등록 기능은 아직 연결되지 않았습니다.')).toBeInTheDocument();

    const inquiryType = screen.getByLabelText('문의 유형 *');
    const title = screen.getByLabelText('제목 *');
    const body = screen.getByLabelText('문의 내용 *');
    fireEvent.change(inquiryType, { target: { value: 'delivery' } });
    fireEvent.change(title, { target: { value: '작성 중인 제목' } });
    fireEvent.change(body, { target: { value: '작성 중인 내용' } });
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(inquiryType).toHaveValue('');
    expect(title).toHaveValue('');
    expect(body).toHaveValue('');
    const api = await getShopApi();
    expect(api.members.list).not.toHaveBeenCalled();
    expect(api.inquiries.listByMember).toHaveBeenCalledWith(
      'mem-001',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('첫 번째가 아닌 현재 회원에게 다른 회원의 문의를 표시하지 않습니다', async () => {
    mockMemberSession(createMember('mem-002'));
    renderWithQuery(<InquiryPage />);
    expect(await screen.findByText('등록된 문의가 없습니다.')).toBeInTheDocument();
    expect(screen.queryByText('배송 일정 문의드립니다')).not.toBeInTheDocument();
    const api = await getShopApi();
    expect(api.members.list).not.toHaveBeenCalled();
    expect(api.inquiries.listByMember).toHaveBeenCalledWith(
      'mem-002',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('로그아웃 상태에서는 회원 문의를 조회하지 않습니다', async () => {
    renderWithQuery(<InquiryPage />);
    expect(await screen.findByRole('status')).toHaveTextContent(
      '로그인 후 문의 내역을 확인할 수 있습니다.',
    );
    expect(screen.queryByText('배송 일정 문의드립니다')).not.toBeInTheDocument();
    const api = await getShopApi();
    expect(api.members.list).not.toHaveBeenCalled();
    expect(api.inquiries.listByMember).not.toHaveBeenCalled();
  });
});
