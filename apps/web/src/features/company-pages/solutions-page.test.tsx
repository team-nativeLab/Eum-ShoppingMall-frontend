import type { CompanyInfo, Member, Product } from '@eum/api/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { createEvent, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMemberSession } from '@/features/auth/member-session';
import { getShopApi } from '@/lib/shop-api';
import { buildQuoteInquiryHref } from './quote-inquiry-link';
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
    {
      id: 'packaging',
      label: '포장',
      required: false,
      choices: [{ id: 'standard', label: '기본 포장', priceDelta: 0 }],
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

const secondProduct: Product = {
  ...product,
  id: 'p-gloves',
  name: '장갑',
  options: [
    {
      id: 'size',
      label: '사이즈',
      required: true,
      choices: [{ id: 'large', label: '대형', priceDelta: 0 }],
    },
  ],
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
    const selectedInterestLabel = selectedInterest.closest('label');
    expect(selectedInterestLabel).toHaveClass('inline-flex', 'min-h-44', 'items-center');
    expect(selectedInterestLabel?.parentElement).toHaveClass('pt-[3px]');
    const selectedChip = selectedInterestLabel?.querySelector('span:not([aria-hidden="true"])');
    expect(selectedChip).toHaveClass(
      'h-36',
      'peer-checked:bg-success-tint',
      'peer-checked:text-success',
    );
    expect(selectedInterestLabel?.querySelector('[aria-hidden="true"] svg')).toHaveAttribute(
      'width',
      '12',
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

    const requiredOption = screen.getByRole('combobox', { name: '안전모 색상' });
    const optionalOption = screen.getByRole('combobox', { name: '안전모 포장' });
    expect(requiredOption).toBeRequired();
    expect(requiredOption.closest('label')?.querySelector('[aria-hidden="true"]')).toHaveClass(
      'ml-4',
      'text-danger',
    );
    expect(optionalOption).not.toBeRequired();
    expect(optionalOption.closest('label')?.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('견적 폼 정보를 정해진 순서로 보여 주고 전체 수량 도움말을 연결합니다', async () => {
    renderWithQueryClient(<SolutionsPageContent />);
    await screen.findByRole('combobox', { name: '상품 선택' });

    const form = screen.getByRole('region', { name: '견적 문의 입력' });
    const productsHeading = screen.getByRole('heading', { name: '문의 상품' });
    const inquiryTypeLegend = screen.getByText('문의 유형', { selector: 'legend' });
    const memberPrefillNote = screen.getByText(
      '회원 정보를 입력란에 미리 채울 수 있습니다. 입력 후에도 직접 수정할 수 있습니다.',
    );
    const companyNameInput = screen.getByRole('textbox', { name: '회사명' });
    const quantityInput = screen.getByRole('spinbutton', { name: '현장 전체 예상 수량' });
    const deliveryDateButton = screen.getByRole('button', {
      name: '희망 납기 날짜를 선택해 주세요',
    });
    const deliveryDateInput = form.querySelector('input[name="deliveryDate"]');
    const deliveryLocationInput = screen.getByLabelText('납품 지역');
    const interestLegend = screen.getByText('관심 품목');
    const detailsLabel = screen.getByText('상세 내용');
    const attachmentGroup = screen.getByRole('group', { name: '견적 파일 첨부' });
    const privacyCheckbox = screen.getByRole('checkbox', {
      name: '[필수] 개인정보 수집·이용 동의',
    });
    const submitButton = screen.getByRole('button', { name: '견적 문의 접수' });

    const expectBefore = (first: Element, second: Element) => {
      expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    };

    expect(form).toContainElement(productsHeading);
    const inquiryTypeGroup = screen.getByRole('group', { name: '문의 유형' });
    expect(inquiryTypeGroup).toContainElement(inquiryTypeLegend);
    expect(inquiryTypeLegend.querySelector('[aria-hidden="true"]')).toHaveClass(
      'ml-4',
      'text-danger',
    );
    const inquiryTypeRadios = screen.getAllByRole('radio');
    expect(inquiryTypeRadios).toHaveLength(4);
    expect(inquiryTypeRadios.every((radio) => radio.hasAttribute('required'))).toBe(true);
    expect(screen.getByRole('radio', { name: '맞춤 제작' })).toBeChecked();
    for (const label of ['회사명', '담당자명', '연락처', '이메일']) {
      const requiredInput = screen.getByRole('textbox', { name: label });
      expect(requiredInput).toBeRequired();
      expect(
        requiredInput.closest('div')?.querySelector('label span[aria-hidden="true"]'),
      ).toHaveClass('ml-4', 'text-danger');
    }
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
    const user = userEvent.setup();
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
    const attachmentInput = screen.getByLabelText('첨부할 파일 선택');
    await user.upload(attachmentInput, new File(['drawing'], 'drawing-plan.pdf'));
    fireEvent.click(screen.getByRole('radio', { name: '대량 구매' }));
    expect(screen.getByRole('radio', { name: '대량 구매' })).toBeChecked();
    fireEvent.change(screen.getByRole('textbox', { name: '회사명' }), {
      target: { value: '테스트 회사' },
    });
    fireEvent.click(screen.getByRole('button', { name: '회원 정보로 미리 채우기' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '[필수] 개인정보 수집·이용 동의' }));
    fireEvent.submit(
      screen.getByRole('button', { name: '견적 문의 접수' }).closest('form') as HTMLFormElement,
    );

    expect(
      await screen.findByRole('heading', { name: '견적 문의가 접수되었습니다' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/입력값은 서버로 전송되거나 저장되지 않았습니다/)).toBeInTheDocument();
    expect(
      screen.getByText('선택한 파일은 현재 화면에만 표시되며 문의와 함께 전송되지 않았습니다.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('drawing-plan.pdf')).not.toBeInTheDocument();
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

  it('URL의 유효한 상품 선택 줄과 옵션·수량을 복원하고 잘못된 값은 기본화합니다', async () => {
    navigationMock.search =
      'productId=p-quote&optionId=color%3Awhite&quantity=4&productId=p-quote&optionId=color%3Amissing&quantity=0&productId=missing&optionId=color%3Awhite&quantity=10';
    renderWithQueryClient(<SolutionsPageContent />);

    const quantities = await screen.findAllByRole('spinbutton', { name: /안전모 선택 \d 수량/ });
    expect(quantities).toHaveLength(2);
    expect(quantities[0]).toHaveValue(4);
    expect(quantities[1]).toHaveValue(1);
    const colors = screen.getAllByRole('combobox', { name: /안전모 선택 \d 색상/ });
    expect(colors[0]).toHaveValue('white');
    expect(colors[1]).toHaveValue('');
    expect(screen.getByRole('button', { name: '안전모 선택 1 삭제' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '안전모 선택 2 삭제' })).toBeInTheDocument();

    fireEvent.change(quantities[1]!, { target: { value: '8' } });
    expect(quantities[0]).toHaveValue(4);
    expect(quantities[1]).toHaveValue(8);
    fireEvent.click(screen.getByRole('button', { name: '안전모 선택 1 삭제' }));
    expect(screen.getAllByRole('spinbutton', { name: '안전모 수량' })).toHaveLength(1);
    expect(screen.getByRole('spinbutton', { name: '안전모 수량' })).toHaveValue(8);
  });

  it('항목 단위 파라미터 정합성을 유지해 뒤 상품에 옵션·수량을 복원합니다', async () => {
    const quoteHref = buildQuoteInquiryHref([
      { productId: 'p-quote' },
      { productId: 'p-gloves', optionId: 'size:large', quantity: 6 },
    ]);
    navigationMock.search = quoteHref.split('?')[1] ?? '';
    vi.mocked(getShopApi).mockResolvedValue({
      products: {
        list: async () => ({
          items: [product, secondProduct],
          page: 1,
          pageSize: 100,
          totalCount: 2,
        }),
      },
      company: { getInfo: async () => companyInfo },
    } as never);
    renderWithQueryClient(<SolutionsPageContent />);

    expect(await screen.findByRole('spinbutton', { name: '안전모 수량' })).toHaveValue(1);
    expect(screen.getByRole('combobox', { name: '안전모 색상' })).toHaveValue('');
    expect(screen.getByRole('spinbutton', { name: '장갑 수량' })).toHaveValue(6);
    expect(screen.getByRole('combobox', { name: '장갑 사이즈' })).toHaveValue('large');
  });

  it('동일 상품이 다른 상품 사이에 있어도 삭제 버튼 번호는 상품별로 매깁니다', async () => {
    navigationMock.search =
      'productId=p-quote&optionId=color%3Awhite&quantity=4&productId=p-gloves&optionId=size%3Alarge&quantity=6&productId=p-quote&optionId=color%3Awhite&quantity=2';
    vi.mocked(getShopApi).mockResolvedValue({
      products: {
        list: async () => ({
          items: [product, secondProduct],
          page: 1,
          pageSize: 100,
          totalCount: 2,
        }),
      },
      company: { getInfo: async () => companyInfo },
    } as never);
    renderWithQueryClient(<SolutionsPageContent />);

    expect(await screen.findByRole('button', { name: '안전모 선택 1 삭제' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '장갑 삭제' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '안전모 선택 2 삭제' })).toBeInTheDocument();
  });

  it('첨부 선택 버튼은 키보드로 열 수 있고 같은 이름의 여러 파일을 개별 제거합니다', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<SolutionsPageContent />);

    const chooseButton = screen.getByRole('button', { name: '파일 선택' });
    const input = screen.getByLabelText('첨부할 파일 선택') as HTMLInputElement;
    const openFilePicker = vi.spyOn(input, 'click');
    expect(input).toHaveAttribute('multiple');
    expect(input).not.toHaveAttribute('required');
    expect(input).not.toHaveAttribute('accept');

    chooseButton.focus();
    await user.keyboard('{Enter}');
    expect(openFilePicker).toHaveBeenCalledOnce();
    await user.keyboard(' ');
    expect(openFilePicker).toHaveBeenCalledTimes(2);
    await user.tab();
    expect(screen.getByRole('checkbox', { name: '[필수] 개인정보 수집·이용 동의' })).toHaveFocus();
    expect(input).toHaveAttribute('tabindex', '-1');

    await user.upload(input, [
      new File(['first'], 'drawing-plan.pdf'),
      new File(['second'], 'drawing-plan.pdf'),
    ]);
    expect(input).toHaveValue('');
    const fileList = screen.getByRole('list', { name: '선택한 파일' });
    expect(within(fileList).getAllByText('drawing-plan.pdf')).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent(
      '선택한 파일 2개가 화면에만 표시됩니다. 파일은 문의와 함께 전송되지 않습니다.',
    );

    fireEvent.click(screen.getByRole('button', { name: 'drawing-plan.pdf 항목 1 제거' }));
    expect(within(fileList).getAllByText('drawing-plan.pdf')).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: 'drawing-plan.pdf 항목 1 제거' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('drawing-plan.pdf 파일을 제거했습니다.');
  });

  it('드롭으로 여러 파일을 추가하고 같은 파일도 다시 선택할 수 있습니다', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<SolutionsPageContent />);
    const dropArea = screen.getByRole('group', { name: '견적 파일 첨부' });
    const input = screen.getByLabelText('첨부할 파일 선택');
    const firstFile = new File(['first'], 'first.txt');
    const secondFile = new File(['second'], 'second.txt');

    fireEvent.dragOver(dropArea, { dataTransfer: { files: [firstFile, secondFile] } });
    expect(dropArea).toHaveClass('border-text-1', 'bg-surface');
    const chooseButton = screen.getByRole('button', { name: '파일 선택' });
    const description = screen.getByText(
      '선택한 파일은 현재 화면에만 표시되며 문의와 함께 전송되지 않습니다.',
    );
    const dragLeaveWithinArea = createEvent.dragLeave(chooseButton);
    Object.defineProperty(dragLeaveWithinArea, 'relatedTarget', { value: description });
    fireEvent(chooseButton, dragLeaveWithinArea);
    expect(dropArea).toHaveClass('border-text-1', 'bg-surface');
    const dragLeaveOutsideArea = createEvent.dragLeave(dropArea);
    Object.defineProperty(dragLeaveOutsideArea, 'relatedTarget', { value: document.body });
    fireEvent(dropArea, dragLeaveOutsideArea);
    expect(dropArea).not.toHaveClass('border-text-1', 'bg-surface');

    fireEvent.drop(dropArea, { dataTransfer: { files: [firstFile, secondFile] } });
    const fileList = screen.getByRole('list', { name: '선택한 파일' });
    expect(within(fileList).getByText('first.txt')).toBeInTheDocument();
    expect(within(fileList).getByText('second.txt')).toBeInTheDocument();

    const repeatFile = new File(['same'], 'repeat.txt');
    await user.upload(input, repeatFile);
    expect(input).toHaveValue('');
    await user.upload(input, repeatFile);
    expect(within(fileList).getAllByText('repeat.txt')).toHaveLength(2);
  });

  it('파일을 제거하면 다음 또는 이전 제거 버튼으로 포커스를 옮기고 목록이 비면 선택 버튼으로 이동합니다', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<SolutionsPageContent />);
    const input = screen.getByLabelText('첨부할 파일 선택');
    await user.upload(input, [
      new File(['first'], 'first.txt'),
      new File(['second'], 'second.txt'),
      new File(['third'], 'third.txt'),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'second.txt 항목 2 제거' }));
    expect(screen.getByRole('button', { name: 'third.txt 항목 2 제거' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'third.txt 항목 2 제거' }));
    expect(screen.getByRole('button', { name: 'first.txt 항목 1 제거' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'first.txt 항목 1 제거' }));
    expect(screen.getByRole('button', { name: '파일 선택' })).toHaveFocus();
  });

  it('취소하면 첨부 파일 목록을 초기화하고 긴 파일명은 줄바꿈합니다', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<SolutionsPageContent />);
    const input = screen.getByLabelText('첨부할 파일 선택') as HTMLInputElement;
    const longName = `${'very-long-filename-'.repeat(8)}blueprint.pdf`;
    await user.upload(input, new File(['blueprint'], longName));

    const fileName = screen.getByText(longName);
    expect(fileName).toHaveClass('min-w-0', 'break-all');
    expect(input).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.queryByRole('list', { name: '선택한 파일' })).not.toBeInTheDocument();
    expect(input).toHaveValue('');
    expect(screen.getByRole('status')).toHaveTextContent('선택한 파일 목록을 초기화했습니다.');
  });

  it('선택 상품이 없을 때 빈 선택 영역을 숨기고 수동 추가 선택기는 유지합니다', async () => {
    renderWithQueryClient(<SolutionsPageContent />);
    expect(await screen.findByRole('combobox', { name: '상품 선택' })).toBeInTheDocument();
    expect(screen.queryByText('선택한 상품이 여기에 표시됩니다.')).not.toBeInTheDocument();
  });

  it('문의 유형 라디오는 조밀한 반응형 행에서 라벨·키보드로 선택할 수 있습니다', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<SolutionsPageContent />);
    await screen.findByRole('combobox', { name: '상품 선택' });

    const inquiryTypeGroup = screen.getByRole('group', { name: '문의 유형' });
    const choiceRow = inquiryTypeGroup.querySelector('div.flex.flex-wrap');
    const customRadio = screen.getByRole('radio', { name: '맞춤 제작' });
    const bulkRadio = screen.getByRole('radio', { name: '대량 구매' });
    const regularSupplyRadio = screen.getByRole('radio', { name: '정기 납품' });

    expect(choiceRow).toHaveClass('gap-x-16', 'gap-y-8');
    expect(choiceRow).toHaveClass('flex-wrap');
    expect(customRadio.closest('label')).toHaveClass('min-h-44');
    expect(customRadio).toHaveClass('peer', 'sr-only');
    const radioVisual = customRadio.closest('label')?.querySelector('span[aria-hidden="true"]');
    expect(radioVisual).toHaveClass('size-20', 'peer-focus-visible:outline-2');
    expect(radioVisual?.querySelector('span')).toHaveClass('size-10');

    customRadio.focus();
    await user.keyboard('{ArrowRight}');
    expect(bulkRadio).toBeChecked();

    await user.click(screen.getByText('정기 납품'));
    expect(regularSupplyRadio).toBeChecked();
  });

  it('direct entry starts empty and an incoming product ID preselects its product', async () => {
    const directEntry = renderWithQueryClient(<SolutionsPageContent />);
    expect(await screen.findByRole('combobox', { name: '상품 선택' })).toBeInTheDocument();
    expect(screen.queryByText('선택한 상품이 여기에 표시됩니다.')).not.toBeInTheDocument();
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
