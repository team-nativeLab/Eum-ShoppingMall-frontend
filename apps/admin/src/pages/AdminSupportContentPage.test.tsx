import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminFaq, AdminNotice } from '@eum/api/types';
import type { AdminNoticeInput } from '@eum/api/shop-api';
import { AdminFaqsPage, AdminNoticesPage } from './AdminSupportContentPage';

const mocks = vi.hoisted(() => ({ getShopApi: vi.fn() }));
vi.mock('@/lib/shop-api', () => ({ getShopApi: mocks.getShopApi }));

function renderPage(page: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(<QueryClientProvider client={queryClient}>{page}</QueryClientProvider>);
}

describe('Admin notice and FAQ filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('compares notice schedule dates and new notice dates by the local calendar day', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T03:00:00.000Z'));
    const notices: AdminNotice[] = [
      {
        id: 'notice-scheduled',
        title: '예약 공지',
        body: '내일 게시합니다.',
        isPinned: false,
        isVisible: true,
        sortOrder: 1,
        publishedAt: '2026-10-26T15:00:00.000Z',
      },
      {
        id: 'notice-published',
        title: '오늘 공지',
        body: '오늘 게시합니다.',
        isPinned: false,
        isVisible: true,
        sortOrder: 2,
        publishedAt: '2026-10-25T15:00:00.000Z',
      },
    ];
    const saveAdmin = vi.fn(async (input: Omit<AdminNotice, 'id'> & { id?: string }) => input);
    mocks.getShopApi.mockResolvedValue({
      notices: {
        adminList: vi.fn(async () => notices),
        saveAdmin,
        deleteAdmin: vi.fn(),
      },
    });
    const rendered = renderPage(<AdminNoticesPage />);

    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      fireEvent.click(screen.getByRole('button', { name: /예약\s*1/ }));
      expect(screen.getByText('예약 공지')).toBeInTheDocument();
      expect(screen.queryByText('오늘 공지')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '새로 등록' }));
      expect(screen.getByLabelText('게시일')).toHaveValue('2026-10-26');
      fireEvent.change(screen.getByLabelText('제목'), { target: { value: '신규 공지' } });
      fireEvent.change(screen.getByLabelText('본문'), { target: { value: '본문' } });
      fireEvent.click(screen.getByRole('button', { name: '저장' }));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(saveAdmin).toHaveBeenCalledWith(
        expect.objectContaining({ publishedAt: '2026-10-25T15:00:00.000Z' }),
      );
    } finally {
      rendered.unmount();
      vi.useRealTimers();
    }
  });

  it('can select a FAQ category literally named 전체 separately from the all category', async () => {
    const faqs: AdminFaq[] = [
      {
        id: 'faq-all-label',
        category: '전체',
        question: '전체 분류 질문',
        answer: '답변',
        isVisible: true,
        sortOrder: 1,
      },
      {
        id: 'faq-shipping',
        category: '배송',
        question: '배송 분류 질문',
        answer: '답변',
        isVisible: true,
        sortOrder: 2,
      },
    ];
    mocks.getShopApi.mockResolvedValue({
      faqs: {
        adminList: vi.fn(async () => faqs),
        saveAdmin: vi.fn(),
        deleteAdmin: vi.fn(),
      },
    });
    renderPage(<AdminFaqsPage />);

    expect(await screen.findByText('배송 분류 질문')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /전체1/ }));
    expect(screen.getByText('전체 분류 질문')).toBeInTheDocument();
    expect(screen.queryByText('배송 분류 질문')).not.toBeInTheDocument();
  });

  it('selects visible notices, selects all, and deselects an individual row', async () => {
    const notices: AdminNotice[] = [
      {
        id: 'notice-one',
        title: '첫 번째 공지',
        body: '본문',
        isPinned: false,
        isVisible: true,
        sortOrder: 1,
        publishedAt: '2026-10-20T00:00:00.000Z',
      },
      {
        id: 'notice-two',
        title: '두 번째 공지',
        body: '본문',
        isPinned: false,
        isVisible: true,
        sortOrder: 2,
        publishedAt: '2026-10-21T00:00:00.000Z',
      },
    ];
    mocks.getShopApi.mockResolvedValue({
      notices: {
        adminList: vi.fn(async () => notices),
        saveAdmin: vi.fn(),
        deleteAdmin: vi.fn(),
      },
    });
    renderPage(<AdminNoticesPage />);

    expect(await screen.findByText('첫 번째 공지')).toBeInTheDocument();
    const user = userEvent.setup();
    const selectAll = screen.getByRole('checkbox', { name: '현재 목록 공지 전체 선택' });
    const firstNoticeCheckbox = screen.getByRole('checkbox', { name: '첫 번째 공지 선택' });
    await user.click(firstNoticeCheckbox);
    expect(screen.getByText('1개 선택')).toBeInTheDocument();
    expect(selectAll).toBePartiallyChecked();

    await user.keyboard(' ');
    expect(screen.queryByText('1개 선택')).not.toBeInTheDocument();
    await user.keyboard(' ');
    expect(screen.getByText('1개 선택')).toBeInTheDocument();

    fireEvent.click(selectAll);
    expect(screen.getByText('2개 선택')).toBeInTheDocument();
    expect(selectAll).toBeChecked();

    fireEvent.click(screen.getByRole('checkbox', { name: '두 번째 공지 선택' }));
    expect(screen.getByText('1개 선택')).toBeInTheDocument();
    expect(selectAll).toBePartiallyChecked();
  });

  it('saves a selected visibility action sequentially and refreshes after a partial failure', async () => {
    const originalNotices: AdminNotice[] = [
      {
        id: 'notice-success',
        title: '게시 성공 공지',
        body: '본문',
        isPinned: false,
        isVisible: false,
        sortOrder: 1,
        publishedAt: '2026-10-20T00:00:00.000Z',
      },
      {
        id: 'notice-failure',
        title: '게시 실패 공지',
        body: '본문',
        isPinned: false,
        isVisible: false,
        sortOrder: 2,
        publishedAt: '2026-10-21T00:00:00.000Z',
      },
    ];
    const refreshedNotices = originalNotices.map((notice) =>
      notice.id === 'notice-success' ? { ...notice, isVisible: true } : notice,
    );
    const adminList = vi
      .fn<() => Promise<AdminNotice[]>>()
      .mockResolvedValueOnce(originalNotices)
      .mockResolvedValueOnce(refreshedNotices);
    const saveCalls: Array<string | undefined> = [];
    const saveAdmin = vi.fn(async (input: AdminNoticeInput) => {
      saveCalls.push(input.id);
      if (input.id === 'notice-failure') throw new Error('save failed');
      return { ...input };
    });
    mocks.getShopApi.mockResolvedValue({
      notices: { adminList, saveAdmin, deleteAdmin: vi.fn() },
    });
    renderPage(<AdminNoticesPage />);

    expect(await screen.findByText('게시 성공 공지')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: '현재 목록 공지 전체 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '게시' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        '선택한 공지 1건을 게시했고 1건은 실패했습니다. 목 API 목록을 다시 확인했습니다.',
      ),
    );
    expect(saveCalls).toEqual(['notice-success', 'notice-failure']);
    expect(adminList).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('row', { name: /게시 성공 공지/ })).toHaveTextContent('노출');
    expect(screen.getByRole('row', { name: /게시 실패 공지/ })).toHaveTextContent('숨김');
  });

  it('hides only the selected notice through the existing single-save API', async () => {
    const notices: AdminNotice[] = [
      {
        id: 'notice-selected',
        title: '선택한 공지',
        body: '본문',
        isPinned: false,
        isVisible: true,
        sortOrder: 1,
        publishedAt: '2026-10-20T00:00:00.000Z',
      },
      {
        id: 'notice-unselected',
        title: '선택하지 않은 공지',
        body: '본문',
        isPinned: false,
        isVisible: true,
        sortOrder: 2,
        publishedAt: '2026-10-21T00:00:00.000Z',
      },
    ];
    const saveAdmin = vi.fn(async (input: AdminNoticeInput) => ({
      ...input,
      id: input.id ?? 'notice-created',
    }));
    mocks.getShopApi.mockResolvedValue({
      notices: {
        adminList: vi.fn(async () => notices),
        saveAdmin,
        deleteAdmin: vi.fn(),
      },
    });
    renderPage(<AdminNoticesPage />);

    expect(await screen.findByText('선택한 공지')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: '선택한 공지 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '숨김' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        '선택한 공지 1건을 숨김했습니다. 목 API 목록을 다시 확인했습니다.',
      ),
    );
    expect(saveAdmin).toHaveBeenCalledTimes(1);
    expect(saveAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'notice-selected',
        isVisible: false,
      }),
    );
  });

  it('announces a total save failure even when refreshing the list also fails', async () => {
    const notice: AdminNotice = {
      id: 'notice-failure',
      title: '게시 실패 공지',
      body: '본문',
      isPinned: false,
      isVisible: false,
      sortOrder: 1,
      publishedAt: '2026-10-20T00:00:00.000Z',
    };
    const adminList = vi
      .fn<() => Promise<AdminNotice[]>>()
      .mockResolvedValueOnce([notice])
      .mockRejectedValueOnce(new Error('refresh failed'));
    mocks.getShopApi.mockResolvedValue({
      notices: {
        adminList,
        saveAdmin: vi.fn().mockRejectedValue(new Error('save failed')),
        deleteAdmin: vi.fn(),
      },
    });
    renderPage(<AdminNoticesPage />);

    expect(await screen.findByText('게시 실패 공지')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: '게시 실패 공지 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '게시' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        '선택한 공지 1건을 게시하지 못했습니다. 목록을 새로 불러오지 못했습니다.',
      ),
    );
    expect(adminList).toHaveBeenCalledTimes(2);
  });

  it('blocks publishing a future scheduled notice while allowing it to be hidden', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T12:00:00.000Z'));
    const scheduledNotice: AdminNotice = {
      id: 'notice-scheduled',
      title: '예약 공지',
      body: '게시 시각 전에는 공개할 수 없습니다.',
      isPinned: false,
      isVisible: false,
      sortOrder: 1,
      publishedAt: '2026-10-27T00:00:00.000Z',
    };
    const saveAdmin = vi.fn(async (input: AdminNoticeInput) => ({
      ...input,
      id: input.id ?? 'notice-created',
    }));
    mocks.getShopApi.mockResolvedValue({
      notices: {
        adminList: vi.fn(async () => [scheduledNotice]),
        saveAdmin,
        deleteAdmin: vi.fn(),
      },
    });
    const rendered = renderPage(<AdminNoticesPage />);

    try {
      expect(await screen.findByText('예약 공지')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('checkbox', { name: '예약 공지 선택' }));

      const publishButton = screen.getByRole('button', { name: '게시' });
      expect(publishButton).toBeDisabled();
      expect(
        screen.getByText('예약 공지는 게시 시각 전까지 공개할 수 없습니다.'),
      ).toBeInTheDocument();
      expect(saveAdmin).not.toHaveBeenCalled();

      const hideButton = screen.getByRole('button', { name: '숨김' });
      expect(hideButton).toBeEnabled();
      fireEvent.click(hideButton);

      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(
          '선택한 공지 1건을 숨김했습니다. 목 API 목록을 다시 확인했습니다.',
        ),
      );
      expect(saveAdmin).toHaveBeenCalledTimes(1);
      expect(saveAdmin).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'notice-scheduled',
          isVisible: false,
          publishedAt: '2026-10-27T00:00:00.000Z',
        }),
      );
    } finally {
      rendered.unmount();
      vi.useRealTimers();
    }
  });

  it('enables bulk publishing when the selected notice reaches its scheduled time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T12:00:00.000Z'));
    const scheduledNotice: AdminNotice = {
      id: 'notice-scheduled-boundary',
      title: '게시 경계 예약 공지',
      body: '게시 시각이 되면 공개할 수 있습니다.',
      isPinned: false,
      isVisible: false,
      sortOrder: 1,
      publishedAt: '2026-10-27T00:00:00.000Z',
    };
    const saveAdmin = vi.fn(async (input: AdminNoticeInput) => ({
      ...input,
      id: input.id ?? 'notice-created',
    }));
    mocks.getShopApi.mockResolvedValue({
      notices: {
        adminList: vi.fn(async () => [scheduledNotice]),
        saveAdmin,
        deleteAdmin: vi.fn(),
      },
    });
    const rendered = renderPage(<AdminNoticesPage />);

    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(screen.getByText('게시 경계 예약 공지')).toBeInTheDocument();
      const scheduledNoticeCheckbox = screen.getByRole('checkbox', {
        name: '게시 경계 예약 공지 선택',
      });
      fireEvent.click(scheduledNoticeCheckbox);

      const publishButton = screen.getByRole('button', { name: '게시' });
      expect(publishButton).toBeDisabled();
      expect(saveAdmin).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      fireEvent.click(scheduledNoticeCheckbox);
      expect(vi.getTimerCount()).toBe(0);
      fireEvent.click(scheduledNoticeCheckbox);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(12 * 60 * 60 * 1000);
      });

      const enabledPublishButton = screen.getByRole('button', { name: '게시' });
      expect(enabledPublishButton).toBeEnabled();
      expect(screen.queryByText('예약 공지는 게시 시각 전까지 공개할 수 없습니다.')).toBeNull();
      fireEvent.click(enabledPublishButton);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });

      expect(screen.getByRole('status')).toHaveTextContent(
        '선택한 공지 1건을 게시했습니다. 목 API 목록을 다시 확인했습니다.',
      );
      expect(saveAdmin).toHaveBeenCalledTimes(1);
      expect(saveAdmin).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'notice-scheduled-boundary',
          isVisible: true,
          publishedAt: '2026-10-27T00:00:00.000Z',
        }),
      );
    } finally {
      rendered.unmount();
      vi.useRealTimers();
    }
  });

  it('cancels bulk deletion with the modal cancel and Escape behavior without API calls', async () => {
    const notice: AdminNotice = {
      id: 'notice-cancel',
      title: '삭제 취소 공지',
      body: '본문',
      isPinned: false,
      isVisible: true,
      sortOrder: 1,
      publishedAt: '2026-10-20T00:00:00.000Z',
    };
    const deleteAdmin = vi.fn();
    mocks.getShopApi.mockResolvedValue({
      notices: { adminList: vi.fn(async () => [notice]), saveAdmin: vi.fn(), deleteAdmin },
    });
    renderPage(<AdminNoticesPage />);

    expect(await screen.findByText('삭제 취소 공지')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: '삭제 취소 공지 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '선택한 공지 삭제' }));

    const dialog = screen.getByRole('dialog', { name: '공지를 삭제하시겠습니까?' });
    expect(dialog).toHaveAccessibleDescription(
      '선택한 공지 1건을 삭제하면 사용자 화면에서 바로 사라지고 되돌릴 수 없습니다.',
    );
    const cancelButton = screen.getByRole('button', { name: '취소' });
    cancelButton.focus();
    expect(cancelButton).toHaveFocus();
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '선택한 공지 삭제' }));
    const keyboardCancelButton = screen.getByRole('button', { name: '취소' });
    keyboardCancelButton.focus();
    await userEvent.setup().keyboard('{Enter}');
    expect(deleteAdmin).not.toHaveBeenCalled();
  });

  it('deletes the confirmation snapshot sequentially, blocks duplicate clicks, and reconciles selection', async () => {
    const notices: AdminNotice[] = [
      {
        id: 'notice-snapshot-one',
        title: '스냅샷 공지 1',
        body: '본문',
        isPinned: false,
        isVisible: true,
        sortOrder: 1,
        publishedAt: '2026-10-20T00:00:00.000Z',
      },
      {
        id: 'notice-snapshot-two',
        title: '스냅샷 공지 2',
        body: '본문',
        isPinned: false,
        isVisible: true,
        sortOrder: 2,
        publishedAt: '2026-10-21T00:00:00.000Z',
      },
    ];
    const adminList = vi
      .fn<() => Promise<AdminNotice[]>>()
      .mockResolvedValueOnce(notices)
      .mockResolvedValueOnce([notices[1]!]);
    const resolveFirstDelete: { current?: () => void } = {};
    const deleteCalls: string[] = [];
    const deleteAdmin = vi.fn((noticeId: string) => {
      deleteCalls.push(noticeId);
      if (noticeId === notices[0]!.id) {
        return new Promise<void>((resolve) => {
          resolveFirstDelete.current = resolve;
        });
      }
      return Promise.resolve();
    });
    mocks.getShopApi.mockResolvedValue({
      notices: { adminList, saveAdmin: vi.fn(), deleteAdmin },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    queryClient.setQueryData(['notices'], []);
    render(
      <QueryClientProvider client={queryClient}>
        <AdminNoticesPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('스냅샷 공지 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: '현재 목록 공지 전체 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '선택한 공지 삭제' }));
    // Selection changes after opening the confirmation do not change its captured target list.
    fireEvent.click(screen.getByRole('checkbox', { name: '스냅샷 공지 1 선택' }));
    const keyboardConfirmButton = within(screen.getByRole('dialog')).getByRole('button', {
      name: '삭제',
    });
    keyboardConfirmButton.focus();
    await userEvent.setup().keyboard('{Enter}');

    expect(within(screen.getByRole('dialog')).getByRole('status')).toHaveTextContent(
      '순서대로 처리하고 있습니다.',
    );
    expect(screen.getByRole('button', { name: '삭제 중' })).toBeDisabled();
    await waitFor(() => expect(deleteCalls).toEqual(['notice-snapshot-one']));
    expect(screen.getByRole('checkbox', { name: '스냅샷 공지 2 선택' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '삭제 중' }));
    expect(deleteAdmin).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstDelete.current?.();
    });
    await waitFor(() =>
      expect(deleteCalls).toEqual(['notice-snapshot-one', 'notice-snapshot-two']),
    );
    await waitFor(() =>
      expect(
        screen.getByText(
          '삭제 요청 성공 응답 2건, 실패 응답 0건. 관리자 공지 목록을 다시 불러왔습니다. 남아 있는 선택 공지 1건입니다.',
          { selector: 'span[role="status"]' },
        ),
      ).toBeInTheDocument(),
    );

    expect(adminList).toHaveBeenCalledTimes(2);
    expect(queryClient.getQueryState(['notices'])?.isInvalidated).toBe(true);
    expect(screen.queryByRole('checkbox', { name: '스냅샷 공지 1 선택' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: '스냅샷 공지 2 선택' })).toBeChecked();
  });

  it('continues after an individual delete response failure and reports the response counts', async () => {
    const notices: AdminNotice[] = [
      ...['first', 'middle', 'last'].map((suffix, index) => ({
        id: `notice-${suffix}`,
        title: `삭제 ${suffix}`,
        body: '본문',
        isPinned: false,
        isVisible: true,
        sortOrder: index + 1,
        publishedAt: '2026-10-20T00:00:00.000Z',
      })),
    ];
    const adminList = vi.fn<() => Promise<AdminNotice[]>>().mockResolvedValue(notices);
    const deleteAdmin = vi.fn(async (noticeId: string) => {
      if (noticeId === 'notice-middle') throw new Error('delete response failed');
    });
    mocks.getShopApi.mockResolvedValue({
      notices: { adminList, saveAdmin: vi.fn(), deleteAdmin },
    });
    renderPage(<AdminNoticesPage />);

    expect(await screen.findByText('삭제 first')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: '현재 목록 공지 전체 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '선택한 공지 삭제' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        '삭제 요청 성공 응답 2건, 실패 응답 1건. 관리자 공지 목록을 다시 불러왔습니다. 남아 있는 선택 공지 3건입니다.',
      ),
    );
    expect(deleteAdmin.mock.calls.map(([noticeId]) => noticeId)).toEqual([
      'notice-first',
      'notice-middle',
      'notice-last',
    ]);
    expect(adminList).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('row', { name: /삭제 middle/ })).toBeInTheDocument();
  });

  it('continues every delete after total failure and reports an admin list refresh failure', async () => {
    const notices: AdminNotice[] = [
      {
        id: 'notice-total-fail-one',
        title: '전체 실패 1',
        body: '본문',
        isPinned: false,
        isVisible: true,
        sortOrder: 1,
        publishedAt: '2026-10-20T00:00:00.000Z',
      },
      {
        id: 'notice-total-fail-two',
        title: '전체 실패 2',
        body: '본문',
        isPinned: false,
        isVisible: true,
        sortOrder: 2,
        publishedAt: '2026-10-21T00:00:00.000Z',
      },
    ];
    const adminList = vi
      .fn<() => Promise<AdminNotice[]>>()
      .mockResolvedValueOnce(notices)
      .mockRejectedValueOnce(new Error('refresh failed'));
    const deleteAdmin = vi.fn().mockRejectedValue(new Error('delete response failed'));
    mocks.getShopApi.mockResolvedValue({
      notices: { adminList, saveAdmin: vi.fn(), deleteAdmin },
    });
    renderPage(<AdminNoticesPage />);

    expect(await screen.findByText('전체 실패 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: '현재 목록 공지 전체 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '선택한 공지 삭제' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        '삭제 요청 성공 응답 0건, 실패 응답 2건. 관리자 공지 목록을 새로 불러오지 못했습니다.',
      ),
    );
    expect(deleteAdmin.mock.calls.map(([noticeId]) => noticeId)).toEqual([
      'notice-total-fail-one',
      'notice-total-fail-two',
    ]);
    expect(adminList).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('alert')).toHaveTextContent('정보를 불러오지 못했습니다');
  });

  it('removes successful delete IDs from selection and waits for a fresh list before retrying', async () => {
    const user = userEvent.setup();
    const notices: AdminNotice[] = [
      {
        id: 'notice-delete-success',
        title: '삭제 성공 공지',
        body: '본문',
        isPinned: false,
        isVisible: true,
        sortOrder: 1,
        publishedAt: '2026-10-20T00:00:00.000Z',
      },
      {
        id: 'notice-delete-retry',
        title: '삭제 재시도 공지',
        body: '본문',
        isPinned: false,
        isVisible: true,
        sortOrder: 2,
        publishedAt: '2026-10-21T00:00:00.000Z',
      },
    ];
    const adminList = vi
      .fn<() => Promise<AdminNotice[]>>()
      .mockResolvedValueOnce(notices)
      .mockRejectedValueOnce(new Error('refresh failed'))
      .mockResolvedValueOnce([notices[1]!])
      .mockResolvedValueOnce([]);
    const deleteCalls: string[] = [];
    const deleteAdmin = vi.fn(async (noticeId: string) => {
      deleteCalls.push(noticeId);
      if (noticeId === 'notice-delete-retry' && deleteCalls.length === 2) {
        throw new Error('delete failed');
      }
    });
    mocks.getShopApi.mockResolvedValue({
      notices: { adminList, saveAdmin: vi.fn(), deleteAdmin },
    });
    renderPage(<AdminNoticesPage />);

    expect(await screen.findByText('삭제 성공 공지')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: '현재 목록 공지 전체 선택' }));
    await user.click(screen.getByRole('button', { name: '선택한 공지 삭제' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('정보를 불러오지 못했습니다');
    expect(screen.getByRole('status')).toHaveTextContent(
      '삭제 요청 성공 응답 1건, 실패 응답 1건. 관리자 공지 목록을 새로 불러오지 못했습니다.',
    );
    expect(screen.queryByRole('button', { name: '선택한 공지 삭제' })).not.toBeInTheDocument();
    expect(deleteCalls).toEqual(['notice-delete-success', 'notice-delete-retry']);

    await user.click(screen.getByRole('button', { name: '다시 불러오기' }));
    const retryNoticeCheckbox = await screen.findByRole('checkbox', {
      name: '삭제 재시도 공지 선택',
    });
    expect(screen.queryByText('삭제 성공 공지')).not.toBeInTheDocument();
    expect(retryNoticeCheckbox).toBeChecked();

    await user.click(screen.getByRole('button', { name: '선택한 공지 삭제' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }));

    expect(await screen.findByText('조건에 맞는 공지가 없습니다')).toBeInTheDocument();
    expect(deleteCalls).toEqual([
      'notice-delete-success',
      'notice-delete-retry',
      'notice-delete-retry',
    ]);
    expect(adminList).toHaveBeenCalledTimes(4);
  });
});
