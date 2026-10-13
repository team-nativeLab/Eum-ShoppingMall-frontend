import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextField } from './TextField';

describe('TextField', () => {
  it('라벨과 입력이 연결됩니다', () => {
    render(<TextField label="이메일" helperText="로그인에 사용합니다." />);
    const emailInput = screen.getByLabelText('이메일');
    expect(emailInput).toHaveAccessibleDescription('로그인에 사용합니다.');
  });

  it('오류 메시지가 있으면 aria-invalid와 설명을 연결합니다', () => {
    render(<TextField label="휴대폰 번호" errorMessage="올바른 형식으로 입력해 주십시오." />);
    const phoneInput = screen.getByLabelText('휴대폰 번호');
    expect(phoneInput).toHaveAttribute('aria-invalid', 'true');
    expect(phoneInput).toHaveAccessibleDescription('올바른 형식으로 입력해 주십시오.');
  });
});
