'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

type MenuTriggerHandler = (trigger: HTMLButtonElement) => void;

interface SiteMenuContextValue {
  isMenuOpen: boolean;
  setIsMenuOpen: Dispatch<SetStateAction<boolean>>;
  registerMenuTriggerHandler: (handler: MenuTriggerHandler) => () => void;
  requestMenuToggle: (trigger: HTMLButtonElement) => void;
}

const SiteMenuContext = createContext<SiteMenuContextValue | null>(null);

export function SiteMenuProvider({ children }: { children: ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuTriggerHandlerRef = useRef<MenuTriggerHandler | null>(null);

  const registerMenuTriggerHandler = useCallback((handler: MenuTriggerHandler) => {
    menuTriggerHandlerRef.current = handler;
    return () => {
      if (menuTriggerHandlerRef.current === handler) menuTriggerHandlerRef.current = null;
    };
  }, []);
  const requestMenuToggle = useCallback((trigger: HTMLButtonElement) => {
    menuTriggerHandlerRef.current?.(trigger);
  }, []);

  return (
    <SiteMenuContext.Provider
      value={{ isMenuOpen, setIsMenuOpen, registerMenuTriggerHandler, requestMenuToggle }}
    >
      {children}
    </SiteMenuContext.Provider>
  );
}

export function useSiteMenu() {
  const context = useContext(SiteMenuContext);
  if (!context) throw new Error('useSiteMenu must be used within SiteMenuProvider');
  return context;
}
