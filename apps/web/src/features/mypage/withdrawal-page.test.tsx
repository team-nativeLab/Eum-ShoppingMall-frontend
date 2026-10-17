import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WithdrawalPage } from './withdrawal-page';

const sessionMock = vi.hoisted(() => ({
  member: { id: 'member-a' } as { id: string } | null,
  status: 'ready',
  refreshMember: vi.fn(),
  clearMember: vi.fn(),
}));
const routerMock = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('@/features/auth/member-session', () => ({ useMemberSession: () => sessionMock }));
vi.mock('next/navigation', () => ({ useRouter: () => routerMock }));
vi.mock('./mypage-shell', () => ({
  MyPageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

beforeEach(() => {
  sessionMock.member = { id: 'member-a' };
  sessionMock.status = 'ready';
  sessionMock.clearMember.mockReset().mockResolvedValue(undefined);
  sessionMock.refreshMember.mockReset();
  routerMock.replace.mockReset();
});

describe('회원 탈퇴 데모 화면', () => {
  it('세션이 없으면 신청 폼 대신 로그인 경로를 안내합니다', () => {
    sessionMock.member = null;
    render(<WithdrawalPage />);

    expect(screen.getByText('로그인 후 회원 탈퇴 안내를 확인할 수 있습니다.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute(
      'href',
      '/login?redirect=%2Fmypage%2Fwithdrawal',
    );
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('데모 확인 시 세션 정리를 요청하고 실제 삭제 없이 로그인으로 이동합니다', async () => {
    const user = userEvent.setup();
    render(<WithdrawalPage />);

    await user.click(screen.getByRole('radio', { name: '서비스 이용이 불편함' }));
    await user.click(screen.getByRole('button', { name: '다음' }));
    await user.click(screen.getByRole('button', { name: '데모 탈퇴 흐름 확인' }));
    expect(
      within(screen.getByRole('dialog')).getByText(
        /실제 회원 탈퇴나 계정 삭제는 진행되지 않습니다/,
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() => {
      expect(sessionMock.clearMember).toHaveBeenCalledOnce();
      expect(routerMock.replace).toHaveBeenCalledWith('/login');
    });
  });

  it('회원 조회 실패에서는 다시 시도를 제공합니다', () => {
    sessionMock.status = 'error';
    sessionMock.member = null;
    render(<WithdrawalPage />);

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(sessionMock.refreshMember).toHaveBeenCalledOnce();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
});
