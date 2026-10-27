import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category } from '@eum/api/types';
import { AdminCategoriesPage } from './AdminCategoriesPage';

const shopMocks = vi.hoisted(() => ({ getShopApi: vi.fn() }));
vi.mock('@/lib/shop-api', () => ({ getShopApi: shopMocks.getShopApi }));

const categoryFixtures: Category[] = [
  {
    id: 'root-a',
    slug: 'root-a',
    name: '첫 번째 상위',
    parentId: null,
    description: null,
    iconKey: null,
    sortOrder: 0,
    filterAttributes: [],
  },
  {
    id: 'root-b',
    slug: 'root-b',
    name: '두 번째 상위',
    parentId: null,
    description: null,
    iconKey: null,
    sortOrder: 1,
    filterAttributes: [],
  },
  {
    id: 'child-a1',
    slug: 'child-a1',
    name: '첫 번째 하위',
    parentId: 'root-a',
    description: null,
    iconKey: null,
    sortOrder: 10,
    filterAttributes: [],
  },
  {
    id: 'child-a2',
    slug: 'child-a2',
    name: '두 번째 하위',
    parentId: 'root-a',
    description: null,
    iconKey: null,
    sortOrder: 20,
    filterAttributes: [],
  },
  {
    id: 'child-b1',
    slug: 'child-b1',
    name: '다른 상위의 하위',
    parentId: 'root-b',
    description: null,
    iconKey: null,
    sortOrder: 10,
    filterAttributes: [],
  },
];

function renderCategoriesPage(
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const renderedPage = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminCategoriesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { queryClient, ...renderedPage };
}

