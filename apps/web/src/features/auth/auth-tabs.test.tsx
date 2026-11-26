import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AuthTabs } from './auth-tabs';

describe('AuthTabs', () => {
  it('marks only the tab that matches value as selected', () => {
    render(<AuthTabs value="signup" onChange={vi.fn()} />);

    expect(screen.getByRole('tab', { name: '로그인' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: '회원가입' })).toHaveAttribute('aria-selected', 'true');
  });

  it('calls onChange once with the other value when an unselected tab is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AuthTabs value="login" onChange={onChange} />);

    await user.click(screen.getByRole('tab', { name: '회원가입' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('signup');
  });

  it('does not call onChange when the already selected tab is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AuthTabs value="login" onChange={onChange} />);

    await user.click(screen.getByRole('tab', { name: '로그인' }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('selects the focused tab with Enter and Space', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AuthTabs value="login" onChange={onChange} />);

    screen.getByRole('tab', { name: '회원가입' }).focus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('signup');

    onChange.mockClear();
    screen.getByRole('tab', { name: '회원가입' }).focus();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith('signup');
  });

  it('renders the sliding indicator first, hidden from assistive tech, without images or svg', () => {
    render(<AuthTabs value="login" onChange={vi.fn()} />);

    const tablist = screen.getByRole('tablist', { name: '계정' });
    const indicator = tablist.firstElementChild;
    expect(indicator).toBeInstanceOf(HTMLSpanElement);
    expect(indicator).toHaveAttribute('aria-hidden', 'true');
    expect(indicator?.querySelector('img, svg')).toBeNull();
    expect(indicator?.nextElementSibling).toBe(screen.getByRole('tab', { name: '로그인' }));
  });

  it('keeps the tab elements mounted while the selected value changes', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = useState<'login' | 'signup'>('login');
      return <AuthTabs value={value} onChange={setValue} />;
    }
    render(<Harness />);

    const loginTab = screen.getByRole('tab', { name: '로그인' });
    await user.click(screen.getByRole('tab', { name: '회원가입' }));

    expect(screen.getByRole('tab', { name: '로그인' })).toBe(loginTab);
    expect(loginTab).toHaveAttribute('aria-selected', 'false');
  });
});
