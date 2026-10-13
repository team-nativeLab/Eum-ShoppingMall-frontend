'use client';

import type { Member } from '@eum/api/types';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getMemberAuth } from '@/lib/member-auth';

type MemberSessionStatus = 'loading' | 'ready' | 'error';

interface MemberSessionValue {
  member: Member | null;
  status: MemberSessionStatus;
  refreshMember: () => Promise<Member | null>;
  setMember: (member: Member | null) => void;
  clearMember: () => Promise<void>;
}

const MemberSessionContext = createContext<MemberSessionValue | null>(null);

/** 회원 목 세션은 userId만 저장하고, 프로필은 앱이 열린 동안 메모리에서만 유지합니다. */
export function MemberSessionProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);
  const [status, setStatus] = useState<MemberSessionStatus>('loading');
  const setSessionMember = useCallback((nextMember: Member | null) => {
    setMember(nextMember);
    setStatus('ready');
  }, []);

  const refreshMember = useCallback(async () => {
    setStatus('loading');
    try {
      const currentMember = await (await getMemberAuth()).getCurrentUser();
      setMember(currentMember);
      setStatus('ready');
      return currentMember;
    } catch {
      setMember(null);
      setStatus('error');
      return null;
    }
  }, []);

  const clearMember = useCallback(async () => {
    await (await getMemberAuth()).logout();
    setMember(null);
    setStatus('ready');
  }, []);

  useEffect(() => {
    let isMounted = true;
    void getMemberAuth()
      .then((memberAuth) => memberAuth.getCurrentUser())
      .then((currentMember) => {
        if (!isMounted) return;
        setMember(currentMember);
        setStatus('ready');
      })
      .catch(() => {
        if (!isMounted) return;
        setMember(null);
        setStatus('error');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({ member, status, refreshMember, setMember: setSessionMember, clearMember }),
    [member, status, refreshMember, setSessionMember, clearMember],
  );

  return <MemberSessionContext value={value}>{children}</MemberSessionContext>;
}

export function useMemberSession(): MemberSessionValue {
  const value = use(MemberSessionContext);
  if (!value) throw new Error('useMemberSession은 MemberSessionProvider 안에서만 씁니다.');
  return value;
}
