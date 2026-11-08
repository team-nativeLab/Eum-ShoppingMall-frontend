import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminBrand, AdminProduct, Category } from '@eum/api/types';
import { AdminPriceVisibilityPreviewProvider } from '@/lib/admin-price-visibility-preview';
import { AdminProductFormPage } from './AdminProductFormPage';

const shopMocks = vi.hoisted(() => ({ getShopApi: vi.fn() }));
vi.mock('@/lib/shop-api', () => ({ getShopApi: shopMocks.getShopApi }));

const categoriesFixture: Category[] = [
  {
    id: 'safety',
    slug: 'safety',
    name: '안전용품',
    parentId: null,
    description: null,
    iconKey: null,
  },
  {
    id: 'helmet',
    slug: 'helmet',
    name: '안전모',
    parentId: 'safety',
    description: null,
    iconKey: null,
  },
];

const brandFixture: AdminBrand = {
  id: 'brand-one',
  name: '한결안전',
  englishName: 'HANGYEOL',
  logoUrl: null,
  tagline: null,
  productCount: 0,
  coverImageUrl: null,
  mainField: null,
  originCountry: null,
  certification: null,
  story: null,
  isVisible: true,
  isFeatured: false,
};

function createProductFixture(
  detailDescription: string,
  detailDescriptionFormat?: AdminProduct['detailDescriptionFormat'],
): AdminProduct {
  return {
    id: 'product-edit',
    name: '기존 안전모',
    brand: brandFixture.name,
    categoryId: 'helmet',
    price: 12000,
    listPrice: null,
    priceVisible: true,
    stockStatus: 'inStock',
    stockCount: 4,
    thumbnailUrl: null,
    summary: '기존 짧은 설명',
    detailDescription,
    ...(detailDescriptionFormat ? { detailDescriptionFormat } : {}),
    modelName: null,
    images: [],
    options: [],
    specifications: [],
    certifications: [],
    shipping: { method: '', estimate: '', fee: 0, countryOfOrigin: '', policy: '' },
    purchaseNotices: [],
    rating: null,
    reviewCount: 0,
    createdAt: '2026-10-19T00:00:00.000Z',
    isFeatured: false,
    autoSoldOut: true,
  };
}

function renderProductForm(
  path = '/products/new',
  initialEntries = [path],
  initialIndex = initialEntries.length - 1,
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/products', element: <h1>상품 목록</h1> },
      { path: '/products/new', element: <AdminProductFormPage /> },
      { path: '/products/:productId', element: <AdminProductFormPage /> },
      { path: '*', element: <h1>다른 페이지</h1> },
    ],
    { initialEntries, initialIndex },
  );
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <AdminPriceVisibilityPreviewProvider>
        <RouterProvider router={router} />
      </AdminPriceVisibilityPreviewProvider>
    </QueryClientProvider>,
  );
  return { ...rendered, router };
}

