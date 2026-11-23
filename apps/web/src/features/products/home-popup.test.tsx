import type { ShopPopup } from '@eum/api/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePopup } from './home-popup';

const shopMocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/lib/shop-api', () => ({
  getShopApi: async () => ({ popups: { list: shopMocks.list } }),
}));

const fixturePopup: ShopPopup = {
  id: 'popup-demo',
  title: '현장 안전 안내',
  imageUrl: '/assets/web/hero-v3.webp',
  body: '현장에 필요한 안전용품을 살펴보세요.',
};

function renderPopup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <HomePopup />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  shopMocks.list.mockReset().mockResolvedValue([fixturePopup]);
});

describe('HomePopup', () => {
  it('keeps a previously hidden session popup closed during hydration and shows it in a fresh session', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['popups'], [fixturePopup]);
    const app = (
      <QueryClientProvider client={queryClient}>
        <HomePopup />
      </QueryClientProvider>
    );
    const container = document.createElement('div');
    container.innerHTML = renderToString(app);
    document.body.append(container);

    expect(container.querySelector('dialog')).not.toHaveAttribute('open');

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, app);
    });
    await waitFor(() => expect(container.querySelector('dialog')).toHaveAttribute('open'));

    await act(async () => root?.unmount());
    container.remove();
  });

  it('does not flash a popup hidden earlier in the tab session during hydration', async () => {
    window.sessionStorage.setItem('eum-home-popup-hidden', 'hidden');
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['popups'], [fixturePopup]);
    const app = (
      <QueryClientProvider client={queryClient}>
        <HomePopup />
      </QueryClientProvider>
    );
    const container = document.createElement('div');
    container.innerHTML = renderToString(app);
    document.body.append(container);

    expect(container.querySelector('dialog')).not.toHaveAttribute('open');

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, app);
    });
    expect(container.querySelector('dialog')).not.toHaveAttribute('open');

    await act(async () => root?.unmount());
    container.remove();
  });

  it('closes only the current display from the X and shows again on the next home visit', async () => {
    const firstRender = renderPopup();
    const dialog = await screen.findByRole('dialog', { name: fixturePopup.title });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveClass('max-w-864', 'overflow-y-auto');
    expect(screen.getByRole('img', { name: fixturePopup.title })).toHaveAttribute(
      'src',
      fixturePopup.imageUrl,
    );
    expect(screen.getByText(fixturePopup.body)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '팝업 닫기' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(window.sessionStorage.getItem('eum-home-popup-hidden')).toBeNull();

    firstRender.unmount();
    renderPopup();
    expect(await screen.findByRole('dialog', { name: fixturePopup.title })).toBeInTheDocument();
  });

  it('keeps the home popup absent when the mock returns an empty list or an error', async () => {
    shopMocks.list.mockResolvedValueOnce([]);
    const emptyRender = renderPopup();
    await waitFor(() => expect(shopMocks.list).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    emptyRender.unmount();

    shopMocks.list.mockRejectedValueOnce(new Error('mock unavailable'));
    const errorRender = renderPopup();
    await waitFor(() => expect(shopMocks.list).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    errorRender.unmount();
  });

  it('hides for the tab session and shows again in a new tab session', async () => {
    const firstRender = renderPopup();
    await screen.findByRole('dialog', { name: fixturePopup.title });

    fireEvent.click(screen.getByRole('button', { name: '다시 보지 않기' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(window.sessionStorage.getItem('eum-home-popup-hidden')).toBe('hidden');

    firstRender.unmount();
    const hiddenSessionRender = renderPopup();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    window.sessionStorage.clear();
    hiddenSessionRender.unmount();
    renderPopup();
    expect(await screen.findByRole('dialog', { name: fixturePopup.title })).toBeInTheDocument();
  });
});
