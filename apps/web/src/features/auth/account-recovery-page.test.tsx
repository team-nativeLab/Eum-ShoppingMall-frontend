import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountRecoveryPage } from './account-recovery-page';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('계정 복구 데모 화면', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('이메일 찾기는 입력값을 지우고 계정 존재 여부나 주소를 공개하지 않습니다', async () => {
    const user = userEvent.setup();
    render(<AccountRecoveryPage mode="email" />);

    await user.type(screen.getByRole('textbox', { name: '이름' }), '홍길동');
    await user.type(screen.getByRole('textbox', { name: '휴대폰 번호' }), '01012345678');
    await user.click(screen.getByRole('button', { name: '이메일 찾기' }));

    expect(await screen.findByText('요청 내용을 확인했습니다.')).toBeInTheDocument();
    expect(
      screen.getByText(/계정 존재 여부나 이메일·휴대폰 번호를 안내하지 않습니다/),
    ).toBeInTheDocument();
    expect(screen.queryByText('01012345678')).not.toBeInTheDocument();
    expect(screen.queryByText('홍길동')).not.toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
  });

  it('비밀번호 재설정 화면은 완료 후 입력값을 비우고 실제 변경이 없음을 표시합니다', async () => {
    const user = userEvent.setup();
    render(<AccountRecoveryPage mode="password" />);

    await user.type(screen.getByRole('textbox', { name: '이름' }), '홍길동');
    await user.type(
      screen.getByRole('textbox', { name: '이메일 또는 휴대폰 번호' }),
      'person@example.com',
    );
    await user.click(screen.getByRole('button', { name: '비밀번호 찾기' }));
    await user.click(screen.getByRole('button', { name: '데모 재설정 화면 보기' }));
    const passwordField = screen.getByLabelText('새 비밀번호');
    const confirmationField = screen.getByLabelText('새 비밀번호 확인');
    await user.type(passwordField, 'password123');
    await user.type(confirmationField, 'password123');
    await user.click(screen.getByRole('button', { name: '데모 완료' }));

    expect(await screen.findByText('데모 흐름이 완료되었습니다.')).toBeInTheDocument();
    expect(
      screen.getByText('실제 비밀번호는 변경되지 않았습니다. 기존 계정 정보를 계속 사용해 주세요.'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('새 비밀번호')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('새 비밀번호 확인')).not.toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
  });

  it('빠른 중복 제출에도 결과는 같은 일반 응답으로 끝납니다', async () => {
    const user = userEvent.setup();
    render(<AccountRecoveryPage mode="email" />);
    await user.type(screen.getByRole('textbox', { name: '이름' }), '이름');
    await user.type(screen.getByRole('textbox', { name: '휴대폰 번호' }), '01012345678');
    const form = screen.getByRole('button', { name: '이메일 찾기' }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    fireEvent.submit(form!);
    expect(await screen.findByText('요청 내용을 확인했습니다.')).toBeInTheDocument();
    expect(screen.queryByLabelText('이름')).not.toBeInTheDocument();
  });

  it('필드 오류를 입력에 연결하고 첫 오류 입력에 포커스를 둡니다', async () => {
    const user = userEvent.setup();
    render(<AccountRecoveryPage mode="email" rawRedirect="/mypage/claims/clm-001" />);

    await user.click(screen.getByRole('button', { name: '이메일 찾기' }));

    const nameField = screen.getByRole('textbox', { name: '이름' });
    const contactField = screen.getByRole('textbox', { name: '휴대폰 번호' });
    expect(nameField).toHaveAttribute('aria-invalid', 'true');
    expect(
      document.getElementById(nameField.getAttribute('aria-describedby') ?? ''),
    ).toHaveTextContent('이름을 입력해 주세요.');
    expect(contactField).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(nameField).toHaveFocus());
    expect(contactField).toHaveAttribute('type', 'tel');
    expect(contactField).toHaveAttribute('autocomplete', 'tel');
    expect(screen.getByRole('link', { name: '로그인으로' })).toHaveAttribute(
      'href',
      '/login?redirect=%2Fmypage%2Fclaims%2Fclm-001',
    );
  });

  it('복구 링크의 외부 redirect는 내부 루트로 정리합니다', () => {
    render(<AccountRecoveryPage mode="password" rawRedirect="https://attacker.example" />);

    expect(screen.getByRole('link', { name: '로그인으로' })).toHaveAttribute(
      'href',
      '/login?redirect=%2F',
    );
    expect(screen.getByRole('link', { name: '이메일 찾기' })).toHaveAttribute(
      'href',
      '/account/find-email?redirect=%2F',
    );
  });
});
