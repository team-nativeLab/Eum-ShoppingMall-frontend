import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Member } from '@eum/api/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMemberAuth, getUnifiedAuth } from '@/lib/member-auth';
import { LoginPageView } from './login-page';
import { MemberSessionProvider, useMemberSession } from './member-session';

const authMock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isEmailAvailable: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  signup: vi.fn(),
}));

const routerMock = vi.hoisted(() => ({ replace: vi.fn() }));
const apiModeMock = vi.hoisted(() => ({ mode: 'mock' as 'mock' | 'real' }));

vi.mock('@/lib/member-auth', () => ({ getMemberAuth: vi.fn(), getUnifiedAuth: vi.fn() }));
vi.mock('@/lib/api-config', () => ({
  getWebApiConfig: () => ({
    mode: apiModeMock.mode,
    baseUrl: apiModeMock.mode === 'real' ? 'https://api.example.test' : '',
    mockLatencyMs: 0,
    mockScenario: 'normal',
    isProduction: false,
    isMockAllowedInProduction: false,
  }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: routerMock.replace }) }));

const member: Member = {
  id: 'mem-login-test',
  email: 'member@example.com',
  name: '테스트 회원',
  phone: '',
  joinedAt: '2026-10-01T00:00:00+09:00',
  pointBalance: 0,
};

function renderLoginPage(rawRedirect?: string, showMemberSession = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemberSessionProvider>
        <LoginPageView rawRedirect={rawRedirect} />
        {showMemberSession ? <MemberSessionProbe /> : null}
      </MemberSessionProvider>
    </QueryClientProvider>,
  );
}

function MemberSessionProbe() {
  const { member } = useMemberSession();
  return <output data-testid="member-session">{member?.name ?? '로그아웃'}</output>;
}

beforeEach(() => {
  vi.clearAllMocks();
  apiModeMock.mode = 'mock';
  authMock.getCurrentUser.mockResolvedValue(null);
  authMock.login.mockResolvedValue({ role: 'member', user: member });
  authMock.logout.mockResolvedValue(undefined);
  vi.mocked(getUnifiedAuth).mockResolvedValue(authMock as never);
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
    apiModeMock.mode = 'real';
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

  it.each([false, true])(
    'keeps a member session after mock login with remember checked=%s',
    async (rememberLogin) => {
      const user = userEvent.setup();
      renderLoginPage('/mypage');

      await user.type(screen.getByRole('textbox', { name: '이메일' }), 'member@example.com');
      await user.type(screen.getByLabelText('비밀번호'), 'password');
      const rememberCheckbox = screen.getByRole('checkbox', { name: '로그인 상태 유지' });
      if (rememberLogin) await user.click(rememberCheckbox);
      await user.click(screen.getByRole('button', { name: '로그인' }));

      await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/mypage'));
      expect(authMock.logout).not.toHaveBeenCalled();
      expect(
        screen.getByText(
          '목 데모 로그인은 로그아웃할 때까지 유지됩니다. 로그인 상태 유지는 목 모드에 적용되지 않습니다.',
        ),
      ).toBeInTheDocument();
    },
  );

  it('returns a direct member login to home with the shared member session ready', async () => {
    const user = userEvent.setup();
    renderLoginPage(undefined, true);

    expect(screen.getByTestId('member-session')).toHaveTextContent('로그아웃');
    await user.type(screen.getByRole('textbox', { name: '이메일' }), 'member@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'password');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/'));
    expect(screen.getByTestId('member-session')).toHaveTextContent('테스트 회원');
  });

  it('shows the mock session guidance only in mock mode', () => {
    const mockView = renderLoginPage();

    expect(screen.getByText(/목 데모 로그인은 로그아웃할 때까지 유지됩니다/)).toBeInTheDocument();
    expect(
      screen.getByText('목 로그인은 화면 흐름 확인용이며 실제 인증은 처리되지 않습니다.'),
    ).toBeInTheDocument();

    mockView.unmount();
    apiModeMock.mode = 'real';
    renderLoginPage();
    expect(
      screen.queryByText(/목 데모 로그인은 로그아웃할 때까지 유지됩니다/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('목 로그인은 화면 흐름 확인용이며 실제 인증은 처리되지 않습니다.'),
    ).not.toBeInTheDocument();
  });

  it('preserves an admin mock session when remember login is unchecked', async () => {
    const user = userEvent.setup();
    authMock.login.mockResolvedValue({ role: 'admin', user: null });
    renderLoginPage();

    await user.type(screen.getByRole('textbox', { name: '이메일' }), 'admin@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'password');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/admin'));
    expect(authMock.logout).not.toHaveBeenCalled();
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

  it('does not render the brand logo image on the login page', () => {
    renderLoginPage();

    expect(screen.queryByAltText('안전맛집')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: '로그인' })).toBeInTheDocument();
  });
});

