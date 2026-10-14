import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PageErrorState } from './mypage-ui';

describe('PageErrorState', () => {
  it('announces query errors and keeps the retry action available', () => {
    const onRetry = vi.fn();
    render(<PageErrorState onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('정보를 불러오지 못했습니다.');
    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
