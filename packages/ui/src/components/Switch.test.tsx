import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Switch } from './Switch';

describe('Switch', () => {
  it('switch 역할과 켜짐 상태를 알리고 누르면 반대 값을 넘깁니다', async () => {
    const handleCheckedChange = vi.fn();
    render(
      <Switch
        label="금액 표시"
        isChecked
        onCheckedChange={handleCheckedChange}
        onText="표시"
        offText="미표시"
      />,
    );
    const priceSwitch = screen.getByRole('switch', { name: '금액 표시' });
    expect(priceSwitch).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(priceSwitch);
    expect(handleCheckedChange).toHaveBeenCalledWith(false);
  });

  it('반영 중에는 포커스를 유지한 채 누름을 무시합니다', async () => {
    const handleCheckedChange = vi.fn();
    render(
      <Switch
        label="금액 표시"
        isChecked={false}
        isPending
        onCheckedChange={handleCheckedChange}
      />,
    );
    const priceSwitch = screen.getByRole('switch', { name: '금액 표시' });
    expect(priceSwitch).not.toBeDisabled();
    expect(priceSwitch).toHaveAttribute('aria-disabled', 'true');
    expect(priceSwitch).toHaveAttribute('aria-busy', 'true');
    priceSwitch.focus();
    await userEvent.click(priceSwitch);
    await userEvent.keyboard('[Space]');
    expect(handleCheckedChange).not.toHaveBeenCalled();
    expect(priceSwitch).toHaveFocus();
  });

  it('isDisabled이면 네이티브 disabled입니다', () => {
    render(<Switch label="금액 표시" isChecked isDisabled onCheckedChange={() => undefined} />);
    expect(screen.getByRole('switch', { name: '금액 표시' })).toBeDisabled();
  });
});
