import type { ShopApi } from '@eum/api/shop-api';
import { queryKeys } from '@eum/api/query-keys';
import type { CompanyInfo, Faq, Inquiry, Member, Notice } from '@eum/api/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMemberSession } from '@/features/auth/member-session';
import { MemberInquiryDetailPage, MemberInquiriesPage } from '@/features/mypage/member-inquiries';
import { getShopApi } from '@/lib/shop-api';
import { FaqPage, InquiryPage, NoticesPage } from './support-pages';

vi.mock('@/lib/shop-api', () => ({ getShopApi: vi.fn() }));
vi.mock('@/features/auth/member-session', () => ({ useMemberSession: vi.fn() }));
const routerMock = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: routerMock.push }) }));

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
    orders: { listByMember: vi.fn(async () => []) },
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
    const tableRows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(tableRows[0]).toHaveClass('h-48');
    expect(within(tableRows[0]!).getAllByRole('cell')[0]).toHaveClass('py-12');
    expect(tableRows[2]).not.toHaveClass('h-48');
    expect(within(tableRows[2]!).getAllByRole('cell')[0]).toHaveClass('py-22');

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

  it('문의 작성 화면은 주문 선택과 1,000자 카운터를 제공하고 입력을 초기화합니다', async () => {
    mockMemberSession(createMember('mem-001'));
    renderWithQuery(<InquiryPage />);
    expect(await screen.findByRole('heading', { name: '문의 작성' })).toBeInTheDocument();
    expect(screen.getByLabelText('문의 유형 *')).toBeRequired();
    expect(screen.getByLabelText('제목 *')).toBeRequired();
    expect(screen.getByRole('textbox', { name: /문의 내용/ })).toBeRequired();
    expect(screen.getByLabelText('주문 선택 (선택)')).toBeInTheDocument();
    expect(screen.getByText('0 / 1,000')).toBeInTheDocument();

    const inquiryType = screen.getByLabelText('문의 유형 *');
    const title = screen.getByLabelText('제목 *');
    const body = screen.getByRole('textbox', { name: /문의 내용/ });
    fireEvent.change(inquiryType, { target: { value: 'delivery' } });
    fireEvent.change(title, { target: { value: '작성 중인 제목' } });
    fireEvent.change(body, { target: { value: '작성 중인 내용' } });
    expect(screen.getByText('8 / 1,000')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(inquiryType).toHaveValue('');
    expect(title).toHaveValue('');
    expect(body).toHaveValue('');
    expect(
      screen.getByText('작성 내용을 초기화했습니다. 입력값은 저장되지 않았습니다.'),
    ).toBeInTheDocument();
    const api = await getShopApi();
    expect(api.members.list).not.toHaveBeenCalled();
    expect(api.orders.listByMember).toHaveBeenCalledWith(
      'mem-001',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(api.inquiries.listByMember).not.toHaveBeenCalled();
  });

  it('문의 등록은 입력값을 지운 뒤 저장하지 않는 데모 완료 안내를 보여 줍니다', async () => {
    mockMemberSession(createMember('mem-001'));
    renderWithQuery(<InquiryPage />);
    await screen.findByRole('heading', { name: '문의 작성' });
    fireEvent.change(screen.getByLabelText('문의 유형 *'), { target: { value: 'delivery' } });
    fireEvent.change(screen.getByLabelText('제목 *'), { target: { value: '배송 확인' } });
    fireEvent.change(screen.getByRole('textbox', { name: /문의 내용/ }), {
      target: { value: '배송 일정을 확인해 주세요.' },
    });
    fireEvent.submit(
      screen.getByRole('heading', { name: '문의 작성' }).closest('form') as HTMLFormElement,
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      '문의가 접수되었습니다. 데모 화면이며 입력값은 전송·저장되지 않았습니다.',
    );
    expect(screen.getByLabelText('제목 *')).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /문의 내용/ })).toHaveValue('');
    expect(screen.getByText('접수 상태 다시 보기')).toBeInTheDocument();
    const api = await getShopApi();
    expect(api.inquiries.listByMember).not.toHaveBeenCalled();
  });

  it('회원 문의 목록은 현재 세션 회원의 문의만 표시하고 상세 경로를 연결합니다', async () => {
    mockMemberSession(createMember('mem-001'));
    renderWithQuery(<MemberInquiriesPage />);
    const inquiryLinks = await screen.findAllByRole('link', { name: '배송 일정 문의드립니다' });
    expect(inquiryLinks[0]).toHaveAttribute('href', '/mypage/inquiries/inq-1');
    expect(await screen.findAllByText('세금계산서 발행 요청')).toHaveLength(2);
    expect(await screen.findAllByText('대량 구매 견적 문의')).toHaveLength(2);
    const api = await getShopApi();
    expect(api.inquiries.listByMember).toHaveBeenCalledWith(
      'mem-001',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('회원 문의 상세는 문의 본문을 화면 텍스트로 표시합니다', async () => {
    const detailInquiry = { ...inquiries[0], body: '<script>alert(1)</script>문의 내용' };
    vi.mocked(getShopApi).mockResolvedValue({
      ...createApi([]),
      inquiries: { listByMember: vi.fn(async () => [detailInquiry]) },
    } as unknown as ShopApi);
    mockMemberSession(createMember('mem-001'));
    renderWithQuery(<MemberInquiryDetailPage inquiryId="inq-1" />);
    expect(await screen.findByText('<script>alert(1)</script>문의 내용')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('회원 문의 상세 조회 실패는 고정 문구와 다시 시도 동작을 표시합니다', async () => {
    const detailInquiry = { ...inquiries[0], body: '다시 불러온 문의 내용' };
    const listByMember = vi
      .fn()
      .mockRejectedValueOnce(new Error('sensitive server failure'))
      .mockResolvedValueOnce([detailInquiry]);
    vi.mocked(getShopApi).mockResolvedValue({
      ...createApi([]),
      inquiries: { listByMember },
    } as unknown as ShopApi);
    mockMemberSession(createMember('mem-001'));
    renderWithQuery(<MemberInquiryDetailPage inquiryId="inq-1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('문의 내용을 불러오지 못했습니다.');
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByText('다시 불러온 문의 내용')).toBeInTheDocument();
    expect(listByMember).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('sensitive server failure')).not.toBeInTheDocument();
  });

  it('회원 문의 목록은 다른 회원의 fixture를 걸러 냅니다', async () => {
    mockMemberSession(createMember('mem-002'));
    renderWithQuery(<MemberInquiriesPage />);
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
      '문의 내역은 로그인 후 마이페이지에서 확인할 수 있습니다.',
    );
    expect(screen.queryByText('배송 일정 문의드립니다')).not.toBeInTheDocument();
    const api = await getShopApi();
    expect(api.members.list).not.toHaveBeenCalled();
    expect(api.inquiries.listByMember).not.toHaveBeenCalled();
  });
});
