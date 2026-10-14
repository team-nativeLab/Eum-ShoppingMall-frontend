import { afterEach, describe, expect, it } from 'vitest';
import {
  createAdminRequestScope,
  ensureAdminSessionActive,
  endAdminSession,
  startAdminSession,
} from './admin-request-lifecycle';

describe('admin request lifecycle', () => {
  afterEach(() => {
    startAdminSession();
  });

  it('invalidates and aborts active requests when the administrator session changes', () => {
    const requestScope = createAdminRequestScope();

    expect(requestScope.isCurrent()).toBe(true);
    expect(requestScope.signal.aborted).toBe(false);

    endAdminSession();

    expect(requestScope.signal.aborted).toBe(true);
    expect(requestScope.isCurrent()).toBe(false);
  });

  it('does not allow new requests while logout is in progress', () => {
    endAdminSession();

    const requestScope = createAdminRequestScope();

    expect(requestScope.signal.aborted).toBe(true);
    expect(requestScope.isCurrent()).toBe(false);
  });

  it('restores request eligibility when current-user validation confirms an active session', () => {
    endAdminSession();

    ensureAdminSessionActive();
    const requestScope = createAdminRequestScope();

    expect(requestScope.signal.aborted).toBe(false);
    expect(requestScope.isCurrent()).toBe(true);
  });

  it('cancels a single request scope without changing the session generation', () => {
    const requestScope = createAdminRequestScope();

    requestScope.cancel();

    expect(requestScope.signal.aborted).toBe(true);
    expect(requestScope.isCurrent()).toBe(false);
  });

  it('keeps a completed scope current until its session boundary changes', () => {
    const requestScope = createAdminRequestScope();

    requestScope.dispose();

    expect(requestScope.signal.aborted).toBe(false);
    expect(requestScope.isCurrent()).toBe(true);
  });
});
