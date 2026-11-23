import { describe, expect, it } from 'vitest';
import { getSharedWebLoginUrl } from './shared-web-login';

describe('getSharedWebLoginUrl', () => {
  const adminUrl = new URL('https://admin.example.com/admin/login');

  it('sends a valid Admin deep link through the configured Web login', () => {
    const loginUrl = getSharedWebLoginUrl(
      'https://shop.example.com/store/',
      '/admin/orders?status=paid#latest',
      adminUrl,
    );

    expect(loginUrl).not.toBeNull();
    const parsedLoginUrl = new URL(loginUrl ?? '');
    expect(parsedLoginUrl.origin).toBe('https://shop.example.com');
    expect(parsedLoginUrl.pathname).toBe('/login');
    expect(parsedLoginUrl.searchParams.get('redirect')).toBe('/admin/orders?status=paid#latest');
  });

  it.each([undefined, 'invalid-url', 'javascript:alert(1)'])(
    'falls back to the current site when the Web URL config is missing or invalid (%s)',
    (webBaseUrl) => {
      expect(getSharedWebLoginUrl(webBaseUrl, '/admin/orders', adminUrl)).toBe(
        'https://admin.example.com/login?redirect=%2Fadmin%2Forders',
      );
    },
  );

  it('uses the Web development URL for a local Admin development server', () => {
    const localAdminUrl = new URL('http://localhost:5173/admin/login');

    expect(getSharedWebLoginUrl(undefined, '/admin/orders', localAdminUrl)).toBe(
      'http://localhost:3000/login?redirect=%2Fadmin%2Forders',
    );
  });

  it.each(['https://evil.example/path', '//evil.example/path', '/%2e%2e/evil'])(
    'rejects unsafe redirect %s and returns to the Admin root',
    (unsafeRedirect) => {
      const loginUrl = getSharedWebLoginUrl('https://shop.example.com', unsafeRedirect, adminUrl);

      expect(loginUrl).not.toBeNull();
      expect(new URL(loginUrl ?? '').searchParams.get('redirect')).toBe('/admin');
    },
  );

  it('adds the Admin prefix to a safe local path and preserves its query and hash', () => {
    const loginUrl = getSharedWebLoginUrl(
      'https://shop.example.com',
      '/orders?status=paid#latest',
      adminUrl,
    );

    expect(new URL(loginUrl ?? '').searchParams.get('redirect')).toBe(
      '/admin/orders?status=paid#latest',
    );
  });

  it('prevents redirecting to the same Web login route', () => {
    const webLoginUrl = new URL('https://shop.example.com/login');

    expect(
      getSharedWebLoginUrl('https://shop.example.com', '/admin/login', webLoginUrl),
    ).toBeNull();
  });

  it('returns to the Admin root when the requested destination is the Admin login route', () => {
    const loginUrl = getSharedWebLoginUrl(
      'https://shop.example.com',
      '/admin/login?redirect=%2Fadmin%2Forders',
      adminUrl,
    );

    expect(new URL(loginUrl ?? '').searchParams.get('redirect')).toBe('/admin');
  });

  it('does not construct a login URL for opaque origins without a valid config', () => {
    expect(getSharedWebLoginUrl(undefined, '/admin', new URL('file:///admin/login'))).toBeNull();
  });
});
