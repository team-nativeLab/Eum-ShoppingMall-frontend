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
const routerMock = vi.hoisted(() => ({ push: vi.fn(), search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerMock.push }),
  useSearchParams: () => new URLSearchParams(routerMock.search),
}));

const companyInfo: CompanyInfo = {
  companyName: '안전맛집',
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
    title: '단체 구매 문의',
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
      submit: vi.fn(async (input: Pick<Inquiry, 'memberId' | 'title' | 'body'>) => ({
        ...inquiries[0],
        id: 'inq-submitted',
        ...input,
        status: 'waiting' as const,
        createdAt: '2026-10-03T00:00:00Z',
        answer: null,
      })),
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
  routerMock.search = '';
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
    expect(screen.queryByText('안전맛집의 소식과 이용 안내를 확인하세요.')).not.toBeInTheDocument();
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

  it('문의 작성 화면은 제목·본문을 제공하고 입력값을 초기화합니다', async () => {
    mockMemberSession(createMember('mem-001'));
    renderWithQuery(<InquiryPage />);
    expect(await screen.findByRole('heading', { name: '문의 작성' })).toBeInTheDocument();
    expect(
      screen.getByText(
        /Mock 문의는 현재 브라우저에 저장되며 같은 origin의 Preview Admin에서 확인할 수 있습니다/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/만료되지 않으며 브라우저 사이트 데이터를 삭제하면 정리됩니다/),
    ).toBeInTheDocument();
    expect(screen.getByText(/실제 개인정보 대신 테스트 내용만 입력해 주세요/)).toBeInTheDocument();
    expect(screen.getByLabelText(/제목/)).toBeRequired();
    expect(screen.getByRole('textbox', { name: /문의 내용/ })).toBeRequired();
    expect(screen.getByText('0 / 5,000')).toBeInTheDocument();

    const title = screen.getByLabelText(/제목/);
    const body = screen.getByRole('textbox', { name: /문의 내용/ });
    fireEvent.change(title, { target: { value: '작성 중인 제목' } });
    fireEvent.change(body, { target: { value: '작성 중인 내용' } });
    expect(screen.getByText('8 / 5,000')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '초기화' }));
    expect(title).toHaveValue('');
    expect(body).toHaveValue('');
    expect(screen.getByText('작성 내용을 초기화했습니다.')).toBeInTheDocument();
    await screen.findByText('배송 일정 문의드립니다');
    const api = await getShopApi();
    expect(api.orders.listByMember).not.toHaveBeenCalled();
  });

  it('회원 세션으로 문의를 저장하고 상품 문맥은 canonical 상품 정보로 포함합니다', async () => {
    mockMemberSession(createMember('mem-001'));
    routerMock.search =
      '?productId=&optionId=color%3Ablack&quantity=99&productId=product-a&optionId=color%3Awhite&quantity=3&productId=product-a&optionId=color%3Ablack&quantity=2';
    const product = {
      id: 'product-a',
      name: '안전모',
      options: [
        {
          id: 'color',
          label: '색상',
          required: true,
          choices: [
            { id: 'white', label: '백색', priceDelta: 0 },
            { id: 'black', label: '흑색', priceDelta: 0 },
          ],
        },
      ],
      skus: [],
    };
    const submit = vi.fn(async (input: Pick<Inquiry, 'memberId' | 'title' | 'body'>) => ({
      ...inquiries[0],
      id: 'inq-saved',
      ...input,
      status: 'waiting' as const,
      answer: null,
    }));
    vi.mocked(getShopApi).mockResolvedValue({
      ...createApi([]),
      products: { getById: vi.fn(async () => product) },
      inquiries: { listByMember: vi.fn(async () => []), submit },
    } as unknown as ShopApi);
    renderWithQuery(<InquiryPage />);
    expect(await screen.findByText('안전모 · 색상: 백색 · 수량 3')).toBeInTheDocument();
    expect(screen.getByText('안전모 · 색상: 흑색 · 수량 2')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/제목/), { target: { value: '납기 문의' } });
    fireEvent.change(screen.getByRole('textbox', { name: /문의 내용/ }), {
      target: { value: '입고 일정을 알려주세요.' },
    });
    fireEvent.click(screen.getByRole('button', { name: '문의 등록' }));

    expect(await screen.findByRole('heading', { name: '문의 접수 완료' })).toBeInTheDocument();
    expect(submit).toHaveBeenCalledWith({
      memberId: 'mem-001',
      title: '상품 문의: 안전모 · 납기 문의',
      body: '문의 상품\n- 안전모 (색상: 백색) · 수량 3\n- 안전모 (색상: 흑색) · 수량 2\n\n입고 일정을 알려주세요.',
    });
    expect(screen.getByRole('link', { name: '접수 내역 보기' })).toHaveAttribute(
      'href',
      '/mypage/inquiries/inq-saved',
    );
    routerMock.search = '';
  });

  it('상품 정보 조회 실패 상태에서 다시 시도해 상품 문맥을 불러옵니다', async () => {
    mockMemberSession(createMember('mem-001'));
    routerMock.search = '?productId=product-retry';
    const product = {
      id: 'product-retry',
      name: '안전모',
      options: [],
      skus: [],
    };
    const getById = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce(product);
    vi.mocked(getShopApi).mockResolvedValue({
      ...createApi([]),
      products: { getById },
    } as unknown as ShopApi);
    renderWithQuery(<InquiryPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('상품 정보를 불러오지 못했습니다.');
    fireEvent.click(screen.getByRole('button', { name: '상품 정보 다시 시도' }));
    expect(await screen.findByText('안전모 · 수량 1')).toBeInTheDocument();
    expect(getById).toHaveBeenCalledTimes(2);
    routerMock.search = '';
  });

  it('문의 저장 실패 시 입력값을 보존하고 성공 완료로 표시하지 않습니다', async () => {
    mockMemberSession(createMember('mem-001'));
    vi.mocked(getShopApi).mockResolvedValue({
      ...createApi([]),
      inquiries: {
        listByMember: vi.fn(async () => []),
        submit: vi.fn(async () => {
          throw new Error('저장 실패');
        }),
      },
    } as unknown as ShopApi);
    renderWithQuery(<InquiryPage />);
    await screen.findByRole('heading', { name: '문의 작성' });
    fireEvent.change(screen.getByLabelText(/제목/), { target: { value: '실패 제목' } });
    fireEvent.change(screen.getByRole('textbox', { name: /문의 내용/ }), {
      target: { value: '실패 본문' },
    });
    fireEvent.click(screen.getByRole('button', { name: '문의 등록' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('저장 실패');
    expect(screen.getByLabelText(/제목/)).toHaveValue('실패 제목');
    expect(screen.getByRole('textbox', { name: /문의 내용/ })).toHaveValue('실패 본문');
    expect(screen.queryByRole('heading', { name: '문의 접수 완료' })).not.toBeInTheDocument();
  });

  it('회원 문의 목록은 현재 세션 회원의 문의만 표시하고 상세 경로를 연결합니다', async () => {
    mockMemberSession(createMember('mem-001'));
    renderWithQuery(<MemberInquiriesPage />);
    const inquiryLinks = await screen.findAllByRole('link', { name: '배송 일정 문의드립니다' });
    expect(inquiryLinks[0]).toHaveAttribute('href', '/mypage/inquiries/inq-1');
    expect(await screen.findAllByText('세금계산서 발행 요청')).toHaveLength(2);
    expect(await screen.findAllByText('단체 구매 문의')).toHaveLength(2);
    const answeredBadges = await screen.findAllByText('답변완료');
    expect(answeredBadges.length).toBeGreaterThan(0);
    answeredBadges.forEach((badge) => expect(badge).toHaveClass('bg-success-tint', 'text-success'));
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
    expect(screen.getByText('답변완료')).toHaveClass('bg-success-tint', 'text-success');
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
      '문의 등록과 내역 확인은 회원 로그인 후 이용할 수 있습니다.',
    );
    expect(screen.queryByText('배송 일정 문의드립니다')).not.toBeInTheDocument();
    const api = await getShopApi();
    expect(api.members.list).not.toHaveBeenCalled();
    expect(api.inquiries.listByMember).not.toHaveBeenCalled();
  });

  it('문의 화면은 세션 회원의 문의만 최신순으로 표시합니다', async () => {
    const otherMemberInquiry = { ...inquiries[1], id: 'other-inquiry', memberId: 'mem-002' };
    const listByMember = vi.fn(async () => [inquiries[0], otherMemberInquiry, inquiries[1]]);
    vi.mocked(getShopApi).mockResolvedValue({
      ...createApi([]),
      inquiries: { listByMember },
    } as unknown as ShopApi);
    mockMemberSession(createMember('mem-001'));
    renderWithQuery(<InquiryPage />);

    const latestInquiry = await screen.findByRole('link', { name: '배송 일정 문의드립니다' });
    expect(latestInquiry).toHaveAttribute('href', '/mypage/inquiries/inq-1');
    const history = screen.getByRole('region', { name: '내 문의 내역' });
    const inquiryLinks = within(history)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('/mypage/inquiries/'));
    expect(inquiryLinks.map((link) => link.getAttribute('href'))).toEqual([
      '/mypage/inquiries/inq-1',
      '/mypage/inquiries/inq-2',
    ]);
    expect(within(history).getByText('답변완료')).toBeInTheDocument();
    expect(within(history).queryByText('other-inquiry')).not.toBeInTheDocument();
    expect(listByMember).toHaveBeenCalledWith(
      'mem-001',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('문의 내역 조회 오류에서 다시 시도해 목록을 불러옵니다', async () => {
    const listByMember = vi
      .fn()
      .mockRejectedValueOnce(new Error('sensitive server failure'))
      .mockResolvedValueOnce([inquiries[0]]);
    vi.mocked(getShopApi).mockResolvedValue({
      ...createApi([]),
      inquiries: { listByMember },
    } as unknown as ShopApi);
    mockMemberSession(createMember('mem-001'));
    renderWithQuery(<InquiryPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('문의 내역을 불러오지 못했습니다.');
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('link', { name: '배송 일정 문의드립니다' })).toBeInTheDocument();
    expect(listByMember).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('sensitive server failure')).not.toBeInTheDocument();
  });

  it('문의 내역 조회 결과가 비어 있으면 빈 상태를 표시합니다', async () => {
    vi.mocked(getShopApi).mockResolvedValue({
      ...createApi([]),
      inquiries: { listByMember: vi.fn(async () => []) },
    } as unknown as ShopApi);
    mockMemberSession(createMember('mem-001'));
    renderWithQuery(<InquiryPage />);

    expect(await screen.findByText('등록된 문의가 없습니다.')).toBeInTheDocument();
  });
});
