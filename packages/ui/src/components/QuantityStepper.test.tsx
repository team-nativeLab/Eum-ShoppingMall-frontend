import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { QuantityStepper } from './QuantityStepper';

// 상태를 가진 테스트용 래퍼
function StatefulStepper({ initialValue, max }: { initialValue: number; max?: number }) {
  const [quantity, setQuantity] = useState(initialValue);
  return (
    <QuantityStepper label="상품 수량" value={quantity} onValueChange={setQuantity} max={max} />
  );
}

describe('QuantityStepper', () => {
  it('하한에서는 줄이기 버튼이 비활성화됩니다', () => {
    render(<StatefulStepper initialValue={1} />);
    expect(screen.getByRole('button', { name: '수량 줄이기' })).toBeDisabled();
  });

  it('늘리기·줄이기로 값이 바뀌고 상한에서 멈춥니다', async () => {
    render(<StatefulStepper initialValue={1} max={2} />);
    const increaseButton = screen.getByRole('button', { name: '수량 늘리기' });
    await userEvent.click(increaseButton);
    expect(screen.getByRole('status')).toHaveTextContent('2');
    expect(increaseButton).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: '수량 줄이기' }));
    expect(screen.getByRole('status')).toHaveTextContent('1');
  });

  it('그룹 이름을 가집니다', () => {
    render(<StatefulStepper initialValue={3} />);
    expect(screen.getByRole('group', { name: '상품 수량' })).toBeInTheDocument();
  });
});
