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
  toggleWishlist: (productId: string) => void;
  recordRecent: (productId: string) => void;
}

interface LocalCollectionsState {
  wishlistIds: string[];
  recentIds: string[];
  hasRestored: boolean;
}

type LocalCollectionsAction =
  | { type: 'restore'; wishlistIds: string[]; recentIds: string[] }
  | { type: 'toggleWishlist'; productId: string }
  | { type: 'recordRecent'; productId: string };

const INITIAL_STATE: LocalCollectionsState = {
  wishlistIds: [],
  recentIds: [],
  hasRestored: false,
};

const LocalCollectionsContext = createContext<LocalCollectionsValue | null>(null);

function collectionsReducer(
  state: LocalCollectionsState,
  action: LocalCollectionsAction,
): LocalCollectionsState {
  if (action.type === 'restore') {
    return { wishlistIds: action.wishlistIds, recentIds: action.recentIds, hasRestored: true };
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
  if (state.recentIds[0] === action.productId) return state;
  return {
    ...state,
    recentIds: [
      action.productId,
      ...state.recentIds.filter((productId) => productId !== action.productId),
    ].slice(0, RECENT_LIMIT),
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

/** 목 인증 단계에서 찜·최근 본 상품 ID만 브라우저에 보관합니다. */
export function LocalCollectionsProvider({ children }: { children: ReactNode }) {
  const [collectionState, dispatch] = useReducer(collectionsReducer, INITIAL_STATE);
  const { wishlistIds, recentIds, hasRestored } = collectionState;

  useEffect(() => {
    dispatch({
      type: 'restore',
      wishlistIds: readIds(WISHLIST_STORAGE_KEY),
      recentIds: readIds(RECENT_STORAGE_KEY),
    });
  }, []);

  useEffect(() => {
    if (!hasRestored) return;
    try {
      window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistIds));
      window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recentIds));
    } catch {
      // 비활성화된 저장소에서도 상품 탐색은 계속할 수 있습니다.
    }
  }, [hasRestored, recentIds, wishlistIds]);

  const toggleWishlist = useCallback((productId: string) => {
    dispatch({ type: 'toggleWishlist', productId });
  }, []);

  const recordRecent = useCallback((productId: string) => {
    dispatch({ type: 'recordRecent', productId });
  }, []);

  const value = useMemo<LocalCollectionsValue>(
    () => ({
      wishlistIds,
      recentIds,
      toggleWishlist,
      recordRecent,
    }),
    [recentIds, recordRecent, toggleWishlist, wishlistIds],
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