describe('Admin 상품 등록·수정 폼', () => {
  let products: AdminProduct[];
  let saveAdmin: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    products = [];
    saveAdmin = vi.fn(async (input) => {
      const savedProduct = {
        ...input,
        id: input.id ?? 'product-created',
        createdAt: '2026-10-19T00:00:00.000Z',
        rating: null,
        reviewCount: 0,
      } as AdminProduct;
      products = [savedProduct];
      return savedProduct;
    });
    shopMocks.getShopApi.mockResolvedValue({
      categories: { adminList: vi.fn(async () => structuredClone(categoriesFixture)) },
      brands: { adminList: vi.fn(async () => [structuredClone(brandFixture)]) },
      products: { adminList: vi.fn(async () => structuredClone(products)), saveAdmin },
    });
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('브랜드 API를 선택지로 사용하고 summary와 상세 설명을 분리해 목 API에 저장한다', async () => {
    const user = userEvent.setup();
    renderProductForm();

    await user.type(await screen.findByRole('textbox', { name: '상품명' }), '안전모');
    await user.selectOptions(screen.getByLabelText('브랜드'), '한결안전');
    await user.selectOptions(screen.getByLabelText('1차 카테고리'), 'safety');
    await user.selectOptions(screen.getByLabelText('2차 카테고리'), 'helmet');
    await user.type(screen.getByLabelText('판매가'), '12000');
    await user.type(screen.getByLabelText('짧은 설명'), '가벼운 안전모');
    const detailInput = screen.getByLabelText('상세 설명');
    if (!(detailInput instanceof HTMLTextAreaElement)) {
      throw new Error('상세 설명 입력란을 찾지 못했습니다.');
    }
    await user.type(detailInput, '제품 상세 사양입니다.');
    detailInput.setSelectionRange(0, detailInput.value.length);
    fireEvent.select(detailInput);
    await user.click(screen.getByRole('button', { name: '굵게' }));
    await user.click(screen.getByLabelText('재고 0 옵션은 품절, 모든 옵션 품절 시 상품 전체 품절'));
    await user.click(screen.getByRole('radio', { name: '품절' }));
    await user.clear(screen.getByLabelText('상품 코드'));
    await user.type(screen.getByLabelText('상품 코드'), 'CUSTOM-100');
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => expect(saveAdmin).toHaveBeenCalledOnce());
    expect(saveAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        brand: '한결안전',
        categoryId: 'helmet',
        summary: '가벼운 안전모',
        detailDescription: '**제품 상세 사양입니다.**',
        detailDescriptionFormat: 'rich-v1',
        stockStatus: 'soldOut',
        salesStatus: 'active',
        autoSoldOut: false,
        productCode: 'CUSTOM-100',
      }),
    );
  });

  it('수정 폼에서 rich-v1 서식을 표시하고 메타데이터를 보존한다', async () => {
    const user = userEvent.setup();
    products = [createProductFixture('**기존 서식**', 'rich-v1')];
    renderProductForm('/products/product-edit');

    const detailInput = await screen.findByLabelText('상세 설명');
    expect(detailInput).toHaveValue('**기존 서식**');
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => expect(saveAdmin).toHaveBeenCalledOnce());
    expect(saveAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        detailDescription: '**기존 서식**',
        detailDescriptionFormat: 'rich-v1',
      }),
    );
  });

  it('변경 후 취소 링크를 막고 계속 작성 또는 이탈 확인을 제공한다', async () => {
    const user = userEvent.setup();
    renderProductForm();

    const nameInput = await screen.findByRole('textbox', { name: '상품명' });
    await user.type(nameInput, '새 상품');
    await user.click(screen.getByRole('link', { name: '취소' }));

    const exitDialog = await screen.findByRole('dialog', {
      name: '작성 중인 내용을 버리고 나갈까요?',
    });
    expect(
      within(exitDialog).getByText('저장하지 않고 나가면 상품 등록 화면을 닫습니다.'),
    ).toBeInTheDocument();
    await user.click(within(exitDialog).getByRole('button', { name: '계속 작성' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(nameInput).toHaveValue('새 상품');

    await user.click(screen.getByRole('link', { name: '취소' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '나가기' }),
    );
    expect(await screen.findByRole('heading', { name: '상품 목록' })).toBeInTheDocument();
  });

  it('뒤로 가기와 새로고침 이탈을 막고 저장 성공 후에는 경고하지 않는다', async () => {
    const user = userEvent.setup();
    products = [createProductFixture('기존 설명')];
    const { router } = renderProductForm(
      '/products/product-edit',
      ['/products', '/products/product-edit'],
      1,
    );

    const nameInput = await screen.findByRole('textbox', { name: '상품명' });
    await user.clear(nameInput);
    await user.type(nameInput, '저장할 이름');
    const unloadEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unloadEvent);
    expect(unloadEvent.defaultPrevented).toBe(true);

    router.navigate(-1);
    const exitDialog = await screen.findByRole('dialog', {
      name: '작성 중인 내용을 버리고 나갈까요?',
    });
    await user.click(within(exitDialog).getByRole('button', { name: '계속 작성' }));
    expect(router.state.location.pathname).toBe('/products/product-edit');

    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(saveAdmin).toHaveBeenCalledOnce());
    const savedUnloadEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(savedUnloadEvent);
    expect(savedUnloadEvent.defaultPrevented).toBe(false);

    router.navigate('/products');
    expect(await screen.findByRole('heading', { name: '상품 목록' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('저장 실패 시 작성 중 이탈 경고를 유지한다', async () => {
    const user = userEvent.setup();
    products = [createProductFixture('기존 설명')];
    saveAdmin.mockRejectedValueOnce(new Error('저장 실패'));
    renderProductForm('/products/product-edit');

    const nameInput = await screen.findByRole('textbox', { name: '상품명' });
    await user.clear(nameInput);
    await user.type(nameInput, '저장 실패 상품');
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByRole('status')).toHaveTextContent('저장 실패');

    await user.click(screen.getByRole('link', { name: '취소' }));
    expect(
      await screen.findByRole('dialog', { name: '작성 중인 내용을 버리고 나갈까요?' }),
    ).toBeInTheDocument();
  });

  it('수정 폼에서 다른 필드를 저장해도 종료된 판매 상태를 보존한다', async () => {
    const user = userEvent.setup();
    products = [{ ...createProductFixture('상세 설명'), salesStatus: 'ended' }];
    renderProductForm('/products/product-edit');

    const nameInput = await screen.findByRole('textbox', { name: '상품명' });
    await user.clear(nameInput);
    await user.type(nameInput, '수정된 안전모');
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => expect(saveAdmin).toHaveBeenCalledOnce());
    expect(saveAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ name: '수정된 안전모', salesStatus: 'ended' }),
    );
  });

  it('신규 상품의 배송 예정과 배송비를 저장한다', async () => {
    const user = userEvent.setup();
    renderProductForm();

    await user.type(await screen.findByRole('textbox', { name: '상품명' }), '새 안전모');
    await user.selectOptions(screen.getByLabelText('브랜드'), '한결안전');
    await user.selectOptions(screen.getByLabelText('1차 카테고리'), 'safety');
    await user.selectOptions(screen.getByLabelText('2차 카테고리'), 'helmet');
    await user.type(screen.getByLabelText('판매가'), '12000');
    await user.type(screen.getByLabelText('배송 예정'), '2~3일');
    await user.clear(screen.getByLabelText('배송비'));
    await user.type(screen.getByLabelText('배송비'), '3000');
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => expect(saveAdmin).toHaveBeenCalledOnce());
    expect(saveAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        shipping: expect.objectContaining({ estimate: '2~3일', fee: 3000 }),
      }),
    );
  });

  it('수정 폼의 배송 예정을 표시하고 변경한 배송 예정을 저장한다', async () => {
    const user = userEvent.setup();
    products = [
      {
        ...createProductFixture('상세 설명'),
        shipping: {
          method: '택배',
          estimate: '기존 배송 일정',
          fee: 2500,
          countryOfOrigin: '',
          policy: '',
        },
      },
    ];
    renderProductForm('/products/product-edit');

    const estimateInput = await screen.findByLabelText('배송 예정');
    expect(estimateInput).toHaveValue('기존 배송 일정');
    await user.clear(estimateInput);
    await user.type(estimateInput, '3~5일');
    await user.clear(screen.getByLabelText('배송비'));
    await user.type(screen.getByLabelText('배송비'), '4000');
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => expect(saveAdmin).toHaveBeenCalledOnce());
    expect(saveAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        shipping: expect.objectContaining({ estimate: '3~5일', fee: 4000 }),
      }),
    );
  });

  it('서식 메타데이터가 없는 기존 설명은 평문으로 유지한다', async () => {
    const user = userEvent.setup();
    const legacyDescription = '<!--eum-rich-text:v1-->\n*강조처럼 보이는 텍스트*';
    products = [createProductFixture(legacyDescription)];
    renderProductForm('/products/product-edit');

    expect(await screen.findByLabelText('상세 설명')).toHaveValue(legacyDescription);
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => expect(saveAdmin).toHaveBeenCalledOnce());
    expect(saveAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        detailDescription: legacyDescription,
        detailDescriptionFormat: 'plain',
      }),
    );
  });

  it('JPG·PNG 외 형식과 10MB 초과 파일을 거부한다', async () => {
    renderProductForm();
    const imageInput = await screen.findByLabelText('이미지 슬롯 1 파일 선택');
    const unsupportedImage = new File(['gif'], 'unsafe.gif', { type: 'image/gif' });

    fireEvent.change(imageInput, { target: { files: [unsupportedImage] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('JPG 또는 PNG');

    const oversizedImage = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png', {
      type: 'image/png',
    });
    fireEvent.change(imageInput, { target: { files: [oversizedImage] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('10MB 이하');
    const sectionLink = screen.getByRole('link', { name: '카테고리' });
    expect(sectionLink).toHaveAttribute('href', '#category-info');
    expect(screen.getByRole('navigation', { name: '상품 정보 섹션' })).toBeInTheDocument();
  });

  it('11번째 이미지가 포함된 선택을 거부하고 기존 선택 이미지는 유지한다', async () => {
    renderProductForm();
    const imageInput = await screen.findByLabelText('이미지 슬롯 1 파일 선택');
    const files = Array.from(
      { length: 11 },
      (_, index) => new File([`image-${index}`], `image-${index}.png`, { type: 'image/png' }),
    );

    fireEvent.change(imageInput, { target: { files: files.slice(0, 9) } });
    await waitFor(() =>
      expect(screen.getByRole('group', { name: '상품 이미지 9' })).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText('이미지 슬롯 1 파일 선택'), {
      target: { files: files.slice(9) },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('최대 10장');
    expect(screen.getAllByRole('group', { name: /^상품 이미지/ })).toHaveLength(9);
  });

  it('이미지 10장은 정상 등록한다', async () => {
    renderProductForm();
    const imageInput = await screen.findByLabelText('이미지 슬롯 1 파일 선택');
    const files = Array.from(
      { length: 10 },
      (_, index) => new File([`image-${index}`], `image-${index}.png`, { type: 'image/png' }),
    );

    fireEvent.change(imageInput, { target: { files } });

    await waitFor(() =>
      expect(screen.getByRole('group', { name: '상품 이미지 10' })).toBeInTheDocument(),
    );
    expect(screen.getAllByRole('group', { name: /^상품 이미지/ })).toHaveLength(10);
    expect(screen.getByText('10/10')).toBeInTheDocument();
  });

  it('같은 파일을 다시 선택하면 중복으로 안내하고 한 장만 유지한다', async () => {
    renderProductForm();
    const imageInput = await screen.findByLabelText('이미지 슬롯 1 파일 선택');
    const image = new File(['same-image'], 'same.png', { type: 'image/png' });

    fireEvent.change(imageInput, { target: { files: [image] } });
    await waitFor(() =>
      expect(screen.getByRole('group', { name: '상품 이미지 1' })).toBeInTheDocument(),
    );
    fireEvent.change(imageInput, { target: { files: [image] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('중복 이미지를 제외');
    expect(screen.getAllByRole('group', { name: /^상품 이미지/ })).toHaveLength(1);
  });

  it('키보드 버튼으로 이미지를 이동하고 대표 이미지를 첫 번째로 지정한다', async () => {
    const user = userEvent.setup();
    renderProductForm();
    const imageInput = await screen.findByLabelText('이미지 슬롯 1 파일 선택');
    const firstImage = new File(['first'], 'first.png', { type: 'image/png' });
    const secondImage = new File(['second'], 'second.png', { type: 'image/png' });
    fireEvent.change(imageInput, { target: { files: [firstImage, secondImage] } });

    await waitFor(() =>
      expect(screen.getByRole('group', { name: '상품 이미지 2' })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: '이미지 2 위로 이동' }));

    expect(
      within(screen.getByRole('group', { name: '상품 이미지 1' })).getByRole('img'),
    ).toHaveAttribute('alt', 'second');
    await user.click(screen.getByRole('button', { name: '이미지 2을 대표 이미지로 설정' }));

    expect(
      within(screen.getByRole('group', { name: '상품 이미지 1' })).getByRole('img'),
    ).toHaveAttribute('alt', 'first');
  });
});
