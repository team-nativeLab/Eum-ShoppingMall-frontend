import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SelectField, TextField } from './TextField';

describe('TextField', () => {
  it('라벨과 입력이 연결됩니다', () => {
    render(<TextField label="이메일" helperText="로그인에 사용합니다." />);
    const emailInput = screen.getByRole('textbox', { name: '이메일' });
    expect(emailInput).toHaveAccessibleDescription('로그인에 사용합니다.');
  });

  it('오류 메시지가 있으면 aria-invalid와 설명을 연결합니다', () => {
    render(<TextField label="휴대폰 번호" errorMessage="올바른 형식으로 입력해 주십시오." />);
    const phoneInput = screen.getByLabelText('휴대폰 번호');
    expect(phoneInput).toHaveAttribute('aria-invalid', 'true');
    expect(phoneInput).toHaveAccessibleDescription('올바른 형식으로 입력해 주십시오.');
  });

  it('opt-in 필수 표시는 접근 가능한 라벨에서 숨기고 native required는 유지합니다', () => {
    render(<TextField label="이메일" showRequiredIndicator required />);

    const emailInput = screen.getByRole('textbox', { name: '이메일' });
    const label = screen.getByText('이메일', { selector: 'label' });
    const requiredIndicator = label.querySelector('span[aria-hidden="true"]');

    expect(emailInput).toBeRequired();
    expect(requiredIndicator).toHaveTextContent('*');
    expect(requiredIndicator).toHaveClass('ml-4', 'text-danger');
  });

  it('필수 표시 opt-in이 없으면 별표를 추가하지 않고 전달된 라벨 문자열은 그대로 둡니다', () => {
    render(<TextField label="관리자 *" required />);

    const adminInput = screen.getByLabelText('관리자 *');
    const label = screen.getByText('관리자 *', { selector: 'label' });

    expect(adminInput).toBeRequired();
    expect(label.querySelector('span[aria-hidden="true"]')).toBeNull();
  });
});

describe('SelectField', () => {
  it('opt-in 필수 표시를 같은 스타일로 렌더링하고 native 필수 상태를 유지합니다', () => {
    render(
      <SelectField
        label="문의 유형"
        showRequiredIndicator
        required
        options={[{ value: 'delivery', label: '배송' }]}
      />,
    );

    const inquiryType = screen.getByRole('combobox', { name: '문의 유형' });
    const label = screen.getByText('문의 유형', { selector: 'label' });
    const requiredIndicator = label.querySelector('span[aria-hidden="true"]');

    expect(inquiryType).toBeRequired();
    expect(requiredIndicator).toHaveTextContent('*');
    expect(requiredIndicator).toHaveClass('ml-4', 'text-danger');
  });

  it('opt-in이 없는 선택 필드에는 별표를 추가하지 않습니다', () => {
    render(
      <SelectField label="주문 선택 (선택)" options={[{ value: 'order-1', label: '주문 1' }]} />,
    );

    const orderSelect = screen.getByLabelText('주문 선택 (선택)');
    const label = screen.getByText('주문 선택 (선택)', { selector: 'label' });

    expect(orderSelect).not.toBeRequired();
    expect(label.querySelector('span[aria-hidden="true"]')).toBeNull();
  });
});
