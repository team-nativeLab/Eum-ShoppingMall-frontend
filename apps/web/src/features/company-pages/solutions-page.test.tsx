import type { CompanyInfo, Member, Product } from '@eum/api/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMemberSession } from '@/features/auth/member-session';
import { getShopApi } from '@/lib/shop-api';
import { SolutionsPageContent } from './solutions-page';

vi.mock('@/lib/shop-api', () => ({ getShopApi: vi.fn() }));
vi.mock('@/features/auth/member-session', () => ({ useMemberSession: vi.fn() }));
const navigationMock = vi.hoisted(() => ({ search: '' }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(navigationMock.search),
}));

const product: Product = {
  id: 'p-quote',
  name: '안전모',
  brand: '이음',
  categoryId: 'cat-safety',
  price: 12000,
  listPrice: null,
  priceVisible: true,
  stockStatus: 'inStock',
  thumbnailUrl: null,
  summary: '',
  modelName: null,
  images: [],
  options: [
    {
      id: 'color',
      label: '색상',
      required: true,
      choices: [{ id: 'white', label: '흰색', priceDelta: 0 }],
    },
  ],
  specifications: [],
  certifications: [],
  shipping: {
    method: '일반 배송',
    estimate: '2~3일',
    fee: 0,
    countryOfOrigin: '대한민국',
    policy: '',
  },
  purchaseNotices: [],
  rating: null,
  reviewCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  isFeatured: false,
};

const member: Member = {
  id: 'mem-001',
  email: 'member@example.com',
  name: '목 회원',
  phone: '010-0000-0000',
  joinedAt: '2026-01-01T00:00:00.000Z',
  pointBalance: 0,
};

const companyInfo: CompanyInfo = {
  companyName: '이음산업건설',
  representative: '',
  businessRegistrationNumber: '',
  mailOrderSalesNumber: '',
  address: '',
  email: 'info@example.com',
  quoteEmail: 'quote@example.com',
  privacyOfficer: '',
  customerCenterPhone: '0000-0000',
  customerCenterTel: null,
  customerCenterHours: '평일 운영',
};

function renderWithQueryClient(element: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

beforeEach(() => {
  navigationMock.search = '';
  vi.mocked(useMemberSession).mockReturnValue({
    member,
    status: 'ready',
    refreshMember: async () => member,
    setMember: vi.fn(),
    clearMember: vi.fn(async () => undefined),
  });
  vi.mocked(getShopApi).mockResolvedValue({
    products: {
      list: async () => ({ items: [product], page: 1, pageSize: 100, totalCount: 1 }),
    },
    company: { getInfo: async () => companyInfo },
  } as never);
});

describe('quote request preview', () => {
  it('상품·옵션·수량을 선택하고 접수 후 입력 내용을 저장하지 않는 완료 미리보기를 표시합니다', async () => {
    renderWithQueryClient(<SolutionsPageContent />);
    const productSelect = await screen.findByRole('combobox', { name: '상품 선택' });
    await screen.findByRole('option', { name: '안전모' });
    fireEvent.change(productSelect, { target: { value: product.id } });
    fireEvent.click(screen.getByRole('button', { name: '상품 추가' }));
    expect(await screen.findAllByText('안전모')).toHaveLength(2);
    fireEvent.change(screen.getByRole('combobox', { name: '안전모 색상' }), {
      target: { value: 'white' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: '안전모 수량' }), {
      target: { value: '12' },
    });
    fireEvent.click(screen.getByRole('radio', { name: '대량 구매' }));
    fireEvent.change(screen.getByLabelText('회사명 *'), { target: { value: '테스트 회사' } });
    fireEvent.click(screen.getByRole('button', { name: '회원 정보로 미리 채우기' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '[필수] 개인정보 수집·이용 동의' }));
    fireEvent.submit(
      screen.getByRole('button', { name: '견적 문의 접수' }).closest('form') as HTMLFormElement,
    );

    expect(
      await screen.findByRole('heading', { name: '견적 문의가 접수되었습니다' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/입력값은 서버로 전송되거나 저장되지 않았습니다/)).toBeInTheDocument();
    expect(screen.getByText('대량 구매')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '문의 진행 상태' })).toBeInTheDocument();
    expect(screen.getByText(/^PREVIEW-/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '문의 내역 보기' })).toHaveAttribute(
      'href',
      '/mypage/quotes',
    );
    expect(screen.queryByText('회사명', { selector: 'dt' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '쇼핑 계속하기' })).toHaveAttribute('href', '/');
  });

  it('direct entry starts empty and an incoming product ID preselects its product', async () => {
    const directEntry = renderWithQueryClient(<SolutionsPageContent />);
    expect(await screen.findByText('선택한 상품이 여기에 표시됩니다.')).toBeInTheDocument();
    directEntry.unmount();

    navigationMock.search = 'productId=p-quote';
    renderWithQueryClient(<SolutionsPageContent />);
    expect(await screen.findByRole('spinbutton', { name: '안전모 수량' })).toHaveValue(1);
  });

  it('견적 담당자 이메일을 회사 정보 응답에서 표시합니다', async () => {
    renderWithQueryClient(<SolutionsPageContent />);
    expect(await screen.findByRole('link', { name: 'quote@example.com' })).toHaveAttribute(
      'href',
      'mailto:quote@example.com',
    );
  });
});
