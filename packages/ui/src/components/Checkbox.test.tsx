import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('라벨을 눌러 체크할 수 있습니다', async () => {
    render(<Checkbox>전체 선택</Checkbox>);
    const selectAllCheckbox = screen.getByRole('checkbox', { name: '전체 선택' });
    await userEvent.click(screen.getByText('전체 선택'));
    expect(selectAllCheckbox).toBeChecked();
  });

  it('일부 선택 상태는 네이티브 indeterminate로만 알립니다', () => {
    render(<Checkbox isIndeterminate>전체 선택</Checkbox>);
    const selectAllCheckbox = screen.getByRole<HTMLInputElement>('checkbox', { name: '전체 선택' });
    expect(selectAllCheckbox.indeterminate).toBe(true);
    expect(selectAllCheckbox).not.toHaveAttribute('aria-checked');
    expect(selectAllCheckbox).toBePartiallyChecked();
  });

  it('비활성+체크 상태에서도 체크 상태를 유지하고 누를 수 없습니다', async () => {
    render(
      <Checkbox disabled defaultChecked>
        약관 동의
      </Checkbox>,
    );
    const agreeCheckbox = screen.getByRole('checkbox', { name: '약관 동의' });
    await userEvent.click(screen.getByText('약관 동의'));
    expect(agreeCheckbox).toBeChecked();
    expect(agreeCheckbox).toBeDisabled();
  });

  it('작은 facet 체크박스만 16px 상자를 쓰고 기본 체크박스는 20px를 유지합니다', () => {
    const { container } = render(
      <>
        <Checkbox size="small" className="h-32">
          브랜드 필터
        </Checkbox>
        <Checkbox>기본 체크박스</Checkbox>
      </>,
    );

    const visibleBoxes = container.querySelectorAll('span[aria-hidden="true"]');
    expect(visibleBoxes[0]).toHaveClass('size-16');
    expect(visibleBoxes[1]).toHaveClass('size-20');
    expect(visibleBoxes[0]).toHaveClass('peer-focus-visible:outline-2');
    expect(screen.getByRole('checkbox', { name: '브랜드 필터' }).closest('label')).toHaveClass(
      'h-32',
    );
  });
});
