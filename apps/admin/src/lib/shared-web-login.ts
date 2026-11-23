import { sanitizeRedirectPath } from '@eum/api/redirect';

function getAdminReturnPath(rawRedirect: unknown): string {
  const safeRedirect = sanitizeRedirectPath(rawRedirect, '/admin');
  const separatorIndex = safeRedirect.search(/[?#]/);
  const safePathname =
    (separatorIndex < 0 ? safeRedirect : safeRedirect.slice(0, separatorIndex)).replace(
      /\/+$/,
      '',
    ) || '/';

  if (safePathname === '/login' || safePathname === '/admin/login') return '/admin';
  if (safePathname === '/admin' || safePathname.startsWith('/admin/')) return safeRedirect;

  return safeRedirect === '/' ? '/admin' : `/admin${safeRedirect}`;
}

function getFallbackWebLoginBaseUrl(currentUrl: URL): URL | null {
  if (
    (currentUrl.hostname === 'localhost' || currentUrl.hostname === '127.0.0.1') &&
    currentUrl.port === '5173'
  ) {
    return new URL('http://localhost:3000/');
  }

  if (currentUrl.origin === 'null') return null;
  return new URL(`${currentUrl.origin}/`);
}

function isSameLoginRoute(firstUrl: URL, secondUrl: URL): boolean {
  const normalizePathname = (pathname: string) => pathname.replace(/\/+$/, '') || '/';
  return (
    firstUrl.origin === secondUrl.origin &&
    normalizePathname(firstUrl.pathname) === normalizePathname(secondUrl.pathname)
  );
}

export function getSharedWebLoginUrl(
  rawWebBaseUrl: string | undefined,
  rawRedirect: unknown,
  currentUrl: URL,
): string | null {
  const configuredWebBaseUrl = rawWebBaseUrl?.trim();
  let webBaseUrl: URL | null = null;

  if (configuredWebBaseUrl) {
    try {
      const parsedWebBaseUrl = new URL(configuredWebBaseUrl);
      if (
        (parsedWebBaseUrl.protocol === 'http:' || parsedWebBaseUrl.protocol === 'https:') &&
        !parsedWebBaseUrl.username &&
        !parsedWebBaseUrl.password
      ) {
        webBaseUrl = parsedWebBaseUrl;
      }
    } catch {
      // Invalid build configuration falls back to a known same-site or local development URL.
    }
  }

  webBaseUrl ??= getFallbackWebLoginBaseUrl(currentUrl);
  if (!webBaseUrl) return null;

  const webLoginUrl = new URL('/login', webBaseUrl.origin);
  webLoginUrl.searchParams.set('redirect', getAdminReturnPath(rawRedirect));
  if (isSameLoginRoute(webLoginUrl, currentUrl)) return null;

  return webLoginUrl.href;
}
