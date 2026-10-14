'use client';

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';

const WISHLIST_STORAGE_KEY = 'eum.wishlist.v1';
const RECENT_STORAGE_KEY = 'eum.recent.v1';
const RECENT_LIMIT = 20;

interface LocalCollectionsValue {
  wishlistIds: string[];
  recentIds: string[];
  recentViewedAt: Record<string, string>;
  toggleWishlist: (productId: string) => void;
  recordRecent: (productId: string) => void;
  removeRecent: (productId: string) => void;
  clearRecent: () => void;
}

interface LocalCollectionsState {
  wishlistIds: string[];
  recentIds: string[];
  recentViewedAt: Record<string, string>;
  hasRestored: boolean;
}

type LocalCollectionsAction =
  | {
      type: 'restore';
      wishlistIds: string[];
      recentIds: string[];
      recentViewedAt: Record<string, string>;
    }
  | { type: 'toggleWishlist'; productId: string }
  | { type: 'recordRecent'; productId: string; viewedAt: string }
  | { type: 'removeRecent'; productId: string }
  | { type: 'clearRecent' };

const INITIAL_STATE: LocalCollectionsState = {
  wishlistIds: [],
  recentIds: [],
  recentViewedAt: {},
  hasRestored: false,
};

const LocalCollectionsContext = createContext<LocalCollectionsValue | null>(null);

function collectionsReducer(
  state: LocalCollectionsState,
  action: LocalCollectionsAction,
): LocalCollectionsState {
  if (action.type === 'restore') {
    return {
      wishlistIds: action.wishlistIds,
      recentIds: action.recentIds,
      recentViewedAt: action.recentViewedAt,
      hasRestored: true,
    };
  }
  if (action.type === 'toggleWishlist') {
    const isWishlisted = state.wishlistIds.includes(action.productId);
    return {
      ...state,
      wishlistIds: isWishlisted
        ? state.wishlistIds.filter((productId) => productId !== action.productId)
        : [...state.wishlistIds, action.productId],
    };
  }
  if (action.type === 'removeRecent') {
    const recentViewedAt = Object.fromEntries(
      Object.entries(state.recentViewedAt).filter(([productId]) => productId !== action.productId),
    );
    return {
      ...state,
      recentIds: state.recentIds.filter((productId) => productId !== action.productId),
      recentViewedAt,
    };
  }
  if (action.type === 'clearRecent') return { ...state, recentIds: [], recentViewedAt: {} };
  const nextRecentIds = [
    action.productId,
    ...state.recentIds.filter((productId) => productId !== action.productId),
  ].slice(0, RECENT_LIMIT);
  const nextViewedAt = { ...state.recentViewedAt, [action.productId]: action.viewedAt };
  const recentViewedAt = Object.fromEntries(
    nextRecentIds.flatMap((productId) =>
      nextViewedAt[productId] ? [[productId, nextViewedAt[productId]]] : [],
    ),
  );
  if (state.recentIds[0] === action.productId) return { ...state, recentViewedAt };
  return {
    ...state,
    recentIds: nextRecentIds,
    recentViewedAt,
  };
}

// JSON 저장값을 안전하게 상품 ID 목록으로 바꿉니다.
function readIds(storageKey: string): string[] {
  try {
    const storedValue: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(storedValue)
      ? storedValue.filter((entry): entry is string => typeof entry === 'string')
      : [];
  } catch {
    return [];
  }
}

function readViewedAt(): Record<string, string> {
  try {
    const storedValue: unknown = JSON.parse(
      window.localStorage.getItem('eum.recent-dates.v1') ?? '{}',
    );
    if (!storedValue || typeof storedValue !== 'object' || Array.isArray(storedValue)) return {};
    return Object.fromEntries(
      Object.entries(storedValue).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
  } catch {
    return {};
  }
}

/** 목 인증 단계에서 찜·최근 본 상품 ID만 브라우저에 보관합니다. */
export function LocalCollectionsProvider({ children }: { children: ReactNode }) {
  const [collectionState, dispatch] = useReducer(collectionsReducer, INITIAL_STATE);
  const { wishlistIds, recentIds, recentViewedAt, hasRestored } = collectionState;

  useEffect(() => {
    dispatch({
      type: 'restore',
      wishlistIds: readIds(WISHLIST_STORAGE_KEY),
      recentIds: readIds(RECENT_STORAGE_KEY),
      recentViewedAt: readViewedAt(),
    });
  }, []);

  useEffect(() => {
    if (!hasRestored) return;
    try {
      window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistIds));
      window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recentIds));
      window.localStorage.setItem('eum.recent-dates.v1', JSON.stringify(recentViewedAt));
    } catch {
      // 비활성화된 저장소에서도 상품 탐색은 계속할 수 있습니다.
    }
  }, [hasRestored, recentIds, recentViewedAt, wishlistIds]);

  const toggleWishlist = useCallback((productId: string) => {
    dispatch({ type: 'toggleWishlist', productId });
  }, []);

  const recordRecent = useCallback((productId: string) => {
    dispatch({ type: 'recordRecent', productId, viewedAt: new Date().toISOString() });
  }, []);

  const removeRecent = useCallback((productId: string) => {
    dispatch({ type: 'removeRecent', productId });
  }, []);

  const clearRecent = useCallback(() => {
    dispatch({ type: 'clearRecent' });
  }, []);

  const value = useMemo<LocalCollectionsValue>(
    () => ({
      wishlistIds,
      recentIds,
      recentViewedAt,
      toggleWishlist,
      recordRecent,
      removeRecent,
      clearRecent,
    }),
    [
      clearRecent,
      recentIds,
      recentViewedAt,
      recordRecent,
      removeRecent,
      toggleWishlist,
      wishlistIds,
    ],
  );

  return <LocalCollectionsContext value={value}>{children}</LocalCollectionsContext>;
}

/** 브라우저 저장소 기반 찜·최근 본 상품 상태를 가져옵니다. */
export function useLocalCollections(): LocalCollectionsValue {
  const contextValue = use(LocalCollectionsContext);
  if (!contextValue) {
    throw new Error('useLocalCollections는 LocalCollectionsProvider 안에서만 쓸 수 있습니다.');
  }
  return contextValue;
}
