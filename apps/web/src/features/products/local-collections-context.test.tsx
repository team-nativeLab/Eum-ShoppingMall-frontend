import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalCollectionsProvider, useLocalCollections } from './local-collections-context';

function RecentCollectionProbe() {
  const { recentIds, recentViewedAt, removeRecent, clearRecent, recordRecent } =
    useLocalCollections();
  return (
    <div>
      <p>최근 {recentIds.join(',')}</p>
      <p>날짜 {Object.keys(recentViewedAt).join(',')}</p>
      <button type="button" onClick={() => removeRecent('product-a')}>
        하나 삭제
      </button>
      <button type="button" onClick={clearRecent}>
        전체 삭제
      </button>
      <button type="button" onClick={() => recordRecent('product-c')}>
        다시 보기
      </button>
    </div>
  );
}

function renderRecentCollection() {
  return render(
    <LocalCollectionsProvider>
      <RecentCollectionProbe />
    </LocalCollectionsProvider>,
  );
}

afterEach(() => {
  window.localStorage.clear();
});

describe('LocalCollectionsProvider recent products', () => {
  it('개별 삭제를 ID와 날짜 저장소에 함께 반영합니다', async () => {
    window.localStorage.setItem('eum.recent.v1', JSON.stringify(['product-a', 'product-b']));
    window.localStorage.setItem(
      'eum.recent-dates.v1',
      JSON.stringify({
        'product-a': '2026-10-01T10:00:00.000Z',
        'product-b': '2026-10-02T10:00:00.000Z',
      }),
    );
    renderRecentCollection();
    await screen.findByText('최근 product-a,product-b');

    await userEvent.click(screen.getByRole('button', { name: '하나 삭제' }));

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem('eum.recent.v1') ?? '[]')).toEqual([
        'product-b',
      ]);
      expect(JSON.parse(window.localStorage.getItem('eum.recent-dates.v1') ?? '{}')).toEqual({
        'product-b': '2026-10-02T10:00:00.000Z',
      });
    });
  });

  it('전체 삭제를 영속 저장하고 새 상품의 열람 일자를 저장합니다', async () => {
    window.localStorage.setItem('eum.recent.v1', JSON.stringify(['product-a']));
    renderRecentCollection();
    await screen.findByText('최근 product-a');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '전체 삭제' }));
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem('eum.recent.v1') ?? '[]')).toEqual([]);
      expect(JSON.parse(window.localStorage.getItem('eum.recent-dates.v1') ?? '{}')).toEqual({});
    });

    await user.click(screen.getByRole('button', { name: '다시 보기' }));
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem('eum.recent.v1') ?? '[]')).toEqual([
        'product-c',
      ]);
      const savedDates = JSON.parse(window.localStorage.getItem('eum.recent-dates.v1') ?? '{}');
      expect(savedDates['product-c']).toEqual(expect.any(String));
      expect(Number.isNaN(Date.parse(savedDates['product-c']))).toBe(false);
    });
  });
});
