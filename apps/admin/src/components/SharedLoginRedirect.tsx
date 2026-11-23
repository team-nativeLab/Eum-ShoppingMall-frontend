import { useEffect } from 'react';
import { getSharedWebLoginUrl } from '@/lib/shared-web-login';

interface SharedLoginRedirectProps {
  webBaseUrl?: string;
  currentUrl?: URL;
}

export function SharedLoginRedirect({ webBaseUrl, currentUrl }: SharedLoginRedirectProps) {
  const activeUrl = currentUrl ?? new URL(window.location.href);
  const redirectValues = new URLSearchParams(activeUrl.search).getAll('redirect');
  const rawRedirect = redirectValues.length === 1 ? redirectValues[0] : null;
  const webLoginUrl = getSharedWebLoginUrl(webBaseUrl, rawRedirect, activeUrl);

  useEffect(() => {
    if (webLoginUrl) window.location.replace(webLoginUrl);
  }, [webLoginUrl]);

  if (!webLoginUrl) {
    return (
      <main role="alert" className="mx-auto max-w-560 p-32 pt-120 text-center">
        <h1 className="text-h2">쇼핑몰 로그인으로 이동할 수 없습니다</h1>
        <p className="mt-12 text-body-m text-text-2">
          관리자 로그인은 쇼핑몰 로그인 화면을 사용합니다. VITE_WEB_BASE_URL 설정을 확인해 주세요.
        </p>
      </main>
    );
  }

  return <main className="p-32">쇼핑몰 로그인 화면으로 이동하고 있습니다.</main>;
}
