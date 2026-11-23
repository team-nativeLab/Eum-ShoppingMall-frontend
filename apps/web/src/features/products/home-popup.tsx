'use client';

import { queryKeys } from '@eum/api/query-keys';
import { Button } from '@eum/ui/components/Button';
import { Modal } from '@eum/ui/components/Modal';
import { useQuery } from '@tanstack/react-query';
import { useState, useSyncExternalStore } from 'react';
import { getShopApi } from '@/lib/shop-api';

const HIDDEN_POPUP_SESSION_KEY = 'eum-home-popup-hidden';
const POPUP_VISIBILITY_EVENT = 'eum-home-popup-visibility-change';

function subscribeToPopupVisibility(onChange: () => void): () => void {
  window.addEventListener(POPUP_VISIBILITY_EVENT, onChange);
  return () => window.removeEventListener(POPUP_VISIBILITY_EVENT, onChange);
}

function getPopupHiddenSnapshot(): boolean {
  try {
    return window.sessionStorage.getItem(HIDDEN_POPUP_SESSION_KEY) === 'hidden';
  } catch {
    return false;
  }
}

function getPopupHiddenServerSnapshot(): boolean {
  return true;
}

/** X는 현재 화면만 닫고, 다시 보지 않기는 현재 탭 세션 동안 숨깁니다. */
export function HomePopup() {
  const [isHiddenForCurrentDisplay, setIsHiddenForCurrentDisplay] = useState(false);
  const popupQuery = useQuery({
    queryKey: queryKeys.popups.all,
    queryFn: async ({ signal }) => (await getShopApi()).popups.list({ signal }),
  });
  const isHiddenForVisit = useSyncExternalStore(
    subscribeToPopupVisibility,
    getPopupHiddenSnapshot,
    getPopupHiddenServerSnapshot,
  );
  const popup = popupQuery.data?.[0];

  const handleCloseForNow = () => setIsHiddenForCurrentDisplay(true);

  const handleDoNotShowAgain = () => {
    try {
      window.sessionStorage.setItem(HIDDEN_POPUP_SESSION_KEY, 'hidden');
      window.dispatchEvent(new Event(POPUP_VISIBILITY_EVENT));
    } catch {
      setIsHiddenForCurrentDisplay(true);
    }
  };

  if (!popup) return null;

  return (
    <Modal
      isOpen={!isHiddenForVisit && !isHiddenForCurrentDisplay}
      onClose={handleCloseForNow}
      title={popup.title}
      showCloseButton
      className="max-h-[calc(100dvh-32px)] max-w-864 overflow-y-auto"
      actions={
        <Button variant="secondary" onClick={handleDoNotShowAgain}>
          다시 보지 않기
        </Button>
      }
    >
      {popup.imageUrl ? (
        // API accepts only validated image URL schemes; data URLs cannot use the Next image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={popup.imageUrl}
          alt={popup.title}
          className="mt-16 aspect-16/9 w-full rounded-8 object-cover"
        />
      ) : null}
      <p className="mt-16 text-body-m whitespace-pre-wrap text-text-2">{popup.body}</p>
    </Modal>
  );
}
