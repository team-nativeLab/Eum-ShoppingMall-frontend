import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PasswordChangeDemoModal } from './password-change-demo-modal';

function getInputErrorTextId(input: HTMLElement) {
  return input.getAttribute('aria-describedby')?.split(' ') ?? [];
}

describe('비밀번호 변경 데모 모달 오류 연결', () => {
  it('짧은 새 비밀번호 오류를 새 비밀번호 입력에 연결합니다', async () => {
    const user = userEvent.setup();
    render(<PasswordChangeDemoModal isOpen onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: '비밀번호 변경' });
    const newPassword = within(dialog).getByLabelText('새 비밀번호');
    const confirmation = within(dialog).getByLabelText('새 비밀번호 확인');
    await user.type(newPassword, 'short');
    await user.type(confirmation, 'short');
    await user.click(within(dialog).getByRole('button', { name: '데모 확인' }));

    const error = within(dialog).getByText('새 비밀번호는 8자 이상 입력해 주세요.');
    expect(newPassword).toHaveAttribute('aria-invalid', 'true');
    expect(getInputErrorTextId(newPassword)).toContain(error.id);
    expect(confirmation).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('불일치 오류를 비밀번호 확인 입력에 연결합니다', async () => {
    const user = userEvent.setup();
    render(<PasswordChangeDemoModal isOpen onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: '비밀번호 변경' });
    const newPassword = within(dialog).getByLabelText('새 비밀번호');
    const confirmation = within(dialog).getByLabelText('새 비밀번호 확인');
    await user.type(newPassword, 'password-1');
    await user.type(confirmation, 'password-2');
    await user.click(within(dialog).getByRole('button', { name: '데모 확인' }));

    const error = within(dialog).getByText('새 비밀번호와 확인 내용이 일치하지 않습니다.');
    expect(newPassword).not.toHaveAttribute('aria-invalid', 'true');
    expect(confirmation).toHaveAttribute('aria-invalid', 'true');
    expect(getInputErrorTextId(confirmation)).toContain(error.id);
  });
});
