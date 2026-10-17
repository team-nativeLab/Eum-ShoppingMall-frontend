import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Member } from '@eum/api/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMemberAuth } from '@/lib/member-auth';
import { LoginPageView } from './login-page';
import { MemberSessionProvider } from './member-session';

const authMock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isEmailAvailable: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  signup: vi.fn(),
}));

const routerMock = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('@/lib/member-auth', () => ({ getMemberAuth: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: routerMock.replace }) }));

const member: Member = {
  id: 'mem-login-test',
  email: 'member@example.com',
  name: '테스트 회원',
  phone: '',
  joinedAt: '2026-10-01T00:00:00+09:00',
  pointBalance: 0,
};

function renderLoginPage(rawRedirect?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemberSessionProvider>
        <LoginPageView rawRedirect={rawRedirect} />
      </MemberSessionProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.getCurrentUser.mockResolvedValue(null);
  authMock.login.mockResolvedValue(member);
  authMock.logout.mockResolvedValue(undefined);
  vi.mocked(getMemberAuth).mockResolvedValue(authMock as never);
});

describe('W-09 login form validation', () => {
  it('requires email, associates its error, and focuses the first invalid field', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const emailInput = screen.getByRole('textbox', { name: '이메일' });
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(screen.getByText('이메일을 입력해 주세요.')).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    const errorId = emailInput.getAttribute('aria-describedby');
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId ?? '')).toHaveTextContent('이메일을 입력해 주세요.');
    await waitFor(() => expect(emailInput).toHaveFocus());
    expect(authMock.login).not.toHaveBeenCalled();
  });

  it('shows an email format error and skips authentication', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByRole('textbox', { name: '이메일' }), 'invalid-email');
    await user.type(screen.getByLabelText('비밀번호'), 'password');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(screen.getByText('올바른 이메일 형식으로 입력해 주세요.')).toBeInTheDocument();
    expect(authMock.login).not.toHaveBeenCalled();
  });

  it('shows the missing password with the danger style and focuses the password field', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const passwordInput = screen.getByLabelText('비밀번호');
    await user.type(screen.getByRole('textbox', { name: '이메일' }), 'member@example.com');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    const passwordError = screen.getByText('비밀번호를 입력해 주세요.');
    expect(passwordError).toHaveClass('text-danger');
    expect(passwordInput).toHaveClass('border-danger');
    expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(passwordInput).toHaveFocus());
    expect(authMock.login).not.toHaveBeenCalled();
  });

  it('clears each field error when that field changes', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('button', { name: '로그인' }));
    expect(screen.getByText('이메일을 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('비밀번호를 입력해 주세요.')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: '이메일' }), 'member@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'password');

    expect(screen.queryByText('이메일을 입력해 주세요.')).not.toBeInTheDocument();
    expect(screen.queryByText('비밀번호를 입력해 주세요.')).not.toBeInTheDocument();
    expect(authMock.login).not.toHaveBeenCalled();
  });

  it('passes the password to authentication without trimming it', async () => {
    const user = userEvent.setup();
    renderLoginPage('/orders');

    const unchangedPassword = '  pass word  ';
    await user.type(screen.getByRole('textbox', { name: '이메일' }), 'member@example.com');
    await user.type(screen.getByLabelText('비밀번호'), unchangedPassword);
    await user.click(screen.getByRole('checkbox', { name: '로그인 상태 유지' }));
    await user.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() =>
      expect(authMock.login).toHaveBeenCalledWith({
        email: 'member@example.com',
        password: unchangedPassword,
      }),
    );
    expect(authMock.logout).not.toHaveBeenCalled();
    expect(routerMock.replace).toHaveBeenCalledWith('/orders');
  });

  it('preserves a safe redirect while opening account recovery', () => {
    renderLoginPage('/mypage/claims/clm-001');

    expect(screen.getByRole('link', { name: '이메일 찾기' })).toHaveAttribute(
      'href',
      '/account/find-email?redirect=%2Fmypage%2Fclaims%2Fclm-001',
    );
    expect(screen.getByRole('link', { name: '비밀번호 찾기' })).toHaveAttribute(
      'href',
      '/account/find-password?redirect=%2Fmypage%2Fclaims%2Fclm-001',
    );
  });

  it('does not forward an external redirect into recovery links', () => {
    renderLoginPage('https://attacker.example');

    expect(screen.getByRole('link', { name: '이메일 찾기' })).toHaveAttribute(
      'href',
      '/account/find-email?redirect=%2F',
    );
  });
});
