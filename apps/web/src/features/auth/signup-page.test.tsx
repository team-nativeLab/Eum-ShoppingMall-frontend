import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
});