describe('AdminCategoriesPage 순서 조작', () => {
  let categories: Category[];
  let adminList: ReturnType<typeof vi.fn>;
  let save: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    categories = structuredClone(categoryFixtures);
    adminList = vi.fn(async () => structuredClone(categories));
    save = vi.fn(async (input: Category) => {
      categories = categories.map((category) =>
        category.id === input.id ? structuredClone(input) : category,
      );
      return structuredClone(input);
    });
    shopMocks.getShopApi.mockResolvedValue({
      categories: {
        adminList,
        save,
      },
    });
  });

  it('같은 부모의 형제만 저장하고 성공 후 표시 순서를 갱신한다', async () => {
    const user = userEvent.setup();
    renderCategoriesPage();

    const firstChildUp = await screen.findByRole('button', {
      name: '첫 번째 하위 순서 위로 이동',
    });
    expect(firstChildUp).toBeDisabled();
    expect(screen.getByRole('button', { name: '두 번째 하위 순서 아래로 이동' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '두 번째 상위 하위 카테고리 펼치기' }));
    expect(screen.getByRole('button', { name: '다른 상위의 하위 순서 위로 이동' })).toBeDisabled();
    const categoryNameInput = screen.getByRole('textbox', { name: '카테고리명' });
    await user.clear(categoryNameInput);
    await user.type(categoryNameInput, '저장하지 않은 이름');

    await user.click(screen.getByRole('button', { name: '두 번째 하위 순서 위로 이동' }));

    expect(await screen.findByText('목 API에 카테고리 순서를 저장했습니다.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('목 API에 카테고리 순서를 저장했습니다.');
    expect(screen.getByRole('status')).toHaveClass('text-success');
    expect(screen.queryByText('카테고리 순서를 저장하고 있습니다.')).not.toBeInTheDocument();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: 'child-a2',
        name: '두 번째 하위',
        parentId: 'root-a',
        sortOrder: 0,
      }),
    );
    expect(save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: 'child-a1',
        name: '첫 번째 하위',
        parentId: 'root-a',
        sortOrder: 1,
      }),
    );
    expect(save.mock.calls.map(([category]) => category.id)).not.toContain('root-a');
    expect(save.mock.calls.map(([category]) => category.id)).not.toContain('child-b1');
    expect(adminList).toHaveBeenCalledTimes(2);

    const tree = screen.getByRole('region', { name: '카테고리 목록' });
    const renderedChildren = within(tree)
      .getAllByRole('button', { name: /순서 위로 이동/ })
      .map((button) => button.getAttribute('aria-label'));
    expect(renderedChildren.indexOf('두 번째 하위 순서 위로 이동')).toBeLessThan(
      renderedChildren.indexOf('저장하지 않은 이름 순서 위로 이동'),
    );
    expect(screen.getByRole('heading', { name: '‘저장하지 않은 이름’ 상세' })).toBeInTheDocument();
    expect(categoryNameInput).toHaveValue('저장하지 않은 이름');
  });

  it('부분 저장 실패 뒤 권위 있는 목록을 다시 읽고 오류를 안내한다', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['categories'], ['cached category']);
    queryClient.setQueryData(['products'], ['cached product']);
    save.mockImplementationOnce(async (input: Category) => {
      categories = categories.map((category) =>
        category.id === input.id ? structuredClone(input) : category,
      );
      return structuredClone(input);
    });
    save.mockImplementationOnce(async () => {
      throw new Error('저장 실패');
    });
    renderCategoriesPage(queryClient);

    await user.click(await screen.findByRole('button', { name: '두 번째 하위 순서 위로 이동' }));

    expect(
      await screen.findByText(/카테고리 순서를 모두 저장하지 못했습니다\./),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('text-danger');
    expect(screen.queryByText('카테고리 순서를 저장하고 있습니다.')).not.toBeInTheDocument();
    expect(adminList).toHaveBeenCalledTimes(2);
    expect(queryClient.getQueryState(['categories'])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['products'])?.isInvalidated).toBe(true);
    const tree = screen.getByRole('region', { name: '카테고리 목록' });
    const firstChildRow = within(tree).getByRole('button', {
      name: '첫 번째 하위 순서 위로 이동',
    });
    const secondChildRow = within(tree).getByRole('button', {
      name: '두 번째 하위 순서 위로 이동',
    });
    const renderedChildren = within(tree)
      .getAllByRole('button', { name: /하위 순서 위로 이동/ })
      .map((button) => button.getAttribute('aria-label'));
    expect(renderedChildren.indexOf('두 번째 하위 순서 위로 이동')).toBeLessThan(
      renderedChildren.indexOf('첫 번째 하위 순서 위로 이동'),
    );
    expect(firstChildRow).toBeInTheDocument();
    expect(secondChildRow).toBeInTheDocument();
  });

  it('reports a refresh failure without claiming the successful reorder did not save', async () => {
    const user = userEvent.setup();
    adminList
      .mockResolvedValueOnce(structuredClone(categoryFixtures))
      .mockRejectedValueOnce(new Error('refresh failed'));
    renderCategoriesPage();

    await user.click(await screen.findByRole('button', { name: '두 번째 하위 순서 위로 이동' }));

    expect(save).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole('status')).toHaveTextContent(
      '목 API에 카테고리 순서를 저장했지만 최신 목록을 불러오지 못했습니다. 다시 조회해 주세요.',
    );
    expect(
      within(screen.getByRole('region', { name: '카테고리 목록' })).getByRole('button', {
        name: '첫 번째 하위상품 수 정보 없음',
      }),
    ).toBeInTheDocument();
  });

  it('형제 카테고리에 정렬 초안이 있으면 보존하고 재정렬을 거부한다', async () => {
    const user = userEvent.setup();
    renderCategoriesPage();

    const sortOrderInput = await screen.findByRole('spinbutton');
    await user.clear(sortOrderInput);
    await user.type(sortOrderInput, '17');
    await user.click(screen.getByRole('button', { name: '두 번째 하위 순서 위로 이동' }));

    expect(
      await screen.findByText(
        '정렬 순서 초안이 있습니다. 초안을 저장하거나 취소한 뒤 순서를 변경해 주세요.',
      ),
    ).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
    expect(adminList).toHaveBeenCalledTimes(1);
    expect(sortOrderInput).toHaveValue(17);
    const tree = screen.getByRole('region', { name: '카테고리 목록' });
    const renderedChildren = within(tree)
      .getAllByRole('button', { name: /순서 위로 이동/ })
      .map((button) => button.getAttribute('aria-label'));
    expect(renderedChildren.indexOf('첫 번째 하위 순서 위로 이동')).toBeLessThan(
      renderedChildren.indexOf('두 번째 하위 순서 위로 이동'),
    );
  });

  it('재정렬 중 선택과 상세 변경을 막고 완료 후 목록과 입력을 다시 활성화한다', async () => {
    const user = userEvent.setup();
    let releaseFirstSave: (() => void) | undefined;
    const firstSaveGate = new Promise<void>((resolve) => {
      releaseFirstSave = resolve;
    });
    save.mockImplementationOnce(async (input: Category) => {
      await firstSaveGate;
      categories = categories.map((category) =>
        category.id === input.id ? structuredClone(input) : category,
      );
      return structuredClone(input);
    });
    renderCategoriesPage();

    await user.click(await screen.findByRole('button', { name: '두 번째 하위 순서 위로 이동' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const progressStatus = await screen.findByRole('status');
    expect(progressStatus).toHaveTextContent('카테고리 순서를 저장하고 있습니다.');
    expect(progressStatus).toHaveClass('text-info');
    await user.click(screen.getByRole('button', { name: '두 번째 하위 순서 위로 이동' }));
    expect(save).toHaveBeenCalledTimes(1);

    const selectionButton = screen.getByRole('button', {
      name: '두 번째 하위상품 수 정보 없음',
    });
    const categoryNameInput = screen.getByRole('textbox', { name: '카테고리명' });
    const categoryDescriptionInput = screen.getByRole('textbox', { name: /부제/ });
    const visibilityCheckbox = screen.getByRole('checkbox');
    const sortOrderInput = screen.getByRole('spinbutton');
    const filtersInput = screen.getByRole('textbox', { name: /필터 속성/ });
    const deleteButton = screen.getByRole('button', { name: '삭제' });
    const saveButton = screen.getByRole('button', { name: '저장' });

    for (const control of [
      selectionButton,
      categoryNameInput,
      categoryDescriptionInput,
      visibilityCheckbox,
      sortOrderInput,
      filtersInput,
      deleteButton,
      saveButton,
      screen.getByRole('button', { name: '하위 카테고리 추가' }),
      screen.getByRole('button', { name: '1차 카테고리 추가' }),
    ]) {
      expect(control).toBeDisabled();
    }

    selectionButton.removeAttribute('disabled');
    fireEvent.click(selectionButton);
    selectionButton.setAttribute('disabled', '');
    categoryNameInput.removeAttribute('disabled');
    fireEvent.change(categoryNameInput, { target: { value: '재정렬 중 편집' } });
    categoryNameInput.setAttribute('disabled', '');
    saveButton.removeAttribute('disabled');
    fireEvent.click(saveButton);
    saveButton.setAttribute('disabled', '');
    expect(screen.getByRole('heading', { name: '‘첫 번째 하위’ 상세' })).toBeInTheDocument();
    expect(categoryNameInput).toHaveValue('첫 번째 하위');
    expect(save).toHaveBeenCalledTimes(1);

    if (!releaseFirstSave) throw new Error('첫 번째 저장 대기 핸들러가 없습니다.');
    releaseFirstSave();
    expect(await screen.findByText('목 API에 카테고리 순서를 저장했습니다.')).toBeInTheDocument();
    expect(screen.queryByText('카테고리 순서를 저장하고 있습니다.')).not.toBeInTheDocument();
    expect(adminList).toHaveBeenCalledTimes(2);
    for (const control of [
      selectionButton,
      categoryNameInput,
      categoryDescriptionInput,
      visibilityCheckbox,
      sortOrderInput,
      filtersInput,
      deleteButton,
      saveButton,
      screen.getByRole('button', { name: '하위 카테고리 추가' }),
      screen.getByRole('button', { name: '1차 카테고리 추가' }),
    ]) {
      expect(control).toBeEnabled();
    }

    const tree = screen.getByRole('region', { name: '카테고리 목록' });
    const renderedChildren = within(tree)
      .getAllByRole('button', { name: /하위 순서 위로 이동/ })
      .map((button) => button.getAttribute('aria-label'));
    expect(renderedChildren.indexOf('두 번째 하위 순서 위로 이동')).toBeLessThan(
      renderedChildren.indexOf('첫 번째 하위 순서 위로 이동'),
    );
  });
});
