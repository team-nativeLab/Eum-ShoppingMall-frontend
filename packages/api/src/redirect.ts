// 경로 판정에 쓰는 임시 기준 origin. 실제 사이트 주소와 무관하며 "같은 origin인지"만 비교합니다.
const REDIRECT_BASE_ORIGIN = 'https://redirect-check.invalid';

/**
 * 로그인 후 이동할 ?redirect= 값을 같은 사이트 안의 경로로 제한하는 함수.
 * 반드시 URL 디코딩이 끝난 최종 값(예: URLSearchParams.get() 결과)에 적용합니다.
 * 디코딩 전 값에 적용하면 %2F%2F 같은 인코딩 우회를 놓칠 수 있습니다.
 * 배열이나 그 외 비문자열 입력은 안전하지 않은 값으로 보고 fallback을 돌려줍니다.
 *
 * 거절(→ fallback) 조건
 * - '/'로 시작하지 않는 값(https://…, javascript:… 등)
 * - 역슬래시가 어디든 들어간 값(브라우저가 '/'로 바꿔 해석할 수 있음)
 * - 제어 문자가 들어간 값
 * - '.' 또는 '..' 경로 세그먼트가 있는 값(%2e 인코딩 포함, 대소문자 무관)
 * - new URL로 해석했을 때 origin이 달라지는 값(//evil.com 등)
 * - 정규화 결과가 '//' 또는 '/\\'로 시작하는 값
 * 통과하면 정규화된 pathname + search + hash를 돌려줍니다.
 */
export function sanitizeRedirectPath(rawRedirect: unknown, fallbackPath = '/'): string {
  if (typeof rawRedirect !== 'string' || !rawRedirect || !rawRedirect.startsWith('/'))
    return fallbackPath;
  if (rawRedirect.includes('\\')) return fallbackPath;
  for (const character of rawRedirect) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint < 0x20 || codePoint === 0x7f) return fallbackPath;
  }
  const pathPart = rawRedirect.split(/[?#]/, 1)[0] ?? '';
  // URL 파서는 %2e(대소문자 무관)도 점으로 보고 점 세그먼트를 정규화하므로 인코딩된 형태도 함께 거절합니다.
  const hasDotSegment = pathPart.split('/').some((segment) => {
    const decodedDots = segment.replace(/%2e/gi, '.');
    return decodedDots === '.' || decodedDots === '..';
  });
  if (hasDotSegment) return fallbackPath;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawRedirect, REDIRECT_BASE_ORIGIN);
  } catch {
    return fallbackPath;
  }
  if (parsedUrl.origin !== REDIRECT_BASE_ORIGIN) return fallbackPath;
  const safePath = `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  // 정규화 결과가 프로토콜 상대 주소(//host, /\host)가 되면 브라우저가 외부로 이동하므로 마지막에 한 번 더 막습니다.
  if (safePath.startsWith('//') || safePath.startsWith('/\\')) return fallbackPath;
  return safePath;
}
