import type { AdminPopup } from '@eum/api/types';
import type { AdminPopupInput } from '@eum/api/shop-api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPopupsPage } from './AdminPopupsPage';

const shopMocks = vi.hoisted(() => ({ getShopApi: vi.fn() }));
vi.mock('@/lib/shop-api', () => ({ getShopApi: shopMocks.getShopApi }));

const fixturePopup: AdminPopup = {
  id: 'popup-one',
  title: '초기 팝업',
  imageUrl: 'https://example.test/popup.png',
  body: '초기 안내입니다.',
  isVisible: true,
  sortOrder: 0,
};

const deferredFileReaders: DeferredFileReader[] = [];

class DeferredFileReader {
  result: string | null = null;
  loadListener: (() => void) | null = null;

  addEventListener(eventName: string, listener: () => void) {
    if (eventName === 'load') this.loadListener = listener;
  }

  readAsDataURL() {
    deferredFileReaders.push(this);
  }

  complete(imageUrl: string) {
    this.result = imageUrl;
    this.loadListener?.();
  }
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('ShopApi 기반 팝업 관리', () => {
  let popups: AdminPopup[];
  const saveAdmin = vi.fn(async (input: AdminPopupInput) => {
    const savedPopup: AdminPopup = { ...input, id: input.id ?? 'popup-created' };
    const existingIndex = popups.findIndex((popup) => popup.id === savedPopup.id);
    if (existingIndex < 0) popups.unshift(savedPopup);
    else popups[existingIndex] = savedPopup;
    return structuredClone(savedPopup);
  });
  const deleteAdmin = vi.fn(async (popupId: string) => {
    popups = popups.filter((popup) => popup.id !== popupId);
  });

  beforeEach(() => {
    deferredFileReaders.length = 0;
    popups = [structuredClone(fixturePopup)];
    saveAdmin.mockClear();
    deleteAdmin.mockClear();
    shopMocks.getShopApi.mockResolvedValue({
      popups: {
        adminList: vi.fn(async () => structuredClone(popups)),
        saveAdmin,
        deleteAdmin,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a popup and displays its browser-shaped preview before saving', async () => {
    const user = userEvent.setup();
    render(<AdminPopupsPage />, { wrapper: createWrapper() });
    await user.click(await screen.findByRole('button', { name: '새로 등록' }));
    await user.type(screen.getByLabelText('제목'), '안전 캠페인');
    await user.type(screen.getByLabelText('사진 URL'), 'https://example.test/campaign.png');
    await user.type(screen.getByLabelText('내용'), '현장 안전용품을 준비해 주세요.');
    expect(screen.getByRole('region', { name: '웹 팝업 미리보기' })).toHaveTextContent(
      '안전 캠페인',
    );
    expect(screen.getByRole('img', { name: '팝업 이미지 미리보기' })).toHaveAttribute(
      'src',
      'https://example.test/campaign.png',
    );
    expect(screen.getByLabelText('정렬 순서').className).toContain('w-full');
    expect(screen.getByRole('region', { name: '웹 팝업 미리보기' }).className).toContain('min-w-0');

    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(saveAdmin).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '안전 캠페인',
          imageUrl: 'https://example.test/campaign.png',
          body: '현장 안전용품을 준비해 주세요.',
          isVisible: true,
          sortOrder: 0,
        }),
      ),
    );
    expect(await screen.findByRole('row', { name: /안전 캠페인/ })).toBeInTheDocument();
  });

  it('edits and deletes a popup through its row actions', async () => {
    const user = userEvent.setup();
    render(<AdminPopupsPage />, { wrapper: createWrapper() });
    const popupRow = await screen.findByRole('row', { name: /초기 팝업/ });
    await user.click(within(popupRow).getByRole('button', { name: '수정' }));
    await user.clear(screen.getByLabelText('제목'));
    await user.type(screen.getByLabelText('제목'), '수정된 팝업');
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(saveAdmin).toHaveBeenCalledWith(
        expect.objectContaining({ id: fixturePopup.id, title: '수정된 팝업' }),
      ),
    );
    const updatedRow = await screen.findByRole('row', { name: /수정된 팝업/ });
    await user.click(within(updatedRow).getByRole('button', { name: '삭제' }));
    const deleteDialog = screen.getByRole('dialog', { name: '팝업을 삭제할까요?' });
    await user.click(within(deleteDialog).getByRole('button', { name: '삭제' }));

    await waitFor(() => expect(deleteAdmin).toHaveBeenCalledWith(fixturePopup.id));
    expect(await screen.findByText('등록된 팝업이 없습니다')).toBeInTheDocument();
  });

