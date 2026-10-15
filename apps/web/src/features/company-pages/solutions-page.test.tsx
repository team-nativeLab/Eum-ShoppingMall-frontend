import type { CompanyInfo, Member, Product } from '@eum/api/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
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
  it('uses the success selection state and keeps the disabled add action visible', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<SolutionsPageContent />);

    const productsPanel = await screen.findByRole('region', { name: '문의 상품' });
    const addButton = screen.getByRole('button', { name: '상품 추가' });
    expect(productsPanel).toHaveClass('border-line-strong', 'bg-bg');
    expect(addButton).toBeDisabled();
    expect(addButton).toHaveClass('disabled:bg-surface', 'disabled:text-text-3');

    const selectedInterest = screen.getByRole('checkbox', { name: '개인보호장비' });
    expect(selectedInterest).toBeChecked();
    const selectedChip = selectedInterest
      .closest('label')
      ?.querySelector('span:not([aria-hidden="true"])');
    expect(selectedChip).toHaveClass(
      'min-h-44',
      'peer-checked:bg-success-tint',
      'peer-checked:text-success',
    );
    expect(selectedInterest.closest('label')?.querySelector('[aria-hidden="true"]')).toHaveClass(
      'hidden',
      'peer-checked:inline-flex',
    );

    await screen.findByRole('option', { name: '안전모' });
    await user.selectOptions(screen.getByRole('combobox', { name: '상품 선택' }), product.id);
    expect(addButton).toBeEnabled();
    await user.click(addButton);

    const selectedProductRow = screen.getByText('안전모', { selector: 'p' }).closest('li');
    expect(selectedProductRow).toHaveClass('border-success', 'bg-success-tint');
    expect(addButton).toBeDisabled();
  });

  it('견적 폼 정보를 정해진 순서로 보여 주고 전체 수량 도움말을 연결합니다', async () => {
    renderWithQueryClient(<SolutionsPageContent />);
    await screen.findByRole('combobox', { name: '상품 선택' });

    const form = screen.getByRole('region', { name: '견적 문의 입력' });
    const productsHeading = screen.getByRole('heading', { name: '문의 상품' });
    const inquiryTypeLegend = screen.getByText('문의 유형 *');
    const memberPrefillNote = screen.getByText(
      '회원 정보를 입력란에 미리 채울 수 있습니다. 입력 후에도 직접 수정할 수 있습니다.',
    );
    const companyNameInput = screen.getByLabelText('회사명 *');
    const quantityInput = screen.getByRole('spinbutton', { name: '현장 전체 예상 수량' });
    const deliveryDateButton = screen.getByRole('button', {
      name: '희망 납기 날짜를 선택해 주세요',
    });
    const deliveryDateInput = form.querySelector('input[name="deliveryDate"]');
    const deliveryLocationInput = screen.getByLabelText('납품 지역');
    const interestLegend = screen.getByText('관심 품목');
    const detailsLabel = screen.getByText('상세 내용');
    const attachmentGroup = screen.getByRole('group', {
      name: '파일 첨부 영역. 파일 업로드 기능은 준비 중입니다.',
    });
    const privacyCheckbox = screen.getByRole('checkbox', {
      name: '[필수] 개인정보 수집·이용 동의',
    });
    const submitButton = screen.getByRole('button', { name: '견적 문의 접수' });

    const expectBefore = (first: Element, second: Element) => {
      expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    };

    expect(form).toContainElement(productsHeading);
    expect(screen.getByRole('radio', { name: '맞춤 제작' })).toBeChecked();
    expectBefore(productsHeading, inquiryTypeLegend);
    expectBefore(inquiryTypeLegend, memberPrefillNote);
    expectBefore(memberPrefillNote, companyNameInput);
    expectBefore(companyNameInput, quantityInput);
    expectBefore(quantityInput, deliveryDateButton);
    expectBefore(deliveryDateButton, deliveryLocationInput);
    expectBefore(deliveryLocationInput, interestLegend);
    expectBefore(interestLegend, detailsLabel);
    expectBefore(detailsLabel, attachmentGroup);
    expectBefore(attachmentGroup, privacyCheckbox);
    expectBefore(privacyCheckbox, submitButton);
    expect(quantityInput).toHaveAttribute('name', 'quantity');
    expect(quantityInput).toHaveAccessibleDescription(
      '이 문의로 필요한 전체 수량을 입력해 주세요.',
    );
    expect(deliveryDateInput).toHaveAttribute('type', 'date');
    expect(deliveryDateInput).toHaveAttribute('name', 'deliveryDate');
  });

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
    expect(screen.getByRole('radio', { name: '대량 구매' })).toBeChecked();
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

  it('날짜 버튼을 키보드로 열고 날짜 폼 값을 유지하며 취소 후 초기화합니다', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<SolutionsPageContent />);
    await screen.findByRole('combobox', { name: '상품 선택' });

    const form = screen.getByRole('region', { name: '견적 문의 입력' }).querySelector('form');
    expect(form).not.toBeNull();
    const dateInput = form?.querySelector<HTMLInputElement>('input[name="deliveryDate"]');
    expect(dateInput).not.toBeNull();
    if (!dateInput) throw new Error('deliveryDate input was not rendered');

    const dateButton = screen.getByRole('button', {
      name: '희망 납기 날짜를 선택해 주세요',
    });
    expect(dateButton).toHaveAttribute('type', 'button');
    expect(dateButton).toHaveAccessibleName('희망 납기 날짜를 선택해 주세요');

    const showPicker = vi.fn();
    Object.defineProperty(dateInput, 'showPicker', {
      configurable: true,
      value: showPicker,
    });
    dateButton.focus();
    await user.keyboard('{Enter}');
    expect(showPicker).toHaveBeenCalledTimes(1);
    await user.keyboard(' ');
    expect(showPicker).toHaveBeenCalledTimes(2);

    fireEvent.change(dateInput, { target: { value: '2026-11-30' } });
    expect(dateInput).toHaveValue('2026-11-30');
    expect(dateButton).toHaveAccessibleName('희망 납기 2026-11-30');
    expect(dateButton).toHaveTextContent('2026-11-30');
    expect(new FormData(form as HTMLFormElement).get('deliveryDate')).toBe('2026-11-30');

    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(
      screen.getByRole('button', { name: '희망 납기 날짜를 선택해 주세요' }),
    ).toBeInTheDocument();
    expect(form?.querySelector<HTMLInputElement>('input[name="deliveryDate"]')).toHaveValue('');
    expect(new FormData(form as HTMLFormElement).get('deliveryDate')).toBe('');
  });

  it('showPicker를 사용할 수 없으면 네이티브 날짜 입력 click으로 대체합니다', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<SolutionsPageContent />);
    await screen.findByRole('combobox', { name: '상품 선택' });

    const dateInput = screen
      .getByRole('region', { name: '견적 문의 입력' })
      .querySelector<HTMLInputElement>('input[name="deliveryDate"]');
    expect(dateInput).not.toBeNull();
    if (!dateInput) throw new Error('deliveryDate input was not rendered');
    Object.defineProperty(dateInput, 'showPicker', {
      configurable: true,
      value: undefined,
    });
    const click = vi.spyOn(dateInput, 'click');

    await user.click(screen.getByRole('button', { name: '희망 납기 날짜를 선택해 주세요' }));
    expect(click).toHaveBeenCalledOnce();
  });

  it('견적 담당자 이메일을 회사 정보 응답에서 표시합니다', async () => {
    renderWithQueryClient(<SolutionsPageContent />);
    expect(await screen.findByRole('link', { name: 'quote@example.com' })).toHaveAttribute(
      'href',
      'mailto:quote@example.com',
    );
  });
});
