import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignupPageView } from './signup-page';

const authMock = vi.hoisted(() => ({ isEmailAvailable: vi.fn(), signup: vi.fn() }));

vi.mock('@/lib/member-auth', () => ({
  getMemberAuth: vi.fn().mockResolvedValue(authMock),
}));
vi.mock('./member-session', () => ({ useMemberSession: () => ({ setMember: vi.fn() }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));

describe('SignupPageView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.isEmailAvailable.mockResolvedValue(true);
    authMock.signup.mockResolvedValue({
      id: 'mem-signup-test',
      email: 'member@example.com',
      name: '테스트 회원',
      phone: '01012345678',
      joinedAt: '2026-11-22T00:00:00+09:00',
      pointBalance: 0,
      accountType: 'personal',
    });
  });

  it('six required labels show danger markers while accessible names and required states remain clear', () => {
    render(<SignupPageView />);

    const nativeRequiredFields = [
      { name: 'email', label: '이메일' },
      { name: 'password', label: '비밀번호' },
      { name: 'passwordConfirmation', label: '비밀번호 확인' },
      { name: 'name', label: '이름' },
      { name: 'phone', label: '휴대폰 번호' },
    ];
    for (const { name, label } of nativeRequiredFields) {
      const field = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      if (!field) throw new Error(`필수 입력 필드를 찾지 못했습니다: ${name}`);
      const fieldLabel = field.parentElement?.querySelector('label');
      const requiredIndicator = fieldLabel?.querySelector('span[aria-hidden="true"]');

      expect(field).toBeRequired();
      expect(field).toHaveAccessibleName(label);
      expect(requiredIndicator).toHaveTextContent('*');
      expect(requiredIndicator).toHaveClass('ml-4', 'text-danger');
    }

    const verificationCode = document.querySelector<HTMLInputElement>(
      'input[name="verificationCode"]',
    );
    if (!verificationCode) throw new Error('인증번호 필드를 찾지 못했습니다.');
    const verificationLabel = verificationCode.parentElement?.querySelector('label');
    const verificationIndicator = verificationLabel?.querySelector('span[aria-hidden="true"]');

    expect(verificationLabel).toHaveClass('sr-only');
    expect(verificationCode).toHaveAccessibleName('인증번호');
    expect(verificationCode).toHaveAttribute('aria-required', 'true');
    expect(verificationCode).not.toHaveAttribute('required');
    expect(verificationIndicator).toHaveTextContent('*');
    expect(verificationIndicator).toHaveClass('ml-4', 'text-danger');
    expect(screen.getAllByText('*', { selector: 'label span[aria-hidden="true"]' })).toHaveLength(
      6,
    );
  });

  it('keeps required terms copy and blocks submission when required terms are not accepted', () => {
    render(<SignupPageView />);

    expect(screen.queryByText('회원 유형')).not.toBeInTheDocument();
    expect(screen.queryByText('개인 회원')).not.toBeInTheDocument();
    expect(screen.queryByText('사업자 회원')).not.toBeInTheDocument();

    expect(screen.getByRole('checkbox', { name: '[필수] 이용약관 동의' })).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: '[필수] 개인정보 수집·이용 동의' }),
    ).not.toBeChecked();
    fireEvent.submit(screen.getByRole('button', { name: '가입하기' }).closest('form')!);

    expect(screen.getByRole('alert')).toHaveTextContent(
      '이메일 확인, 비밀번호 조건, 휴대폰 확인과 필수 약관 동의를 완료해 주세요.',
    );
  });

  it('submits only a personal account after the required checks and consents', async () => {
    const user = userEvent.setup();
    render(<SignupPageView />);

    await user.type(screen.getByRole('textbox', { name: '이메일' }), 'member@example.com');
    await user.click(screen.getByRole('button', { name: '중복 확인' }));
    await waitFor(() =>
      expect(authMock.isEmailAvailable).toHaveBeenCalledWith('member@example.com'),
    );
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

    await waitFor(() => expect(authMock.signup).toHaveBeenCalled());
    expect(authMock.signup).toHaveBeenCalledWith({
      email: 'member@example.com',
      password: 'password123',
      name: '테스트 회원',
      phone: '01012345678',
      accountType: 'personal',
    });
  });

  it('renders the /signup route without account tabs and with a single page heading', () => {
    render(<SignupPageView />);

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('회원가입');
    expect(headings[0]?.closest('section')).toHaveClass('max-w-480');
  });

  it('links back to /login from the standalone signup route', () => {
    render(<SignupPageView />);

    expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute(
      'href',
      '/login?redirect=%2F',
    );
  });

  it('shows a duplicate email result on the field and in a live status region, not in the bottom message', async () => {
    const user = userEvent.setup();
    authMock.isEmailAvailable.mockResolvedValueOnce(false);
    render(<SignupPageView />);

    const emailInput = screen.getByRole('textbox', { name: '이메일' });
    await user.type(emailInput, 'member@example.com');
    await user.click(screen.getByRole('button', { name: '중복 확인' }));

    const duplicateMessage = '이미 사용 중인 이메일입니다. 다른 이메일을 입력해 주세요.';
    await waitFor(() => expect(emailInput).toHaveAttribute('aria-invalid', 'true'));
    expect(
      document.getElementById(emailInput.getAttribute('aria-describedby') ?? ''),
    ).toHaveTextContent(duplicateMessage);
    expect(screen.getByText(duplicateMessage, { selector: '[role="status"]' })).toBeInTheDocument();
    expect(
      screen.queryByText(/이메일/, { selector: 'p[aria-live="polite"]:not([role="status"])' }),
    ).not.toBeInTheDocument();
  });

  it('shows an available email result on the field and in the status region with the unified wording only', async () => {
    const user = userEvent.setup();
    render(<SignupPageView />);

    const emailInput = screen.getByRole('textbox', { name: '이메일' });
    await user.type(emailInput, 'member@example.com');
    await user.click(screen.getByRole('button', { name: '중복 확인' }));

    await waitFor(() =>
      expect(
        screen.getByText('사용 가능한 이메일입니다.', { selector: '[role="status"]' }),
      ).toBeInTheDocument(),
    );
    expect(emailInput).not.toHaveAttribute('aria-invalid');
    expect(
      document.getElementById(emailInput.getAttribute('aria-describedby') ?? ''),
    ).toHaveTextContent('사용 가능한 이메일입니다.');
    expect(screen.queryByText('사용할 수 있는 이메일입니다.')).not.toBeInTheDocument();
  });

  it('clears the email result from the field and the status region when the email changes', async () => {
    const user = userEvent.setup();
    authMock.isEmailAvailable.mockResolvedValueOnce(false);
    render(<SignupPageView />);

    const emailInput = screen.getByRole('textbox', { name: '이메일' });
    await user.type(emailInput, 'member@example.com');
    await user.click(screen.getByRole('button', { name: '중복 확인' }));
    const duplicateMessage = '이미 사용 중인 이메일입니다. 다른 이메일을 입력해 주세요.';
    await waitFor(() => expect(emailInput).toHaveAttribute('aria-invalid', 'true'));

    await user.type(emailInput, 'x');

    expect(emailInput).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText(duplicateMessage)).not.toBeInTheDocument();
    expect(screen.queryByText('사용 가능한 이메일입니다.')).not.toBeInTheDocument();

    await user.keyboard('{Backspace}');

    expect(emailInput).toHaveValue('member@example.com');
    expect(emailInput).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText(duplicateMessage)).not.toBeInTheDocument();
    expect(
      screen.queryByText(duplicateMessage, { selector: '[role="status"]' }),
    ).not.toBeInTheDocument();
  });

  it('shows a failed email check in the bottom error and keeps the email result empty', async () => {
    const user = userEvent.setup();
    authMock.isEmailAvailable.mockRejectedValueOnce(new Error('network down'));
    render(<SignupPageView />);

    await user.type(screen.getByRole('textbox', { name: '이메일' }), 'member@example.com');
    await user.click(screen.getByRole('button', { name: '중복 확인' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '이메일을 확인하지 못했습니다. 다시 시도해 주세요.',
    );
    expect(
      screen.queryByText(/사용 가능한 이메일입니다|이미 사용 중인 이메일입니다/),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '이메일' })).not.toHaveAttribute('aria-invalid');
  });

  it('ignores a late email check failure for an email the user has already changed', async () => {
    const user = userEvent.setup();
    let rejectPendingCheck: (reason: Error) => void = () => undefined;
    authMock.isEmailAvailable.mockReturnValueOnce(
      new Promise<boolean>((_resolve, reject) => {
        rejectPendingCheck = reject;
      }),
    );
    render(<SignupPageView />);

    const emailInput = screen.getByRole('textbox', { name: '이메일' });
    await user.type(emailInput, 'first@example.com');
    await user.click(screen.getByRole('button', { name: '중복 확인' }));
    await user.type(emailInput, 'x');
    await act(async () => rejectPendingCheck(new Error('network down')));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not show a previous duplicate result after the email has been edited back', async () => {
    // 키 입력마다 결과가 지워지므로 이 경로로는 옛 결과가 화면에 나오지 않습니다.
    // 가드가 실제로 막는 것은 실패 응답 경로이며, 이는 'ignores a late email check failure' 테스트가 확인합니다.
    const user = userEvent.setup();
    let resolvePendingCheck: (isAvailable: boolean) => void = () => undefined;
    authMock.isEmailAvailable.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolvePendingCheck = resolve;
      }),
    );
    render(<SignupPageView />);

    const emailInput = screen.getByRole('textbox', { name: '이메일' });
    await user.type(emailInput, 'first@example.com');
    await user.click(screen.getByRole('button', { name: '중복 확인' }));
    await user.type(emailInput, 'x');
    await act(async () => resolvePendingCheck(false));

    expect(emailInput).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText(/이미 사용 중인 이메일입니다/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/이미 사용 중인 이메일입니다/, { selector: '[role="status"]' }),
    ).not.toBeInTheDocument();

    await user.keyboard('{Backspace}');

    expect(emailInput).toHaveValue('first@example.com');
    expect(emailInput).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText(/이미 사용 중인 이메일입니다/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/이미 사용 중인 이메일입니다/, { selector: '[role="status"]' }),
    ).not.toBeInTheDocument();
  });
});
