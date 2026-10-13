import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, buttonClassName } from './Button';

describe('Button', () => {
  it('기본 type은 button이라 폼을 제출하지 않습니다', () => {
    render(<Button>저장</Button>);
    expect(screen.getByRole('button', { name: '저장' })).toHaveAttribute('type', 'button');
  });

  it('비활성화되면 클릭 콜백을 부르지 않습니다', async () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        바로 구매
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: '바로 구매' }));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('변형·크기 className을 적용합니다', () => {
    render(
      <Button variant="danger" size="l">
        정지
      </Button>,
    );
    const dangerButton = screen.getByRole('button', { name: '정지' });
    expect(dangerButton).toHaveClass('bg-danger', 'h-56');
  });

  it('기본 버튼은 줄지 않고, 전체 폭 버튼은 부모 폭 안에서 줄어들 수 있습니다', () => {
    render(
      <>
        <Button>기본</Button>
        <Button isFullWidth>전체 폭</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: '기본' })).toHaveClass('shrink-0');
    const fullWidthButton = screen.getByRole('button', { name: '전체 폭' });
    expect(fullWidthButton).toHaveClass('w-full', 'min-w-0');
    expect(fullWidthButton).not.toHaveClass('shrink-0');
  });
});

describe('buttonClassName — 링크에 적용', () => {
  it('링크에서도 hover가 동작하도록 :enabled에 묶지 않습니다', () => {
    const linkClassName = buttonClassName({ variant: 'secondary' });
    expect(linkClassName).toContain('hover:not-disabled:not-aria-disabled:bg-surface');
    expect(linkClassName).not.toContain('enabled:hover');
  });

  it('aria-disabled 링크는 시각 표시만 바뀌고 포커스 이동은 호출부가 막아야 합니다', () => {
    render(
      <a href="/cart" aria-disabled="true" className={buttonClassName()}>
        장바구니
      </a>,
    );
    const disabledLink = screen.getByRole('link', { name: '장바구니' });
    expect(disabledLink).toHaveClass('aria-disabled:pointer-events-none');
    disabledLink.focus();
    expect(disabledLink).toHaveFocus();
  });
});