  it('prevents repeated deletion while the request is pending', async () => {
    const user = userEvent.setup();
    let finishDelete = () => {};
    deleteAdmin.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishDelete = resolve)),
    );
    render(<AdminPopupsPage />, { wrapper: createWrapper() });
    const popupRow = await screen.findByRole('row', { name: /초기 팝업/ });
    await user.click(within(popupRow).getByRole('button', { name: '삭제' }));
    const deleteDialog = screen.getByRole('dialog', { name: '팝업을 삭제할까요?' });
    const confirmButton = within(deleteDialog).getByRole('button', { name: '삭제' });

    await user.click(confirmButton);
    expect(confirmButton).toBeDisabled();
    expect(deleteAdmin).toHaveBeenCalledTimes(1);
    await user.click(confirmButton);
    expect(deleteAdmin).toHaveBeenCalledTimes(1);

    finishDelete();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('requires title and body and rejects unsafe image URL schemes', async () => {
    const user = userEvent.setup();
    popups = [];
    render(<AdminPopupsPage />, { wrapper: createWrapper() });
    await user.click(await screen.findByRole('button', { name: '새로 등록' }));
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('팝업 제목과 내용을 입력해 주세요.');

    await user.type(screen.getByLabelText('제목'), '안전 안내');
    await user.type(screen.getByLabelText('내용'), '안전 안내 내용입니다.');
    fireEvent.change(screen.getByLabelText('사진 URL'), {
      target: { value: 'javascript:alert(1)' },
    });
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('이미지 URL은 http(s) 주소');
    expect(saveAdmin).not.toHaveBeenCalled();
  });

  it('previews a selected image file and permits an empty image', async () => {
    const user = userEvent.setup();
    popups = [];
    render(<AdminPopupsPage />, { wrapper: createWrapper() });
    await user.click(await screen.findByRole('button', { name: '새로 등록' }));
    await user.type(screen.getByLabelText('제목'), '이미지 선택 안내');
    await user.type(screen.getByLabelText('내용'), '본문입니다.');
    await user.upload(
      screen.getByLabelText('팝업 이미지 파일'),
      new File(['sample'], 'popup.png', { type: 'image/png' }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('popup.png');
    expect(screen.getByRole('button', { name: '파일 선택' })).toHaveAttribute(
      'aria-controls',
      'popup-image-file',
    );

    expect(await screen.findByRole('img', { name: '팝업 이미지 미리보기' })).toHaveAttribute(
      'src',
      'data:image/png;base64,c2FtcGxl',
    );

    await user.click(screen.getByRole('button', { name: '사진 제거' }));
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() =>
      expect(saveAdmin).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: null })),
    );
  });

  it('keeps the most recently selected image when earlier reads finish later', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('FileReader', DeferredFileReader);
    popups = [];
    render(<AdminPopupsPage />, { wrapper: createWrapper() });
    await user.click(await screen.findByRole('button', { name: '새로 등록' }));
    const fileInput = screen.getByLabelText('팝업 이미지 파일');

    await user.upload(fileInput, new File(['first'], 'first.png', { type: 'image/png' }));
    await user.upload(fileInput, new File(['second'], 'second.png', { type: 'image/png' }));
    expect(deferredFileReaders).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent('second.png');

    await act(async () => {
      deferredFileReaders[1]?.complete('data:image/png;base64,c2Vjb25k');
    });
    expect(await screen.findByRole('img', { name: '팝업 이미지 미리보기' })).toHaveAttribute(
      'src',
      'data:image/png;base64,c2Vjb25k',
    );

    await act(async () => {
      deferredFileReaders[0]?.complete('data:image/png;base64,Zmlyc3Q=');
    });
    expect(screen.getByRole('img', { name: '팝업 이미지 미리보기' })).toHaveAttribute(
      'src',
      'data:image/png;base64,c2Vjb25k',
    );
    expect(screen.getByRole('status')).toHaveTextContent('second.png');
  });
});