describe('W-09 login and signup tab transition', () => {
  const signupTabName = '회원가입';

  it('keeps the same tablist DOM node when switching to signup', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const tablistBefore = screen.getByRole('tablist', { name: '계정' });
    await user.click(screen.getByRole('tab', { name: signupTabName }));

    expect(screen.getByRole('tablist', { name: '계정' })).toBe(tablistBefore);
  });

  it('keeps focus on the signup tab after switching modes', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const signupTab = screen.getByRole('tab', { name: signupTabName });
    await user.click(signupTab);

    expect(signupTab).toHaveFocus();
  });

  it('shows the signup heading, one email field, and toggled aria-selected after switching', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('tab', { name: signupTabName }));

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('회원가입');
    expect(screen.queryByText('안전맛집 계정으로 로그인하세요.')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/목 데모 로그인은 로그아웃할 때까지 유지됩니다/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('목 로그인은 화면 흐름 확인용이며 실제 인증은 처리되지 않습니다.'),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('textbox', { name: '이메일' })).toHaveLength(1);
    expect(screen.getByRole('tab', { name: '로그인' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: signupTabName })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('keeps the login email value after a round trip through signup', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByRole('textbox', { name: '이메일' }), 'member@example.com');
    await user.click(screen.getByRole('tab', { name: signupTabName }));
    await user.click(screen.getByRole('tab', { name: '로그인' }));

    expect(screen.getByRole('textbox', { name: '이메일' })).toHaveValue('member@example.com');
  });

  it('switches to signup from the account help navigation link too', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('link', { name: signupTabName }));

    expect(screen.getByRole('heading', { level: 1, name: '회원가입' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: signupTabName })).toHaveFocus();
    expect(screen.getByRole('tab', { name: signupTabName })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('returns to the safe redirect path when a member signs up from the login screen', async () => {
    const user = userEvent.setup();
    authMock.isEmailAvailable.mockResolvedValue(true);
    authMock.signup.mockResolvedValue(member);
    renderLoginPage('/mypage');

    await user.click(screen.getByRole('tab', { name: signupTabName }));
    await user.type(screen.getByRole('textbox', { name: '이메일' }), 'new@example.com');
    await user.click(screen.getByRole('button', { name: '중복 확인' }));
    await waitFor(() => expect(authMock.isEmailAvailable).toHaveBeenCalledWith('new@example.com'));
    await user.type(screen.getByPlaceholderText('비밀번호를 입력해 주세요'), 'password123');
    await user.type(
      screen.getByPlaceholderText('비밀번호를 한 번 더 입력해 주세요'),
      'password123',
    );
    await user.type(screen.getByLabelText(/^이름/), '테스트 회원');
    await user.type(screen.getByLabelText(/^휴대폰 번호/), '01012345678');
    await user.click(screen.getByRole('button', { name: '인증번호 받기' }));

    const phoneCodeMessage = await screen.findByText(/목 인증번호 \d{6}/);
    const phoneCode = phoneCodeMessage.textContent?.match(/목 인증번호 (\d{6})/)?.[1];
    expect(phoneCode).toBeTruthy();
    await user.type(screen.getByRole('textbox', { name: '인증번호' }), phoneCode ?? '');
    await user.click(screen.getByRole('button', { name: '확인' }));
    await user.click(screen.getByRole('checkbox', { name: '[필수] 이용약관 동의' }));
    await user.click(screen.getByRole('checkbox', { name: '[필수] 개인정보 수집·이용 동의' }));
    await user.click(screen.getByRole('button', { name: '가입하기' }));

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/mypage'));
    expect(authMock.signup).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com', accountType: 'personal' }),
    );
  });

  it('returns to the login tab from the signup form login link and focuses it', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('tab', { name: signupTabName }));
    await user.click(screen.getByRole('link', { name: '로그인' }));

    expect(screen.getByRole('heading', { level: 1, name: '로그인' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '로그인' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '로그인' })).toHaveFocus();
  });

  it('keeps signup input values and terms consent across a tab round trip', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('tab', { name: signupTabName }));
    await user.type(screen.getByRole('textbox', { name: '이메일' }), 'new@example.com');
    await user.type(screen.getByLabelText(/^이름/), '테스트 회원');
    await user.click(screen.getByRole('checkbox', { name: '[필수] 이용약관 동의' }));
    await user.click(screen.getByRole('tab', { name: '로그인' }));
    await user.click(screen.getByRole('tab', { name: signupTabName }));

    expect(screen.getByRole('textbox', { name: '이메일' })).toHaveValue('new@example.com');
    expect(screen.getByLabelText(/^이름/)).toHaveValue('테스트 회원');
    expect(screen.getByRole('checkbox', { name: '[필수] 이용약관 동의' })).toBeChecked();
  });
  const modifierClicks = [
    { name: 'ctrl', init: { ctrlKey: true } },
    { name: 'meta', init: { metaKey: true } },
    { name: 'shift', init: { shiftKey: true } },
    { name: 'alt', init: { altKey: true } },
    { name: 'middle button', init: { button: 1 } },
  ];

  it.each(modifierClicks)(
    'leaves the embedded signup login link to the browser default for $name click',
    async ({ init }) => {
      const user = userEvent.setup();
      renderLoginPage('/mypage');

      await user.click(screen.getByRole('tab', { name: signupTabName }));
      const notPrevented = fireEvent.click(screen.getByRole('link', { name: '로그인' }), init);

      expect(notPrevented).toBe(true);
      expect(screen.getByRole('heading', { level: 1, name: signupTabName })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: signupTabName })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    },
  );

  it.each(modifierClicks)(
    'leaves the login screen signup nav link to the browser default for $name click',
    async ({ init }) => {
      renderLoginPage('/mypage');

      const notPrevented = fireEvent.click(screen.getByRole('link', { name: signupTabName }), init);

      expect(notPrevented).toBe(true);
      expect(screen.getByRole('heading', { level: 1, name: '로그인' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: '로그인' })).toHaveAttribute('aria-selected', 'true');
    },
  );
  it('clears the whole signup draft after a successful signup so the login screen keeps no personal data', async () => {
    const user = userEvent.setup();
    authMock.isEmailAvailable.mockResolvedValue(true);
    authMock.signup.mockResolvedValue(member);
    renderLoginPage('/mypage');

    await user.click(screen.getByRole('tab', { name: signupTabName }));
    await user.type(screen.getByRole('textbox', { name: '이메일' }), 'new@example.com');
    await user.click(screen.getByRole('button', { name: '중복 확인' }));
    await waitFor(() => expect(authMock.isEmailAvailable).toHaveBeenCalled());
    await user.type(screen.getByPlaceholderText('비밀번호를 입력해 주세요'), 'password123');
    await user.type(
      screen.getByPlaceholderText('비밀번호를 한 번 더 입력해 주세요'),
      'password123',
    );
    await user.type(screen.getByLabelText(/^이름/), '테스트 회원');
    await user.type(screen.getByLabelText(/^휴대폰 번호/), '01012345678');
    await user.click(screen.getByRole('button', { name: '인증번호 받기' }));
    const phoneCodeMessage = await screen.findByText(/목 인증번호 \d{6}/);
    const phoneCode = phoneCodeMessage.textContent?.match(/목 인증번호 (\d{6})/)?.[1];
    await user.type(screen.getByRole('textbox', { name: '인증번호' }), phoneCode ?? '');
    await user.click(screen.getByRole('button', { name: '확인' }));
    await user.click(screen.getByRole('checkbox', { name: '[필수] 이용약관 동의' }));
    await user.click(screen.getByRole('checkbox', { name: '[필수] 개인정보 수집·이용 동의' }));
    await user.click(screen.getByRole('button', { name: '가입하기' }));
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/mypage'));

    await user.click(screen.getByRole('tab', { name: '로그인' }));
    await user.click(screen.getByRole('tab', { name: signupTabName }));

    expect(screen.getByRole('textbox', { name: '이메일' })).toHaveValue('');
    expect(screen.getByLabelText(/^이름/)).toHaveValue('');
    expect(screen.getByLabelText(/^휴대폰 번호/)).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: '[필수] 이용약관 동의' })).not.toBeChecked();
  });

  it('submits the login and signup forms as POST forms', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    expect(screen.getByRole('button', { name: '로그인' }).closest('form')).toHaveAttribute(
      'method',
      'post',
    );
    await user.click(screen.getByRole('tab', { name: signupTabName }));
    expect(screen.getByRole('button', { name: '가입하기' }).closest('form')).toHaveAttribute(
      'method',
      'post',
    );
  });
  it('clears the signup password fields when switching tabs but keeps the email and terms consent', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('tab', { name: signupTabName }));
    await user.type(screen.getByRole('textbox', { name: '이메일' }), 'new@example.com');
    await user.type(screen.getByPlaceholderText('비밀번호를 입력해 주세요'), 'password123');
    await user.type(
      screen.getByPlaceholderText('비밀번호를 한 번 더 입력해 주세요'),
      'password123',
    );
    await user.click(screen.getByRole('checkbox', { name: '[필수] 이용약관 동의' }));
    await user.click(screen.getByRole('tab', { name: '로그인' }));
    await user.click(screen.getByRole('tab', { name: signupTabName }));

    expect(screen.getByPlaceholderText('비밀번호를 입력해 주세요')).toHaveValue('');
    expect(screen.getByPlaceholderText('비밀번호를 한 번 더 입력해 주세요')).toHaveValue('');
    expect(screen.getByRole('textbox', { name: '이메일' })).toHaveValue('new@example.com');
    expect(screen.getByRole('checkbox', { name: '[필수] 이용약관 동의' })).toBeChecked();
  });

  it('clears the phone verification code and issued code when switching tabs but keeps the phone number', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('tab', { name: signupTabName }));
    await user.type(screen.getByLabelText(/^휴대폰 번호/), '01012345678');
    await user.click(screen.getByRole('button', { name: '인증번호 받기' }));
    const issuedMessage = await screen.findByText(/목 인증번호 \d{6}/);
    const issuedCode = issuedMessage.textContent?.match(/목 인증번호 (\d{6})/)?.[1] ?? '';
    await user.type(screen.getByRole('textbox', { name: '인증번호' }), issuedCode);
    await user.click(screen.getByRole('tab', { name: '로그인' }));
    await user.click(screen.getByRole('tab', { name: signupTabName }));

    expect(screen.getByRole('textbox', { name: '인증번호' })).toHaveValue('');
    expect(screen.queryByText(/목 인증번호 \d{6}/)).not.toBeInTheDocument();
    expect(screen.queryByText(/목 인증번호를 만들었습니다/)).not.toBeInTheDocument();
    expect(screen.getByText('남은 시간 03:00')).toBeInTheDocument();
    expect(screen.getByLabelText(/^휴대폰 번호/)).toHaveValue('01012345678');
  });

  it('clears the login password when moving to signup so it does not carry over', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByRole('textbox', { name: '이메일' }), 'member@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'loginpass');
    await user.click(screen.getByRole('tab', { name: signupTabName }));
    await user.click(screen.getByRole('tab', { name: '로그인' }));

    expect(screen.getByLabelText('비밀번호')).toHaveValue('');
    expect(screen.getByRole('textbox', { name: '이메일' })).toHaveValue('member@example.com');
  });
});
