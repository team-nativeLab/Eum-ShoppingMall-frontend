import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import { createRealMemberAuth } from './auth';
import type { ApiConfig } from './config';

const config: ApiConfig = {
  mode: 'real',
  baseUrl: 'https://eum.https.gsmsv.site',
  mockLatencyMs: 0,
  mockScenario: 'normal',
  isProduction: false,
  isMockAllowedInProduction: false,
};

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function setBrowserStorage(): Storage {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  vi.stubGlobal('window', { localStorage, sessionStorage });
  return sessionStorage;
}

function envelope(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }));
}

function member(id: string) {
  return {
    id,
    email: `${id}@example.test`,
    name: id,
    phone: null,
    role: 'USER',
    hasPassword: true,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

afterEach(() => vi.unstubAllGlobals());

describe('createRealMemberAuth 세션 경합', () => {
  it('인증 요청에만 cookie credentials를 쓰고 보호 요청에만 Bearer를 보냅니다', async () => {
    setBrowserStorage();
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/auth/login')) return envelope({ accessToken: 'access', expiresIn: 900 });
      if (url.endsWith('/me')) return envelope(member('member'));
      if (url.endsWith('/auth/logout')) return new Response(null, { status: 204 });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const auth = createRealMemberAuth(config);
    await auth.login({ email: 'm@example.test', password: 'secret' }, { remember: true });
    await auth.logout();
    const requests = fetcher.mock.calls.map(([input, init]) => ({ url: String(input), init }));
    const login = requests.find(({ url }) => url.endsWith('/auth/login'))!.init;
    const me = requests.find(({ url }) => url.endsWith('/me'))!.init;
    const logout = requests.find(({ url }) => url.endsWith('/auth/logout'))!.init;
    expect(login?.method).toBe('POST');
    expect(login?.credentials).toBe('include');
    expect(new Headers(login?.headers).has('authorization')).toBe(false);
    expect(JSON.parse(String(login?.body))).toEqual({
      email: 'm@example.test',
      password: 'secret',
    });
    expect(me?.credentials).toBe('omit');
    expect(new Headers(me?.headers).get('authorization')).toBe('Bearer access');
    expect(logout?.method).toBe('POST');
    expect(logout?.credentials).toBe('include');
    expect(new Headers(logout?.headers).has('authorization')).toBe(false);
  });

  it.each([
    ['null login', 'login', null],
    ['malformed login', 'login', { accessToken: '', expiresIn: 900 }],
    ['null member', 'me', null],
    ['wrong role', 'me', { ...member('member'), role: 'ADMIN' }],
    ['unknown role', 'me', { ...member('member'), role: 'GUEST' }],
    ['missing role', 'me', (({ role: _role, ...withoutRole }) => withoutRole)(member('member'))],
  ])('rejects %s response', async (_name, operation, data) => {
    const sessionStorage = setBrowserStorage();
    if (operation === 'me') {
      sessionStorage.setItem('eum.member-auth.refresh-preference.v1', 'session');
    }
    const paths: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        paths.push(url);
        if (url.endsWith('/auth/refresh'))
          return envelope({ accessToken: 'refresh-token', expiresIn: 900 });
        if (url.endsWith('/auth/login') || url.endsWith('/me')) return envelope(data);
        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    const auth = createRealMemberAuth(config);
    const request =
      operation === 'login'
        ? auth.login({ email: 'm@example.test', password: 'secret' })
        : auth.getCurrentUser();
    await expect(request).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    if (operation === 'me') {
      expect(paths.map((url) => new URL(url).pathname)).toEqual([
        '/api/v1/auth/refresh',
        '/api/v1/me',
      ]);
    }
  });

  it.each([
    ['buyer role', 'USER'],
    ['nullable role', null],
  ])('%s is accepted without exposing role', async (_label, role) => {
    setBrowserStorage();
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/login')) {
        return envelope({ accessToken: 'access-token', expiresIn: 900 });
      }
      if (url.endsWith('/api/v1/me')) return envelope({ ...member('buyer'), role });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);

    const session = await createRealMemberAuth(config).login({
      email: 'buyer@example.test',
      password: 'secret',
    });

    expect(session).toEqual({
      id: 'buyer',
      email: 'buyer@example.test',
      name: 'buyer',
      phone: null,
    });
    expect(session).not.toHaveProperty('role');
  });

  it('refresh 401 clears preference and logout failure clears session state', async () => {
    const storage = setBrowserStorage();
    storage.setItem('eum.member-auth.refresh-preference.v1', 'session');
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(
        async () =>
          new Response(JSON.stringify({ success: false, code: 'UNAUTHORIZED' }), { status: 401 }),
      ),
    );
    await expect(createRealMemberAuth(config).getCurrentUser()).resolves.toBeNull();
    expect(storage.getItem('eum.member-auth.refresh-preference.v1')).toBeNull();
    const localStorage = (window as unknown as { localStorage: Storage }).localStorage;
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/auth/login')) return envelope({ accessToken: 'access', expiresIn: 900 });
      if (url.endsWith('/me')) return envelope(member('member'));
      throw new TypeError('network failure');
    });
    vi.stubGlobal('fetch', fetcher);
    const auth = createRealMemberAuth(config);
    await auth.login({ email: 'm@example.test', password: 'secret' }, { remember: true });
    await expect(auth.logout()).rejects.toBeInstanceOf(ApiError);
    await expect(auth.getCurrentUser()).resolves.toBeNull();
    expect(localStorage.getItem('eum.member-auth.refresh-preference.v1')).toBeNull();
    expect(storage.getItem('eum.member-auth.refresh-preference.v1')).toBeNull();
  });

  it('remember on enables persistent refresh while remember off stays in the session', async () => {
    const sessionStorage = setBrowserStorage();
    const localStorage = (window as unknown as { localStorage: Storage }).localStorage;
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/auth/login')) return envelope({ accessToken: 'access', expiresIn: 900 });
      if (url.endsWith('/me')) return envelope(member('member'));
      if (url.endsWith('/auth/refresh'))
        return envelope({ accessToken: 'refreshed', expiresIn: 900 });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    await createRealMemberAuth(config).login(
      { email: 'm@example.test', password: 'secret' },
      { remember: true },
    );
    expect(localStorage.getItem('eum.member-auth.refresh-preference.v1')).toBe('remember');
    const revisitFetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh'))
        return envelope({ accessToken: 'revisited', expiresIn: 900 });
      if (url.endsWith('/me')) return envelope(member('revisited'));
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', revisitFetcher);
    await expect(createRealMemberAuth(config).getCurrentUser()).resolves.toMatchObject({
      id: 'revisited',
    });
    expect(
      revisitFetcher.mock.calls.filter(([input]) => String(input).endsWith('/auth/refresh')),
    ).toHaveLength(1);

    const sessionFetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/auth/login'))
        return envelope({ accessToken: 'session-token', expiresIn: 900 });
      if (url.endsWith('/me')) return envelope(member('session-member'));
      if (url.endsWith('/auth/refresh'))
        return envelope({ accessToken: 'session-refresh', expiresIn: 900 });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', sessionFetcher);
    await createRealMemberAuth(config).login(
      { email: 's@example.test', password: 'secret' },
      { remember: false },
    );
    expect(localStorage.getItem('eum.member-auth.refresh-preference.v1')).toBeNull();
    expect(sessionStorage.getItem('eum.member-auth.refresh-preference.v1')).toBe('session');
    sessionStorage.removeItem('eum.member-auth.refresh-preference.v1');
    const freshClientFetcher = vi.fn<typeof fetch>(async () => {
      throw new Error('refresh must be gated by the cleared session preference');
    });
    vi.stubGlobal('fetch', freshClientFetcher);
    await expect(createRealMemberAuth(config).getCurrentUser()).resolves.toBeNull();
    expect(freshClientFetcher).not.toHaveBeenCalled();
  });

  it('Web Locks serializes cookie mutations across clients', async () => {
    setBrowserStorage();
    (window as unknown as { sessionStorage: Storage }).sessionStorage.setItem(
      'eum.member-auth.refresh-preference.v1',
      'session',
    );
    let tail: Promise<void> = Promise.resolve();
    const order: string[] = [];
    const lockNames: string[] = [];
    vi.stubGlobal('navigator', {
      locks: {
        request: async (_name: string, _options: unknown, callback: () => Promise<unknown>) => {
          lockNames.push(_name);
          const previous = tail;
          let release!: () => void;
          tail = new Promise<void>((resolve) => {
            release = resolve;
          });
          await previous;
          try {
            return await callback();
          } finally {
            release();
          }
        },
      },
    });
    let refreshCount = 0;
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/me')) return envelope(member('member'));
      if (url.endsWith('/auth/refresh')) {
        refreshCount += 1;
        order.push(`refresh-${refreshCount}:start`);
        await Promise.resolve();
        order.push(`refresh-${refreshCount}:end`);
        return envelope({ accessToken: `access-${refreshCount}`, expiresIn: 900 });
      }
      throw new Error(`Unexpected request: ${url} ${String(init?.method)}`);
    });
    vi.stubGlobal('fetch', fetcher);
    await Promise.all([
      createRealMemberAuth(config).getCurrentUser(),
      createRealMemberAuth(config).getCurrentUser(),
    ]);
    expect(order).toEqual(['refresh-1:start', 'refresh-1:end', 'refresh-2:start', 'refresh-2:end']);
    expect(lockNames).toEqual([
      'eum.member-auth.cookie-mutation',
      'eum.member-auth.cookie-mutation',
    ]);
    const refreshCalls = fetcher.mock.calls.filter(([input]) =>
      String(input).endsWith('/auth/refresh'),
    );
    expect(refreshCalls).toHaveLength(2);
    for (const [, init] of refreshCalls) expect(init?.credentials).toBe('include');
    const meCalls = fetcher.mock.calls.filter(([input]) => String(input).endsWith('/api/v1/me'));
    expect(meCalls).toHaveLength(2);
    for (const [, init] of meCalls) {
      expect(init?.credentials).toBe('omit');
      expect(new Headers(init?.headers).get('authorization')).toMatch(/^Bearer access-[12]$/);
    }
  });

  it('Web Locks 미지원 fallback은 한 클라이언트 안에서 mutation을 직렬화합니다', async () => {
    setBrowserStorage();
    vi.stubGlobal('navigator', {});
    const firstLogoutResponse = deferred<Response>();
    const order: string[] = [];
    let logoutCount = 0;
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/auth/logout')) {
        logoutCount += 1;
        order.push(`logout-${logoutCount}:start`);
        if (logoutCount === 1) await firstLogoutResponse.promise;
        order.push(`logout-${logoutCount}:end`);
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const auth = createRealMemberAuth(config);
    const firstLogout = auth.logout();
    const secondLogout = auth.logout();
    await Promise.resolve();
    expect(order).toEqual(['logout-1:start']);
    firstLogoutResponse.resolve(new Response(null, { status: 204 }));
    await Promise.all([firstLogout, secondLogout]);
    expect(order).toEqual(['logout-1:start', 'logout-1:end', 'logout-2:start', 'logout-2:end']);
    // navigator.locks가 없으면 다른 탭의 queue와는 공유되지 않습니다.
  });

  it('refresh 후 /me의 401은 한 번만 재시도합니다', async () => {
    setBrowserStorage();
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/auth/login')) return envelope({ accessToken: 'old', expiresIn: 900 });
      if (url.endsWith('/auth/refresh')) return envelope({ accessToken: 'new', expiresIn: 900 });
      if (url.endsWith('/me'))
        return new Response(JSON.stringify({ success: false, code: 'UNAUTHORIZED' }), {
          status: 401,
        });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    await expect(
      createRealMemberAuth(config).login({ email: 'm@example.test', password: 'secret' }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(
      fetcher.mock.calls.filter(([input]) => String(input).endsWith('/api/v1/me')),
    ).toHaveLength(2);
    expect(
      fetcher.mock.calls.filter(([input]) => String(input).endsWith('/api/v1/auth/refresh')),
    ).toHaveLength(1);
  });
  it('같은 세션의 동시 refresh 요청을 하나로 합칩니다', async () => {
    const sessionStorage = setBrowserStorage();
    sessionStorage.setItem('eum.member-auth.refresh-preference.v1', 'session');
    const refreshResponse = deferred<Response>();
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/refresh')) return refreshResponse.promise;
      if (url.endsWith('/api/v1/me')) return envelope(member('member-1'));
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const auth = createRealMemberAuth(config);

    const first = auth.getCurrentUser();
    const second = auth.getCurrentUser();
    await vi.waitFor(() => {
      expect(
        fetcher.mock.calls.filter(([input]) => String(input).endsWith('/api/v1/auth/refresh')),
      ).toHaveLength(1);
    });
    refreshResponse.resolve(envelope({ accessToken: 'fresh-token', expiresIn: 900 }));

    await expect(Promise.all([first, second])).resolves.toEqual([
      { id: 'member-1', email: 'member-1@example.test', name: 'member-1', phone: null },
      { id: 'member-1', email: 'member-1@example.test', name: 'member-1', phone: null },
    ]);
  });

  it('동일 만료 토큰의 동시 /me 401 요청은 refresh를 공유하고 모두 재시도합니다', async () => {
    setBrowserStorage();
    const refreshResponse = deferred<Response>();
    let memberRequestCount = 0;
    let refreshRequestCount = 0;
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/login')) {
        return envelope({ accessToken: 'expired-token', expiresIn: 900 });
      }
      if (url.endsWith('/api/v1/auth/refresh')) {
        refreshRequestCount += 1;
        return refreshResponse.promise;
      }
      if (url.endsWith('/api/v1/me')) {
        memberRequestCount += 1;
        const authorization = new Headers(init?.headers).get('authorization');
        if (authorization === 'Bearer expired-token' && memberRequestCount > 1) {
          return new Response(JSON.stringify({ success: false, code: 'TOKEN_EXPIRED' }), {
            status: 401,
          });
        }
        return envelope(member('current-member'));
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const auth = createRealMemberAuth(config);
    await auth.login({ email: 'member@example.test', password: 'secret' });

    const lookups = [auth.getCurrentUser(), auth.getCurrentUser()];
    await vi.waitFor(() => expect(refreshRequestCount).toBe(1));
    refreshResponse.resolve(envelope({ accessToken: 'fresh-token', expiresIn: 900 }));

    await expect(Promise.all(lookups)).resolves.toEqual([
      {
        id: 'current-member',
        email: 'current-member@example.test',
        name: 'current-member',
        phone: null,
      },
      {
        id: 'current-member',
        email: 'current-member@example.test',
        name: 'current-member',
        phone: null,
      },
    ]);
    expect(refreshRequestCount).toBe(1);
  });

  it('동시 /me 401에서 한 caller의 AbortSignal은 공유 refresh 대기만 취소합니다', async () => {
    setBrowserStorage();
    const refreshResponse = deferred<Response>();
    const firstController = new AbortController();
    const secondController = new AbortController();
    let memberRequestCount = 0;
    let staleMemberRequestCount = 0;
    let refreshRequestCount = 0;
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/login')) {
        return envelope({ accessToken: 'expired-token', expiresIn: 900 });
      }
      if (url.endsWith('/api/v1/auth/refresh')) {
        refreshRequestCount += 1;
        return refreshResponse.promise;
      }
      if (url.endsWith('/api/v1/me')) {
        memberRequestCount += 1;
        const authorization = new Headers(init?.headers).get('authorization');
        if (authorization === 'Bearer expired-token' && memberRequestCount > 1) {
          staleMemberRequestCount += 1;
          return new Response(JSON.stringify({ success: false, code: 'TOKEN_EXPIRED' }), {
            status: 401,
          });
        }
        if (authorization === 'Bearer expired-token') return envelope(member('current-member'));
        expect(authorization).toBe('Bearer fresh-token');
        return envelope(member('current-member'));
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const auth = createRealMemberAuth(config);
    await auth.login({ email: 'member@example.test', password: 'secret' });

    const firstLookup = auth.getCurrentUser({ signal: firstController.signal });
    const secondLookup = auth.getCurrentUser({ signal: secondController.signal });
    await vi.waitFor(() => {
      expect(staleMemberRequestCount).toBe(2);
      expect(refreshRequestCount).toBe(1);
    });

    const refreshCall = fetcher.mock.calls.find(([input]) =>
      String(input).endsWith('/api/v1/auth/refresh'),
    );
    expect(refreshCall?.[1]?.credentials).toBe('include');
    expect(refreshCall?.[1]?.signal).toBeUndefined();

    secondController.abort();
    await expect(secondLookup).rejects.toMatchObject({ name: 'AbortError' });
    refreshResponse.resolve(envelope({ accessToken: 'fresh-token', expiresIn: 900 }));

    await expect(firstLookup).resolves.toEqual({
      id: 'current-member',
      email: 'current-member@example.test',
      name: 'current-member',
      phone: null,
    });
    expect(refreshRequestCount).toBe(1);
    const memberCalls = fetcher.mock.calls.filter(([input]) =>
      String(input).endsWith('/api/v1/me'),
    );
    expect(memberCalls).toHaveLength(4);
    expect(memberCalls.map(([, init]) => new Headers(init?.headers).get('authorization'))).toEqual([
      'Bearer expired-token',
      'Bearer expired-token',
      'Bearer expired-token',
      'Bearer fresh-token',
    ]);
    expect(memberCalls[3]?.[1]?.credentials).toBe('omit');
  });

  it('logout 응답을 기다린 뒤 호출된 login을 실행하고 새 세션을 유지합니다', async () => {
    setBrowserStorage();
    const logoutResponse = deferred<Response>();
    const requestOrder: string[] = [];
    let loginRequestCount = 0;
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/login')) {
        loginRequestCount += 1;
        requestOrder.push('login');
        return envelope({
          accessToken: loginRequestCount === 1 ? 'old-token' : 'new-token',
          expiresIn: 900,
        });
      }
      if (url.endsWith('/api/v1/me')) {
        return envelope(member(loginRequestCount === 1 ? 'old-member' : 'new-member'));
      }
      if (url.endsWith('/api/v1/auth/logout')) {
        requestOrder.push('logout');
        return logoutResponse.promise;
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const auth = createRealMemberAuth(config);
    await auth.login({ email: 'old@example.test', password: 'secret' });

    const logout = auth.logout();
    await vi.waitFor(() => expect(requestOrder).toContain('logout'));
    const login = auth.login({ email: 'new@example.test', password: 'secret' });
    await Promise.resolve();
    expect(loginRequestCount).toBe(1);

    logoutResponse.resolve(new Response(null, { status: 204 }));
    await Promise.all([logout, login]);

    expect(requestOrder).toEqual(['login', 'logout', 'login']);
    await expect(auth.getCurrentUser()).resolves.toMatchObject({ id: 'new-member' });
  });

  it.each([
    ['success', envelope(member('stale-member'))],
    [
      '401',
      new Response(JSON.stringify({ success: false, code: 'UNAUTHORIZED' }), { status: 401 }),
    ],
  ])(
    '오래된 /me %s 응답은 새 로그인 세션에 영향을 주지 않습니다',
    async (_label, staleResponse) => {
      setBrowserStorage();
      const staleMe = deferred<Response>();
      let oldMeCallCount = 0;
      const fetcher = vi.fn<typeof fetch>(async (input, init) => {
        const url = String(input);
        if (url.endsWith('/api/v1/auth/login')) {
          const body = JSON.parse(String(init?.body)) as { email: string };
          const isOldLogin = body.email === 'old@example.test';
          return envelope({ accessToken: isOldLogin ? 'old-token' : 'new-token', expiresIn: 900 });
        }
        if (url.endsWith('/api/v1/me')) {
          const authorization = new Headers(init?.headers).get('authorization');
          if (authorization === 'Bearer old-token') {
            oldMeCallCount += 1;
            if (oldMeCallCount > 1) return staleMe.promise;
            return envelope(member('old-member'));
          }
          return envelope(member('new-member'));
        }
        throw new Error(`Unexpected request: ${url}`);
      });
      vi.stubGlobal('fetch', fetcher);
      const auth = createRealMemberAuth(config);
      await auth.login({ email: 'old@example.test', password: 'secret' });

      const oldLookup = auth.getCurrentUser();
      await vi.waitFor(() => expect(oldMeCallCount).toBe(2));
      await auth.login({ email: 'new@example.test', password: 'secret' });
      staleMe.resolve(staleResponse);

      await expect(oldLookup).resolves.toBeNull();
      await expect(auth.getCurrentUser()).resolves.toMatchObject({ id: 'new-member' });
      expect(
        fetcher.mock.calls.filter(([input]) => String(input).endsWith('/api/v1/auth/refresh')),
      ).toHaveLength(0);
    },
  );

  it('한 caller의 AbortSignal은 공유 refresh를 취소하지 않습니다', async () => {
    const sessionStorage = setBrowserStorage();
    sessionStorage.setItem('eum.member-auth.refresh-preference.v1', 'session');
    const refreshResponse = deferred<Response>();
    const firstController = new AbortController();
    const secondController = new AbortController();
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/refresh')) return refreshResponse.promise;
      if (url.endsWith('/api/v1/me')) return envelope(member('shared-refresh-member'));
      throw new Error(`Unexpected request: ${url} ${String(init?.method)}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const auth = createRealMemberAuth(config);

    const firstLookup = auth.getCurrentUser({ signal: firstController.signal });
    const secondLookup = auth.getCurrentUser({ signal: secondController.signal });
    await vi.waitFor(() => {
      expect(
        fetcher.mock.calls.filter(([input]) => String(input).endsWith('/api/v1/auth/refresh')),
      ).toHaveLength(1);
    });

    const refreshCall = fetcher.mock.calls.find(([input]) =>
      String(input).endsWith('/api/v1/auth/refresh'),
    );
    expect(refreshCall?.[1]?.credentials).toBe('include');
    expect(refreshCall?.[1]?.signal).toBeUndefined();

    firstController.abort();
    await expect(firstLookup).rejects.toMatchObject({ name: 'AbortError' });
    refreshResponse.resolve(envelope({ accessToken: 'shared-access', expiresIn: 900 }));

    await expect(secondLookup).resolves.toEqual({
      id: 'shared-refresh-member',
      email: 'shared-refresh-member@example.test',
      name: 'shared-refresh-member',
      phone: null,
    });
    const memberCalls = fetcher.mock.calls.filter(([input]) =>
      String(input).endsWith('/api/v1/me'),
    );
    expect(memberCalls).toHaveLength(1);
    expect(memberCalls[0]?.[1]?.credentials).toBe('omit');
    expect(new Headers(memberCalls[0]?.[1]?.headers).get('authorization')).toBe(
      'Bearer shared-access',
    );
  });

  it('remember 해제 중 localStorage 삭제가 실패하면 새 클라이언트에서 refresh를 차단합니다', async () => {
    const sessionStorage = setBrowserStorage();
    const localStorage = (window as unknown as { localStorage: Storage }).localStorage;
    localStorage.setItem('eum.member-auth.refresh-preference.v1', 'remember');
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError');
    });
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/login'))
        return envelope({ accessToken: 'login-access', expiresIn: 900 });
      if (url.endsWith('/api/v1/me')) return envelope(member('session-member'));
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);

    await createRealMemberAuth(config).login(
      { email: 'member@example.test', password: 'secret' },
      { remember: false },
    );

    expect(localStorage.getItem('eum.member-auth.refresh-preference.v1')).toBe('session');
    expect(sessionStorage.getItem('eum.member-auth.refresh-preference.v1')).toBe('session');
    sessionStorage.removeItem('eum.member-auth.refresh-preference.v1');
    fetcher.mockClear();

    await expect(createRealMemberAuth(config).getCurrentUser()).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
