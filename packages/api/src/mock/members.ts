import type { AdminUser, Member } from '../types';

/**
 * 목 일반 회원 목록입니다. 비밀번호는 저장하지 않습니다(목 로그인은 계정 존재 여부만 확인).
 */
export const mockMembers: Member[] = [
  {
    id: 'mem-001',
    email: 'buyer@example.com',
    name: '김구매',
    phone: '010-0000-0001',
    joinedAt: '2026-03-02T09:00:00+09:00',
    pointBalance: 3200,
  },
  {
    id: 'mem-002',
    email: 'site-lead@example.com',
    name: '이현장',
    phone: '010-0000-0002',
    joinedAt: '2026-05-18T14:30:00+09:00',
    pointBalance: 0,
  },
  {
    id: 'mem-003',
    email: 'ttagno4230@gmail.com',
    name: '데모 회원',
    phone: '010-0000-0003',
    joinedAt: '2026-10-01T09:00:00+09:00',
    pointBalance: 0,
  },
];

/** 목 관리자 계정. 일반 회원과 완전히 분리된 목록입니다. */
export const mockAdminUsers: AdminUser[] = [
  { id: 'adm-001', loginId: 'admin', name: '관리자', role: 'owner' },
  { id: 'adm-002', loginId: 'manager', name: '운영 담당', role: 'manager' },
];
